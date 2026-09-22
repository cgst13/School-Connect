import { useEffect, useState, useMemo } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import {
  fetchConsolidationData, fetchSchoolYears, fetchTerms,
  fetchLearningAreas, fetchGradeLevels, fetchLearningAreaGrades, fetchSchools,
} from '@/lib/supabase/queries'
import type { TermcatSubmission, SchoolYear, Term, LearningArea, GradeLevel, LearningAreaGrade, School } from '@/types'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Building2, RefreshCw, Printer, Search,
  GraduationCap, BookOpen, Calendar,
  CheckCircle2, ArrowUpDown, Check, ExternalLink, Edit
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
import { useToast } from '@/hooks/useToast'

// ── helpers ───────────────────────────────────────────────────────────────────
function checkIsKS1(sub: TermcatSubmission): boolean {
  if (!sub) return false
  if (String(sub.form_type).toLowerCase() === 'ks1') return true
  if (sub.grade_level?.grade_number !== undefined && sub.grade_level.grade_number <= 3) return true
  if (sub.ks1_learner_data && (sub.ks1_learner_data.total_learners !== undefined || sub.ks1_learner_data.advancing !== undefined)) return true
  return false
}

function perfSum(sub: TermcatSubmission): number {
  if (checkIsKS1(sub) && sub.ks1_learner_data) {
    const d = sub.ks1_learner_data
    return (d.advancing ?? 0) + (d.benchmarking ?? 0) + (d.connecting ?? 0) + (d.developing ?? 0) + (d.emerging ?? 0)
  }
  return 0
}

function getSubTotalLearners(sub: TermcatSubmission): number {
  const isKS1 = checkIsKS1(sub)

  if (!isKS1 && sub.ks2to4_learner_data?.total_learners !== undefined && sub.ks2to4_learner_data?.total_learners !== null) {
    return Number(sub.ks2to4_learner_data.total_learners)
  }

  if (isKS1 && sub.ks1_learner_data?.total_learners !== undefined && sub.ks1_learner_data?.total_learners !== null) {
    return Number(sub.ks1_learner_data.total_learners)
  }

  // Fallbacks if form_type or joins are missing/ambiguous
  if (sub.ks2to4_learner_data?.total_learners !== undefined && sub.ks2to4_learner_data?.total_learners !== null) {
    return Number(sub.ks2to4_learner_data.total_learners)
  }
  if (sub.ks1_learner_data?.total_learners !== undefined && sub.ks1_learner_data?.total_learners !== null) {
    return Number(sub.ks1_learner_data.total_learners)
  }
  if ((sub as any).total_learners !== undefined && (sub as any).total_learners !== null) {
    return Number((sub as any).total_learners)
  }
  if ((sub as any).total_learners_count !== undefined && (sub as any).total_learners_count !== null) {
    return Number((sub as any).total_learners_count)
  }
  return 0
}

function isMismatched(sub: TermcatSubmission): boolean {
  if (!checkIsKS1(sub) || !sub.ks1_learner_data) return false
  return getSubTotalLearners(sub) !== perfSum(sub)
}

type SortField = 'school' | 'grade' | 'teacher' | 'delta'
type FilterTab = 'all' | 'mismatched' | 'matching'

const statusColors: Record<string, string> = {
  finalized: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  returned: 'bg-rose-100 text-rose-800 border-rose-200',
}

export function LearnerMismatchPage() {
  const { toast } = useToast()

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])

  const [syId, setSyId] = useState('')
  const [termId, setTermId] = useState('')
  const [gradeId, setGradeId] = useState('all')
  const [laId, setLaId] = useState('all')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [allSubmissions, setAllSubmissions] = useState<TermcatSubmission[]>([])

  const [sortField, setSortField] = useState<SortField>('delta')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // ── bootstrap dropdowns ───────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchSchoolYears(),
      fetchTerms(),
      fetchLearningAreas(),
      fetchGradeLevels(),
      fetchLearningAreaGrades(),
      fetchSchools(true), // ACTIVE SCHOOLS ONLY
    ])
      .then(([sy, t, la, g, lag, sch]) => {
        setSchoolYears(sy)
        setTerms(t)
        setLearningAreas(la)
        setLearningAreaGrades(lag)
        setGrades(g)
        setSchools(sch)

        const activeSY = sy.find((s: any) => s.is_active) ?? sy[0]
        const defaultTerm = t.find((tm: any) => tm.is_default) ?? t[0]
        if (activeSY) setSyId(activeSY.id)
        if (defaultTerm) setTermId(defaultTerm.id)
      })
      .catch(() => toast('Failed to load filter options.', 'error'))
  }, [])

  // Dynamic learning areas assigned to selected Grade Level
  const availableLearningAreas = useMemo(() => {
    if (gradeId === 'all') return learningAreas
    const assignedLaIds = new Set(
      learningAreaGrades
        .filter(lag => lag.grade_level_id === gradeId)
        .map(lag => lag.learning_area_id)
    )
    if (assignedLaIds.size === 0) return learningAreas
    return learningAreas.filter(la => assignedLaIds.has(la.id))
  }, [gradeId, learningAreas, learningAreaGrades])

  // ── fetch data ───────────────────────────────────────────────────────────
  async function loadData() {
    if (!syId || !termId) return
    setLoading(true)
    try {
      const data = await fetchConsolidationData({
        school_year_id: syId,
        term_id: termId,
        school_id: 'all',
        school_level: 'all',
        grade_level_id: 'all',
        learning_area_id: 'all',
        key_stage: 'all',
        statuses: ['submitted', 'reviewed', 'finalized'],
      })
      setAllSubmissions(data ?? [])
    } catch {
      toast('Failed to load consolidation entries.', 'error')
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  useEffect(() => { if (syId && termId) loadData() }, [syId, termId])

  // ── derived data (ACTIVE SCHOOLS ONLY) ──────────────────────────────────
  const baseFiltered = useMemo(() => {
    const activeSchoolIds = new Set(schools.map(s => s.id))
    let rows = allSubmissions.filter(s => {
      if (s.school && s.school.is_active === false) return false
      if (activeSchoolIds.size > 0 && !activeSchoolIds.has(s.school_id)) return false
      return true
    })
    if (gradeId !== 'all') rows = rows.filter(s => s.grade_level_id === gradeId)
    if (laId !== 'all') rows = rows.filter(s => s.learning_area_id === laId)
    return rows
  }, [allSubmissions, schools, gradeId, laId])

  const tabFiltered = useMemo(() => {
    let rows = baseFiltered
    if (activeTab === 'mismatched') {
      rows = rows.filter(isMismatched)
    } else if (activeTab === 'matching') {
      rows = rows.filter(s => !isMismatched(s))
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(
        s =>
          (s.school?.name ?? '').toLowerCase().includes(q) ||
          (s.teacher_name ?? '').toLowerCase().includes(q) ||
          (s.learning_area?.name ?? '').toLowerCase().includes(q) ||
          (s.grade_level?.name ?? '').toLowerCase().includes(q)
      )
    }

    return rows
  }, [baseFiltered, activeTab, searchQuery])

  const sortedRows = useMemo(() => {
    return [...tabFiltered].sort((a, b) => {
      if (sortField === 'school') {
        const cmp = (a.school?.name ?? '').localeCompare(b.school?.name ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortField === 'grade') {
        const cmp = ((a.grade_level as any)?.grade_number ?? 0) - ((b.grade_level as any)?.grade_number ?? 0)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortField === 'teacher') {
        const cmp = (a.teacher_name ?? '').localeCompare(b.teacher_name ?? '')
        return sortDir === 'asc' ? cmp : -cmp
      }
      // delta
      const da = Math.abs(getSubTotalLearners(a) - perfSum(a))
      const db = Math.abs(getSubTotalLearners(b) - perfSum(b))
      return sortDir === 'asc' ? da - db : db - da
    })
  }, [tabFiltered, sortField, sortDir])

  const stats = useMemo(() => {
    const total = baseFiltered.length
    const mismatchedCount = baseFiltered.filter(isMismatched).length
    const matchingCount = total - mismatchedCount
    const accuracyRate = total > 0 ? Math.round((matchingCount / total) * 100) : 100
    const schoolsAffected = new Set(baseFiltered.filter(isMismatched).map(s => s.school_id)).size
    const totalSchoolsCount = new Set(baseFiltered.map(s => s.school_id)).size

    return { total, mismatchedCount, matchingCount, accuracyRate, schoolsAffected, totalSchoolsCount }
  }, [baseFiltered])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Helper for rendering competency list
  const CompList = ({ items }: { items: NonNullable<TermcatSubmission['submission_competencies']> }) =>
    items.length === 0
      ? <span className="text-slate-300 italic text-[10px]">—</span>
      : <ol className="list-decimal list-inside space-y-1">
          {items.slice(0, 5).map((c, i) => (
            <li key={i} className="text-[10px] text-slate-700 leading-snug">{c.competency_text}</li>
          ))}
        </ol>

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    return (
      <button
        onClick={() => toggleSort(field)}
        className="inline-flex items-center gap-1 hover:text-[#2D2638] transition-colors cursor-pointer group"
      >
        {label}
        <ArrowUpDown
          size={10}
          className={`transition-colors ${sortField === field ? 'text-[#8B72F4]' : 'text-slate-400 group-hover:text-slate-600'}`}
        />
      </button>
    )
  }

  function SelectBox({
    value, onChange, children, icon: Icon,
  }: { value: string; onChange: (v: string) => void; children: React.ReactNode; icon: React.ElementType }) {
    return (
      <div className="relative flex-1 min-w-[160px]">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full text-xs font-semibold pl-8 pr-7 py-2 rounded-xl border border-purple-100 bg-purple-50/30 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8B72F4] appearance-none cursor-pointer"
        >
          {children}
        </select>
      </div>
    )
  }

  const n = (v: number | null | undefined) => v != null ? v : '—'
  const selectedGradeObj = grades.find(g => g.id === gradeId)
  const selectedLAObj = learningAreas.find(la => la.id === laId)

  return (
    <AdminLayout>
      <div className="printable-area space-y-6">
        {/* Official DepEd Print Header (visible only on print) */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-black pb-4 font-sans">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-800">Republic of the Philippines • Department of Education</p>
          <p className="text-xs font-bold text-slate-700">Division of Romblon • TERMCAT Evaluation Engine</p>
          <h1 className="text-lg font-black uppercase text-black mt-1 tracking-tight">LEARNER TOTAL MISMATCH & CONSOLIDATION REPORT</h1>
          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-800 mt-2">
            <span>School Year: <strong>{schoolYears.find(s => s.id === syId)?.name || 'All'}</strong></span>
            <span>Quarter/Term: <strong>{terms.find(t => t.id === termId)?.name || 'All'}</strong></span>
            <span>Grade Level: <strong>{selectedGradeObj?.name || 'All Grades'}</strong></span>
            <span>Learning Area: <strong>{selectedLAObj?.name || 'All Learning Areas'}</strong></span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Generated on: {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Page Header (hidden on print) */}
        <div className="print:hidden">
          <PageHeader
            badge="Data Quality Engine"
            title="Learner Total Mismatch Report"
            description="Displays all school consolidation entries for the selected grade and learning area. Highlighted in red if total learners does not match performance sum."
          />
        </div>

        {/* ── Filters Bar (hidden on print) ── */}
        <div className="clay-card bg-white border border-purple-100 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-xs print:hidden">
          <SelectBox value={syId} onChange={setSyId} icon={Calendar}>
            <option value="">— School Year —</option>
            {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
          </SelectBox>

          <SelectBox value={termId} onChange={setTermId} icon={Calendar}>
            <option value="">— Term —</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </SelectBox>

          {/* Grade filter FIRST */}
          <SelectBox value={gradeId} onChange={v => { setGradeId(v); setLaId('all') }} icon={GraduationCap}>
            <option value="all">All Grade Levels ({grades.length})</option>
            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </SelectBox>

          {/* Learning Area filter SECOND */}
          <SelectBox value={laId} onChange={setLaId} icon={BookOpen}>
            <option value="all">
              {gradeId === 'all' ? 'All Learning Areas (Select Grade to filter)' : 'All Assigned Learning Areas'}
            </option>
            {availableLearningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
          </SelectBox>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={loadData}
              disabled={loading || !syId || !termId}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#6366F1] text-white text-xs font-bold flex items-center gap-1.5 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-200 transition-all cursor-pointer"
            >
              <Printer size={13} />
              Print
            </button>
          </div>
        </div>

        {/* ── Stat Banner ── */}
        {initialized && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="clay-card p-4 border rounded-2xl bg-purple-50/50 border-purple-200 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-white text-purple-600 flex items-center justify-center shadow-xs border border-purple-100">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-purple-900">{stats.total}</p>
                <p className="text-[10px] text-purple-700 font-semibold leading-tight mt-0.5">
                  Submissions ({stats.totalSchoolsCount} Schools)
                </p>
              </div>
            </div>

            <div className="clay-card p-4 border rounded-2xl bg-red-50/50 border-red-200 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center shadow-xs border border-red-100">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-red-700">{stats.mismatchedCount}</p>
                <p className="text-[10px] text-red-700 font-semibold leading-tight mt-0.5">
                  Mismatched Entries {stats.schoolsAffected > 0 && `(${stats.schoolsAffected} Schools)`}
                </p>
              </div>
            </div>

            <div className="clay-card p-4 border rounded-2xl bg-emerald-50/50 border-emerald-200 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center shadow-xs border border-emerald-100">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-800">{stats.matchingCount}</p>
                <p className="text-[10px] text-emerald-700 font-semibold leading-tight mt-0.5">Matching / Verified Entries</p>
              </div>
            </div>

            <div className="clay-card p-4 border rounded-2xl bg-indigo-50/50 border-indigo-200 flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-indigo-900">{stats.accuracyRate}%</p>
                <p className="text-[10px] text-indigo-700 font-semibold leading-tight mt-0.5">Data Accuracy Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-navigation Tabs & Search ── */}
        {initialized && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-purple-100 shadow-xs print:hidden">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'all'
                    ? 'bg-[#8B72F4] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Submissions ({stats.total})
              </button>

              <button
                onClick={() => setActiveTab('mismatched')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'mismatched'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlertTriangle size={13} />
                Mismatched Only
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {stats.mismatchedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('matching')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'matching'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={13} />
                Matching Only ({stats.matchingCount})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search school or teacher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8B72F4]"
              />
            </div>
          </div>
        )}

        {/* ── Table Results ── */}
        {loading ? (
          <div className="py-16">
            <DepEdPageLoader label="Loading consolidation data and detecting learner mismatches..." />
          </div>
        ) : sortedRows.length === 0 && initialized ? (
          <div className="clay-card bg-white border border-purple-100 rounded-2xl p-14 text-center space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="text-base font-black text-slate-800">No School Entries Found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No submissions found matching the selected grade level and learning area. Try adjusting your filters.
            </p>
          </div>
        ) : (
          initialized && (
            <div className="clay-card bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
              {/* Card Header Title */}
              <div className="p-4 border-b border-purple-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#2D2638]">
                      School Entries Included in Consolidation
                    </p>
                    <p className="text-[10px] text-[#7A7289] font-medium">
                      {sortedRows.length} submission{sortedRows.length !== 1 ? 's' : ''} from {new Set(sortedRows.map(s => s.school_id)).size} school{new Set(sortedRows.map(s => s.school_id)).size !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {stats.mismatchedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-xs font-extrabold animate-pulse">
                    <AlertTriangle size={14} className="text-red-600" />
                    {stats.mismatchedCount} Mismatched {stats.mismatchedCount === 1 ? 'Row' : 'Rows'} Highlighted
                  </span>
                )}
              </div>

              {/* Consolidation Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]" style={{ minWidth: '1600px' }}>
                  <thead className="sticky top-0 z-10">
                    {/* Group header row */}
                    <tr className="bg-[#2D2638] text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="py-2 px-3 border-r border-white/20" colSpan={4}>School Info</th>
                      <th className="py-2 px-3 text-center border-r border-white/20" colSpan={1}>Learners</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-teal-900/80" colSpan={5}>KS1 Performance Levels</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-indigo-900/80" colSpan={1}>KS2–4</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-purple-900/80" colSpan={3}>Competency Summary</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-emerald-900/80" colSpan={1}>Most Learned (Top 5)</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-amber-900/80" colSpan={1}>Least Mastered (Top 5)</th>
                      <th className="py-2 px-3 text-center border-r border-white/20 bg-rose-900/80" colSpan={1}>Most Difficult (Top 5)</th>
                      <th className="py-2 px-3 text-center bg-slate-700/80" colSpan={2}>Status & Action</th>
                    </tr>

                    {/* Column header row */}
                    <tr className="bg-[#F6EFFF] text-[#7A7289] font-extrabold uppercase tracking-wider border-b border-purple-100 text-[9px]">
                      <th className="py-2.5 px-3 w-7">#</th>
                      <th className="py-2.5 px-3 min-w-[180px]"><SortBtn field="school" label="School" /></th>
                      <th className="py-2.5 px-3 min-w-[140px]"><SortBtn field="grade" label="Grade & Subject" /></th>
                      <th className="py-2.5 px-3 min-w-[120px] border-r border-purple-200"><SortBtn field="teacher" label="Teacher" /></th>
                      <th className="py-2.5 px-3 text-center min-w-[70px] border-r border-purple-200"><SortBtn field="delta" label="Total" /></th>
                      {/* KS1 */}
                      <th className="py-2.5 px-3 text-center min-w-[55px] bg-teal-50">Adv.</th>
                      <th className="py-2.5 px-3 text-center min-w-[55px] bg-teal-50">Bench.</th>
                      <th className="py-2.5 px-3 text-center min-w-[55px] bg-teal-50">Conn.</th>
                      <th className="py-2.5 px-3 text-center min-w-[55px] bg-teal-50">Dev.</th>
                      <th className="py-2.5 px-3 text-center min-w-[55px] bg-teal-50 border-r border-purple-200">Emerg.</th>
                      {/* KS2-4 */}
                      <th className="py-2.5 px-3 text-center min-w-[65px] bg-indigo-50 border-r border-purple-200">MPS</th>
                      {/* Competency summary */}
                      <th className="py-2.5 px-3 text-center min-w-[65px] bg-purple-50">Intended</th>
                      <th className="py-2.5 px-3 text-center min-w-[60px] bg-purple-50">Taught</th>
                      <th className="py-2.5 px-3 text-center min-w-[65px] bg-purple-50 border-r border-purple-200">Not Tght</th>
                      {/* Competency lists */}
                      <th className="py-2.5 px-3 min-w-[200px] bg-emerald-50 border-r border-purple-200">Top 5 Most Learned</th>
                      <th className="py-2.5 px-3 min-w-[200px] bg-amber-50 border-r border-purple-200">Top 5 Least Mastered</th>
                      <th className="py-2.5 px-3 min-w-[200px] bg-rose-50 border-r border-purple-200">Top 5 Most Difficult</th>
                      {/* Factors + Status */}
                      <th className="py-2.5 px-3 min-w-[160px] bg-slate-50">Instructional Factors</th>
                      <th className="py-2.5 px-3 text-center min-w-[80px] bg-slate-50">Status</th>
                      <th className="py-2.5 px-3 text-center min-w-[90px] bg-slate-50 print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {sortedRows.map((sub, idx) => {
                      const isKS1 = checkIsKS1(sub)
                      const d1 = sub.ks1_learner_data
                      const d2 = sub.ks2to4_learner_data
                      const cs = sub.competency_summary
                      const comps = sub.submission_competencies ?? []
                      const mostLearned = comps.filter(c => c.category === 'most_learned').sort((a,b) => a.rank - b.rank)
                      const leastMastered = comps.filter(c => c.category === 'least_mastered').sort((a,b) => a.rank - b.rank)
                      const mostDifficult = comps.filter(c => c.category === 'most_difficult_to_teach').sort((a,b) => a.rank - b.rank)
                      const factors = sub.instructional_difficulty?.factors_text?.trim() || '—'

                      const ks1PerfSum = isKS1 && d1
                        ? (d1.advancing ?? 0) + (d1.benchmarking ?? 0) + (d1.connecting ?? 0) + (d1.developing ?? 0) + (d1.emerging ?? 0)
                        : null
                      const ks1Total = isKS1 ? (d1?.total_learners ?? null) : null
                      const hasMismatch = ks1Total !== null && ks1PerfSum !== null && ks1Total !== ks1PerfSum

                      return (
                        <tr
                          key={sub.id}
                          className={`align-top transition-colors ${
                            hasMismatch
                              ? 'bg-red-50/70 hover:bg-red-100/60 outline outline-1 outline-red-300'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-purple-50/40'
                              : 'bg-[#FAFAFE] hover:bg-purple-50/40'
                          }`}
                        >
                          {/* Row number + mismatch indicator */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-[#7A7289]">{idx + 1}</span>
                              {hasMismatch && (
                                <Link
                                  to={`/admin/submissions/${sub.id}/edit`}
                                  target="_blank"
                                  title="Click to edit this mismatched submission"
                                  className="text-[9px] font-black text-red-600 bg-red-100 hover:bg-red-200 border border-red-300 rounded-full px-1.5 py-0.5 leading-none transition-transform hover:scale-105"
                                >
                                  ⚠ Mismatch
                                </Link>
                              )}
                            </div>
                          </td>

                          {/* School Info */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-start gap-1.5">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${hasMismatch ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                                <Building2 size={10} />
                              </div>
                              <Link
                                to={`/admin/submissions/${sub.id}/edit`}
                                target="_blank"
                                className={`font-bold leading-tight text-[11px] hover:underline flex items-center gap-1 group ${hasMismatch ? 'text-red-900 font-black' : 'text-[#2D2638]'}`}
                                title="Click to edit submission"
                              >
                                {sub.school?.name ?? sub.school_id}
                                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-purple-600 transition-opacity" />
                              </Link>
                            </div>
                          </td>

                          {/* Grade & Subject */}
                          <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-900 font-bold text-xs">{sub.grade_level?.name ?? '—'}</span>
                              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 w-fit">
                                {sub.learning_area?.name ?? '—'}
                              </span>
                            </div>
                          </td>

                          {/* Teacher */}
                          <td className="py-2.5 px-3 text-slate-600 border-r border-purple-100">
                            {sub.teacher_name}
                          </td>

                          {/* Total Learners */}
                          <td className={`py-2.5 px-3 text-center font-bold border-r border-purple-100 ${hasMismatch ? 'text-red-700 bg-red-100' : 'text-slate-800'}`}>
                            <div className="flex flex-col items-center">
                              <span>{isKS1 ? n(d1?.total_learners) : n(d2?.total_learners)}</span>
                              {hasMismatch && (
                                <span className="text-[9px] text-red-600 font-bold leading-tight">
                                  ≠ sum: {ks1PerfSum}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* KS1 Performance Levels */}
                          <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>
                            {isKS1 ? n(d1?.advancing) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>
                            {isKS1 ? n(d1?.benchmarking) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>
                            {isKS1 ? n(d1?.connecting) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>
                            {isKS1 ? n(d1?.developing) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-semibold border-r border-purple-100 ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>
                            {isKS1 ? n(d1?.emerging) : <span className="text-slate-300">—</span>}
                          </td>

                          {/* KS2-4 MPS */}
                          <td className="py-2.5 px-3 text-center font-bold text-indigo-800 bg-indigo-50/40 border-r border-purple-100">
                            {!isKS1 ? (d2?.mps != null ? `${d2.mps}%` : '—') : <span className="text-slate-300">—</span>}
                          </td>

                          {/* Competency summary */}
                          <td className="py-2.5 px-3 text-center font-semibold text-purple-800 bg-purple-50/40">{n(cs?.total_intended_competencies)}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-emerald-700 bg-purple-50/40">{n(cs?.competencies_taught)}</td>
                          <td className="py-2.5 px-3 text-center font-semibold text-rose-700 bg-purple-50/40 border-r border-purple-100">{n(cs?.competencies_not_taught)}</td>

                          {/* Top 5 Competency Lists */}
                          <td className="py-2.5 px-3 bg-emerald-50/30 border-r border-purple-100 align-top"><CompList items={mostLearned} /></td>
                          <td className="py-2.5 px-3 bg-amber-50/30 border-r border-purple-100 align-top"><CompList items={leastMastered} /></td>
                          <td className="py-2.5 px-3 bg-rose-50/30 border-r border-purple-100 align-top"><CompList items={mostDifficult} /></td>

                          {/* Instructional Factors */}
                          <td className="py-2.5 px-3 text-[10px] text-slate-600 leading-snug bg-slate-50/50 align-top">{factors}</td>

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center bg-slate-50/50">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border capitalize ${statusColors[sub.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {sub.status}
                            </span>
                          </td>

                          {/* Action Link */}
                          <td className="py-2.5 px-3 text-center bg-slate-50/50 print:hidden">
                            <Link
                              to={`/admin/submissions/${sub.id}/edit`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded px-2.5 py-1 transition-all shadow-2xs hover:shadow-xs"
                              title="Edit this submission in a new tab"
                            >
                              <Edit size={12} />
                              Edit
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="px-4 py-2.5 bg-[#F6EFFF]/60 border-t border-purple-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-[10px] text-[#7A7289] font-semibold">
                    {sortedRows.length} entries · {new Set(sortedRows.map(s => s.school_id)).size} schools · Scroll horizontally to view all columns
                  </p>
                  {stats.mismatchedCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 text-[9px] font-black">
                      ⚠ Rows highlighted in red have mismatched learner totals vs. performance level sums
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-purple-600 font-bold">TERMCAT Data Quality Engine</span>
              </div>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  )
}
