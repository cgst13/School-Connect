import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  XCircle,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Sparkles,
  Calendar,
  Filter,
  Loader2,
  CheckCircle2,
  Clock,
  Layers
} from 'lucide-react'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { hasDraft, loadDraft } from '@/lib/draft/draftManager'
import {
  fetchSchools,
  fetchGradeLevels,
  fetchLearningAreas,
  fetchLearningAreaGrades,
  fetchSchoolYears,
  fetchTerms,
} from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'
import type { School, GradeLevel, LearningArea, LearningAreaGrade, SchoolYear, Term } from '@/types'

interface SubmissionRecord {
  id: string
  school_id: string
  grade_level_id: string
  learning_area_id: string
  teacher_name: string
  status: string
  submitted_at: string
}

interface SubjectStatus {
  learningArea: LearningArea
  isSubmitted: boolean
  teacherName?: string
  submittedAt?: string
  status?: string
}

interface GradeStatus {
  gradeLevel: GradeLevel
  subjects: SubjectStatus[]
  totalSubjects: number
  submittedSubjects: number
  isComplete: boolean
  isPending: boolean
}

interface SchoolStatus {
  school: School
  gradeStatuses: GradeStatus[]
  totalGrades: number
  completedGrades: number
  totalSubjects: number
  submittedSubjects: number
  isComplete: boolean
  isPending: boolean
}

export function LandingPage() {
  const navigate = useNavigate()
  const [showDraftPrompt, setShowDraftPrompt] = useState(hasDraft())
  const draft = loadDraft()

  // Master Data
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])

  // Filters & State
  const [selectedSYId, setSelectedSYId] = useState<string>('')
  const [selectedTermId, setSelectedTermId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete' | 'pending'>('all')
  const [expandedSchoolIds, setExpandedSchoolIds] = useState<Set<string>>(new Set())
  const [expandedGradeKeys, setExpandedGradeKeys] = useState<Set<string>>(new Set())

  const [loading, setLoading] = useState<boolean>(true)
  const [fetchingSubmissions, setFetchingSubmissions] = useState<boolean>(false)

  // 1. Initial Load of Master Data
  useEffect(() => {
    async function loadMasterData() {
      setLoading(true)
      try {
        const [scs, gls, las, lags, sys, tms] = await Promise.all([
          fetchSchools(true),
          fetchGradeLevels(),
          fetchLearningAreas(true),
          fetchLearningAreaGrades(),
          fetchSchoolYears(true),
          fetchTerms(true),
        ])

        setSchools(scs)
        setGradeLevels(gls)
        setLearningAreas(las)
        setLearningAreaGrades(lags)
        setSchoolYears(sys)
        setTerms(tms)

        // Select default active SY and Term
        const activeSY = sys.find(s => s.is_active) || sys[0]
        const activeTerm = tms.find(t => t.is_default || t.is_active) || tms[0]

        if (activeSY) setSelectedSYId(activeSY.id)
        if (activeTerm) setSelectedTermId(activeTerm.id)
      } catch (err) {
        console.error('Error loading master data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMasterData()
  }, [])

  // 2. Fetch Submissions whenever SY or Term changes
  useEffect(() => {
    if (!selectedSYId || !selectedTermId) return

    async function loadSubmissions() {
      setFetchingSubmissions(true)
      try {
        const { data, error } = await supabase
          .from('termcat_submissions')
          .select('id, school_id, grade_level_id, learning_area_id, teacher_name, status, submitted_at')
          .eq('school_year_id', selectedSYId)
          .eq('term_id', selectedTermId)
          .neq('status', 'returned')

        if (error) throw error
        setSubmissions(data || [])
      } catch (err) {
        console.error('Error fetching submissions for matrix:', err)
      } finally {
        setFetchingSubmissions(false)
      }
    }

    loadSubmissions()
  }, [selectedSYId, selectedTermId])

  // 3. Compute School & Grade Compliance Matrix
  const schoolStatuses = useMemo<SchoolStatus[]>(() => {
    if (!schools.length || !gradeLevels.length || !learningAreas.length) return []

    // Map submissions by key: `${school_id}_${grade_level_id}_${learning_area_id}`
    const subMap = new Map<string, SubmissionRecord>()
    submissions.forEach(sub => {
      const key = `${sub.school_id}_${sub.grade_level_id}_${sub.learning_area_id}`
      subMap.set(key, sub)
    })

    // Map learning areas assigned to each grade level
    const gradeSubjectMap = new Map<string, LearningArea[]>()
    learningAreaGrades.forEach(lag => {
      const la = learningAreas.find(a => a.id === lag.learning_area_id)
      if (la) {
        if (!gradeSubjectMap.has(lag.grade_level_id)) {
          gradeSubjectMap.set(lag.grade_level_id, [])
        }
        gradeSubjectMap.get(lag.grade_level_id)!.push(la)
      }
    })

    return schools.map(school => {
      // Find applicable grade levels for school type
      const appGrades = gradeLevels.filter(g => g.school_type === school.school_type)

      let totalSchoolSubjects = 0
      let submittedSchoolSubjects = 0
      let completedGradesCount = 0

      const gradeStatuses: GradeStatus[] = appGrades.map(gl => {
        const reqSubjects = gradeSubjectMap.get(gl.id) || []
        let submittedCount = 0

        const subjects: SubjectStatus[] = reqSubjects.map(la => {
          const key = `${school.id}_${gl.id}_${la.id}`
          const sub = subMap.get(key)
          if (sub) {
            submittedCount++
            return {
              learningArea: la,
              isSubmitted: true,
              teacherName: sub.teacher_name,
              submittedAt: sub.submitted_at,
              status: sub.status,
            }
          }
          return {
            learningArea: la,
            isSubmitted: false,
          }
        })

        const totalSubs = reqSubjects.length
        const isGradeComp = totalSubs > 0 && submittedCount === totalSubs
        const isGradePend = submittedCount === 0

        totalSchoolSubjects += totalSubs
        submittedSchoolSubjects += submittedCount
        if (isGradeComp) completedGradesCount++

        return {
          gradeLevel: gl,
          subjects,
          totalSubjects: totalSubs,
          submittedSubjects: submittedCount,
          isComplete: isGradeComp,
          isPending: isGradePend,
        }
      })

      const totalGradesCount = appGrades.length
      const isSchoolComp = totalGradesCount > 0 && completedGradesCount === totalGradesCount
      const isSchoolPend = submittedSchoolSubjects === 0

      return {
        school,
        gradeStatuses,
        totalGrades: totalGradesCount,
        completedGrades: completedGradesCount,
        totalSubjects: totalSchoolSubjects,
        submittedSubjects: submittedSchoolSubjects,
        isComplete: isSchoolComp,
        isPending: isSchoolPend,
      }
    })
  }, [schools, gradeLevels, learningAreas, learningAreaGrades, submissions])

  // Filtered Schools
  const filteredSchoolStatuses = useMemo(() => {
    return schoolStatuses.filter(item => {
      const matchesSearch = item.school.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      if (!matchesSearch) return false

      if (statusFilter === 'complete') return item.isComplete
      if (statusFilter === 'incomplete') return !item.isComplete && !item.isPending
      if (statusFilter === 'pending') return item.isPending

      return true
    })
  }, [schoolStatuses, searchQuery, statusFilter])

  // Overall Statistics
  const overallStats = useMemo(() => {
    const totalSchools = schoolStatuses.length
    const completedSchools = schoolStatuses.filter(s => s.isComplete).length
    const totalGrades = schoolStatuses.reduce((acc, s) => acc + s.totalGrades, 0)
    const completedGrades = schoolStatuses.reduce((acc, s) => acc + s.completedGrades, 0)
    const totalSubjects = schoolStatuses.reduce((acc, s) => acc + s.totalSubjects, 0)
    const submittedSubjects = schoolStatuses.reduce((acc, s) => acc + s.submittedSubjects, 0)

    return {
      totalSchools,
      completedSchools,
      totalGrades,
      completedGrades,
      totalSubjects,
      submittedSubjects,
    }
  }, [schoolStatuses])

  const toggleSchoolAccordion = (schoolId: string) => {
    setExpandedSchoolIds(prev => {
      const next = new Set(prev)
      if (next.has(schoolId)) {
        next.delete(schoolId)
      } else {
        next.add(schoolId)
      }
      return next
    })
  }

  const toggleGradeAccordion = (schoolId: string, gradeId: string) => {
    const key = `${schoolId}_${gradeId}`
    setExpandedGradeKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleExpandAllGradesForSchool = (schoolItem: SchoolStatus) => {
    const allGradeKeys = schoolItem.gradeStatuses.map(gs => `${schoolItem.school.id}_${gs.gradeLevel.id}`)
    const areAllExpanded = allGradeKeys.every(k => expandedGradeKeys.has(k))

    setExpandedGradeKeys(prev => {
      const next = new Set(prev)
      if (areAllExpanded) {
        allGradeKeys.forEach(k => next.delete(k))
      } else {
        allGradeKeys.forEach(k => next.add(k))
      }
      return next
    })
  }

  const toggleExpandAll = () => {
    if (expandedSchoolIds.size === filteredSchoolStatuses.length && filteredSchoolStatuses.length > 0) {
      setExpandedSchoolIds(new Set())
      setExpandedGradeKeys(new Set())
    } else {
      setExpandedSchoolIds(new Set(filteredSchoolStatuses.map(s => s.school.id)))
      // Also expand all grades
      const allKeys = new Set<string>()
      filteredSchoolStatuses.forEach(s => {
        s.gradeStatuses.forEach(gs => {
          allKeys.add(`${s.school.id}_${gs.gradeLevel.id}`)
        })
      })
      setExpandedGradeKeys(allKeys)
    }
  }

  const handleStart = () => {
    navigate('/submit')
  }

  const handleContinueDraft = () => {
    navigate('/submit?draft=true')
  }

  const handleNewSubmission = () => {
    setShowDraftPrompt(false)
    navigate('/submit?new=true')
  }

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-10">
        {/* Hero Section (Start Submission Button only) */}
        <div className="text-center max-w-3xl mx-auto">
          {/* Logo Mark */}
          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-2xl bg-deped-blue flex items-center justify-center shadow-card-lg">
              <span className="text-white text-2xl font-extrabold tracking-tight">TC</span>
            </div>
          </div>

          {/* Branding */}
          <div className="mb-2">
            <span className="inline-block bg-deped-blue-light text-deped-blue text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Concepcion District · Romblon
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-content-primary mt-2 leading-tight">
            TERMCAT
          </h1>
          <p className="text-base sm:text-lg text-content-secondary font-medium mt-1">
            Teacher Data Collection & Consolidation System
          </p>
          <p className="text-xs sm:text-sm text-content-tertiary mt-2">
            Submit your TERMCAT data quickly and securely. No teacher account is required.
          </p>

          {/* Draft Prompt or Start Submission CTA */}
          {showDraftPrompt && draft ? (
            <div className="mt-8 card p-5 max-w-md mx-auto border-deped-blue/30 bg-deped-blue-light text-left shadow-md animate-fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className="text-deped-blue flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-deped-blue-dark">Saved Draft Found</p>
                  <p className="text-xs text-deped-blue-dark/70 mt-0.5">
                    Last saved: {new Date(draft.savedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleContinueDraft} className="btn-md btn-primary flex-1">
                  Continue Previous
                </button>
                <button onClick={handleNewSubmission} className="btn-md btn-secondary flex-1">
                  Start New
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button
                id="start-submission-btn"
                onClick={handleStart}
                className="btn-lg btn-primary shadow-card-md text-base px-8 py-3.5 flex items-center gap-2 transition-transform hover:scale-105"
                aria-label="Start TERMCAT submission"
              >
                Start Submission
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>
          )}

          <p className="text-xs text-content-tertiary mt-3">
            No teacher account required. Quick 5-step form.
          </p>
        </div>

        {/* Divider */}
        <hr className="border-slate-200" />

        {/* School Submission Status Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-deped-blue font-bold text-sm">
                <Layers size={18} />
                <span>DISTRICT COMPLIANCE MATRIX</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-content-primary mt-1">
                School Submission Status
              </h2>
              <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
                Click any school to view its grade levels, then click a grade level to expand its subject completion status.
              </p>
            </div>

            {/* SY & Quarter Filters */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-500">
                <Calendar size={14} />
                <span>Period:</span>
              </div>

              <select
                value={selectedSYId}
                onChange={e => setSelectedSYId(e.target.value)}
                className="input-sm text-xs font-medium bg-white border-slate-300"
              >
                {schoolYears.map(sy => (
                  <option key={sy.id} value={sy.id}>
                    {sy.name} {sy.is_active ? '(Active)' : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedTermId}
                onChange={e => setSelectedTermId(e.target.value)}
                className="input-sm text-xs font-medium bg-white border-slate-300"
              >
                {terms.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_default ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Statistics Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="card p-4 bg-white border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-deped-blue flex items-center justify-center flex-shrink-0">
                <Building2 size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Total Schools</p>
                <p className="text-lg sm:text-xl font-bold text-slate-800">{overallStats.totalSchools}</p>
              </div>
            </div>

            <div className="card p-4 bg-white border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Fully Complete</p>
                <p className="text-lg sm:text-xl font-bold text-emerald-600">
                  {overallStats.completedSchools} / {overallStats.totalSchools}
                </p>
              </div>
            </div>

            <div className="card p-4 bg-white border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Grades Complete</p>
                <p className="text-lg sm:text-xl font-bold text-amber-600">
                  {overallStats.completedGrades} / {overallStats.totalGrades}
                </p>
              </div>
            </div>

            <div className="card p-4 bg-white border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <BookOpen size={20} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Subjects Submitted</p>
                <p className="text-lg sm:text-xl font-bold text-indigo-600">
                  {overallStats.submittedSubjects} / {overallStats.totalSubjects}
                </p>
              </div>
            </div>
          </div>

          {/* Search, Status Filter & Expand All Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search school name..."
                className="input-sm pl-9 w-full text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Filter size={14} />
                <span>Filter:</span>
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="input-sm text-xs font-medium border-slate-300"
              >
                <option value="all">All Statuses</option>
                <option value="complete">🟢 Complete Only</option>
                <option value="incomplete">🟡 In Progress Only</option>
                <option value="pending">🔴 Not Started Only</option>
              </select>

              <button
                onClick={toggleExpandAll}
                className="btn-xs btn-secondary text-xs font-semibold whitespace-nowrap ml-1"
              >
                {expandedSchoolIds.size === filteredSchoolStatuses.length && filteredSchoolStatuses.length > 0
                  ? 'Collapse All'
                  : 'Expand All'}
              </button>
            </div>
          </div>

          {/* Expandable Schools Accordion List */}
          {loading || fetchingSubmissions ? (
            <div className="card p-12 text-center text-slate-500 space-y-3">
              <Loader2 size={32} className="animate-spin mx-auto text-deped-blue" />
              <p className="text-sm font-medium">Loading school submission status matrix...</p>
            </div>
          ) : filteredSchoolStatuses.length === 0 ? (
            <div className="card p-10 text-center text-slate-500 space-y-2">
              <Building2 size={36} className="mx-auto text-slate-400 mb-2" />
              <p className="text-base font-semibold text-slate-700">No schools match the filter criteria</p>
              <p className="text-xs text-slate-500">
                Try searching for a different school name or clearing the status filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSchoolStatuses.map(item => {
                const { school, gradeStatuses, totalGrades, completedGrades, totalSubjects, submittedSubjects, isComplete, isPending } = item
                const isExpanded = expandedSchoolIds.has(school.id)
                const completionPercentage = totalSubjects > 0 ? Math.round((submittedSubjects / totalSubjects) * 100) : 0

                const allGradeKeys = gradeStatuses.map(gs => `${school.id}_${gs.gradeLevel.id}`)
                const areAllGradesExpanded = allGradeKeys.every(k => expandedGradeKeys.has(k))

                return (
                  <div
                    key={school.id}
                    className={`card border transition-all duration-200 overflow-hidden ${
                      isExpanded ? 'border-deped-blue/40 shadow-md' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* School Header Row (Level 1 Accordion trigger) */}
                    <div
                      onClick={() => toggleSchoolAccordion(school.id)}
                      className="p-4 sm:p-5 bg-white hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                            isComplete
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          <Building2 size={22} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                              {school.name}
                            </h3>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {school.school_type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{completedGrades} of {totalGrades} Grades Completed</span>
                            <span>•</span>
                            <span>{submittedSubjects} of {totalSubjects} Subjects Submitted ({completionPercentage}%)</span>
                          </p>
                        </div>
                      </div>

                      {/* Status Badges & Controls */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Overall School Badge */}
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={14} className="text-emerald-600" />
                            Completed
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle size={14} className="text-rose-600" />
                            Not Started
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock size={14} className="text-amber-600" />
                            In Progress ({submittedSubjects}/{totalSubjects})
                          </span>
                        )}

                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Grade Level Accordions List */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-6 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 flex-wrap">
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                              <GraduationCap size={16} className="text-deped-blue" />
                              Grade Levels in {school.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Click any grade level to view its list of subjects and submission status.
                            </p>
                          </div>

                          <button
                            onClick={e => {
                              e.stopPropagation()
                              toggleExpandAllGradesForSchool(item)
                            }}
                            className="btn-xs btn-secondary text-xs font-semibold"
                          >
                            {areAllGradesExpanded ? 'Collapse All Grades' : 'Expand All Grades'}
                          </button>
                        </div>

                        <div className="space-y-3">
                          {gradeStatuses.map(gs => {
                            const gradeKey = `${school.id}_${gs.gradeLevel.id}`
                            const isGradeExpanded = expandedGradeKeys.has(gradeKey)

                            return (
                              <div
                                key={gs.gradeLevel.id}
                                className={`card border transition-all duration-150 overflow-hidden bg-white ${
                                  isGradeExpanded
                                    ? 'border-deped-blue/30 shadow-sm'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {/* Grade Header (Level 2 Accordion Trigger) */}
                                <div
                                  onClick={() => toggleGradeAccordion(school.id, gs.gradeLevel.id)}
                                  className="p-3.5 sm:p-4 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center flex-shrink-0 ${
                                        gs.isComplete
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : gs.isPending
                                          ? 'bg-slate-100 text-slate-700'
                                          : 'bg-amber-100 text-amber-900'
                                      }`}
                                    >
                                      G{gs.gradeLevel.grade_number}
                                    </span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-bold text-slate-900">{gs.gradeLevel.name}</h5>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold px-1.5 py-0.5 bg-slate-100 rounded">
                                          Key Stage {gs.gradeLevel.key_stage.replace('ks', '')}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {gs.submittedSubjects} of {gs.totalSubjects} subjects submitted
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                        gs.isComplete
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : gs.isPending
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-amber-50 text-amber-800 border-amber-200'
                                      }`}
                                    >
                                      {gs.isComplete
                                        ? '🟢 Complete'
                                        : gs.isPending
                                        ? '🔴 Not Started'
                                        : `🟡 ${gs.submittedSubjects}/${gs.totalSubjects} Submitted`}
                                    </span>

                                    <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                                      {isGradeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                  </div>
                                </div>

                                {/* Subjects List (Visible when Grade is expanded) */}
                                {isGradeExpanded && (
                                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-2 animate-fade-in">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-1">
                                      <span>Learning Area / Subject</span>
                                      <span>Status & Teacher</span>
                                    </div>

                                    {gs.subjects.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic py-2">
                                        No learning areas configured for this grade level.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {gs.subjects.map(sub => (
                                          <div
                                            key={sub.learningArea.id}
                                            className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-medium border ${
                                              sub.isSubmitted
                                                ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950'
                                                : 'bg-white border-slate-200 text-slate-600'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 overflow-hidden pr-2">
                                              {sub.isSubmitted ? (
                                                <Check size={15} className="text-emerald-600 flex-shrink-0" />
                                              ) : (
                                                <XCircle size={15} className="text-slate-400 flex-shrink-0" />
                                              )}
                                              <span className="truncate font-semibold">{sub.learningArea.name}</span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              {sub.isSubmitted ? (
                                                <div className="text-right">
                                                  <span className="inline-block px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                                                    Submitted
                                                  </span>
                                                  {sub.teacherName && (
                                                    <p className="text-[10px] text-emerald-800 font-bold truncate max-w-[130px] mt-0.5">
                                                      {sub.teacherName}
                                                    </p>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                                  Missing
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}


