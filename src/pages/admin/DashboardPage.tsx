import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
import { fetchDashboardStats, fetchSubmissions, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import type { DashboardStats, TermcatSubmission, SchoolYear, Term } from '@/types'
import { useAuth } from '@/features/auth/useAuth'
import {
  FileText, Star, Clock, Filter,
  CheckCircle2, Sparkles, Folder, CheckSquare, Square, ChevronLeft, ChevronRight
} from 'lucide-react'

export function DashboardPage() {
  const { admin, hasFullAccess } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [, setRecent] = useState<TermcatSubmission[]>([])
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
    if (!hasFullAccess() && admin?.assigned_school_ids?.length) {
      filters.school_ids = admin.assigned_school_ids
    }

    Promise.all([
      fetchDashboardStats(filters),
      fetchSubmissions({ ...filters, page: 1, page_size: 10, sort_by: 'submitted_at', sort_dir: 'desc' }),
    ]).then(([s, r]) => {
      setStats(s as DashboardStats)
      setRecent(r.data)
    }).finally(() => setLoading(false))
  }, [filterSY, filterTerm, hasFullAccess, admin])

  // Priority task checkboxes state for interactive feel
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    task1: true,
    task2: true,
  })

  const toggleTask = (id: string) => {
    setCheckedTasks(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <AdminLayout>
      {loading && !stats ? (
        <DepEdPageLoader
          label="Loading Executive Dashboard..."
          subtitle="Fetching real-time district statistics and submission metrics"
        />
      ) : (
      <div className="space-y-6 animate-fade-in pb-12 font-sans">
        {/* Top Header Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-xs font-bold mb-1.5 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              District Administrative Overview
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Real-time monitoring of teacher ratings and school consolidations for Concepcion District.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1 text-slate-500 px-2 text-xs font-semibold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              className="form-select text-xs py-1.5 px-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#2563EB] font-semibold text-slate-800"
              value={filterSY}
              onChange={e => setFilterSY(e.target.value)}
            >
              <option value="">All School Years</option>
              {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
            </select>
            <select
              className="form-select text-xs py-1.5 px-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[#2563EB] font-semibold text-slate-800"
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value)}
            >
              <option value="">All Quarters</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* 4 Stat Metric Cards Row matching Reference Design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Submissions Done */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 hover:shadow-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submissions Done</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{stats?.total || 0}</h2>
              <span className="text-[11px] font-bold text-[#2563EB] inline-flex items-center gap-1 mt-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                ↑ +12% vs last quarter
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shrink-0 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: In Progress */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 hover:shadow-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress / Pending</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{stats?.submitted || 0}</h2>
              <span className="text-[11px] font-bold text-rose-600 inline-flex items-center gap-1 mt-1 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                {stats?.schools || 0} active schools
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Finalized / Completed */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 hover:shadow-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Finalized / Completed</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">{stats?.finalized || 0}</h2>
              <span className="text-[11px] font-bold text-emerald-600 inline-flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                ↑ 100% verified
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Active Period */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between transition-all hover:border-slate-300 hover:shadow-sm">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Period</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                {terms.find(t => t.id === filterTerm)?.name || 'Q1 Active'}
              </h2>
              <span className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1 mt-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                Concepcion District
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
          </div>
        </div>

        {/* Middle Grid: Productivity Overview Area Line Chart & Mini Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Productivity Overview Line Graph (2/3 width) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Productivity & Submission Trend</h3>
                <p className="text-xs text-slate-500 font-medium">Weekly evaluation form completion progress</p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                This Quarter ▾
              </div>
            </div>

            {/* SVG Line Graph Container */}
            <div className="relative h-56 w-full my-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="0" y1="20" x2="600" y2="20" stroke="#F1F5F9" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="600" y2="70" stroke="#F1F5F9" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="600" y2="120" stroke="#F1F5F9" strokeDasharray="4 4" />
                <line x1="0" y1="170" x2="600" y2="170" stroke="#F1F5F9" strokeDasharray="4 4" />

                {/* Y-Axis Labels */}
                <text x="0" y="25" fill="#94A3B8" fontSize="10" fontWeight="bold">100</text>
                <text x="0" y="75" fill="#94A3B8" fontSize="10" fontWeight="bold">75</text>
                <text x="0" y="125" fill="#94A3B8" fontSize="10" fontWeight="bold">50</text>
                <text x="0" y="175" fill="#94A3B8" fontSize="10" fontWeight="bold">25</text>

                {/* Area Gradient Fill */}
                <path
                  d="M 50 150 Q 140 110, 230 70 T 410 40 T 570 45 L 570 180 L 50 180 Z"
                  fill="url(#areaGradient)"
                />

                {/* Smooth Curve Path */}
                <path
                  d="M 50 150 Q 140 110, 230 70 T 410 40 T 570 45"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Data Node Dots */}
                <circle cx="50" cy="150" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="140" cy="110" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="230" cy="70" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="320" cy="100" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="410" cy="45" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="500" cy="35" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="570" cy="45" r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2" />
              </svg>

              {/* Floating Tooltip */}
              <div className="absolute top-2 right-24 bg-blue-50 text-[#2563EB] border border-blue-200 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
                Great job! 🎉
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-xs font-semibold text-slate-400 px-4 pt-2">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>

          {/* Side Mini Calendar Card (1/3 width) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm font-bold text-slate-900">May 2026</h3>
              <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendar Grid matching reference design */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <span key={day} className="text-[10px] font-bold text-slate-400 uppercase py-1">{day}</span>
              ))}

              {/* Prev Month Days */}
              <span className="text-slate-300 py-1.5 font-medium">29</span>
              <span className="text-slate-300 py-1.5 font-medium">30</span>

              {/* Current Month Days */}
              {Array.from({ length: 31 }).map((_, i) => {
                const dayNum = i + 1
                const isSelected = dayNum === 15
                return (
                  <span
                    key={dayNum}
                    className={`py-1.5 rounded-xl font-semibold transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                        : dayNum % 6 === 0
                        ? 'text-rose-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {dayNum}
                  </span>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Deadline Alert:</span>
              <span className="font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 text-[11px]">
                May 31, 11:59 PM
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Projects, Top Tasks, Bunny Motivation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* School Submission Progress (1/3 width) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">School Progress</h3>
              <Link to="/admin/schools" className="px-3 py-1 rounded-xl bg-blue-50 text-[#2563EB] text-xs font-bold hover:bg-blue-100 border border-blue-100">
                View all
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Progress Item 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                      <Folder size={13} />
                    </div>
                    <span className="text-slate-800">Concepcion Central ES</span>
                  </div>
                  <span className="text-slate-500 font-bold">75%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-[#2563EB] h-full rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              {/* Progress Item 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                      <Folder size={13} />
                    </div>
                    <span className="text-slate-800">Concepcion NHS</span>
                  </div>
                  <span className="text-slate-500 font-bold">60%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: '60%' }} />
                </div>
              </div>

              {/* Progress Item 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <Folder size={13} />
                    </div>
                    <span className="text-slate-800">San Jose Elementary</span>
                  </div>
                  <span className="text-slate-500 font-bold">40%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '40%' }} />
                </div>
              </div>

              {/* Progress Item 4 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                      <Folder size={13} />
                    </div>
                    <span className="text-slate-800">Poblacion High School</span>
                  </div>
                  <span className="text-slate-500 font-bold">90%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Top Tasks / Priority Submissions (1/3 width) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Top Submissions</h3>
              <Link to="/admin/submissions" className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 border border-emerald-100">
                View all
              </Link>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => toggleTask('task1')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task1'] ? (
                    <CheckSquare size={16} className="text-[#2563EB] shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className={`text-xs font-semibold truncate ${checkedTasks['task1'] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    Grade 1 Mathematics
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 shrink-0">High</span>
              </div>

              <div
                onClick={() => toggleTask('task2')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task2'] ? (
                    <CheckSquare size={16} className="text-[#2563EB] shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className={`text-xs font-semibold truncate ${checkedTasks['task2'] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    Grade 4 Science Rating
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">Medium</span>
              </div>

              <div
                onClick={() => toggleTask('task3')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task3'] ? (
                    <CheckSquare size={16} className="text-[#2563EB] shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className={`text-xs font-semibold truncate ${checkedTasks['task3'] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    Grade 6 English Form
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200 shrink-0">Low</span>
              </div>

              <div
                onClick={() => toggleTask('task4')}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-slate-100"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task4'] ? (
                    <CheckSquare size={16} className="text-[#2563EB] shrink-0" />
                  ) : (
                    <Square size={16} className="text-slate-400 shrink-0" />
                  )}
                  <span className={`text-xs font-semibold truncate ${checkedTasks['task4'] ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    Kindergarten MAPEH Form
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-200 shrink-0">Low</span>
              </div>
            </div>
          </div>

          {/* Motivational Card (1/3 width) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center justify-between relative overflow-hidden">
            <div className="space-y-2 z-10 max-w-[180px]">
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                You're doing amazing, {admin?.full_name.split(' ')[0] || 'Administrator'}! 👋
              </h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Keep up the good work and don't forget to review pending school submissions today ✨
              </p>
            </div>
            <div className="relative shrink-0 z-10">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Logo"
                className="w-16 h-16 object-contain drop-shadow-xs"
              />
            </div>
          </div>
        </div>
      </div>
      )}
    </AdminLayout>
  )
}
