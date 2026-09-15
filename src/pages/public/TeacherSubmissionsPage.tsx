import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PageLoader, EmptyState } from '@/components/ui/EmptyState'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import { fetchSubmissionsByTeacher } from '@/lib/supabase/queries'
import type { TermcatSubmission, GradeLevel } from '@/types'
import { format } from 'date-fns'
import {
  User, GraduationCap, BookOpen, Printer, Eye, X, ArrowLeft, Building2, Calendar, FileText, Sparkles
} from 'lucide-react'

interface GradeGroup {
  gradeLevel: GradeLevel | null
  gradeName: string
  gradeNumber: number
  submissions: TermcatSubmission[]
}

export function TeacherSubmissionsPage() {
  const [searchParams] = useSearchParams()
  const teacherName = searchParams.get('name') || searchParams.get('teacher') || ''

  const [submissions, setSubmissions] = useState<TermcatSubmission[]>([])
  const [loading, setLoading] = useState(true)

  // Modal for Viewing / Printing an individual submission form
  const [selectedSub, setSelectedSub] = useState<TermcatSubmission | null>(null)

  useEffect(() => {
    if (!teacherName) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchSubmissionsByTeacher(teacherName)
      .then(setSubmissions)
      .finally(() => setLoading(false))
  }, [teacherName])

  // Group submissions by Grade Level
  const gradeGroups = useMemo<GradeGroup[]>(() => {
    const map = new Map<string, GradeGroup>()

    submissions.forEach(sub => {
      const gId = sub.grade_level_id || 'unknown'
      const gName = sub.grade_level?.name || 'Unassigned Grade'
      const gNum = sub.grade_level?.grade_number || 99

      if (!map.has(gId)) {
        map.set(gId, {
          gradeLevel: sub.grade_level || null,
          gradeName: gName,
          gradeNumber: gNum,
          submissions: [],
        })
      }
      map.get(gId)!.submissions.push(sub)
    })

    return Array.from(map.values()).sort((a, b) => a.gradeNumber - b.gradeNumber)
  }, [submissions])

  const schoolName = submissions[0]?.school?.name || ''

  if (loading) {
    return (
      <PublicLayout>
        <div className="w-full max-w-5xl mx-auto px-4 py-12">
          <PageLoader />
        </div>
      </PublicLayout>
    )
  }

  if (!teacherName || submissions.length === 0) {
    return (
      <PublicLayout>
        <div className="w-full max-w-4xl mx-auto px-4 py-12 space-y-4">
          <Link to="/" className="btn-sm btn-secondary inline-flex items-center gap-1.5 no-print">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="card p-8">
            <EmptyState
              title="No submissions found"
              description={teacherName ? `No submitted evaluation records found for teacher "${teacherName}".` : 'No teacher specified in the link.'}
              icon={<User size={32} />}
            />
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between gap-4 flex-wrap no-print">
          <Link to="/" className="btn-sm btn-secondary inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Home
          </Link>

          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            🔒 Public Teacher Submission Record (Read-Only View)
          </span>
        </div>

        {/* Teacher Profile Card */}
        <div className="card p-6 bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 text-white shadow-lg space-y-4 no-print">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30">
                <Sparkles size={12} className="text-amber-400" /> Public Evaluation History
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <User size={26} className="text-blue-400" />
                {teacherName}
              </h1>
              {schoolName && (
                <p className="text-sm text-slate-300 flex items-center gap-1.5">
                  <Building2 size={15} className="text-slate-400" />
                  <span>{schoolName}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Total Submissions</p>
                <p className="text-xl font-extrabold text-white">{submissions.length}</p>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-300">Grades Evaluated</p>
                <p className="text-xl font-extrabold text-blue-300">{gradeGroups.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Submissions per Grade Level */}
        <div className="space-y-8 no-print">
          {gradeGroups.map(group => (
            <div key={group.gradeName} className="space-y-3">
              {/* Grade Level Header */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                    <GraduationCap size={18} />
                  </span>
                  <span>{group.gradeName}</span>
                </h2>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                  {group.submissions.length} {group.submissions.length === 1 ? 'Subject Form' : 'Subject Forms'}
                </span>
              </div>

              {/* Submissions Table / Cards */}
              <div className="card overflow-hidden bg-white">
                <div className="hidden sm:block">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Learning Area</th>
                        <th>School Year</th>
                        <th>Quarter</th>
                        <th>Date Submitted</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="font-semibold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <BookOpen size={14} className="text-blue-500 flex-shrink-0" />
                              <span>{sub.learning_area?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="text-slate-700 text-xs font-medium">
                            {sub.school_year?.name || '—'}
                          </td>
                          <td className="text-slate-700 text-xs font-medium">
                            {sub.term?.name || '—'}
                          </td>
                          <td className="text-slate-500 text-xs">
                            {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedSub(sub)}
                                className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 inline-flex items-center gap-1 transition-colors"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSub(sub)
                                  setTimeout(() => window.print(), 200)
                                }}
                                className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 inline-flex items-center gap-1 transition-colors"
                              >
                                <Printer size={13} /> Print
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {group.submissions.map(sub => (
                    <div key={sub.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{sub.learning_area?.name}</p>
                          <p className="text-xs text-slate-500">{sub.term?.name} · {sub.school_year?.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setSelectedSub(sub)}
                          className="btn-xs btn-secondary inline-flex items-center gap-1"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub)
                            setTimeout(() => window.print(), 200)
                          }}
                          className="btn-xs btn-primary inline-flex items-center gap-1"
                        >
                          <Printer size={12} /> Print
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View / Print Official Template Modal */}
        {selectedSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-fade-in print:static print:inset-auto print:p-0 print:m-0 print:bg-transparent print:overflow-visible print:block">
            <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 border border-slate-200 print:static print:w-full print:max-w-none print:m-0 print:p-0 print:shadow-none print:border-none print:bg-transparent print:overflow-visible">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
                <div className="flex items-center gap-2">
                  <FileText size={20} className="text-blue-400" />
                  <div>
                    <h3 className="font-bold text-base">Official Submitted Form View</h3>
                    <p className="text-xs text-slate-400 font-mono">Ref: {selectedSub.reference_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-sm btn-primary inline-flex items-center gap-1.5"
                  >
                    <Printer size={14} /> Print Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSub(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[80vh] print:p-0 print:overflow-visible print:max-h-none print:h-auto">
                <OfficialTermcatTemplate submission={selectedSub} showPrintButton={false} />
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
