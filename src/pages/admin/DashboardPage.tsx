import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { StatCard, StatCardSkeleton } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { fetchDashboardStats, fetchSubmissions, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import type { DashboardStats, TermcatSubmission, SchoolYear, Term } from '@/types'
import { FileText, Building2, Users, CheckCircle2, RotateCcw, Star, Clock, Filter, ArrowUpRight, Sparkles } from 'lucide-react'
import { format } from 'date-fns'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<TermcatSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [filterSY, setFilterSY] = useState('')
  const [filterTerm, setFilterTerm] = useState('')

  useEffect(() => {
    Promise.all([fetchSchoolYears(false), fetchTerms(false)]).then(([sy, t]) => {
      setSchoolYears(sy)
      setTerms(t)
      const activeSY = sy.find(s => s.is_active)
      if (activeSY) setFilterSY(activeSY.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const filters: any = {}
    if (filterSY) filters.school_year_id = filterSY
    if (filterTerm) filters.term_id = filterTerm

    Promise.all([
      fetchDashboardStats(filters),
      fetchSubmissions({ ...filters, page: 1, page_size: 10, sort_by: 'submitted_at', sort_dir: 'desc' }),
    ]).then(([s, r]) => {
      setStats(s as DashboardStats)
      setRecent(r.data)
    }).finally(() => setLoading(false))
  }, [filterSY, filterTerm])

  const statItems = stats ? [
    { title: 'Total Submissions', value: stats.total, icon: <FileText size={20} />, color: 'blue' as const },
    { title: 'Pending Review', value: stats.submitted, icon: <Clock size={20} />, color: 'gray' as const },
    { title: 'Reviewed', value: stats.reviewed, icon: <CheckCircle2 size={20} />, color: 'gold' as const },
    { title: 'Returned', value: stats.returned, icon: <RotateCcw size={20} />, color: 'red' as const },
    { title: 'Finalized', value: stats.finalized, icon: <Star size={20} />, color: 'green' as const },
    { title: 'Active Schools', value: stats.schools, icon: <Building2 size={20} />, color: 'blue' as const },
    { title: 'Submitting Teachers', value: stats.teachers, icon: <Users size={20} />, color: 'gray' as const },
  ] : []

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Banner & Filters Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2 border border-blue-200/60">
              <Sparkles size={12} />
              District Administrative Overview
            </div>
            <h1 className="page-title">Executive Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Real-time monitoring of teacher ratings and school consolidations for Concepcion District.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 text-slate-500 px-2 text-xs font-semibold">
              <Filter size={14} />
              <span>Filters:</span>
            </div>
            <select
              className="form-select text-xs py-2 bg-white rounded-lg border-slate-200 shadow-xs focus:ring-blue-500"
              value={filterSY}
              onChange={e => setFilterSY(e.target.value)}
              aria-label="Filter by school year"
            >
              <option value="">All School Years</option>
              {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
            </select>
            <select
              className="form-select text-xs py-2 bg-white rounded-lg border-slate-200 shadow-xs focus:ring-blue-500"
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value)}
              aria-label="Filter by term"
            >
              <option value="">All Quarters / Terms</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statItems.map(s => (
                <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} color={s.color} />
              ))
          }
        </div>

        {/* Recent Submissions Section */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="section-title">Recent Teacher Submissions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest quarterly evaluation forms submitted by teachers</p>
            </div>
            <Link
              to="/admin/submissions"
              className="btn-sm btn-secondary font-semibold group inline-flex items-center gap-1"
            >
              <span>View All Submissions</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Table view */}
          <div className="hidden md:block">
            {recent.length === 0 && !loading ? (
              <div className="p-8">
                <EmptyState title="No submissions found" description="No TERMCAT evaluations match your selected filter criteria." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref. ID</th>
                      <th>Teacher Name</th>
                      <th>School</th>
                      <th>Grade Level</th>
                      <th>Learning Area</th>
                      <th>Quarter/Term</th>
                      <th>Status</th>
                      <th>Date Submitted</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map(sub => (
                      <tr key={sub.id} className="group">
                        <td className="font-mono text-xs font-bold text-blue-700">{sub.reference_number}</td>
                        <td className="font-semibold text-slate-900">{sub.teacher_name}</td>
                        <td className="max-w-[180px] truncate text-slate-600">{sub.school?.name}</td>
                        <td className="text-slate-600">{sub.grade_level?.name}</td>
                        <td className="text-slate-600">{sub.learning_area?.name}</td>
                        <td className="text-slate-600">{sub.term?.name}</td>
                        <td><StatusBadge status={sub.status} size="sm" /></td>
                        <td className="text-slate-500 text-xs">{format(new Date(sub.submitted_at), 'MMM d, yyyy')}</td>
                        <td className="text-right">
                          <Link
                            to={`/admin/submissions/${sub.id}`}
                            className="btn-sm btn-ghost text-blue-600 font-bold hover:bg-blue-50"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile Card list */}
          <div className="md:hidden">
            {recent.length === 0 && !loading ? (
              <div className="p-6">
                <EmptyState title="No submissions found" />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map(sub => (
                  <Link
                    key={sub.id}
                    to={`/admin/submissions/${sub.id}`}
                    className="block p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {sub.reference_number}
                        </span>
                        <p className="text-sm font-bold text-slate-900 truncate pt-1">{sub.teacher_name}</p>
                        <p className="text-xs font-medium text-slate-600 truncate">{sub.school?.name}</p>
                        <p className="text-xs text-slate-400">
                          {sub.grade_level?.name} · {sub.learning_area?.name} · {sub.term?.name}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right space-y-2">
                        <StatusBadge status={sub.status} size="sm" />
                        <p className="text-[11px] text-slate-400 font-medium">{format(new Date(sub.submitted_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
