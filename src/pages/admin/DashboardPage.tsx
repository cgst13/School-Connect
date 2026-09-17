import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
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
  const [, setLoading] = useState(true)
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
      <div className="space-y-6 animate-fade-in pb-12">
        {/* Top Header Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-[28px] border border-white shadow-xs">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3EFFF] text-[#6D28D9] text-xs font-black mb-1.5 border border-[#E2D5FE]">
              <Sparkles className="w-3.5 h-3.5 text-[#8B72F4]" />
              District Administrative Overview
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2D2638] tracking-tight">Executive Dashboard</h1>
            <p className="text-xs sm:text-sm text-[#7A7289] font-medium mt-0.5">
              Real-time monitoring of teacher ratings and school consolidations for Concepcion District.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2.5 bg-[#FAF5F0] p-2 rounded-full border border-white flex-wrap sm:flex-nowrap shadow-2xs">
            <div className="flex items-center gap-1.5 text-[#7A7289] px-3 text-xs font-bold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>
            <select
              className="text-xs py-1.5 px-3 bg-white rounded-full border border-white focus:outline-none font-bold text-[#2D2638]"
              value={filterSY}
              onChange={e => setFilterSY(e.target.value)}
            >
              <option value="">All School Years</option>
              {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
            </select>
            <select
              className="text-xs py-1.5 px-3 bg-white rounded-full border border-white focus:outline-none font-bold text-[#2D2638]"
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value)}
            >
              <option value="">All Quarters</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* 4 Stat Metric Cards Row matching Reference Design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Lavender Tasks/Submissions Done */}
          <div className="clay-card-purple p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#7A7289]">Submissions Done</span>
              <h2 className="text-2xl font-black text-[#2D2638] mt-1">{stats?.total || 0}</h2>
              <span className="text-[11px] font-extrabold text-[#6D28D9] inline-block mt-1">
                +12% from previous quarter
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white shadow-xs text-[#8B72F4] flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Pink In Progress */}
          <div className="clay-card-pink p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#7A7289]">In Progress / Pending</span>
              <h2 className="text-2xl font-black text-[#2D2638] mt-1">{stats?.submitted || 0}</h2>
              <span className="text-[11px] font-extrabold text-[#E11D48] inline-block mt-1">
                {stats?.schools || 0} active schools
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white shadow-xs text-[#E11D48] flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Green Completed/Finalized */}
          <div className="clay-card-green p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#7A7289]">Finalized / Completed</span>
              <h2 className="text-2xl font-black text-[#2D2638] mt-1">{stats?.finalized || 0}</h2>
              <span className="text-[11px] font-extrabold text-[#059669] inline-block mt-1">
                This academic period
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white shadow-xs text-[#059669] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Yellow Active SY / Focus Time */}
          <div className="clay-card-yellow p-5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#7A7289]">Active Period</span>
              <h2 className="text-xl font-black text-[#2D2638] mt-1">
                {terms.find(t => t.id === filterTerm)?.name || 'Q1 Active'}
              </h2>
              <span className="text-[11px] font-extrabold text-[#D97706] inline-block mt-1">
                Concepcion District
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white shadow-xs text-[#D97706] flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 fill-[#FDE68A]" />
            </div>
          </div>
        </div>

        {/* Middle Grid: Productivity Overview Area Line Chart & Mini Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Productivity Overview Line Graph (2/3 width) */}
          <div className="lg:col-span-2 clay-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-[#2D2638] tracking-tight">Productivity & Submission Trend</h3>
                <p className="text-xs text-[#7A7289] font-medium">Weekly evaluation form completion progress</p>
              </div>
              <div className="px-3.5 py-1.5 rounded-full bg-[#FAF5F0] border border-white text-xs font-bold text-[#2D2638] shadow-2xs">
                This Quarter ▾
              </div>
            </div>

            {/* SVG Line Graph Container */}
            <div className="relative h-56 w-full my-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 200">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B72F4" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#8B72F4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="0" y1="20" x2="600" y2="20" stroke="#F0E8F5" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="600" y2="70" stroke="#F0E8F5" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="600" y2="120" stroke="#F0E8F5" strokeDasharray="4 4" />
                <line x1="0" y1="170" x2="600" y2="170" stroke="#F0E8F5" strokeDasharray="4 4" />

                {/* Y-Axis Labels */}
                <text x="0" y="25" fill="#A39BAF" fontSize="10" fontWeight="bold">100</text>
                <text x="0" y="75" fill="#A39BAF" fontSize="10" fontWeight="bold">75</text>
                <text x="0" y="125" fill="#A39BAF" fontSize="10" fontWeight="bold">50</text>
                <text x="0" y="175" fill="#A39BAF" fontSize="10" fontWeight="bold">25</text>

                {/* Area Gradient Fill */}
                <path
                  d="M 50 150 Q 140 110, 230 70 T 410 40 T 570 45 L 570 180 L 50 180 Z"
                  fill="url(#areaGradient)"
                />

                {/* Smooth Curve Path */}
                <path
                  d="M 50 150 Q 140 110, 230 70 T 410 40 T 570 45"
                  fill="none"
                  stroke="#8B72F4"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* Data Node Dots */}
                <circle cx="50" cy="150" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="140" cy="110" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="230" cy="70" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="320" cy="100" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="410" cy="45" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="500" cy="35" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
                <circle cx="570" cy="45" r="6" fill="#8B72F4" stroke="#FFFFFF" strokeWidth="3" />
              </svg>

              {/* Floating Pill Tooltip matching reference screenshot */}
              <div className="absolute top-2 right-24 bg-[#F3EFFF] text-[#6D28D9] border border-[#E2D5FE] px-3 py-1 rounded-full text-xs font-black shadow-xs animate-bounce">
                Great job! 🎉
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between text-xs font-bold text-[#A39BAF] px-4 pt-2">
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
          <div className="clay-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <button className="p-1 rounded-lg hover:bg-slate-100 text-[#7A7289]">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm font-black text-[#2D2638]">May 2026</h3>
              <button className="p-1 rounded-lg hover:bg-slate-100 text-[#7A7289]">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Calendar Grid matching reference design */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <span key={day} className="text-[10px] font-bold text-[#A39BAF] py-1">{day}</span>
              ))}

              {/* Prev Month Days */}
              <span className="text-[#D0C9DB] py-1.5 font-medium">29</span>
              <span className="text-[#D0C9DB] py-1.5 font-medium">30</span>

              {/* Current Month Days */}
              {Array.from({ length: 31 }).map((_, i) => {
                const dayNum = i + 1
                const isSelected = dayNum === 15
                return (
                  <span
                    key={dayNum}
                    className={`py-1.5 rounded-full font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#8B72F4] text-white shadow-md shadow-indigo-500/30 font-black'
                        : dayNum % 6 === 0
                        ? 'text-[#E11D48]'
                        : 'text-[#2D2638] hover:bg-[#F3EFFF]'
                    }`}
                  >
                    {dayNum}
                  </span>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[#F0E8F5] flex items-center justify-between text-xs">
              <span className="font-bold text-[#7A7289]">Deadline Alert:</span>
              <span className="font-extrabold text-[#E11D48] bg-[#FFF0F3] px-2.5 py-0.5 rounded-full border border-[#FFCCD4]">
                May 31, 11:59 PM
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Projects, Top Tasks, Bunny Motivation Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* My Projects / School Submission Progress (1/3 width) */}
          <div className="clay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#2D2638] tracking-tight">School Progress</h3>
              <Link to="/admin/schools" className="px-3 py-1 rounded-full bg-[#F3EFFF] text-[#6D28D9] text-xs font-bold hover:bg-[#E9E1FF]">
                View all
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Progress Item 1 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg clay-folder-purple text-white flex items-center justify-center">
                      <Folder size={12} />
                    </div>
                    <span className="text-[#2D2638]">Concepcion Central ES</span>
                  </div>
                  <span className="text-[#7A7289]">75%</span>
                </div>
                <div className="w-full bg-[#FAF5F0] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#8B72F4] h-full rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              {/* Progress Item 2 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg clay-folder-pink text-white flex items-center justify-center">
                      <Folder size={12} />
                    </div>
                    <span className="text-[#2D2638]">Concepcion NHS</span>
                  </div>
                  <span className="text-[#7A7289]">60%</span>
                </div>
                <div className="w-full bg-[#FAF5F0] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#F43F5E] h-full rounded-full" style={{ width: '60%' }} />
                </div>
              </div>

              {/* Progress Item 3 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg clay-folder-green text-white flex items-center justify-center">
                      <Folder size={12} />
                    </div>
                    <span className="text-[#2D2638]">San Jose Elementary</span>
                  </div>
                  <span className="text-[#7A7289]">40%</span>
                </div>
                <div className="w-full bg-[#FAF5F0] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#10B981] h-full rounded-full" style={{ width: '40%' }} />
                </div>
              </div>

              {/* Progress Item 4 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg clay-folder-yellow text-white flex items-center justify-center">
                      <Folder size={12} />
                    </div>
                    <span className="text-[#2D2638]">Poblacion High School</span>
                  </div>
                  <span className="text-[#7A7289]">90%</span>
                </div>
                <div className="w-full bg-[#FAF5F0] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#F59E0B] h-full rounded-full" style={{ width: '90%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Top Tasks / Priority Submissions (1/3 width) */}
          <div className="clay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#2D2638] tracking-tight">Top Submissions</h3>
              <Link to="/admin/submissions" className="px-3 py-1 rounded-full bg-[#EDFAF3] text-[#059669] text-xs font-bold hover:bg-[#D1FAE5]">
                View all
              </Link>
            </div>

            <div className="space-y-2.5">
              <div
                onClick={() => toggleTask('task1')}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#FAF5F0] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task1'] ? (
                    <CheckSquare size={16} className="text-[#059669] shrink-0" />
                  ) : (
                    <Square size={16} className="text-[#A39BAF] shrink-0" />
                  )}
                  <span className={`text-xs font-bold truncate ${checkedTasks['task1'] ? 'line-through text-[#A39BAF]' : 'text-[#2D2638]'}`}>
                    Grade 1 Mathematics
                  </span>
                </div>
                <span className="clay-badge-pink px-2.5 py-0.5 text-[10px] shrink-0">High</span>
              </div>

              <div
                onClick={() => toggleTask('task2')}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#FAF5F0] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task2'] ? (
                    <CheckSquare size={16} className="text-[#059669] shrink-0" />
                  ) : (
                    <Square size={16} className="text-[#A39BAF] shrink-0" />
                  )}
                  <span className={`text-xs font-bold truncate ${checkedTasks['task2'] ? 'line-through text-[#A39BAF]' : 'text-[#2D2638]'}`}>
                    Grade 4 Science Rating
                  </span>
                </div>
                <span className="clay-badge-orange px-2.5 py-0.5 text-[10px] shrink-0">Medium</span>
              </div>

              <div
                onClick={() => toggleTask('task3')}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#FAF5F0] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task3'] ? (
                    <CheckSquare size={16} className="text-[#059669] shrink-0" />
                  ) : (
                    <Square size={16} className="text-[#A39BAF] shrink-0" />
                  )}
                  <span className={`text-xs font-bold truncate ${checkedTasks['task3'] ? 'line-through text-[#A39BAF]' : 'text-[#2D2638]'}`}>
                    Grade 6 English Form
                  </span>
                </div>
                <span className="clay-badge-blue px-2.5 py-0.5 text-[10px] shrink-0">Low</span>
              </div>

              <div
                onClick={() => toggleTask('task4')}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#FAF5F0] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {checkedTasks['task4'] ? (
                    <CheckSquare size={16} className="text-[#059669] shrink-0" />
                  ) : (
                    <Square size={16} className="text-[#A39BAF] shrink-0" />
                  )}
                  <span className={`text-xs font-bold truncate ${checkedTasks['task4'] ? 'line-through text-[#A39BAF]' : 'text-[#2D2638]'}`}>
                    Kindergarten MAPEH Form
                  </span>
                </div>
                <span className="clay-badge-blue px-2.5 py-0.5 text-[10px] shrink-0">Low</span>
              </div>
            </div>
          </div>

          {/* Motivational 3D Bunny Card matching Reference Design (1/3 width) */}
          <div className="bg-gradient-to-br from-[#F3EFFF] to-[#E5D8FD] rounded-[28px] p-5 border border-white shadow-xs flex items-center justify-between relative overflow-hidden">
            <div className="space-y-2 z-10 max-w-[180px]">
              <h3 className="text-sm font-black text-[#2D2638] leading-tight">
                You're doing amazing, {admin?.full_name.split(' ')[0] || 'Emily'}! 💜
              </h3>
              <p className="text-[11px] font-medium text-[#7A7289] leading-relaxed">
                Keep up the good work and don't forget to review pending school submissions today ✨
              </p>
            </div>
            <div className="relative shrink-0 z-10">
              <img
                src="/images/clay/bunny_motivation.jpg"
                alt="Bunny Mascot"
                className="w-24 h-24 rounded-2xl object-cover shadow-sm border-2 border-white"
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
