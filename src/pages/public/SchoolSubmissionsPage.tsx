import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { PageLoader, EmptyState } from '@/components/ui/EmptyState'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import {
  fetchSchools, fetchSubmissionsBySchool, fetchGradeLevels,
  fetchLearningAreas, fetchSchoolYears, fetchTerms, fetchLearningAreaGrades
} from '@/lib/supabase/queries'
import type { TermcatSubmission, School, GradeLevel, LearningArea, SchoolYear, Term, LearningAreaGrade } from '@/types'
import { format } from 'date-fns'
import {
  Building2, GraduationCap, BookOpen, Printer, Eye, X, ArrowLeft,
  Calendar, Clock, CheckCircle2, AlertCircle, Sparkles, ExternalLink, ChevronDown, Layers, Filter, RefreshCw
} from 'lucide-react'

interface GradeGroup {
  gradeLevel: GradeLevel
  items: Array<{
    learningArea: LearningArea
    submission: TermcatSubmission | null
    isSubmitted: boolean
  }>
  total: number
  submitted: number
  missing: number
  rate: number
  status: 'complete' | 'partial' | 'none'
}

interface SubjectGroup {
  learningArea: LearningArea
  items: Array<{
    gradeLevel: GradeLevel
    submission: TermcatSubmission | null
    isSubmitted: boolean
  }>
  total: number
  submitted: number
  missing: number
  rate: number
  status: 'complete' | 'partial' | 'none'
}

export function SchoolSubmissionsPage() {
  const [searchParams] = useSearchParams()
  const schoolId = searchParams.get('id') || searchParams.get('school_id') || ''

  const [school, setSchool] = useState<School | null>(null)
  const [submissions, setSubmissions] = useState<TermcatSubmission[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])

  const [loading, setLoading] = useState(true)

  // Filters state
  const [selectedSY, setSelectedSY] = useState<string>('')
  const [selectedTerm, setSelectedTerm] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'jhs' | 'shs' | 'elementary'>('all')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')

  // View Mode: 'per_grade' | 'per_subject'
  const [viewMode, setViewMode] = useState<'per_grade' | 'per_subject'>('per_grade')

  // Expanded Accordion State
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())

  // Modal Preview State
  const [selectedSub, setSelectedSub] = useState<TermcatSubmission | null>(null)

  const loadData = async () => {
    if (!schoolId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [allSchools, subs, g, la, lag, sy, t] = await Promise.all([
        fetchSchools(false),
        fetchSubmissionsBySchool(schoolId),
        fetchGradeLevels(),
        fetchLearningAreas(false),
        fetchLearningAreaGrades(),
        fetchSchoolYears(false),
        fetchTerms(false),
      ])

      const foundSchool = allSchools.find(s => s.id === schoolId) || null
      setSchool(foundSchool)
      setSubmissions(subs)
      setGrades(g)
      setLearningAreas(la)
      setLearningAreaGrades(lag)
      setSchoolYears(sy)
      setTerms(t)

      const activeSY = sy.find(item => item.is_active)
      if (activeSY && !selectedSY) setSelectedSY(activeSY.id)

      const defaultTerm = t.find(item => item.is_default || item.is_active)
      if (defaultTerm && !selectedTerm) setSelectedTerm(defaultTerm.id)
    } catch (err) {
      console.error('Failed to load school submissions data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [schoolId])

  // Filter submissions by selected School Year & Term
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (selectedSY && sub.school_year_id !== selectedSY) return false
      if (selectedTerm && sub.term_id !== selectedTerm) return false
      return true
    })
  }, [submissions, selectedSY, selectedTerm])

  // Applicable grade levels for the school (filtered by level and grade level selection)
  const applicableGrades = useMemo(() => {
    if (!school || !grades.length) return grades
    return grades.filter(g => {
      if (!g.is_active) return false

      if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
        if (!school.offered_grade_numbers.includes(g.grade_number)) return false
      } else {
        if (school.school_type === 'elementary' && g.grade_number > 6) return false
        if (school.school_type === 'secondary' && g.grade_number < 7) return false
      }

      if (selectedLevel === 'jhs') {
        if (g.grade_number < 7 || g.grade_number > 10) return false
      } else if (selectedLevel === 'shs') {
        if (g.grade_number < 11 || g.grade_number > 12) return false
      } else if (selectedLevel === 'elementary') {
        if (g.grade_number < 1 || g.grade_number > 6) return false
      }

      if (selectedGradeId && g.id !== selectedGradeId) return false

      return true
    }).sort((a, b) => a.grade_number - b.grade_number)
  }, [school, grades, selectedLevel, selectedGradeId])

  // Grade level dropdown options (for selectedLevel context)
  const availableGradeOptions = useMemo(() => {
    if (!school || !grades.length) return grades
    return grades.filter(g => {
      if (!g.is_active) return false
      if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
        if (!school.offered_grade_numbers.includes(g.grade_number)) return false
      } else {
        if (school.school_type === 'elementary' && g.grade_number > 6) return false
        if (school.school_type === 'secondary' && g.grade_number < 7) return false
      }

      if (selectedLevel === 'jhs') {
        if (g.grade_number < 7 || g.grade_number > 10) return false
      } else if (selectedLevel === 'shs') {
        if (g.grade_number < 11 || g.grade_number > 12) return false
      } else if (selectedLevel === 'elementary') {
        if (g.grade_number < 1 || g.grade_number > 6) return false
      }

      return true
    }).sort((a, b) => a.grade_number - b.grade_number)
  }, [school, grades, selectedLevel])

  // Map grade_level_id -> Set of assigned learning_area_ids
  const gradeToLAsMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    learningAreaGrades.forEach(lag => {
      if (!map.has(lag.grade_level_id)) {
        map.set(lag.grade_level_id, new Set())
      }
      map.get(lag.grade_level_id)!.add(lag.learning_area_id)
    })
    return map
  }, [learningAreaGrades])

  // Map key `${grade_level_id}_${learning_area_id}` -> TermcatSubmission
  const subMap = useMemo(() => {
    const map = new Map<string, TermcatSubmission>()
    filteredSubmissions.forEach(sub => {
      const key = `${sub.grade_level_id}_${sub.learning_area_id}`
      if (!map.has(key)) {
        map.set(key, sub)
      }
    })
    return map
  }, [filteredSubmissions])

  // OPTION 1: Group Data Per Grade Level
  const gradeGroups = useMemo<GradeGroup[]>(() => {
    if (!school || !applicableGrades.length || !learningAreas.length) return []

    return applicableGrades.map(grade => {
      const assignedLAIds = gradeToLAsMap.get(grade.id)
      const relevantLAs = assignedLAIds && assignedLAIds.size > 0
        ? learningAreas.filter(la => la.is_active && assignedLAIds.has(la.id))
        : learningAreas.filter(la => la.is_active)

      const items = relevantLAs.map(la => {
        const key = `${grade.id}_${la.id}`
        const submission = subMap.get(key) || null
        return {
          learningArea: la,
          submission,
          isSubmitted: Boolean(submission),
        }
      })

      const total = items.length
      const submitted = items.filter(i => i.isSubmitted).length
      const missing = total - submitted
      const rate = total > 0 ? Math.round((submitted / total) * 100) : 0

      let status: 'complete' | 'partial' | 'none' = 'none'
      if (submitted === total && total > 0) status = 'complete'
      else if (submitted > 0) status = 'partial'

      return {
        gradeLevel: grade,
        items,
        total,
        submitted,
        missing,
        rate,
        status,
      }
    })
  }, [school, applicableGrades, learningAreas, gradeToLAsMap, subMap])

  // OPTION 2: Group Data Per Learning Area (Subject)
  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    if (!school || !applicableGrades.length || !learningAreas.length) return []

    const activeLAs = learningAreas.filter(la => la.is_active)

    return activeLAs.map(la => {
      // Find grades that offer this learning area
      const relevantGrades = applicableGrades.filter(grade => {
        const assignedSet = gradeToLAsMap.get(grade.id)
        if (assignedSet && assignedSet.size > 0) {
          return assignedSet.has(la.id)
        }
        return true
      })

      const items = relevantGrades.map(grade => {
        const key = `${grade.id}_${la.id}`
        const submission = subMap.get(key) || null
        return {
          gradeLevel: grade,
          submission,
          isSubmitted: Boolean(submission),
        }
      })

      const total = items.length
      const submitted = items.filter(i => i.isSubmitted).length
      const missing = total - submitted
      const rate = total > 0 ? Math.round((submitted / total) * 100) : 0

      let status: 'complete' | 'partial' | 'none' = 'none'
      if (submitted === total && total > 0) status = 'complete'
      else if (submitted > 0) status = 'partial'

      return {
        learningArea: la,
        items,
        total,
        submitted,
        missing,
        rate,
        status,
      }
    }).filter(group => group.total > 0)
  }, [school, applicableGrades, learningAreas, gradeToLAsMap, subMap])

  // Auto-expand accordions initially
  useEffect(() => {
    if (gradeGroups.length > 0 && expandedGrades.size === 0) {
      setExpandedGrades(new Set(gradeGroups.map(g => g.gradeLevel.id)))
    }
    if (subjectGroups.length > 0 && expandedSubjects.size === 0) {
      setExpandedSubjects(new Set(subjectGroups.map(s => s.learningArea.id)))
    }
  }, [gradeGroups, subjectGroups])

  // Summary statistics for the school
  const totalSlots = gradeGroups.reduce((acc, g) => acc + g.total, 0)
  const totalSubmitted = gradeGroups.reduce((acc, g) => acc + g.submitted, 0)
  const overallRate = totalSlots > 0 ? Math.round((totalSubmitted / totalSlots) * 100) : 0
  const participatingTeachers = useMemo(() => {
    const names = new Set(filteredSubmissions.map(s => s.teacher_name).filter(Boolean))
    return names.size
  }, [filteredSubmissions])

  if (loading) {
    return (
      <PublicLayout>
        <div className="w-full px-4 sm:px-8 py-12">
          <PageLoader />
        </div>
      </PublicLayout>
    )
  }

  if (!schoolId || !school) {
    return (
      <PublicLayout>
        <div className="w-full px-4 sm:px-8 py-12 space-y-4">
          <Link to="/admin/submissions" className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#795CEE] shadow-xs hover:bg-[#F6EFFF] transition-all no-print">
            <ArrowLeft size={15} /> Back to Submissions
          </Link>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs">
            <EmptyState
              title="School not found"
              description="The requested school profile could not be loaded or specified."
              icon={<Building2 size={32} className="text-blue-600" />}
            />
          </div>
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className="w-full px-4 sm:px-8 py-6 sm:py-8 space-y-6 animate-fade-in">
        {/* Top Navigation & Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3 no-print">
          <Link
            to="/admin/submissions"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#795CEE] shadow-xs hover:bg-[#F6EFFF] transition-all cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Submissions Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-2xl bg-white text-[#795CEE] border border-purple-100 font-extrabold text-xs shadow-xs hover:bg-purple-50 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Page Report</span>
            </button>
            <button
              onClick={loadData}
              className="p-2.5 rounded-2xl bg-white text-[#8B72F4] border border-purple-100 shadow-xs hover:bg-purple-50 transition-all cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* 3D Claymorphic School Header Banner */}
        <div className="bg-gradient-to-r from-[#8B72F4] via-[#9F85F7] to-[#A88BEB] rounded-[32px] p-6 sm:p-8 text-white shadow-[0_18px_40px_-10px_rgba(139,114,244,0.35)] border-2 border-white/20 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 backdrop-blur-md">
                  {school.school_type === 'elementary' ? 'Elementary School (ES)' : 'High School (HS)'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-400/30 text-amber-100 border border-amber-300/30 backdrop-blur-md flex items-center gap-1">
                  <Sparkles size={11} /> School Submissions Profile
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white flex items-center gap-3">
                <Building2 size={32} className="text-purple-200 shrink-0" />
                <span>{school.name}</span>
              </h1>
              <p className="text-xs sm:text-sm text-purple-100 font-medium max-w-2xl">
                Comprehensive TERMCAT submissions & evaluation compliance audit profile.
              </p>
            </div>

            {/* Overall Rate Badge */}
            <div className="bg-white/15 p-4 sm:p-5 rounded-2xl border border-white/30 backdrop-blur-md flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {overallRate}%
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-100">
                  Compliance Rate
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* SUMMARY STATS & CONTEXT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/90 p-4 rounded-2xl border border-purple-100 shadow-2xs space-y-1">
            <div className="text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Submissions Logged</span>
            </div>
            <div className="text-xl font-black text-[#2D2638]">{totalSubmitted} / {totalSlots}</div>
            <div className="text-[10px] text-emerald-700 font-bold">{totalSubmitted} completed forms</div>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-purple-100 shadow-2xs space-y-1">
            <div className="text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle size={14} className="text-rose-500" />
              <span>Missing Forms</span>
            </div>
            <div className="text-xl font-black text-[#2D2638]">{totalSlots - totalSubmitted}</div>
            <div className="text-[10px] text-rose-700 font-bold">Pending submission</div>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-purple-100 shadow-2xs space-y-1">
            <div className="text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={14} className="text-[#8B72F4]" />
              <span>Grade Levels</span>
            </div>
            <div className="text-xl font-black text-[#2D2638]">{applicableGrades.length}</div>
            <div className="text-[10px] text-[#8B72F4] font-bold">Grades offered</div>
          </div>

          <div className="bg-white/90 p-4 rounded-2xl border border-purple-100 shadow-2xs space-y-1">
            <div className="text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#795CEE]" />
              <span>Teachers Tagged</span>
            </div>
            <div className="text-xl font-black text-[#2D2638]">{participatingTeachers}</div>
            <div className="text-[10px] text-[#795CEE] font-bold">Active submitters</div>
          </div>
        </div>

        {/* FILTER & VIEW TOGGLE CONTROLS BAR */}
        <div className="bg-white/90 p-4 rounded-3xl border-2 border-white shadow-[0_8px_20px_rgba(185,170,210,0.12)] space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Filter selectors grid */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* School Year */}
              <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                <Calendar size={15} className="text-[#8B72F4]" />
                <span>SY:</span>
                <select
                  value={selectedSY}
                  onChange={e => setSelectedSY(e.target.value)}
                  className="bg-transparent font-black text-[#8B72F4] focus:outline-none cursor-pointer"
                >
                  <option value="">All School Years</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>

              {/* Term / Quarter */}
              <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                <Clock size={15} className="text-[#795CEE]" />
                <span>Term:</span>
                <select
                  value={selectedTerm}
                  onChange={e => setSelectedTerm(e.target.value)}
                  className="bg-transparent font-black text-[#795CEE] focus:outline-none cursor-pointer"
                >
                  <option value="">All Quarters</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Level Filter (JHS vs SHS vs ES) */}
              <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                <Filter size={15} className="text-[#8B72F4]" />
                <span>Level:</span>
                <select
                  value={selectedLevel}
                  onChange={e => {
                    const lvl = e.target.value as 'all' | 'jhs' | 'shs' | 'elementary'
                    setSelectedLevel(lvl)
                    setSelectedGradeId('')
                  }}
                  className="bg-transparent font-black text-[#8B72F4] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Levels</option>
                  {school?.school_type === 'secondary' ? (
                    <>
                      <option value="jhs">Junior HS (Grades 7–10)</option>
                      <option value="shs">Senior HS (Grades 11–12)</option>
                    </>
                  ) : (
                    <option value="elementary">Elementary (ES)</option>
                  )}
                </select>
              </div>

              {/* Specific Grade Level Filter */}
              <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                <GraduationCap size={15} className="text-[#795CEE]" />
                <span>Grade:</span>
                <select
                  value={selectedGradeId}
                  onChange={e => setSelectedGradeId(e.target.value)}
                  className="bg-transparent font-black text-[#795CEE] focus:outline-none cursor-pointer"
                >
                  <option value="">All Grades ({availableGradeOptions.length})</option>
                  {availableGradeOptions.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {(selectedLevel !== 'all' || selectedGradeId !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevel('all')
                    setSelectedGradeId('')
                  }}
                  className="px-3 py-2 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1"
                >
                  <X size={14} /> Reset Filters
                </button>
              )}
            </div>

            {/* VIEW MODE SELECTION TABS (Option 1: Per Grade Level vs Option 2: Per Learning Area) */}
            <div className="bg-[#FAF5F0] p-1.5 rounded-2xl border border-purple-100 flex items-center gap-1 self-start lg:self-auto shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('per_grade')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'per_grade'
                  ? 'bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white shadow-md'
                  : 'text-[#7A7289] hover:bg-purple-50 hover:text-[#2D2638]'
              }`}
            >
              <GraduationCap size={15} />
              <span>Option 1: View per Grade Level</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('per_subject')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                viewMode === 'per_subject'
                  ? 'bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white shadow-md'
                  : 'text-[#7A7289] hover:bg-purple-50 hover:text-[#2D2638]'
              }`}
            >
              <BookOpen size={15} />
              <span>Option 2: View per Learning Area</span>
            </button>
          </div>
        </div>
      </div>

        {/* DATA PRESENTATION AREA */}
        {viewMode === 'per_grade' ? (
          /* ============================================================ */
          /* OPTION 1: VIEW PER GRADE LEVEL                               */
          /* ============================================================ */
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#2D2638] flex items-center gap-2">
                <GraduationCap size={16} className="text-[#8B72F4]" />
                <span>Submissions Grouped per Grade Level ({gradeGroups.length} Grades)</span>
              </span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setExpandedGrades(new Set(gradeGroups.map(g => g.gradeLevel.id)))}
                  className="font-bold text-[#8B72F4] hover:underline cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-purple-200">|</span>
                <button
                  type="button"
                  onClick={() => setExpandedGrades(new Set())}
                  className="font-bold text-[#7A7289] hover:underline cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {gradeGroups.map(group => {
              const isExpanded = expandedGrades.has(group.gradeLevel.id)
              const toggleExpand = () => {
                setExpandedGrades(prev => {
                  const next = new Set(prev)
                  if (next.has(group.gradeLevel.id)) next.delete(group.gradeLevel.id)
                  else next.add(group.gradeLevel.id)
                  return next
                })
              }

              return (
                <div
                  key={group.gradeLevel.id}
                  className="bg-white/90 rounded-[28px] border-2 border-white shadow-[0_8px_20px_rgba(185,170,210,0.12)] overflow-hidden transition-all"
                >
                  {/* Grade Card Header */}
                  <div
                    onClick={toggleExpand}
                    className={`p-5 flex items-center justify-between cursor-pointer select-none transition-colors border-l-4 ${
                      group.status === 'complete'
                        ? 'border-l-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60'
                        : group.status === 'partial'
                        ? 'border-l-amber-500 bg-amber-50/30 hover:bg-amber-50/60'
                        : 'border-l-rose-500 bg-rose-50/30 hover:bg-rose-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-[#8B72F4] transition-transform ${isExpanded ? 'rotate-180 bg-purple-100' : 'bg-[#FAF5F0]'}`}>
                        <ChevronDown size={18} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-[#2D2638]">
                            {group.gradeLevel.name}
                          </h3>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white border border-purple-100 text-[#8B72F4]">
                            Key Stage {group.gradeLevel.key_stage.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-[#7A7289] font-medium mt-0.5">
                          {group.submitted} of {group.total} subjects submitted ({group.rate}% completed)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {group.status === 'complete' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Fully Complete ({group.submitted}/{group.total})
                        </span>
                      ) : group.status === 'partial' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                          <AlertCircle size={13} className="text-amber-600" />
                          Partial ({group.submitted}/{group.total} Submitted)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                          <AlertCircle size={13} className="text-rose-600" />
                          No Submissions (0/{group.total})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Subjects Table */}
                  {isExpanded && (
                    <div className="border-t border-purple-100 overflow-x-auto bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#FAF5F0] border-b border-purple-100 text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-5">Learning Area / Subject</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Assigned Teacher</th>
                            <th className="py-3 px-4">Performance / Metrics</th>
                            <th className="py-3 px-4">Ref Number</th>
                            <th className="py-3 px-4">Date Logged</th>
                            <th className="py-3 px-5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {group.items.map((item, idx) => {
                            const sub = item.submission
                            return (
                              <tr key={idx} className={item.isSubmitted ? 'hover:bg-purple-50/30' : 'bg-rose-50/20 hover:bg-rose-50/40'}>
                                <td className="py-3 px-5 font-bold text-[#2D2638]">
                                  <div className="flex items-center gap-2">
                                    <BookOpen size={15} className="text-[#8B72F4] shrink-0" />
                                    <span>{item.learningArea.name}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {item.isSubmitted ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                      <CheckCircle2 size={11} className="text-emerald-600" /> Submitted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                                      <AlertCircle size={11} className="text-rose-600" /> Missing
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {sub ? (
                                    <a
                                      href={`/teacher-submissions?name=${encodeURIComponent(sub.teacher_name)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-bold text-[#2D2638] hover:text-[#8B72F4] transition-colors inline-flex items-center gap-1"
                                      title={`Click to view all submissions by ${sub.teacher_name} (opens in new tab)`}
                                    >
                                      <span>{sub.teacher_name}</span>
                                      <ExternalLink size={12} className="text-[#8B72F4] opacity-60 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-[#A39BAF] italic">No submission</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {sub ? (
                                    sub.form_type === 'ks1' ? (
                                      <span className="text-[11px] font-semibold text-[#7A7289]">
                                        Adv: {sub.ks1_learner_data?.advancing || 0} · Bch: {sub.ks1_learner_data?.benchmarking || 0}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-[#8B72F4]">
                                        {sub.ks2to4_learner_data?.mps !== null && sub.ks2to4_learner_data?.mps !== undefined ? `${sub.ks2to4_learner_data.mps}% MPS` : 'N/A'}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[#A39BAF]">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs font-bold text-[#8B72F4]">
                                  {sub ? sub.reference_number : '—'}
                                </td>
                                <td className="py-3 px-4 text-xs font-medium text-[#7A7289]">
                                  {sub ? format(new Date(sub.submitted_at), 'MMM d, yyyy') : '—'}
                                </td>
                                <td className="py-3 px-5 text-right">
                                  {sub ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSub(sub)}
                                      className="px-3 py-1.5 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/30 font-bold text-xs hover:bg-[#8B72F4] hover:text-white transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Eye size={13} />
                                      <span>View Form</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* OPTION 2: VIEW PER LEARNING AREA (SUBJECT)                   */
          /* ============================================================ */
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#2D2638] flex items-center gap-2">
                <BookOpen size={16} className="text-[#8B72F4]" />
                <span>Submissions Grouped per Learning Area ({subjectGroups.length} Subjects)</span>
              </span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setExpandedSubjects(new Set(subjectGroups.map(s => s.learningArea.id)))}
                  className="font-bold text-[#8B72F4] hover:underline cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-purple-200">|</span>
                <button
                  type="button"
                  onClick={() => setExpandedSubjects(new Set())}
                  className="font-bold text-[#7A7289] hover:underline cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {subjectGroups.map(group => {
              const isExpanded = expandedSubjects.has(group.learningArea.id)
              const toggleExpand = () => {
                setExpandedSubjects(prev => {
                  const next = new Set(prev)
                  if (next.has(group.learningArea.id)) next.delete(group.learningArea.id)
                  else next.add(group.learningArea.id)
                  return next
                })
              }

              return (
                <div
                  key={group.learningArea.id}
                  className="bg-white/90 rounded-[28px] border-2 border-white shadow-[0_8px_20px_rgba(185,170,210,0.12)] overflow-hidden transition-all"
                >
                  {/* Subject Card Header */}
                  <div
                    onClick={toggleExpand}
                    className={`p-5 flex items-center justify-between cursor-pointer select-none transition-colors border-l-4 ${
                      group.status === 'complete'
                        ? 'border-l-emerald-500 bg-emerald-50/30 hover:bg-emerald-50/60'
                        : group.status === 'partial'
                        ? 'border-l-amber-500 bg-amber-50/30 hover:bg-amber-50/60'
                        : 'border-l-rose-500 bg-rose-50/30 hover:bg-rose-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-[#8B72F4] transition-transform ${isExpanded ? 'rotate-180 bg-purple-100' : 'bg-[#FAF5F0]'}`}>
                        <ChevronDown size={18} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-[#2D2638]">
                            {group.learningArea.name}
                          </h3>
                        </div>
                        <p className="text-xs text-[#7A7289] font-medium mt-0.5">
                          {group.submitted} of {group.total} offered grade levels submitted ({group.rate}% completed)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {group.status === 'complete' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Fully Complete ({group.submitted}/{group.total})
                        </span>
                      ) : group.status === 'partial' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                          <AlertCircle size={13} className="text-amber-600" />
                          Partial ({group.submitted}/{group.total} Submitted)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                          <AlertCircle size={13} className="text-rose-600" />
                          No Submissions (0/{group.total})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Grade Level Table for Subject */}
                  {isExpanded && (
                    <div className="border-t border-purple-100 overflow-x-auto bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#FAF5F0] border-b border-purple-100 text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-5">Offered Grade Level</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Assigned Teacher</th>
                            <th className="py-3 px-4">Performance / Metrics</th>
                            <th className="py-3 px-4">Ref Number</th>
                            <th className="py-3 px-4">Date Logged</th>
                            <th className="py-3 px-5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {group.items.map((item, idx) => {
                            const sub = item.submission
                            return (
                              <tr key={idx} className={item.isSubmitted ? 'hover:bg-purple-50/30' : 'bg-rose-50/20 hover:bg-rose-50/40'}>
                                <td className="py-3 px-5 font-bold text-[#2D2638]">
                                  <div className="flex items-center gap-2">
                                    <GraduationCap size={15} className="text-[#8B72F4] shrink-0" />
                                    <span>{item.gradeLevel.name}</span>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-[#8B72F4] border border-purple-100">
                                      KS {item.gradeLevel.key_stage.toUpperCase()}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {item.isSubmitted ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                      <CheckCircle2 size={11} className="text-emerald-600" /> Submitted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                                      <AlertCircle size={11} className="text-rose-600" /> Missing
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {sub ? (
                                    <a
                                      href={`/teacher-submissions?name=${encodeURIComponent(sub.teacher_name)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-bold text-[#2D2638] hover:text-[#8B72F4] transition-colors inline-flex items-center gap-1"
                                      title={`Click to view all submissions by ${sub.teacher_name} (opens in new tab)`}
                                    >
                                      <span>{sub.teacher_name}</span>
                                      <ExternalLink size={12} className="text-[#8B72F4] opacity-60 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="text-[#A39BAF] italic">No submission</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {sub ? (
                                    sub.form_type === 'ks1' ? (
                                      <span className="text-[11px] font-semibold text-[#7A7289]">
                                        Adv: {sub.ks1_learner_data?.advancing || 0} · Bch: {sub.ks1_learner_data?.benchmarking || 0}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-[#8B72F4]">
                                        {sub.ks2to4_learner_data?.mps !== null && sub.ks2to4_learner_data?.mps !== undefined ? `${sub.ks2to4_learner_data.mps}% MPS` : 'N/A'}
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-[#A39BAF]">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-mono text-xs font-bold text-[#8B72F4]">
                                  {sub ? sub.reference_number : '—'}
                                </td>
                                <td className="py-3 px-4 text-xs font-medium text-[#7A7289]">
                                  {sub ? format(new Date(sub.submitted_at), 'MMM d, yyyy') : '—'}
                                </td>
                                <td className="py-3 px-5 text-right">
                                  {sub ? (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSub(sub)}
                                      className="px-3 py-1.5 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/30 font-bold text-xs hover:bg-[#8B72F4] hover:text-white transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Eye size={13} />
                                      <span>View Form</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* OFFICIAL TERMCAT FORM OVERLAY MODAL */}
      {selectedSub && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/40 backdrop-blur-md flex flex-col items-center p-2 sm:p-4 animate-fade-in no-print">
          <div className="bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_25px_60px_-15px_rgba(139,114,244,0.3)] w-full max-w-[96vw] overflow-hidden flex flex-col my-auto max-h-[94vh]">
            {/* Header Controls */}
            <div className="bg-gradient-to-r from-[#8B72F4] via-[#9F85F7] to-[#A88BEB] text-white px-6 py-4.5 flex items-center justify-between border-b-2 border-white/20 shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-xs">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-display tracking-tight text-white flex items-center gap-2">
                    Official TERMCAT Form Submission ({selectedSub.reference_number})
                  </h3>
                  <p className="text-xs text-purple-100 font-medium">
                    {selectedSub.teacher_name} · {selectedSub.school?.name} · {selectedSub.grade_level?.name} ({selectedSub.learning_area?.name})
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
                  className="px-4 py-2 rounded-2xl bg-white text-[#795CEE] font-black text-xs shadow-md hover:bg-purple-50 transition-all flex items-center gap-2 cursor-pointer border border-white"
                >
                  <Printer size={15} />
                  <span>Print Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 text-white hover:bg-white/40 flex items-center justify-center font-extrabold text-lg shadow-xs transition-all cursor-pointer"
                  title="Close viewer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Template Render Area */}
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-auto flex-1 bg-[#FAF5F0]">
              <div className="w-full bg-white rounded-[28px] border-2 border-white shadow-[0_10px_30px_rgba(185,170,210,0.15)] p-4 sm:p-6 overflow-x-auto">
                <OfficialTermcatTemplate
                  submissions={[selectedSub]}
                  formType={selectedSub.form_type}
                  epsName={selectedSub.teacher_name}
                  sdoName="Division of Romblon"
                  learningAreaName={selectedSub.learning_area?.name || 'Learning Area'}
                  termName={selectedSub.term?.name || 'Quarter'}
                  schoolYearName={selectedSub.school_year?.name || 'School Year'}
                  showPrintButton={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/90 px-6 py-4 border-t border-purple-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-[#7A7289] font-medium">
                Official DepEd TERMCAT Evaluation Record Archive
              </span>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="px-5 py-2 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#7A7289] hover:bg-purple-50 transition-all shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  )
}
