import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { PageLoader, EmptyState } from '@/components/ui/EmptyState'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import { fetchSubmissionsByTeacher } from '@/lib/supabase/queries'
import type { TermcatSubmission, GradeLevel } from '@/types'
import { format } from 'date-fns'
import {
  User, GraduationCap, BookOpen, Printer, Eye, X, ArrowLeft, Building2, Calendar, FileText, Sparkles, CheckCircle2, Layers, Download, Loader2
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

  // Modal for Viewing / Printing an individual submission form or entire grade consolidation
  const [selectedSub, setSelectedSub] = useState<TermcatSubmission | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<GradeGroup | null>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

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
        <div className="w-full px-4 sm:px-8 py-12">
          <PageLoader />
        </div>
      </PublicLayout>
    )
  }

  if (!teacherName || submissions.length === 0) {
    return (
      <PublicLayout>
        <div className="w-full px-4 sm:px-8 py-12 space-y-4">
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#795CEE] shadow-xs hover:bg-[#F6EFFF] transition-all no-print">
            <ArrowLeft size={15} /> Back to Portal Home
          </Link>
          <div className="clay-card p-8 sm:p-12 text-center">
            <EmptyState
              title="No submissions found"
              description={teacherName ? `No submitted evaluation records found for teacher "${teacherName}".` : 'No teacher specified in the link.'}
              icon={<User size={32} className="text-[#8B72F4]" />}
            />
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="w-full px-4 sm:px-8 py-6 sm:py-8 space-y-6 animate-fade-in">
        {/* Header Navigation */}
        <div className="flex items-center justify-between gap-3 flex-wrap no-print">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-white text-xs font-black text-[#795CEE] shadow-xs hover:bg-[#F6EFFF] hover:shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Back to Portal Home</span>
          </Link>

          <span className="text-xs font-extrabold text-[#795CEE] bg-[#F6EFFF] px-3.5 py-1.5 rounded-full border border-[#8B72F4]/20 shadow-2xs">
            🔒 Public Teacher Submission Record (Read-Only)
          </span>
        </div>

        {/* Soft Pastel Claymorphic Teacher Profile Card */}
        <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white rounded-[36px] p-6 sm:p-9 shadow-[0_20px_40px_rgba(139,114,244,0.28)] border-4 border-white relative overflow-hidden no-print">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold backdrop-blur-md shadow-xs">
                <Sparkles size={14} className="text-amber-300" /> DepEd Concepcion District Evaluation Archive
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display flex items-center gap-2.5">
                <User size={28} className="text-purple-200 shrink-0" />
                <span className="truncate">{teacherName}</span>
              </h1>
              {schoolName && (
                <p className="text-xs sm:text-sm text-purple-100 flex items-center gap-2 font-medium">
                  <Building2 size={16} className="text-purple-200 shrink-0" />
                  <span>{schoolName}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
              <div className="px-5 py-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-center shadow-xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-100">Total Submissions</p>
                <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{submissions.length}</p>
              </div>
              <div className="px-5 py-3 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 text-center shadow-xs">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-purple-100">Grades Evaluated</p>
                <p className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">{gradeGroups.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Submissions per Grade Level */}
        <div className="space-y-8 no-print">
          {gradeGroups.map(group => (
            <div key={group.gradeName} className="clay-card p-6 sm:p-7 space-y-4">
              {/* Grade Level Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-4">
                <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white flex items-center justify-center font-black text-sm border border-white shadow-md shrink-0">
                    <GraduationCap size={22} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#2D2638] font-display">{group.gradeName}</h2>
                    <span className="text-[10px] font-extrabold text-[#8B72F4] bg-[#F6EFFF] px-2.5 py-0.5 rounded-full border border-[#8B72F4]/20 inline-block mt-0.5">
                      {group.submissions.length} {group.submissions.length === 1 ? 'Subject Form' : 'Subject Forms'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group)
                      setSelectedSub(null)
                    }}
                    className="px-4 py-2.5 text-xs font-bold rounded-2xl bg-gradient-to-r from-[#8B72F4] to-[#A88BEB] text-white shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                    title={`Consolidate and view all ${group.gradeName} subject forms`}
                  >
                    <Eye size={15} />
                    <span>View Grade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroup(group)
                      setSelectedSub(null)
                      setTimeout(() => window.print(), 200)
                    }}
                    className="px-4 py-2.5 text-xs font-bold rounded-2xl bg-white border border-purple-100 text-[#7A7289] hover:text-[#2D2638] hover:bg-purple-50 shadow-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                    title={`Print consolidated ${group.gradeName} evaluation report`}
                  >
                    <Printer size={15} />
                    <span>Print Grade</span>
                  </button>
                </div>
              </div>

              {/* Submissions Table / Cards */}
              <div className="rounded-2xl border border-purple-100 overflow-hidden bg-white shadow-2xs">
                {/* Desktop Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FAF5F0] border-b border-purple-100 text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider">
                        <th className="py-3.5 px-5">Learning Area</th>
                        <th className="py-3.5 px-5">School Year</th>
                        <th className="py-3.5 px-5">Quarter Term</th>
                        <th className="py-3.5 px-5">Date Submitted</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      {group.submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-purple-50/50 transition-colors text-xs">
                          <td className="py-3.5 px-5 font-bold text-[#2D2638]">
                            <div className="flex items-center gap-2">
                              <BookOpen size={15} className="text-[#8B72F4] shrink-0" />
                              <span>{sub.learning_area?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-[#7A7289] font-semibold">
                            {sub.school_year?.name || '—'}
                          </td>
                          <td className="py-3.5 px-5 text-[#7A7289] font-semibold">
                            {sub.term?.name || '—'}
                          </td>
                          <td className="py-3.5 px-5 text-[#7A7289] font-mono text-[11px]">
                            {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSub(sub)
                                  setSelectedGroup(null)
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/30 hover:bg-[#8B72F4] hover:text-white inline-flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Eye size={13} /> View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSub(sub)
                                  setSelectedGroup(null)
                                  setTimeout(() => window.print(), 200)
                                }}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white text-[#7A7289] hover:text-[#2D2638] hover:bg-purple-50 border border-purple-100 inline-flex items-center gap-1.5 transition-all cursor-pointer"
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

                {/* Mobile Cards View */}
                <div className="sm:hidden divide-y divide-purple-100">
                  {group.submissions.map(sub => (
                    <div key={sub.id} className="p-4 space-y-3 bg-white">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-[#2D2638] text-sm flex items-center gap-2">
                            <BookOpen size={15} className="text-[#8B72F4] shrink-0" />
                            <span>{sub.learning_area?.name || '—'}</span>
                          </h3>
                        </div>
                        <p className="text-xs text-[#7A7289] font-medium">
                          {sub.term?.name || '—'} · {sub.school_year?.name || '—'}
                        </p>
                        <p className="text-[11px] text-[#A39BAF] font-mono">
                          Submitted: {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-purple-100">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub)
                            setSelectedGroup(null)
                          }}
                          className="flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/30 hover:bg-[#8B72F4] hover:text-white inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSub(sub)
                            setSelectedGroup(null)
                            setTimeout(() => window.print(), 200)
                          }}
                          className="flex-1 px-3 py-2 text-xs font-bold rounded-xl bg-white text-[#7A7289] hover:text-[#2D2638] hover:bg-purple-50 border border-purple-100 inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Printer size={13} /> Print
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3D Soft Pastel Claymorphic View / Print Official Template Modal */}
        {(selectedSub || selectedGroup) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-md animate-fade-in print:static print:inset-auto print:p-0 print:m-0 print:bg-transparent print:overflow-visible print:block">
            <div className="relative w-full max-w-[96vw] sm:max-w-6xl bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_25px_60px_-15px_rgba(139,114,244,0.3)] overflow-hidden my-2 sm:my-4 print:static print:w-full print:max-w-none print:m-0 print:p-0 print:shadow-none print:border-none print:bg-transparent print:overflow-visible flex flex-col max-h-[92vh]">
              {/* Soft Pastel Clay Header */}
              <div className="flex items-center justify-between px-6 py-4.5 bg-gradient-to-r from-[#8B72F4] via-[#9F85F7] to-[#A88BEB] text-white border-b-2 border-white/20 no-print shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-xs shrink-0">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg font-display tracking-tight text-white">
                      {selectedGroup
                        ? `Consolidated ${selectedGroup.gradeName} Evaluation Report`
                        : 'Official Submitted Evaluation Form'}
                    </h3>
                    <p className="text-xs text-purple-100 font-medium font-mono mt-0.5">
                      {selectedGroup
                        ? `Consolidating ${selectedGroup.submissions.length} Subject Forms`
                        : `Ref No: ${selectedSub?.reference_number}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const scrollables = document.querySelectorAll('div, main, section, dialog')
                      scrollables.forEach(el => { if (el.scrollTop > 0) el.scrollTop = 0 })
                      window.scrollTo(0, 0)
                      setTimeout(() => window.print(), 50)
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-white text-[#795CEE] font-black text-xs shadow-md hover:bg-purple-50 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-white"
                  >
                    <Printer size={15} />
                    <span>{selectedGroup ? 'Print Grade Report' : 'Print Form'}</span>
                  </button>


                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSub(null)
                      setSelectedGroup(null)
                    }}
                    className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 text-white hover:bg-white/40 flex items-center justify-center font-extrabold text-lg shadow-xs transition-all cursor-pointer"
                    title="Close preview"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Body Container with Soft Clay Backdrop & Outer Frame */}
              <div className="p-4 sm:p-6 overflow-y-auto overflow-x-auto flex-1 bg-[#FAF5F0] print:p-0 print:overflow-visible print:max-h-none print:h-auto">
                <div className="w-full bg-white rounded-[28px] border-2 border-white shadow-[0_10px_30px_rgba(185,170,210,0.15)] p-4 sm:p-6 overflow-x-auto">
                  {selectedGroup ? (
                    <OfficialTermcatTemplate submissions={selectedGroup.submissions} showPrintButton={false} />
                  ) : (
                    <OfficialTermcatTemplate submission={selectedSub!} showPrintButton={false} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
