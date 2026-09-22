import { useEffect, useState, useMemo } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import {
  fetchConsolidationData, fetchSchoolYears, fetchTerms,
  fetchSchools, fetchGradeLevels, fetchLearningAreaGrades, fetchLearningAreas,
} from '@/lib/supabase/queries'
import type { TermcatSubmission, SchoolYear, Term, School, GradeLevel, LearningArea, LearningAreaGrade } from '@/types'
import {
  Scale, Building2, RefreshCw, Printer, Search,
  GraduationCap, BookOpen, AlertTriangle, CheckCircle2,
  ChevronDown, ArrowUpDown, AlertCircle, Check, HelpCircle,
  Users, Target, Layers, Edit, ExternalLink
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
import { useToast } from '@/hooks/useToast'

// ── helpers & types ───────────────────────────────────────────────────────────
function getSubmissionTotalLearners(sub: TermcatSubmission): number {
  const isKS1 = sub.form_type === 'ks1' || (sub.grade_level?.grade_number !== undefined && sub.grade_level.grade_number <= 3)

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

interface SubjectCell {
  totalLearners: number
  intendedCompetencies: number
  competenciesTaught: number
  competenciesNotTaught: number
  activeMetricValue: number
  teacherName: string
  status: string
  sub: TermcatSubmission
}

interface SchoolMatrixRow {
  key: string
  schoolId: string
  schoolName: string
  schoolCode: string
  gradeId: string
  gradeName: string
  subjectMap: Map<string, SubjectCell> // learning_area_id -> cell data
  counts: number[]
  minCount: number
  maxCount: number
  discrepancy: number
  majorityCount: number
  isInconsistent: boolean
  submittedCount: number
  mismatchesCount: number
}

type MetricType = 'learners' | 'competencies'
type CompetencySubMetric = 'intended' | 'taught' | 'not_taught'
type FilterTab = 'all' | 'inconsistent' | 'consistent'
type SortOption = 'discrepancy_desc' | 'school_asc' | 'school_desc'

export function SubjectConsistencyPage() {
  const { toast } = useToast()

  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])

  const [syId, setSyId] = useState('')
  const [termId, setTermId] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [laFilter, setLaFilter] = useState('all')
  const [schoolFilter, setSchoolFilter] = useState('all')
  const [metricType, setMetricType] = useState<MetricType>('learners')
  const [competencyMetric, setCompetencyMetric] = useState<CompetencySubMetric>('intended')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('school_asc')

  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [allSubmissions, setAllSubmissions] = useState<TermcatSubmission[]>([])

  // ── initial dropdown data ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchSchoolYears(),
      fetchTerms(),
      fetchSchools(true), // ACTIVE SCHOOLS ONLY
      fetchGradeLevels(),
      fetchLearningAreas(false),
      fetchLearningAreaGrades(),
    ])
      .then(([sy, t, sch, g, la, lag]) => {
        setSchoolYears(sy)
        setTerms(t)
        setSchools(sch)
        setGradeLevels(g)
        setLearningAreas(la)
        setLearningAreaGrades(lag)

        const activeSY = sy.find((s: any) => s.is_active) ?? sy[0]
        const defaultTerm = t.find((tm: any) => tm.is_default) ?? t[0]
        if (activeSY) setSyId(activeSY.id)
        if (defaultTerm) setTermId(defaultTerm.id)
      })
      .catch(() => toast('Failed to load filter options.', 'error'))
  }, [])

  // ── fetch submissions ──────────────────────────────────────────────────────
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
      toast('Failed to load submissions.', 'error')
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  useEffect(() => {
    if (syId && termId) loadData()
  }, [syId, termId])

  // ── available learning areas for selected grade ─────────────────────────
  const availableLearningAreas = useMemo(() => {
    let list = learningAreas

    if (gradeFilter !== 'all') {
      const assignedLaIds = new Set(
        learningAreaGrades
          .filter(lag => lag.grade_level_id === gradeFilter)
          .map(lag => lag.learning_area_id)
      )
      if (assignedLaIds.size > 0) {
        list = learningAreas.filter(la => assignedLaIds.has(la.id))
      }
    } else {
      const presentLaIds = new Set(allSubmissions.map(s => s.learning_area_id))
      if (presentLaIds.size > 0) {
        list = learningAreas.filter(la => presentLaIds.has(la.id))
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [gradeFilter, learningAreas, learningAreaGrades, allSubmissions])

  // ── relevant learning areas for the matrix columns ───────────────────────
  const matrixColumns = useMemo(() => {
    if (laFilter !== 'all') {
      return availableLearningAreas.filter(la => la.id === laFilter)
    }
    return availableLearningAreas
  }, [laFilter, availableLearningAreas])

  // ── column majority map for competency count consistency ─────────────────
  const columnMajorityMap = useMemo(() => {
    const map = new Map<string, { majorityCount: number; maxFreq: number; totalCount: number }>()
    if (metricType !== 'competencies') return map

    // Group submissions by `${grade_level_id}_${learning_area_id}` across all active schools
    const laGroupMap = new Map<string, number[]>()
    allSubmissions.forEach(sub => {
      const sch = schools.find(s => s.id === sub.school_id)
      if (sch && sch.is_active === false) return

      const key = `${sub.grade_level_id}_${sub.learning_area_id}`
      const cs = sub.competency_summary
      const intended = cs?.total_intended_competencies ?? 0
      const taught = cs?.competencies_taught ?? 0
      const untaught = cs?.competencies_not_taught ?? 0

      let val = intended
      if (competencyMetric === 'taught') val = taught
      else if (competencyMetric === 'not_taught') val = untaught

      if (!laGroupMap.has(key)) laGroupMap.set(key, [])
      laGroupMap.get(key)!.push(val)
    })

    laGroupMap.forEach((vals, key) => {
      const freq: Record<number, number> = {}
      let maxF = 0
      let majVal = vals[0] ?? 0
      vals.forEach(v => {
        freq[v] = (freq[v] || 0) + 1
        if (freq[v] > maxF) {
          maxF = freq[v]
          majVal = v
        }
      })
      map.set(key, { majorityCount: majVal, maxFreq: maxF, totalCount: vals.length })
    })

    return map
  }, [allSubmissions, schools, metricType, competencyMetric])

  // ── build matrix rows (All Schools x Grade Levels) ─────────────────────────
  const matrixRows = useMemo(() => {
    const rows: SchoolMatrixRow[] = []

    // Submissions map by key `${school_id}_${grade_level_id}`
    const subGroupMap = new Map<string, TermcatSubmission[]>()
    allSubmissions.forEach(sub => {
      const key = `${sub.school_id}_${sub.grade_level_id}`
      if (!subGroupMap.has(key)) subGroupMap.set(key, [])
      subGroupMap.get(key)!.push(sub)
    })

    // Filter target active schools
    const activeSchools = schools.filter(s => s.is_active !== false)
    const targetSchools = schoolFilter === 'all'
      ? activeSchools
      : activeSchools.filter(s => s.id === schoolFilter)

    // Filter target grades
    const targetGrades = gradeFilter === 'all'
      ? gradeLevels
      : gradeLevels.filter(g => g.id === gradeFilter)

    targetSchools.forEach(school => {
      targetGrades.forEach(grade => {
        // Filter by school's offered grade numbers if available (only if offered_grade_numbers is explicitly set)
        if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
          if (!school.offered_grade_numbers.includes(grade.grade_number)) return
        }

        const key = `${school.id}_${grade.id}`
        const subs = subGroupMap.get(key) || []

        // When viewing all grades simultaneously (gradeFilter === 'all'), skip rows with 0 submissions to prevent thousands of blank rows
        // BUT when a specific Grade Level is selected (e.g. Grade 1, Grade 4), include ALL schools in the division even if subs.length === 0
        if (gradeFilter === 'all' && subs.length === 0) return

        const subjectMap = new Map<string, SubjectCell>()
        const counts: number[] = []

        let rowMismatchesCount = 0
        let maxCompDiff = 0

        subs.forEach(s => {
          if (laFilter !== 'all' && s.learning_area_id !== laFilter) return

          const learners = getSubmissionTotalLearners(s)
          const cs = s.competency_summary
          const intended = cs?.total_intended_competencies ?? 0
          const taught = cs?.competencies_taught ?? 0
          const untaught = cs?.competencies_not_taught ?? 0

          let activeMetricValue = learners
          if (metricType === 'competencies') {
            if (competencyMetric === 'intended') activeMetricValue = intended
            else if (competencyMetric === 'taught') activeMetricValue = taught
            else if (competencyMetric === 'not_taught') activeMetricValue = untaught
          }

          subjectMap.set(s.learning_area_id, {
            totalLearners: learners,
            intendedCompetencies: intended,
            competenciesTaught: taught,
            competenciesNotTaught: untaught,
            activeMetricValue,
            teacherName: s.teacher_name ?? 'N/A',
            status: s.status,
            sub: s,
          })
          counts.push(activeMetricValue)

          if (metricType === 'competencies') {
            const colKey = `${grade.id}_${s.learning_area_id}`
            const colMaj = columnMajorityMap.get(colKey)?.majorityCount
            if (colMaj !== undefined && activeMetricValue !== colMaj) {
              rowMismatchesCount++
              const diff = Math.abs(activeMetricValue - colMaj)
              if (diff > maxCompDiff) maxCompDiff = diff
            }
          }
        })

        const distinctSet = Array.from(new Set(counts)).sort((a, b) => a - b)
        const minCount = counts.length > 0 ? Math.min(...counts) : 0
        const maxCount = counts.length > 0 ? Math.max(...counts) : 0

        // Horizontal mode / majority count within row
        const freq: Record<number, number> = {}
        let maxFreq = 0
        let majorityCount = counts[0] || 0

        counts.forEach(c => {
          freq[c] = (freq[c] || 0) + 1
          if (freq[c] > maxFreq) {
            maxFreq = freq[c]
            majorityCount = c
          }
        })

        const isInconsistent = metricType === 'competencies'
          ? rowMismatchesCount > 0
          : (counts.length > 1 && distinctSet.length > 1)

        const discrepancy = metricType === 'competencies'
          ? maxCompDiff
          : (counts.length > 1 ? maxCount - minCount : 0)

        rows.push({
          key,
          schoolId: school.id,
          schoolName: school.name,
          schoolCode: (school as any)?.code ?? '',
          gradeId: grade.id,
          gradeName: grade.name,
          subjectMap,
          counts,
          minCount,
          maxCount,
          discrepancy,
          majorityCount,
          isInconsistent,
          submittedCount: subs.length,
          mismatchesCount: rowMismatchesCount,
        })
      })
    })

    return rows
  }, [allSubmissions, schools, gradeLevels, gradeFilter, schoolFilter, laFilter, metricType, competencyMetric, columnMajorityMap])

  // ── filter & sort rows ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let list = matrixRows

    if (activeTab === 'inconsistent') {
      list = list.filter(r => r.isInconsistent)
    } else if (activeTab === 'consistent') {
      list = list.filter(r => !r.isInconsistent && r.counts.length > 1)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        r =>
          r.schoolName.toLowerCase().includes(q) ||
          r.gradeName.toLowerCase().includes(q) ||
          r.schoolCode.toLowerCase().includes(q)
      )
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortOption === 'discrepancy_desc') {
        if (b.discrepancy !== a.discrepancy) {
          return b.discrepancy - a.discrepancy
        }
        return a.schoolName.localeCompare(b.schoolName)
      }
      if (sortOption === 'school_asc') {
        return a.schoolName.localeCompare(b.schoolName)
      }
      if (sortOption === 'school_desc') {
        return b.schoolName.localeCompare(a.schoolName)
      }
      return 0
    })
  }, [matrixRows, activeTab, searchQuery, sortOption])

  // ── stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalGroups = matrixRows.length
    const multiSubj = matrixRows.filter(r => r.counts.length > 1)
    const inconsistentCount = matrixRows.filter(r => r.isInconsistent).length
    const consistentCount = multiSubj.length - inconsistentCount
    const consistencyRate = multiSubj.length > 0 ? Math.round((consistentCount / multiSubj.length) * 100) : 100
    const maxDiscrepancy = matrixRows.reduce((m, r) => Math.max(m, r.discrepancy), 0)

    return { totalGroups, multiSubjCount: multiSubj.length, inconsistentCount, consistentCount, consistencyRate, maxDiscrepancy }
  }, [matrixRows])

  const selectedGradeObj = gradeLevels.find(g => g.id === gradeFilter)
  const selectedLaObj = learningAreas.find(l => l.id === laFilter)
  const activeSY = schoolYears.find(s => s.id === syId)
  const activeTerm = terms.find(t => t.id === termId)

  return (
    <AdminLayout>
      <div className="printable-area space-y-6">
        {/* Printable DepEd Header */}
        <div className="hidden print:block mb-6 text-center border-b-2 border-black pb-4 font-sans">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-800">Republic of the Philippines • Department of Education</p>
          <p className="text-xs font-bold text-slate-700">Division of Romblon • TERMCAT Evaluation Engine</p>
          <h1 className="text-lg font-black uppercase text-black mt-1 tracking-tight">
            {metricType === 'learners' ? 'SUBJECT LEARNER CONSISTENCY COMPARISON MATRIX' : 'SUBJECT COMPETENCY CONSISTENCY COMPARISON MATRIX'}
          </h1>
          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-800 mt-2">
            <span>School Year: <strong>{activeSY?.name || 'All'}</strong></span>
            <span>Quarter/Term: <strong>{activeTerm?.name || 'All'}</strong></span>
            <span>Selected Grade: <strong>{selectedGradeObj?.name || 'All Grade Levels'}</strong></span>
            <span>Selected Subject: <strong>{selectedLaObj?.name || 'All Learning Areas'}</strong></span>
            <span>Metric: <strong>{metricType === 'learners' ? 'Total Learners' : competencyMetric.toUpperCase()}</strong></span>
          </div>
        </div>

        {/* Page Header */}
        <div className="print:hidden">
          <PageHeader
            title="Subject Consistency Matrix Tracker"
            description="Compare and verify consistency across learning areas for learner enrollment and competency coverage."
            actions={
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="deped-btn-outline inline-flex items-center gap-2 text-xs py-2 px-3"
                >
                  <Printer size={14} /> Print Matrix Report
                </button>
                <button
                  onClick={loadData}
                  disabled={loading}
                  className="deped-btn-primary inline-flex items-center gap-2 text-xs py-2 px-3"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            }
          />
        </div>

        {/* Top Metric Switcher Tabs */}
        <div className="bg-white p-2.5 rounded-2xl border border-purple-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl flex-wrap">
            <button
              onClick={() => setMetricType('learners')}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
                metricType === 'learners'
                  ? 'bg-[#8B72F4] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users size={15} />
              Learner Count Consistency
            </button>

            <button
              onClick={() => {
                setMetricType('competencies')
                setCompetencyMetric('intended')
              }}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
                metricType === 'competencies' && competencyMetric === 'intended'
                  ? 'bg-[#8B72F4] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <BookOpen size={15} />
              Intended Competencies
            </button>

            <button
              onClick={() => {
                setMetricType('competencies')
                setCompetencyMetric('taught')
              }}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
                metricType === 'competencies' && competencyMetric === 'taught'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CheckCircle2 size={15} />
              Competencies Taught
            </button>

            <button
              onClick={() => {
                setMetricType('competencies')
                setCompetencyMetric('not_taught')
              }}
              className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
                metricType === 'competencies' && competencyMetric === 'not_taught'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <AlertTriangle size={15} />
              Competencies Not Taught
            </button>
          </div>

          {metricType === 'competencies' && (
            <div className="flex items-center gap-1 bg-purple-50 p-1 rounded-xl border border-purple-200 shrink-0">
              <span className="text-[11px] font-bold text-purple-900 px-2">Metric:</span>
              <button
                onClick={() => setCompetencyMetric('intended')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  competencyMetric === 'intended'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-purple-800 hover:bg-purple-100'
                }`}
              >
                Intended
              </button>
              <button
                onClick={() => setCompetencyMetric('taught')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  competencyMetric === 'taught'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                Taught
              </button>
              <button
                onClick={() => setCompetencyMetric('not_taught')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  competencyMetric === 'not_taught'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-rose-900 hover:bg-rose-100'
                }`}
              >
                Not Taught
              </button>
            </div>
          )}
        </div>

        {/* Filters Bar */}
        <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Grade Level Selection */}
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                <GraduationCap size={13} className="text-[#8B72F4]" />
                Grade Level
              </label>
              <select
                value={gradeFilter}
                onChange={e => {
                  setGradeFilter(e.target.value)
                  setLaFilter('all')
                }}
                className="deped-input text-xs w-full font-bold bg-purple-50/50 border-purple-200 text-purple-950 focus:ring-[#8B72F4]"
              >
                <option value="all">All Grade Levels ({gradeLevels.length})</option>
                {gradeLevels.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Learning Area Filter */}
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1 flex items-center gap-1">
                <BookOpen size={13} className="text-[#8B72F4]" />
                Learning Area
              </label>
              <select
                value={laFilter}
                onChange={e => setLaFilter(e.target.value)}
                className="deped-input text-xs w-full font-bold bg-purple-50/50 border-purple-200 text-purple-950 focus:ring-[#8B72F4]"
              >
                <option value="all">All Learning Areas ({availableLearningAreas.length})</option>
                {availableLearningAreas.map(la => (
                  <option key={la.id} value={la.id}>
                    {la.name}
                  </option>
                ))}
              </select>
            </div>

            {/* School Year */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                School Year
              </label>
              <select
                value={syId}
                onChange={e => setSyId(e.target.value)}
                className="deped-input text-xs w-full"
              >
                {schoolYears.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Quarter / Term */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                Quarter / Term
              </label>
              <select
                value={termId}
                onChange={e => setTermId(e.target.value)}
                className="deped-input text-xs w-full"
              >
                {terms.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_default ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* School Filter */}
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">
                School Filter
              </label>
              <select
                value={schoolFilter}
                onChange={e => setSchoolFilter(e.target.value)}
                className="deped-input text-xs w-full"
              >
                <option value="all">All Schools ({schools.length})</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Schools Displayed
              </span>
              <Building2 size={16} className="text-[#8B72F4]" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {stats.totalGroups}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {stats.multiSubjCount} multi-subject school groups
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm bg-red-50/20">
            <div className="flex items-center justify-between text-red-600 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Inconsistent Schools
              </span>
              <AlertTriangle size={16} />
            </div>
            <div className="text-2xl font-bold text-red-600">
              {stats.inconsistentCount}
            </div>
            <p className="text-[11px] text-red-600/80 mt-1">
              {metricType === 'learners' ? 'Unequal learner count across subjects' : 'Unequal competency count across subjects'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/20">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Uniform Schools
              </span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {stats.consistentCount}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">
              {metricType === 'learners' ? 'Identical learner count in all subjects' : 'Identical competency count in all subjects'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Max Gap Difference
              </span>
              <Scale size={16} />
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {stats.maxDiscrepancy > 0 ? `±${stats.maxDiscrepancy}` : '0'}
            </div>
            <p className="text-[11px] text-amber-600 mt-1">
              {metricType === 'learners' ? 'Largest difference in learners' : 'Largest difference in competencies'}
            </p>
          </div>
        </div>

        {/* Tab & Search Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-sm print:hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'all'
                  ? 'bg-[#8B72F4] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Schools ({stats.totalGroups})
            </button>

            <button
              onClick={() => setActiveTab('inconsistent')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'inconsistent'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle size={13} />
              Inconsistent Only
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {stats.inconsistentCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('consistent')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'consistent'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={13} />
              Uniform ({stats.consistentCount})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search school name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="deped-input text-xs pl-8 py-1.5 w-full"
              />
            </div>

            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as SortOption)}
              className="deped-input text-xs py-1.5"
            >
              <option value="school_asc">Sort by School (A → Z)</option>
              <option value="school_desc">Sort by School (Z → A)</option>
              <option value="discrepancy_desc">Sort by Gap (Largest first)</option>
            </select>
          </div>
        </div>

        {/* Comparative Matrix Table */}
        {loading ? (
          <div className="py-16">
            <DepEdPageLoader label="Generating Comparative Matrix Report..." />
          </div>
        ) : filteredRows.length === 0 && initialized ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center shadow-sm space-y-3">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <h3 className="text-base font-bold text-slate-800">
              No School Entries Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try adjusting your grade level or school filters to see entries.
            </p>
          </div>
        ) : (
          initialized && (
            <div className="clay-card bg-white border border-purple-200 rounded-3xl overflow-hidden shadow-sm">
              {/* Matrix Context Header */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-purple-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    {metricType === 'learners' ? <Users size={14} /> : <BookOpen size={14} />}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900">
                      {metricType === 'learners' ? 'Subject Learner Comparison Matrix' : `Subject Competency Matrix (${competencyMetric.toUpperCase()})`} {selectedGradeObj && `— ${selectedGradeObj.name}`}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Displaying {metricType === 'learners' ? 'encoded total learners' : `encoded ${competencyMetric} competencies`} per learning area for {filteredRows.length} {filteredRows.length === 1 ? 'school' : 'schools'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    Highlighted Red: Encoded Mismatch
                  </span>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                    Green / Slate: Encoded Count Uniform
                  </span>
                </div>
              </div>

              {/* Grid Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs" style={{ minWidth: `${350 + matrixColumns.length * 110}px` }}>
                  <thead className="bg-[#2D2638] text-white font-extrabold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center border-r border-white/20">#</th>
                      <th className="py-3 px-4 min-w-[200px] border-r border-white/20">School Name</th>
                      <th className="py-3 px-3 min-w-[90px] text-center border-r border-white/20">Grade</th>

                      {/* Dynamic Subject Columns */}
                      {matrixColumns.map(la => {
                        const colKey = gradeFilter !== 'all' ? `${gradeFilter}_${la.id}` : ''
                        const colMaj = gradeFilter !== 'all' ? columnMajorityMap.get(colKey) : null

                        return (
                          <th key={la.id} className="py-3 px-3 text-center min-w-[105px] border-r border-white/15 bg-[#3B3248]">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-white leading-tight truncate max-w-[100px]" title={la.name}>
                                {la.name}
                              </span>
                              <span className="text-[8px] text-purple-200/80 font-normal">
                                {metricType === 'learners'
                                  ? 'Enc. Learners'
                                  : colMaj
                                  ? `Maj: ${colMaj.majorityCount} ${competencyMetric.slice(0, 3)}`
                                  : `${competencyMetric} Comps`}
                              </span>
                            </div>
                          </th>
                        )
                      })}

                      <th className="py-3 px-4 text-center min-w-[130px] bg-[#433854]">Consistency Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {filteredRows.map((row, idx) => {
                      return (
                        <tr
                          key={row.key}
                          className={`transition-colors align-middle ${
                            row.isInconsistent
                              ? 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500'
                              : idx % 2 === 0
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-slate-50/60 hover:bg-slate-100/60'
                          }`}
                        >
                          {/* # Index */}
                          <td className="py-3 px-3 text-center font-bold">
                            {row.isInconsistent ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-[10px]" title="Competency/Learner count differs from division majority!">
                                ⚠
                              </span>
                            ) : row.counts.length > 0 ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">
                                <Check size={12} />
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-normal">{idx + 1}</span>
                            )}
                          </td>

                          {/* School Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                                  row.isInconsistent
                                    ? 'bg-red-100 text-red-700 border border-red-300'
                                    : row.submittedCount > 0
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                <Building2 size={12} />
                              </div>
                              <div>
                                <span className={`font-bold text-xs leading-snug block ${row.isInconsistent ? 'text-red-950 font-black' : 'text-slate-800'}`}>
                                  {row.schoolName}
                                </span>
                                {row.schoolCode && (
                                  <span className="text-[9px] font-mono text-slate-500">
                                    Code: {row.schoolCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Grade Level */}
                          <td className="py-3 px-3 font-semibold text-center text-slate-700 whitespace-nowrap border-r border-purple-100">
                            {row.gradeName}
                          </td>

                          {/* Dynamic Subject Cells */}
                          {matrixColumns.map(la => {
                            const cell = row.subjectMap.get(la.id)
                            if (!cell) {
                              return (
                                <td key={la.id} className="py-3 px-3 text-center text-slate-300 border-r border-purple-100 font-mono italic text-[11px]">
                                  —
                                </td>
                              )
                            }

                            const val = cell.activeMetricValue
                            const colKey = `${row.gradeId}_${la.id}`
                            const colMajVal = columnMajorityMap.get(colKey)?.majorityCount

                            let isCellMismatch = false
                            let diffVal = 0

                            if (metricType === 'competencies') {
                              if (colMajVal !== undefined && val !== colMajVal) {
                                isCellMismatch = true
                                diffVal = val - colMajVal
                              }
                            } else {
                              isCellMismatch = row.isInconsistent && val !== row.majorityCount
                              diffVal = val - row.majorityCount
                            }

                            return (
                              <td
                                key={la.id}
                                className={`py-3 px-3 text-center border-r border-purple-100 ${
                                  isCellMismatch
                                    ? 'bg-red-100/90 text-red-900 border-2 border-red-400 font-black shadow-2xs'
                                    : row.isInconsistent
                                    ? 'bg-white text-slate-800 font-bold'
                                    : 'bg-emerald-50/50 text-emerald-900 font-bold'
                                }`}
                              >
                                <div className="flex flex-col items-center">
                                  <span className={`text-xs ${isCellMismatch ? 'text-red-950 font-black text-sm' : ''}`}>
                                    {val}
                                  </span>
                                  {metricType === 'competencies' && (
                                    <span className="text-[8px] text-slate-500 font-medium truncate max-w-[95px]" title={competencyMetric === 'not_taught' && cell.sub?.competency_summary?.reasons_for_untaught ? `Reason: ${cell.sub.competency_summary.reasons_for_untaught}` : undefined}>
                                      {competencyMetric === 'intended'
                                        ? `Tght: ${cell.competenciesTaught}`
                                        : competencyMetric === 'taught'
                                        ? `Untght: ${cell.competenciesNotTaught}`
                                        : cell.sub?.competency_summary?.reasons_for_untaught
                                        ? `Rsn: ${cell.sub.competency_summary.reasons_for_untaught}`
                                        : `Int: ${cell.intendedCompetencies}`}
                                    </span>
                                  )}
                                  {isCellMismatch && (
                                    <span className="text-[8px] font-extrabold text-red-700 bg-red-200 px-1 rounded mt-0.5 leading-none" title={`Division majority count is ${colMajVal ?? row.majorityCount}`}>
                                      {diffVal > 0 ? `+${diffVal}` : `${diffVal}`}
                                    </span>
                                  )}
                                  <span className="text-[8px] text-slate-400 font-normal truncate max-w-[80px]" title={cell.teacherName}>
                                    {cell.teacherName}
                                  </span>

                                  {/* Direct Edit link to open submission in new tab */}
                                  {cell.sub?.id && (
                                    <a
                                      href={`/admin/submissions/${cell.sub.id}/edit`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`mt-1 inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded transition-all print:hidden shadow-2xs hover:scale-105 ${
                                        isCellMismatch
                                          ? 'bg-red-600 text-white hover:bg-red-700 shadow-xs'
                                          : 'bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300/80'
                                      }`}
                                      title="Edit this submission in a new tab"
                                    >
                                      <Edit size={9} />
                                      Edit
                                      <ExternalLink size={8} className="opacity-70" />
                                    </a>
                                  )}
                                </div>
                              </td>
                            )
                          })}

                          {/* Consistency Result */}
                          <td className="py-3 px-4 text-center">
                            {row.isInconsistent ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-900 border border-red-300 font-black text-xs">
                                  <AlertCircle size={12} className="text-red-600" />
                                  {metricType === 'competencies'
                                    ? `${row.mismatchesCount} ${row.mismatchesCount === 1 ? 'Subj' : 'Subjs'} Mismatch`
                                    : `±${row.discrepancy} Learners`}
                                </span>
                                <span className="text-[9px] text-red-600 font-bold">
                                  {metricType === 'competencies'
                                    ? 'Differs from majority'
                                    : `Range: ${row.minCount} – ${row.maxCount}`}
                                </span>
                              </div>
                            ) : row.submittedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs">
                                <CheckCircle2 size={12} />
                                {metricType === 'competencies' ? 'Matches Division' : `Uniform (${row.majorityCount})`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Pending Submissions
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Matrix Footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-purple-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-900 border border-red-300 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block" />
                    {metricType === 'competencies'
                      ? 'Red Highlight: Encoded competencies differ from majority of schools for that subject'
                      : 'Red Highlight: Encoded learner count differs across assigned subjects in school'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                    {metricType === 'competencies'
                      ? 'Green Highlight: Encoded competencies match majority of schools'
                      : 'Green Highlight: Encoded learner count is uniform across all subjects'}
                  </span>
                </div>
                <span className="text-[10px] text-purple-600 font-bold">TERMCAT Matrix Consistency Engine</span>
              </div>
            </div>
          )
        )}
      </div>
    </AdminLayout>
  )
}
