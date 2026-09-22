import { useEffect, useState, useMemo, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import {
  fetchConsolidationData, fetchSchools, fetchGradeLevels, fetchLearningAreas,
  fetchSchoolYears, fetchTerms, fetchLearningAreaGrades, saveConsolidatedReport, fetchConsolidatedReports,
  deleteConsolidatedReport, fetchLearningCompetencies
} from '@/lib/supabase/queries'
import type {
  ConsolidationFilters, ConsolidationResult, TermcatSubmission, CompetencyCount,
  School, GradeLevel, LearningArea, LearningAreaGrade, SchoolYear, Term, SubmissionStatus,
  TermcatConsolidatedReport, LearningCompetency
} from '@/types'
import {
  Download, RefreshCw, Printer, FileSpreadsheet, LayoutList, CheckCircle2,
  AlertCircle, XCircle, Building2, BookOpen, GraduationCap, Calendar, Clock,
  Sparkles, Save, History, Trash2, Eye, ShieldCheck, FileText, Check, X, HelpCircle
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/features/auth/useAuth'
import { generateExcelExport } from '@/lib/excel/excelExport'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import { PageHeader } from '@/components/ui/PageHeader'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
import { format } from 'date-fns'
import { groupAndDeduplicateCompetencies } from '@/lib/competencies/grouping'

function computeConsolidation(submissions: TermcatSubmission[], filters: ConsolidationFilters): ConsolidationResult {
  const ks1Subs = submissions.filter(s => s.form_type === 'ks1')
  const ks24Subs = submissions.filter(s => s.form_type === 'ks2to4')

  // Numeric aggregates
  const totalLearners = submissions.reduce((acc, s) => acc + (s.ks1_learner_data?.total_learners || s.ks2to4_learner_data?.total_learners || 0), 0)
  const ks1Advancing = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.advancing || 0), 0)
  const ks1Benchmarking = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.benchmarking || 0), 0)
  const ks1Connecting = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.connecting || 0), 0)
  const ks1Developing = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.developing || 0), 0)
  const ks1Emerging = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.emerging || 0), 0)

  const mpsValues = ks24Subs.filter(s => s.ks2to4_learner_data?.mps !== null && s.ks2to4_learner_data?.mps !== undefined).map(s => s.ks2to4_learner_data!.mps!)
  const averageMps = mpsValues.length > 0 ? +(mpsValues.reduce((a, b) => a + b, 0) / mpsValues.length).toFixed(2) : null

  // Fixed competency counts (Don't sum across submissions!)
  const firstCompSum = submissions.find(s => s.competency_summary && s.competency_summary.total_intended_competencies > 0)?.competency_summary
  const totalIntended = firstCompSum?.total_intended_competencies ?? (
    submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + (s.competency_summary?.total_intended_competencies || 0), 0) / submissions.length) : 0
  )
  const totalTaught = firstCompSum?.competencies_taught ?? (
    submissions.length > 0 ? Math.round(submissions.reduce((acc, s) => acc + (s.competency_summary?.competencies_taught || 0), 0) / submissions.length) : 0
  )
  const totalNotTaught = Math.max(0, totalIntended - totalTaught)

  // Competency frequency with similarity grouping & reporting school details
  function aggregateCompetencies(category: string): CompetencyCount[] {
    const rawList: { text: string; school_name: string; teacher_name: string; reference_number: string; submission_id: string }[] = []
    for (const sub of submissions) {
      for (const c of (sub.submission_competencies || [])) {
        if (c.category === category && c.competency_text?.trim()) {
          rawList.push({
            text: c.competency_text.trim(),
            school_name: sub.school?.name || 'Unknown School',
            teacher_name: sub.teacher_name || 'Teacher',
            reference_number: sub.reference_number || 'Ref No.',
            submission_id: sub.id,
          })
        }
      }
    }
    return groupAndDeduplicateCompetencies(rawList)
  }

  function aggregateFactors(): CompetencyCount[] {
    const rawList: { text: string; school_name: string; teacher_name: string; reference_number: string; submission_id: string }[] = []
    for (const sub of submissions) {
      const text = sub.instructional_difficulty?.factors_text?.trim()
      if (text) {
        const parts = text.split(/;|\n/).map(p => p.trim()).filter(Boolean)
        for (const p of parts) {
          rawList.push({
            text: p,
            school_name: sub.school?.name || 'Unknown School',
            teacher_name: sub.teacher_name || 'Teacher',
            reference_number: sub.reference_number || 'Ref No.',
            submission_id: sub.id,
          })
        }
      }
    }
    return groupAndDeduplicateCompetencies(rawList)
  }

  const instructionalDifficultyTexts = submissions
    .map(s => s.instructional_difficulty?.factors_text)
    .filter(Boolean) as string[]

  return {
    filters,
    submissions,
    totalSubmissions: submissions.length,
    totalLearners,
    ks1Advancing, ks1Benchmarking, ks1Connecting, ks1Developing, ks1Emerging,
    averageMps,
    totalIntended, totalTaught, totalNotTaught,
    mostLearned: aggregateCompetencies('most_learned'),
    leastMastered: aggregateCompetencies('least_mastered'),
    mostDifficult: aggregateCompetencies('most_difficult_to_teach'),
    factorsContributing: aggregateFactors(),
    instructionalDifficultyTexts,
  }
}

export function ConsolidationPage() {
  const { admin, getPermittedSchoolIds, getPermittedSchools, hasFullAccess } = useAuth()
  const { toast } = useToast()
  
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])

  const [activeTab, setActiveTab] = useState<'consolidate' | 'by_subject' | 'history'>('consolidate')
  const [viewMode, setViewMode] = useState<'single_table' | 'official_template' | 'cards'>('single_table')

  // Subject-by-Grade Consolidation state
  const [bySubjSYId, setBySubjSYId] = useState('')
  const [bySubjTermId, setBySubjTermId] = useState('')
  const [bySubjLAId, setBySubjLAId] = useState('')
  const [bySubjSchoolFilter, setBySubjSchoolFilter] = useState('all')
  const [loadingBySubject, setLoadingBySubject] = useState(false)
  const [allSubmissionsForSubject, setAllSubmissionsForSubject] = useState<TermcatSubmission[]>([])
  const [bySubjectViewMode, setBySubjectViewMode] = useState<'official_template' | 'single_table'>('official_template')

  const enrichedSubmissions = useMemo(() => {
    return allSubmissionsForSubject.map(sub => {
      if (!sub.grade_level && sub.grade_level_id) {
        const g = grades.find(gr => gr.id === sub.grade_level_id)
        if (g) return { ...sub, grade_level: g }
      }
      return sub
    })
  }, [allSubmissionsForSubject, grades])

  const ks1Submissions = useMemo(() => {
    return enrichedSubmissions.filter(s => {
      if (s.form_type === 'ks1') return true
      const gNum = s.grade_level?.grade_number
      return gNum !== undefined && gNum >= 1 && gNum <= 3
    })
  }, [enrichedSubmissions])

  const ks24Submissions = useMemo(() => {
    return enrichedSubmissions.filter(s => {
      if (s.form_type === 'ks2to4') return true
      const gNum = s.grade_level?.grade_number
      return gNum !== undefined && gNum >= 4
    })
  }, [enrichedSubmissions])

  const permittedSchools = useMemo(() => {
    const active = schools.filter(s => s.is_active !== false)
    return getPermittedSchools(active)
  }, [schools, getPermittedSchools])

  const [filters, setFilters] = useState<ConsolidationFilters>({
    school_year_id: '',
    term_id: '',
    school_level: 'all',
    school_id: 'all',
    grade_level_id: 'all',
    learning_area_id: 'all',
    key_stage: 'all',
    statuses: ['submitted', 'reviewed', 'finalized'],
  })

  // Submissions compliance pre-check state
  const [checkingCompliance, setCheckingCompliance] = useState(false)
  const [currentSubmissions, setCurrentSubmissions] = useState<TermcatSubmission[]>([])
  const [result, setResult] = useState<ConsolidationResult | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [breakdownModal, setBreakdownModal] = useState<{
    categoryTitle: string
    competency: CompetencyCount
    totalSubmissions: number
  } | null>(null)

  const [savedReports, setSavedReports] = useState<TermcatConsolidatedReport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [viewingSavedReport, setViewingSavedReport] = useState<TermcatConsolidatedReport | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [showAnalysisCards, setShowAnalysisCards] = useState(false)
  const [showSchoolEntries, setShowSchoolEntries] = useState(false)

  // BOW Competencies for selected Grade & Subject
  const [gradeCompetencies, setGradeCompetencies] = useState<LearningCompetency[]>([])
  const [loadingCompetencies, setLoadingCompetencies] = useState(false)

  useEffect(() => {
    if (filters.grade_level_id !== 'all' && filters.learning_area_id !== 'all') {
      const selectedGradeObj = grades.find(g => g.id === filters.grade_level_id)
      const selectedLAObj = learningAreas.find(l => l.id === filters.learning_area_id)
      const selectedTermObj = terms.find(t => t.id === filters.term_id)

      if (selectedGradeObj && selectedLAObj) {
        setLoadingCompetencies(true)
        fetchLearningCompetencies({
          grade_number: selectedGradeObj.grade_number,
          learning_area_name: selectedLAObj.name,
          term_name: selectedTermObj?.name
        }).then(res => {
          setGradeCompetencies(res.data)
        }).catch(() => {
          setGradeCompetencies([])
        }).finally(() => {
          setLoadingCompetencies(false)
        })
      }
    } else {
      setGradeCompetencies([])
    }
  }, [filters.grade_level_id, filters.learning_area_id, filters.term_id, grades, learningAreas, terms])

  useEffect(() => {
    Promise.all([
      fetchSchools(true), fetchGradeLevels(), fetchLearningAreas(false),
      fetchSchoolYears(false), fetchTerms(false), fetchLearningAreaGrades()
    ]).then(([s, g, la, sy, t, lag]) => {
      setSchools(s)
      setGrades(g)
      setLearningAreas(la)
      setSchoolYears(sy)
      setTerms(t)
      setLearningAreaGrades(lag)

      const activeSY = sy.find(y => y.is_active)
      const activeTerm = t.find(y => y.is_default || y.is_active)
      setFilters(f => ({
        ...f,
        school_year_id: activeSY?.id || (sy[0]?.id || ''),
        term_id: activeTerm?.id || (t[0]?.id || '')
      }))
      setBySubjSYId(activeSY?.id || (sy[0]?.id || ''))
      setBySubjTermId(activeTerm?.id || (t[0]?.id || ''))
      if (la.length > 0) setBySubjLAId(la[0].id)
    }).finally(() => {
      setInitializing(false)
    })
  }, [])

  // Filter grade levels dynamically by School Level Selection and selected School
  const availableGrades = useMemo(() => {
    let result = grades
    if (filters.school_level === 'elementary') {
      result = result.filter(g => g.grade_number >= 0 && g.grade_number <= 6)
    } else if (filters.school_level === 'junior_hs') {
      result = result.filter(g => g.grade_number >= 7 && g.grade_number <= 10)
    } else if (filters.school_level === 'senior_hs') {
      result = result.filter(g => g.grade_number >= 11 && g.grade_number <= 12)
    }
    if (filters.school_id && filters.school_id !== 'all') {
      const selectedSchool = schools.find(s => s.id === filters.school_id)
      if (selectedSchool && Array.isArray(selectedSchool.offered_grade_numbers) && selectedSchool.offered_grade_numbers.length > 0) {
        result = result.filter(g => selectedSchool.offered_grade_numbers!.includes(g.grade_number))
      }
    }
    return result
  }, [filters.school_level, filters.school_id, grades, schools])

  // Filter Learning Areas dynamically for specific selected Grade Level
  const availableLearningAreas = useMemo(() => {
    if (learningAreaGrades.length === 0) return learningAreas

    // 1. If a specific grade level is selected:
    if (filters.grade_level_id !== 'all') {
      const mappedLAIds = new Set(
        learningAreaGrades
          .filter(lag => lag.grade_level_id === filters.grade_level_id)
          .map(lag => lag.learning_area_id)
      )
      if (mappedLAIds.size > 0) {
        return learningAreas.filter(la => mappedLAIds.has(la.id))
      }
    }

    // 2. If a specific school_level is selected:
    if (filters.school_level !== 'all') {
      const validGradeIds = new Set(availableGrades.map(g => g.id))
      const mappedLAIds = new Set(
        learningAreaGrades
          .filter(lag => validGradeIds.has(lag.grade_level_id))
          .map(lag => lag.learning_area_id)
      )
      if (mappedLAIds.size > 0) {
        return learningAreas.filter(la => mappedLAIds.has(la.id))
      }
    }

    return learningAreas
  }, [filters.grade_level_id, filters.school_level, availableGrades, learningAreaGrades, learningAreas])

  // Auto-reset selected learning_area_id if it's no longer valid for the newly selected grade
  useEffect(() => {
    if (
      filters.learning_area_id !== 'all' &&
      availableLearningAreas.length > 0 &&
      !availableLearningAreas.some(la => la.id === filters.learning_area_id)
    ) {
      setFilters(f => ({ ...f, learning_area_id: 'all' }))
    }
  }, [availableLearningAreas, filters.learning_area_id])

  // Expected schools based on school_level filter and assigned grade numbers from School Directory & Governance
  const expectedSchools = useMemo(() => {
    let base = permittedSchools
    if (filters.school_level === 'elementary') {
      base = base.filter(s => s.school_type === 'elementary')
    } else if (filters.school_level === 'junior_hs' || filters.school_level === 'senior_hs') {
      base = base.filter(s => s.school_type === 'secondary')
    }

    if (filters.grade_level_id && filters.grade_level_id !== 'all') {
      const selectedGradeObj = grades.find(g => g.id === filters.grade_level_id)
      if (selectedGradeObj) {
        base = base.filter(school => {
          if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
            return school.offered_grade_numbers.includes(selectedGradeObj.grade_number)
          }
          if (school.school_type === 'elementary') return selectedGradeObj.grade_number <= 6
          if (school.school_type === 'secondary') return selectedGradeObj.grade_number >= 7
          return true
        })
      }
    }

    if (filters.school_id && filters.school_id !== 'all') {
      base = base.filter(s => s.id === filters.school_id)
    }

    return base
  }, [filters.school_level, filters.grade_level_id, filters.school_id, permittedSchools, grades])

  // Real-time compliance check for selected filters
  const performComplianceCheck = useCallback(async () => {
    if (!filters.school_year_id || !filters.term_id) return
    setCheckingCompliance(true)
    try {
      const effectiveFilters = { ...filters }
      if (!hasFullAccess() && schools.length > 0) {
        ;(effectiveFilters as any).school_ids = getPermittedSchoolIds(schools.map(s => s.id))
      }
      const data = await fetchConsolidationData(effectiveFilters)
      const activeIds = new Set(schools.filter(s => s.is_active !== false).map(s => s.id))
      const filtered = (data || []).filter(sub => !sub.school_id || activeIds.has(sub.school_id))
      setCurrentSubmissions(filtered)
    } catch {
      console.warn('Compliance check failed')
    } finally {
      setCheckingCompliance(false)
    }
  }, [filters, hasFullAccess, getPermittedSchoolIds, schools])

  useEffect(() => {
    performComplianceCheck()
  }, [performComplianceCheck])

  // Fetch submissions for Subject-by-Grade consolidation tab
  const loadBySubjectData = useCallback(async () => {
    if (!bySubjSYId || !bySubjTermId || !bySubjLAId || bySubjLAId === 'all') {
      setAllSubmissionsForSubject([])
      return
    }
    setLoadingBySubject(true)
    try {
      const effectiveFilters: ConsolidationFilters = {
        school_year_id: bySubjSYId,
        term_id: bySubjTermId,
        school_level: 'all',
        school_id: bySubjSchoolFilter,
        grade_level_id: 'all',
        learning_area_id: bySubjLAId,
        key_stage: 'all',
        statuses: ['submitted', 'reviewed', 'finalized'],
      }
      if (!hasFullAccess() && schools.length > 0) {
        ;(effectiveFilters as any).school_ids = getPermittedSchoolIds(schools.map(s => s.id))
      }
      const data = await fetchConsolidationData(effectiveFilters)
      const activeIds = new Set(schools.filter(s => s.is_active !== false).map(s => s.id))
      const filtered = (data || []).filter(sub => !sub.school_id || activeIds.has(sub.school_id))
      setAllSubmissionsForSubject(filtered)
    } catch {
      toast('Failed to fetch subject consolidation data.', 'error')
    } finally {
      setLoadingBySubject(false)
    }
  }, [bySubjSYId, bySubjTermId, bySubjLAId, bySubjSchoolFilter, hasFullAccess, getPermittedSchoolIds, schools, toast])

  useEffect(() => {
    if (activeTab === 'by_subject') {
      loadBySubjectData()
    }
  }, [activeTab, loadBySubjectData])

  // Subject-by-Grade Consolidation Rows computation
  const subjectGradeConsolidationRows = useMemo(() => {
    if (!bySubjLAId || bySubjLAId === 'all') return []

    // 1. Identify grade levels assigned to this learning area
    const assignedGradeIds = new Set(
      learningAreaGrades
        .filter(lag => lag.learning_area_id === bySubjLAId)
        .map(lag => lag.grade_level_id)
    )

    // Fallback: check all grade levels present in submissions
    if (assignedGradeIds.size === 0) {
      allSubmissionsForSubject.forEach(sub => {
        if (sub.grade_level_id) assignedGradeIds.add(sub.grade_level_id)
      })
    }

    const offeredGrades = grades
      .filter(g => assignedGradeIds.has(g.id))
      .sort((a, b) => a.grade_number - b.grade_number)

    return offeredGrades.map(grade => {
      const gradeSubs = allSubmissionsForSubject.filter(s => s.grade_level_id === grade.id)
      const filterObj: ConsolidationFilters = {
        school_year_id: bySubjSYId,
        term_id: bySubjTermId,
        school_level: 'all',
        school_id: bySubjSchoolFilter,
        grade_level_id: grade.id,
        learning_area_id: bySubjLAId,
        key_stage: 'all',
        statuses: ['submitted', 'reviewed', 'finalized'],
      }
      const res = computeConsolidation(gradeSubs, filterObj)

      const submittedSchoolIds = new Set(gradeSubs.map(s => s.school_id))

      return {
        grade,
        subs: gradeSubs,
        result: res,
        submittedCount: gradeSubs.length,
        submittedSchoolsCount: submittedSchoolIds.size,
      }
    })
  }, [bySubjLAId, bySubjSYId, bySubjTermId, bySubjSchoolFilter, learningAreaGrades, grades, allSubmissionsForSubject])

  // Identify which expected schools have submitted and which are missing
  const { submittedSchools, missingSchools, isSpecificFilterSelected, canConsolidate } = useMemo(() => {
    const submittedSchoolIds = new Set(currentSubmissions.map(s => s.school_id))
    const submitted = expectedSchools.filter(s => submittedSchoolIds.has(s.id))
    const missing = expectedSchools.filter(s => !submittedSchoolIds.has(s.id))
    
    // Validation requires selecting a specific Grade Level AND a specific Learning Area
    const isSpecific = filters.grade_level_id !== 'all' && filters.learning_area_id !== 'all'
    
    // Can consolidate whenever a specific Grade & Subject are selected AND there is at least 1 submission logged!
    const allowed = isSpecific && currentSubmissions.length > 0

    return {
      submittedSchools: submitted,
      missingSchools: missing,
      isSpecificFilterSelected: isSpecific,
      canConsolidate: allowed,
    }
  }, [currentSubmissions, expectedSchools, filters.grade_level_id, filters.learning_area_id])

  // Load Saved Reports History
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const history = await fetchConsolidatedReports()
      setSavedReports(history as TermcatConsolidatedReport[])
    } catch {
      toast('Failed to load consolidation history.', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }, [toast])

  useEffect(() => {
    if (activeTab === 'history') loadHistory()
  }, [activeTab, loadHistory])

  // Consolidate Data locally (Compute metrics without auto-saving)
  const handleConsolidate = () => {
    if (!canConsolidate) {
      toast('Cannot consolidate. Please select a specific Grade Level and Learning Area first.', 'warning')
      return
    }

    setLoading(true)
    try {
      const computed = computeConsolidation(currentSubmissions, filters)
      setResult(computed)
      setIsSaved(false)
      toast('Data consolidated successfully! Review the matrix below or click "Save Consolidation".', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to compute consolidation.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Save Consolidation to Supabase / Saved Reports tab
  const handleSaveConsolidation = async () => {
    if (!result) {
      toast('No active consolidation dataset to save.', 'warning')
      return
    }

    setSaving(true)
    try {
      const selectedGradeObj = grades.find(g => g.id === filters.grade_level_id)
      const selectedLAObj = learningAreas.find(l => l.id === filters.learning_area_id)
      const selectedSYObj = schoolYears.find(y => y.id === filters.school_year_id)
      const selectedTermObj = terms.find(t => t.id === filters.term_id)

      const levelTitle = filters.school_level === 'elementary'
        ? 'Elementary'
        : filters.school_level === 'junior_hs'
        ? 'Junior High School'
        : filters.school_level === 'senior_hs'
        ? 'Senior High School'
        : 'All Levels'

      const title = `Consolidated Report — ${levelTitle} (${selectedGradeObj?.name || 'Grade'}) — ${selectedLAObj?.name || 'Subject'} [${selectedSYObj?.name || ''} ${selectedTermObj?.name || ''}]`

      await saveConsolidatedReport({
        title,
        school_year_id: filters.school_year_id,
        term_id: filters.term_id,
        level_type: filters.school_level,
        grade_level_id: filters.grade_level_id,
        learning_area_id: filters.learning_area_id,
        total_schools_included: expectedSchools.length,
        total_submissions_count: result.totalSubmissions,
        total_learners_count: result.totalLearners,
        average_mps: result.averageMps,
        consolidated_data: {
          ks1Advancing: result.ks1Advancing,
          ks1Benchmarking: result.ks1Benchmarking,
          ks1Connecting: result.ks1Connecting,
          ks1Developing: result.ks1Developing,
          ks1Emerging: result.ks1Emerging,
          totalIntended: result.totalIntended,
          totalTaught: result.totalTaught,
          totalNotTaught: result.totalNotTaught,
          mostLearnedTop3: result.mostLearned.slice(0, 5),
          leastMasteredTop3: result.leastMastered.slice(0, 5),
          instructionalDifficultiesCount: result.instructionalDifficultyTexts.length,
        },
        created_by: admin?.id || null,
        created_by_name: admin?.full_name || 'Admin',
      })

      setIsSaved(true)
      setLastSavedTime(format(new Date(), 'MMM d, yyyy · h:mm a'))
      toast('Consolidation saved to Saved Reports tab successfully!', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to save consolidation result to Supabase.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!result) return
    setExporting(true)
    try {
      await generateExcelExport(result.submissions, 'Consolidated_Data')
      toast('Excel file generated successfully.', 'success')
    } catch {
      toast('Failed to generate Excel.', 'error')
    } finally {
      setExporting(false)
    }
  }

  const setF = (key: keyof ConsolidationFilters, val: any) => {
    setFilters(f => {
      const next = { ...f, [key]: val }
      // Reset grade level if not in available grades when level changes
      if (key === 'school_level') {
        next.grade_level_id = 'all'
      }
      return next
    })
  }

  const selectedSY = schoolYears.find(y => y.id === filters.school_year_id)?.name
  const selectedTerm = terms.find(t => t.id === filters.term_id)?.name
  const selectedLA = learningAreas.find(l => l.id === filters.learning_area_id)?.name || 'All Learning Areas'
  const selectedGrade = grades.find(g => g.id === filters.grade_level_id)?.name || 'All Grades'

  const levelLabel = filters.school_level === 'elementary'
    ? 'Elementary'
    : filters.school_level === 'junior_hs'
    ? 'Junior High School'
    : filters.school_level === 'senior_hs'
    ? 'Senior High School'
    : 'All Levels'

  return (
    <AdminLayout>
      {initializing ? (
        <DepEdPageLoader
          label="Loading District Data Consolidation Engine..."
          subtitle="Fetching school directories, grade scopes, and active school terms"
        />
      ) : (
        <div className="space-y-6">
        {/* Header */}
        <PageHeader
          badge="District Data Consolidation"
          title="Data Consolidation & Verification"
          description="Validate 100% school submission completion across Elementary, Junior HS, and Senior HS levels before consolidating evaluation metrics into Supabase."
          actions={
            <div className="inline-flex p-1 bg-white/90 rounded-2xl border border-purple-100 shadow-2xs flex-wrap gap-1">
              <button
                onClick={() => setActiveTab('consolidate')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'consolidate'
                    ? 'bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-[#F6EFFF]/50'
                }`}
              >
                <LayoutList size={15} />
                <span>New Consolidation</span>
              </button>
              <button
                onClick={() => setActiveTab('by_subject')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'by_subject'
                    ? 'bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-[#F6EFFF]/50'
                }`}
              >
                <BookOpen size={15} />
                <span>Consolidation by Subject</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-[#F6EFFF]/50'
                }`}
              >
                <History size={15} />
                <span>Saved Reports</span>
              </button>
            </div>
          }
        />

        {/* TAB 1: NEW CONSOLIDATION WORKFLOW */}
        {activeTab === 'consolidate' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter & Level Selection Card */}
            <div className="clay-card p-6 space-y-5 bg-gradient-to-br from-white via-white to-[#F6EFFF]/40 border border-purple-100 shadow-md rounded-3xl no-print">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#2D2638]">Select Consolidation Criteria</h2>
                    <p className="text-xs text-[#7A7289] font-medium">Choose School Level, Grade, and Learning Area to verify submission completion</p>
                  </div>
                </div>
                {checkingCompliance && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8B72F4] bg-[#F6EFFF] px-3 py-1 rounded-full border border-[#8B72F4]/20 animate-pulse">
                    <RefreshCw size={12} className="animate-spin" /> Verifying Submissions...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. School Year */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-[#8B72F4]" />
                    <span>School Year *</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={filters.school_year_id}
                    onChange={e => setF('school_year_id', e.target.value)}
                  >
                    <option value="">Select SY...</option>
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>

                {/* 2. Quarter / Term */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Clock size={13} className="text-[#795CEE]" />
                    <span>Quarter / Term *</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={filters.term_id}
                    onChange={e => setF('term_id', e.target.value)}
                  >
                    <option value="">Select Term...</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* 3. Grade Level */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <GraduationCap size={13} className="text-[#795CEE]" />
                    <span>Grade Level *</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={filters.grade_level_id}
                    onChange={e => setF('grade_level_id', e.target.value)}
                  >
                    <option value="all">Select Grade Level...</option>
                    {availableGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                {/* 4. Learning Area */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <BookOpen size={13} className="text-[#8B72F4]" />
                      <span>Learning Area *</span>
                    </span>
                    {availableLearningAreas.length < learningAreas.length && (
                      <span className="text-[10px] text-[#8B72F4] font-bold">
                        ({availableLearningAreas.length} for Grade)
                      </span>
                    )}
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={filters.learning_area_id}
                    onChange={e => setF('learning_area_id', e.target.value)}
                  >
                    <option value="all">
                      {filters.grade_level_id !== 'all'
                        ? `Select Learning Area (${availableLearningAreas.length} mapped)...`
                        : 'Select Learning Area...'}
                    </option>
                    {availableLearningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Status checkboxes */}
              <div className="pt-2 border-t border-purple-100/60 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-[#7A7289]">Include Statuses:</span>
                  <div className="flex flex-wrap gap-2.5">
                    {(['submitted', 'reviewed', 'finalized'] as SubmissionStatus[]).map(s => (
                      <label key={s} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D2638] cursor-pointer bg-white px-3 py-1 rounded-xl border border-purple-100 shadow-2xs">
                        <input
                          type="checkbox"
                          checked={filters.statuses.includes(s)}
                          onChange={e => setF('statuses', e.target.checked ? [...filters.statuses, s] : filters.statuses.filter(x => x !== s))}
                          className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/30"
                        />
                        <span className="capitalize">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Consolidate Button */}
                <button
                  type="button"
                  onClick={handleConsolidate}
                  disabled={!canConsolidate || loading}
                  title={
                    !isSpecificFilterSelected
                      ? 'Please select a specific Grade Level and Learning Area first.'
                      : !canConsolidate
                      ? `Consolidation blocked: ${missingSchools.length} school(s) have not submitted evaluation forms.`
                      : 'Consolidate evaluation data for selected criteria'
                  }
                  className={`px-6 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md ${
                    canConsolidate && !loading
                      ? 'bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                  }`}
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  <span>{loading ? 'Processing Consolidation...' : 'Consolidate Data'}</span>
                </button>
              </div>
            </div>

            {/* REAL-TIME PRE-CHECK & COMPLIANCE VALIDATION ALERT (SUPER MINIMAL) */}
            {isSpecificFilterSelected && (
              <div className="space-y-2.5">
                {missingSchools.length === 0 ? (
                  /* SUCCESS: 100% SUBMISSIONS COMPLETE - COMPACT BANNER */
                  <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold min-w-0">
                      <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                      <span className="truncate">
                        Submissions 100% Complete ({submittedSchools.length} of {expectedSchools.length} Schools Submitted) — <span className="font-medium text-emerald-800">{selectedGrade} · {selectedLA}</span>
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                      READY TO CONSOLIDATE
                    </span>
                  </div>
                ) : (
                  /* IN PROGRESS: COMPACT BANNER WITH MINIMAL INLINE PENDING TAGS */
                  <div className="p-3 bg-purple-50/80 border border-purple-200/90 rounded-2xl space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-[#2D2638] font-bold min-w-0">
                        <Building2 size={16} className="text-[#8B72F4] shrink-0" />
                        <span>
                          Submissions In Progress ({submittedSchools.length} of {expectedSchools.length} Schools Submitted)
                        </span>
                        <span className="text-[10px] text-[#7A7289] font-medium">— {selectedGrade} · {selectedLA}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#8B72F4] text-white text-[10px] font-black shrink-0">
                        PROCEED ALLOWED ({currentSubmissions.length} Received)
                      </span>
                    </div>

                    {/* Pending Schools Inline Tags */}
                    {missingSchools.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 border-t border-purple-100/70 text-[11px] flex-wrap">
                        <span className="font-extrabold text-[#7A7289] flex items-center gap-1">
                          <Clock size={12} className="text-[#8B72F4]" />
                          <span>Pending ({missingSchools.length}):</span>
                        </span>
                        {missingSchools.map(school => (
                          <span
                            key={school.id}
                            className="px-2 py-0.5 rounded-lg bg-white border border-purple-200/80 text-[#2D2638] font-semibold text-[10px] inline-flex items-center gap-1"
                          >
                            <Building2 size={10} className="text-slate-400" />
                            {school.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUPER MINIMAL COLLAPSIBLE BUDGET OF WORK (BOW) SECTION */}
                {gradeCompetencies.length > 0 && (
                  <details className="group bg-white border border-purple-100 rounded-2xl shadow-2xs overflow-hidden">
                    <summary className="p-3 flex items-center justify-between cursor-pointer select-none text-xs font-bold text-[#2D2638] hover:bg-[#F6EFFF]/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-[#8B72F4]" />
                        <span>Official Budget of Work Competencies List — {selectedGrade} ({selectedLA})</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-[#8B72F4] bg-[#F6EFFF] px-2.5 py-0.5 rounded-full border border-[#8B72F4]/20">
                        {gradeCompetencies.length} Competencies (Click to toggle)
                      </span>
                    </summary>
                    <div className="p-3 border-t border-purple-100">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#F8F9FD] text-[#7A7289] font-extrabold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="py-2 px-3 w-10 text-center">#</th>
                              <th className="py-2 px-3 w-28">Code</th>
                              <th className="py-2 px-3 w-36">Domain</th>
                              <th className="py-2 px-4">Competency Description</th>
                              <th className="py-2 px-3 w-24 text-center">Schedule</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/70 font-medium text-[#2D2638]">
                            {gradeCompetencies.map((comp, idx) => (
                              <tr key={comp.id || idx} className="hover:bg-[#F6EFFF]/20">
                                <td className="py-2 px-3 text-center text-[#7A7289]">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono font-bold text-[#8B72F4]">{comp.code || '—'}</td>
                                <td className="py-2 px-3 text-[#7A7289]">{comp.domain_strand || '—'}</td>
                                <td className="py-2 px-4">{comp.competency_description}</td>
                                <td className="py-2 px-3 text-center text-[10px] text-[#8B72F4]">{comp.target_week || 'Week 1-2'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* PROMPT TO SELECT GRADE & SUBJECT */}
            {!isSpecificFilterSelected && (
              <div className="clay-card p-5 bg-gradient-to-br from-[#F6EFFF] via-white to-[#EEF0FF] border border-purple-100 shadow-xs rounded-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#8B72F4] text-white flex items-center justify-center font-bold shrink-0">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#2D2638]">
                      Select Grade Level & Learning Area to Verify Submissions
                    </h3>
                    <p className="text-xs text-[#7A7289] font-medium mt-0.5">
                      Choose a specific Grade Level and Learning Area above to perform submission completeness checking across all eligible schools.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* RESULTS VIEW & SINGLE CONSOLIDATED MATRIX TABLE */}
            {result && (
              <div className="space-y-6 animate-fade-in">
                {/* Result Control Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-purple-100 shadow-sm no-print">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-[#2D2638]">Consolidated Dataset Active</h3>
                        {isSaved && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 inline-flex items-center gap-1">
                            <Check size={11} /> Saved to Supabase ({lastSavedTime})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#7A7289]">
                        Aggregating {result.totalSubmissions} forms across {submittedSchools.length} schools · {result.totalLearners} total learners
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher */}
                    <div className="inline-flex p-1 bg-[#F6EFFF] rounded-2xl border border-purple-100 shadow-2xs">
                      <button
                        onClick={() => setViewMode('single_table')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          viewMode === 'single_table'
                            ? 'bg-white text-[#8B72F4] shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                      >
                        Single Table Matrix
                      </button>
                      <button
                        onClick={() => setViewMode('official_template')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          viewMode === 'official_template'
                            ? 'bg-white text-[#8B72F4] shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                      >
                        Official DepEd Form
                      </button>
                      <button
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          viewMode === 'cards'
                            ? 'bg-white text-[#8B72F4] shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                      >
                        Summary Cards
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAnalysisCards(prev => !prev)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer border ${
                        showAnalysisCards
                          ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-xs'
                          : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-50/70 hover:text-purple-900'
                      }`}
                      title="Toggle display of Top 5 Competency Analysis Cards"
                    >
                      <Sparkles size={14} className={showAnalysisCards ? 'text-purple-600' : 'text-purple-500'} />
                      <span>{showAnalysisCards ? 'Hide Analysis Cards' : 'Show Analysis Cards'}</span>
                    </button>

                    <button
                      onClick={handleSaveConsolidation}
                      disabled={saving}
                      className={`px-3.5 py-2 text-xs font-extrabold rounded-xl border transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer ${
                        isSaved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white border-transparent hover:shadow-md hover:scale-[1.01]'
                      }`}
                      title="Save this consolidation into Saved Reports tab for easy retrieval"
                    >
                      <Save size={14} className={saving ? 'animate-spin' : ''} />
                      <span>{saving ? 'Saving...' : isSaved ? 'Saved to Reports Tab' : 'Save Consolidation'}</span>
                    </button>

                    <button
                      onClick={handleExport}
                      disabled={exporting}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} />
                      <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
                    </button>

                    <button
                      onClick={() => {
                        const scrollables = document.querySelectorAll('div, main, section, dialog')
                        scrollables.forEach(el => {
                          if (el.scrollTop > 0) el.scrollTop = 0
                        })
                        window.scrollTo(0, 0)
                        requestAnimationFrame(() => {
                          setTimeout(() => window.print(), 50)
                        })
                      }}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#8B72F4] text-white hover:bg-[#795CEE] transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Print Official Form</span>
                    </button>
                  </div>
                </div>

                {/* VIEW 1: UNIFIED SINGLE CONSOLIDATED MATRIX TABLE */}
                {viewMode === 'single_table' && (
                  <div className="space-y-6">
                    {/* TOP CONSOLIDATED SUMMARY CARDS (4 COLUMNS - HIDDEN BY DEFAULT) */}
                    {showAnalysisCards ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 animate-fade-in">
                        {/* Card 1: Top 5 Most Learned */}
                        <div className="clay-card p-5 bg-gradient-to-br from-emerald-50/60 via-white to-teal-50/40 border border-emerald-200 rounded-3xl space-y-3.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                <Sparkles size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-emerald-950">Top 5 Most Learned</h4>
                                <p className="text-[10px] text-emerald-700 font-semibold">Highest mastery recorded</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                              {result.mostLearned.length} Entries
                            </span>
                          </div>

                          {result.mostLearned.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No most learned competencies logged.</p>
                          ) : (
                            <div className="space-y-2">
                              {result.mostLearned.slice(0, 5).map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setBreakdownModal({ categoryTitle: 'Most Learned Competencies', competency: item, totalSubmissions: result.totalSubmissions })}
                                  className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white border border-emerald-100 shadow-2xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group"
                                  title="Click to inspect reporting schools and exact sentences"
                                >
                                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-emerald-700 transition-colors">{item.competency_text}</p>
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-emerald-700 font-extrabold">
                                      <span className="inline-flex items-center gap-1 group-hover:underline">
                                        <span>{item.count} {item.count === 1 ? 'school' : 'schools'} reported</span>
                                        <Eye size={11} />
                                      </span>
                                      <span>{Math.round((item.count / Math.max(result.totalSubmissions, 1)) * 100)}% of forms</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card 2: Top 5 Least Mastered */}
                        <div className="clay-card p-5 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 border border-amber-200 rounded-3xl space-y-3.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                                <AlertCircle size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-amber-950">Top 5 Least Mastered</h4>
                                <p className="text-[10px] text-amber-700 font-semibold">Requires district intervention</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                              {result.leastMastered.length} Entries
                            </span>
                          </div>

                          {result.leastMastered.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No least mastered competencies logged.</p>
                          ) : (
                            <div className="space-y-2">
                              {result.leastMastered.slice(0, 5).map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setBreakdownModal({ categoryTitle: 'Least Mastered Competencies', competency: item, totalSubmissions: result.totalSubmissions })}
                                  className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white border border-amber-100 shadow-2xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer group"
                                  title="Click to inspect reporting schools and exact sentences"
                                >
                                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-amber-800 transition-colors">{item.competency_text}</p>
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-amber-700 font-extrabold">
                                      <span className="inline-flex items-center gap-1 group-hover:underline">
                                        <span>{item.count} {item.count === 1 ? 'school' : 'schools'} reported</span>
                                        <Eye size={11} />
                                      </span>
                                      <span>{Math.round((item.count / Math.max(result.totalSubmissions, 1)) * 100)}% of forms</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card 3: Top 5 Most Difficult */}
                        <div className="clay-card p-5 bg-gradient-to-br from-rose-50/60 via-white to-pink-50/40 border border-rose-200 rounded-3xl space-y-3.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                                <BookOpen size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-rose-950">Top 5 Most Difficult to Teach</h4>
                                <p className="text-[10px] text-rose-700 font-semibold">Instructional challenges</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                              {result.mostDifficult.length} Entries
                            </span>
                          </div>

                          {result.mostDifficult.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No instructional difficulties logged.</p>
                          ) : (
                            <div className="space-y-2">
                              {result.mostDifficult.slice(0, 5).map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setBreakdownModal({ categoryTitle: 'Most Difficult Competencies to Teach', competency: item, totalSubmissions: result.totalSubmissions })}
                                  className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white border border-rose-100 shadow-2xs hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
                                  title="Click to inspect reporting schools and exact sentences"
                                >
                                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-rose-800 transition-colors">{item.competency_text}</p>
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-rose-700 font-extrabold">
                                      <span className="inline-flex items-center gap-1 group-hover:underline">
                                        <span>{item.count} {item.count === 1 ? 'school' : 'schools'} reported</span>
                                        <Eye size={11} />
                                      </span>
                                      <span>{Math.round((item.count / Math.max(result.totalSubmissions, 1)) * 100)}% of forms</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card 4: Factors Contributing to Instructional Difficulty */}
                        <div className="clay-card p-5 bg-gradient-to-br from-purple-50/60 via-white to-indigo-50/40 border border-purple-200 rounded-3xl space-y-3.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                                <HelpCircle size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-purple-950">Factors Contributing</h4>
                                <p className="text-[10px] text-purple-700 font-semibold">Instructional difficulty root causes</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black">
                              {(result.factorsContributing || []).length} Entries
                            </span>
                          </div>

                          {!(result.factorsContributing && result.factorsContributing.length > 0) ? (
                            <p className="text-xs text-slate-400 italic py-4 text-center">No contributing factors logged.</p>
                          ) : (
                            <div className="space-y-2">
                              {result.factorsContributing.slice(0, 5).map((item, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setBreakdownModal({ categoryTitle: 'Factors Contributing to Instructional Difficulty', competency: item, totalSubmissions: result.totalSubmissions })}
                                  className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white border border-purple-100 shadow-2xs hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
                                  title="Click to inspect reporting schools and exact text"
                                >
                                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-purple-800 transition-colors">{item.competency_text}</p>
                                    <div className="flex items-center justify-between mt-1 text-[10px] text-purple-700 font-extrabold">
                                      <span className="inline-flex items-center gap-1 group-hover:underline">
                                        <span>{item.count} {item.count === 1 ? 'school' : 'schools'} reported</span>
                                        <Eye size={11} />
                                      </span>
                                      <span>{Math.round((item.count / Math.max(result.totalSubmissions, 1)) * 100)}% of forms</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-50/60 via-white to-slate-50/40 border border-purple-100 rounded-2xl">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                            <Sparkles size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">Top 5 Competency Analysis Cards are hidden</p>
                            <p className="text-[10px] text-slate-500 font-medium">Click to display Most Learned, Least Mastered & Difficult Competencies cards</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAnalysisCards(true)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye size={13} />
                          <span>Show Cards</span>
                        </button>
                      </div>
                    )}

                    {/* Single Consolidated Master Table rendered using Official DepEd TERMCAT Template */}
                    <div className="space-y-6">
                      {result.submissions.some(s => s.form_type === 'ks1') && (filters.key_stage === 'all' || filters.key_stage === 'ks1') && (
                        <OfficialTermcatTemplate
                          submissions={result.submissions.filter(s => s.form_type === 'ks1')}
                          formType="ks1"
                          learningAreaName={selectedLA}
                          termName={selectedTerm}
                          schoolYearName={selectedSY}
                          epsName="Cristina F. Fallarme"
                          showPrintButton
                        />
                      )}

                      {result.submissions.some(s => s.form_type === 'ks2to4') && (filters.key_stage === 'all' || filters.key_stage !== 'ks1') && (
                        <OfficialTermcatTemplate
                          submissions={result.submissions.filter(s => s.form_type === 'ks2to4')}
                          formType="ks2to4"
                          learningAreaName={selectedLA}
                          termName={selectedTerm}
                          schoolYearName={selectedSY}
                          epsName="Cristina F. Fallarme"
                          showPrintButton
                        />
                      )}

                      {!result.submissions.some(s => s.form_type === 'ks1') && !result.submissions.some(s => s.form_type === 'ks2to4') && (
                        <div className="clay-card p-6 text-center text-xs font-bold text-slate-500 bg-white border border-purple-100 rounded-2xl">
                          No submissions available for the selected criteria.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* VIEW 2: OFFICIAL DEPED TEMPLATE FORM */}
                {viewMode === 'official_template' && (
                  <div className="space-y-6">
                    {result.submissions.some(s => s.form_type === 'ks1') && (filters.key_stage === 'all' || filters.key_stage === 'ks1') && (
                      <OfficialTermcatTemplate
                        submissions={result.submissions.filter(s => s.form_type === 'ks1')}
                        formType="ks1"
                        learningAreaName={selectedLA}
                        termName={selectedTerm}
                        schoolYearName={selectedSY}
                        epsName="Cristina F. Fallarme"
                        showPrintButton
                      />
                    )}

                    {result.submissions.some(s => s.form_type === 'ks2to4') && (filters.key_stage === 'all' || filters.key_stage !== 'ks1') && (
                      <OfficialTermcatTemplate
                        submissions={result.submissions.filter(s => s.form_type === 'ks2to4')}
                        formType="ks2to4"
                        learningAreaName={selectedLA}
                        termName={selectedTerm}
                        schoolYearName={selectedSY}
                        epsName="Cristina F. Fallarme"
                        showPrintButton
                      />
                    )}

                    {!result.submissions.some(s => s.form_type === 'ks1') && !result.submissions.some(s => s.form_type === 'ks2to4') && (
                      <div className="clay-card p-6 text-center text-xs font-bold text-slate-500 bg-white border border-purple-100 rounded-2xl">
                        No submissions available for the selected criteria.
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 3: SUMMARY CARDS */}
                {viewMode === 'cards' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Total Submissions', value: result.totalSubmissions },
                        { label: 'Total Learners', value: result.totalLearners },
                        { label: 'Average MPS', value: result.averageMps !== null ? `${result.averageMps}%` : '—' },
                        { label: 'Competencies Taught', value: result.totalTaught },
                      ].map(s => (
                        <div key={s.label} className="clay-card p-4 text-center border border-purple-100 bg-white">
                          <p className="text-xs text-[#7A7289] uppercase tracking-wide font-extrabold">{s.label}</p>
                          <p className="text-2xl font-black text-[#8B72F4] mt-1">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SCHOOL ENTRIES BREAKDOWN ── */}
        {result && activeTab === 'consolidate' && (
          <div className="animate-fade-in">
            <div
              className="flex items-center justify-between p-4 clay-card bg-white border border-purple-100 rounded-2xl cursor-pointer select-none hover:border-purple-300 transition-all group"
              onClick={() => setShowSchoolEntries(prev => !prev)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#2D2638]">School Entries Included in Consolidation</p>
                  <p className="text-[10px] text-[#7A7289] font-medium">
                    {result.submissions.length} submission{result.submissions.length !== 1 ? 's' : ''} from {Array.from(new Set(result.submissions.map(s => s.school_id))).length} school{Array.from(new Set(result.submissions.map(s => s.school_id))).length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showSchoolEntries ? 'bg-purple-600 text-white rotate-180' : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            {showSchoolEntries && (
              <div className="mt-2 clay-card bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
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
                        <th className="py-2 px-3 text-center bg-slate-700/80" colSpan={2}>Status</th>
                      </tr>
                      {/* Column header row */}
                      <tr className="bg-[#F6EFFF] text-[#7A7289] font-extrabold uppercase tracking-wider border-b border-purple-100 text-[9px]">
                        <th className="py-2.5 px-3 w-7">#</th>
                        <th className="py-2.5 px-3 min-w-[180px]">School</th>
                        <th className="py-2.5 px-3 min-w-[80px]">Grade</th>
                        <th className="py-2.5 px-3 min-w-[120px] border-r border-purple-200">Teacher</th>
                        <th className="py-2.5 px-3 text-center min-w-[70px] border-r border-purple-200">Total</th>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50">
                      {result.submissions.map((sub, idx) => {
                        const isKS1 = String(sub.form_type).toLowerCase() === 'ks1' || (sub.grade_level?.grade_number !== undefined && sub.grade_level.grade_number <= 3) || !!sub.ks1_learner_data
                        const d1 = sub.ks1_learner_data
                        const d2 = sub.ks2to4_learner_data
                        const cs = sub.competency_summary
                        const comps = sub.submission_competencies ?? []
                        const mostLearned = comps.filter(c => c.category === 'most_learned').sort((a,b) => a.rank - b.rank)
                        const leastMastered = comps.filter(c => c.category === 'least_mastered').sort((a,b) => a.rank - b.rank)
                        const mostDifficult = comps.filter(c => c.category === 'most_difficult_to_teach').sort((a,b) => a.rank - b.rank)
                        const factors = sub.instructional_difficulty?.factors_text?.trim() || '—'
                        const statusColors: Record<string, string> = {
                          finalized: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
                          submitted: 'bg-amber-100 text-amber-800 border-amber-200',
                          returned: 'bg-rose-100 text-rose-800 border-rose-200',
                        }
                        const n = (v: number | null | undefined) => v != null ? v : '—'
                        // ── KS1 mismatch detection ──
                        const ks1PerfSum = isKS1 && d1
                          ? (d1.advancing ?? 0) + (d1.benchmarking ?? 0) + (d1.connecting ?? 0) + (d1.developing ?? 0) + (d1.emerging ?? 0)
                          : null
                        const ks1Total = isKS1 ? (d1?.total_learners ?? null) : null
                        const hasMismatch = ks1Total !== null && ks1PerfSum !== null && ks1Total !== ks1PerfSum
                        const CompList = ({ items }: { items: typeof mostLearned }) =>
                          items.length === 0
                            ? <span className="text-slate-300 italic text-[10px]">—</span>
                            : <ol className="list-decimal list-inside space-y-1">
                                {items.slice(0, 5).map((c, i) => (
                                  <li key={i} className="text-[10px] text-slate-700 leading-snug">{c.competency_text}</li>
                                ))}
                              </ol>
                        return (
                          <tr key={sub.id} className={`align-top transition-colors ${
                            hasMismatch
                              ? 'bg-red-50/60 hover:bg-red-50 outline outline-1 outline-red-300'
                              : idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-[#FAFAFE] hover:bg-purple-50/40'
                          }`}>
                            {/* Row number + mismatch indicator */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-[#7A7289]">{idx + 1}</span>
                                {hasMismatch && (
                                  <span title="Total learners does not match sum of performance levels" className="text-[9px] font-black text-red-600 bg-red-100 border border-red-300 rounded-full px-1.5 py-0.5 leading-none">⚠ Mismatch</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-start gap-1.5">
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${hasMismatch ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                                  <Building2 size={10} />
                                </div>
                                <span className={`font-bold leading-tight text-[11px] ${hasMismatch ? 'text-red-900' : 'text-[#2D2638]'}`}>{sub.school?.name ?? sub.school_id}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">{sub.grade_level?.name ?? '—'}</td>
                            <td className="py-2.5 px-3 text-slate-600 border-r border-purple-100">{sub.teacher_name}</td>
                            {/* Total learners — highlighted red on mismatch */}
                            <td className={`py-2.5 px-3 text-center font-bold border-r border-purple-100 ${hasMismatch ? 'text-red-700 bg-red-100' : 'text-slate-800'}`}>
                              <div className="flex flex-col items-center">
                                <span>{isKS1 ? n(d1?.total_learners) : n(d2?.total_learners)}</span>
                                {hasMismatch && (
                                  <span className="text-[9px] text-red-500 font-semibold leading-tight">≠ sum: {ks1PerfSum}</span>
                                )}
                              </div>
                            </td>
                            {/* KS1 performance levels — highlight cells red on mismatch */}
                            <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>{isKS1 ? n(d1?.advancing)    : <span className="text-slate-300">—</span>}</td>
                            <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>{isKS1 ? n(d1?.benchmarking) : <span className="text-slate-300">—</span>}</td>
                            <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>{isKS1 ? n(d1?.connecting)   : <span className="text-slate-300">—</span>}</td>
                            <td className={`py-2.5 px-3 text-center font-semibold ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>{isKS1 ? n(d1?.developing)   : <span className="text-slate-300">—</span>}</td>
                            <td className={`py-2.5 px-3 text-center font-semibold border-r border-purple-100 ${hasMismatch ? 'text-red-800 bg-red-50' : 'text-teal-800 bg-teal-50/40'}`}>{isKS1 ? n(d1?.emerging) : <span className="text-slate-300">—</span>}</td>
                            {/* KS2-4 MPS */}
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-800 bg-indigo-50/40 border-r border-purple-100">
                              {!isKS1 ? (d2?.mps != null ? `${d2.mps}%` : '—') : <span className="text-slate-300">—</span>}
                            </td>
                            {/* Competency summary */}
                            <td className="py-2.5 px-3 text-center font-semibold text-purple-800 bg-purple-50/40">{n(cs?.total_intended_competencies)}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-emerald-700 bg-purple-50/40">{n(cs?.competencies_taught)}</td>
                            <td className="py-2.5 px-3 text-center font-semibold text-rose-700 bg-purple-50/40 border-r border-purple-100">{n(cs?.competencies_not_taught)}</td>
                            {/* Top 5 competency lists */}
                            <td className="py-2.5 px-3 bg-emerald-50/30 border-r border-purple-100 align-top"><CompList items={mostLearned} /></td>
                            <td className="py-2.5 px-3 bg-amber-50/30 border-r border-purple-100 align-top"><CompList items={leastMastered} /></td>
                            <td className="py-2.5 px-3 bg-rose-50/30 border-r border-purple-100 align-top"><CompList items={mostDifficult} /></td>
                            {/* Instructional factors */}
                            <td className="py-2.5 px-3 text-[10px] text-slate-600 leading-snug bg-slate-50/50 align-top">{factors}</td>
                            {/* Status */}
                            <td className="py-2.5 px-3 text-center bg-slate-50/50">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border capitalize ${statusColors[sub.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {sub.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 bg-[#F6EFFF]/60 border-t border-purple-100 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-[10px] text-[#7A7289] font-semibold">
                      {result.submissions.length} entries · {Array.from(new Set(result.submissions.map(s => s.school_id))).length} schools · Scroll horizontally to view all columns
                    </p>
                    {result.submissions.some(sub => {
                      const d1 = sub.ks1_learner_data
                      if (sub.form_type !== 'ks1' || !d1) return false
                      const sum = (d1.advancing ?? 0) + (d1.benchmarking ?? 0) + (d1.connecting ?? 0) + (d1.developing ?? 0) + (d1.emerging ?? 0)
                      return d1.total_learners !== sum
                    }) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 text-[9px] font-black">
                        ⚠ Rows highlighted in red have mismatched learner totals vs. performance level sums
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold">Data Consolidation Engine</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONSOLIDATION BY SUBJECT ACROSS OFFERED GRADE LEVELS */}
        {activeTab === 'by_subject' && (
          <div className="space-y-6 animate-fade-in">
            {/* Criteria Selection Card */}
            <div className="clay-card p-6 space-y-5 bg-gradient-to-br from-white via-white to-[#F6EFFF]/40 border border-purple-100 shadow-md rounded-3xl no-print">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#2D2638]">Consolidation by Learning Area</h2>
                    <p className="text-xs text-[#7A7289] font-medium">Select a Learning Area to view consolidated evaluation metrics for each offered grade level.</p>
                  </div>
                </div>

                <button
                  onClick={loadBySubjectData}
                  disabled={loadingBySubject}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20 text-xs font-bold hover:bg-[#8B72F4] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={loadingBySubject ? 'animate-spin' : ''} />
                  <span>{loadingBySubject ? 'Loading...' : 'Refresh Data'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Select Learning Area */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#8B72F4] mb-1 flex items-center gap-1">
                    <BookOpen size={13} className="text-[#8B72F4]" />
                    <span>Target Learning Area *</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={bySubjLAId}
                    onChange={e => setBySubjLAId(e.target.value)}
                  >
                    <option value="">— Select Learning Area —</option>
                    {learningAreas.map(la => (
                      <option key={la.id} value={la.id}>
                        {la.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. School Year */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-[#8B72F4]" />
                    <span>School Year</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={bySubjSYId}
                    onChange={e => setBySubjSYId(e.target.value)}
                  >
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>

                {/* 3. Quarter / Term */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Clock size={13} className="text-[#795CEE]" />
                    <span>Quarter / Term</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={bySubjTermId}
                    onChange={e => setBySubjTermId(e.target.value)}
                  >
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* 4. School Filter */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Building2 size={13} className="text-[#8B72F4]" />
                    <span>School Scope</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-bold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={bySubjSchoolFilter}
                    onChange={e => setBySubjSchoolFilter(e.target.value)}
                  >
                    <option value="all">All Division Schools ({permittedSchools.length})</option>
                    {permittedSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Results Table & Summary */}
            {loadingBySubject ? (
              <DepEdPageLoader label="Fetching Consolidated Subject Data across Offered Grades..." />
            ) : !bySubjLAId || bySubjLAId === 'all' ? (
              <div className="clay-card p-12 text-center text-xs font-bold text-slate-500 bg-white border border-purple-100 rounded-3xl space-y-2">
                <BookOpen size={36} className="mx-auto text-purple-400" />
                <p className="text-sm font-extrabold text-slate-800">Please Select a Learning Area Above</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Select a Learning Area (e.g., Mathematics, Science, English) to display consolidated evaluation data for each grade level offering that subject.
                </p>
              </div>
            ) : subjectGradeConsolidationRows.length === 0 ? (
              <div className="clay-card p-12 text-center text-xs font-bold text-slate-500 bg-white border border-purple-100 rounded-3xl space-y-2">
                <AlertCircle size={36} className="mx-auto text-amber-500" />
                <p className="text-sm font-extrabold text-slate-800">No Grade Levels or Submissions Found</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No submissions or grade mapping found for the selected Learning Area in this School Year and Quarter.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Stats Header Bar & View Switcher */}
                <div className="clay-card p-4 bg-white border border-purple-100 rounded-3xl shadow-sm flex items-center justify-between flex-wrap gap-4 no-print">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-100 text-[#8B72F4] flex items-center justify-center font-bold text-lg">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#2D2638]">
                        Subject Consolidation: {learningAreas.find(l => l.id === bySubjLAId)?.name}
                      </h3>
                      <p className="text-xs text-[#7A7289] font-medium">
                        Listing consolidated results for {subjectGradeConsolidationRows.length} grade levels offering {learningAreas.find(l => l.id === bySubjLAId)?.name} · {allSubmissionsForSubject.length} total form submissions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Mode Toggle */}
                    <div className="p-1 rounded-2xl bg-purple-50/80 border border-purple-200 flex items-center gap-1">
                      <button
                        onClick={() => setBySubjectViewMode('official_template')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          bySubjectViewMode === 'official_template'
                            ? 'bg-[#8B72F4] text-white shadow-2xs'
                            : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-white/50'
                        }`}
                      >
                        <FileText size={13} />
                        <span>Official DepEd Form</span>
                      </button>
                      <button
                        onClick={() => setBySubjectViewMode('single_table')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          bySubjectViewMode === 'single_table'
                            ? 'bg-[#8B72F4] text-white shadow-2xs'
                            : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-white/50'
                        }`}
                      >
                        <LayoutList size={13} />
                        <span>Master Matrix Table</span>
                      </button>
                    </div>

                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-2 text-xs font-bold rounded-xl bg-[#8B72F4] text-white hover:bg-[#795CEE] transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={14} />
                      <span>Print Subject Report</span>
                    </button>
                  </div>
                </div>

                {/* VIEW 1: OFFICIAL DEPED TEMPLATE */}
                {bySubjectViewMode === 'official_template' ? (
                  <div className="space-y-8">
                    {/* KS1 Official Form if KS1 submissions exist */}
                    {ks1Submissions.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between no-print">
                          <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-2">
                            <GraduationCap size={15} className="text-[#8B72F4]" />
                            <span>Key Stage 1 (Grades 1–3) — Official DepEd Form</span>
                          </h4>
                        </div>
                        <OfficialTermcatTemplate
                          submissions={ks1Submissions}
                          formType="ks1"
                          sdoName="Division of Romblon"
                          epsName="Cristina F. Fallarme"
                          learningAreaName={learningAreas.find(l => l.id === bySubjLAId)?.name}
                          termName={terms.find(t => t.id === bySubjTermId)?.name}
                          schoolYearName={schoolYears.find(y => y.id === bySubjSYId)?.name}
                          showPrintButton={true}
                        />
                      </div>
                    )}

                    {/* KS2-4 Official Form if KS2-4 submissions exist */}
                    {ks24Submissions.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between no-print">
                          <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-2">
                            <GraduationCap size={15} className="text-[#8B72F4]" />
                            <span>Key Stage 2–4 (Grades 4–12) — Official DepEd Form</span>
                          </h4>
                        </div>
                        <OfficialTermcatTemplate
                          submissions={ks24Submissions}
                          formType="ks2to4"
                          sdoName="Division of Romblon"
                          epsName="Cristina F. Fallarme"
                          learningAreaName={learningAreas.find(l => l.id === bySubjLAId)?.name}
                          termName={terms.find(t => t.id === bySubjTermId)?.name}
                          schoolYearName={schoolYears.find(y => y.id === bySubjSYId)?.name}
                          showPrintButton={true}
                        />
                      </div>
                    )}

                    {ks1Submissions.length === 0 && ks24Submissions.length === 0 && (
                      <div className="clay-card p-12 text-center text-xs font-bold text-slate-500 bg-white border border-purple-100 rounded-3xl space-y-2">
                        <AlertCircle size={36} className="mx-auto text-amber-500" />
                        <p className="text-sm font-extrabold text-slate-800">No Submissions Found to Display Official Template</p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          There are no form submissions logged yet for {learningAreas.find(l => l.id === bySubjLAId)?.name} in the selected term and school scope.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* VIEW 2: MASTER MATRIX TABLE VIEW */
                  <div className="clay-card bg-white border border-purple-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs" style={{ minWidth: '1500px' }}>
                        <thead className="bg-[#2D2638] text-white font-extrabold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center border-r border-white/20">#</th>
                            <th className="py-3 px-4 min-w-[140px] border-r border-white/20">Offered Grade Level</th>
                            <th className="py-3 px-3 min-w-[90px] text-center border-r border-white/20">Schools</th>
                            <th className="py-3 px-3 min-w-[90px] text-center border-r border-white/20">Learners</th>
                            <th className="py-3 px-3 min-w-[160px] text-center border-r border-white/20 bg-indigo-900/80">Assessment Results</th>
                            <th className="py-3 px-3 min-w-[130px] text-center border-r border-white/20 bg-purple-900/80">Competency Summary</th>
                            <th className="py-3 px-4 min-w-[220px] bg-emerald-900/80 border-r border-white/20">Top 5 Most Learned</th>
                            <th className="py-3 px-4 min-w-[220px] bg-amber-900/80 border-r border-white/20">Top 5 Least Mastered</th>
                            <th className="py-3 px-4 min-w-[220px] bg-rose-900/80">Top 5 Most Difficult / Factors</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {subjectGradeConsolidationRows.map((row, idx) => {
                            const isKS1 = row.grade.grade_number <= 3
                            const res = row.result

                            return (
                              <tr key={row.grade.id} className={`align-top transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-purple-50/30' : 'bg-slate-50/50 hover:bg-purple-50/30'}`}>
                                {/* Index */}
                                <td className="py-3.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>

                                {/* Grade Level Name */}
                                <td className="py-3.5 px-4 font-black text-slate-900 text-xs border-r border-purple-100">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                                      <GraduationCap size={13} />
                                    </div>
                                    <div>
                                      <span className="block font-black text-slate-900">{row.grade.name}</span>
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        {isKS1 ? 'Key Stage 1 (Gr 1-3)' : row.grade.grade_number <= 6 ? 'Key Stage 2 (Gr 4-6)' : row.grade.grade_number <= 10 ? 'Key Stage 3 (Gr 7-10)' : 'Key Stage 4 (Gr 11-12)'}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Submissions / Schools */}
                                <td className="py-3.5 px-3 text-center border-r border-purple-100">
                                  <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-extrabold ${row.submittedCount > 0 ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-slate-100 text-slate-400'}`}>
                                    {row.submittedSchoolsCount} {row.submittedSchoolsCount === 1 ? 'School' : 'Schools'}
                                  </span>
                                </td>

                                {/* Total Learners */}
                                <td className="py-3.5 px-3 text-center font-black text-slate-900 text-sm border-r border-purple-100">
                                  {res.totalLearners}
                                </td>

                                {/* Assessment Results: KS1 Performance Levels OR KS2-4 MPS */}
                                <td className="py-3.5 px-3 text-center border-r border-purple-100 bg-indigo-50/20">
                                  {isKS1 ? (
                                    <div className="text-[10px] space-y-0.5">
                                      <div className="grid grid-cols-5 gap-1 font-bold text-center">
                                        <span className="text-emerald-700 bg-emerald-50 px-1 rounded" title="Advancing">Adv: {res.ks1Advancing}</span>
                                        <span className="text-amber-700 bg-amber-50 px-1 rounded" title="Benchmarking">Bch: {res.ks1Benchmarking}</span>
                                        <span className="text-sky-700 bg-sky-50 px-1 rounded" title="Connecting">Con: {res.ks1Connecting}</span>
                                        <span className="text-orange-700 bg-orange-50 px-1 rounded" title="Developing">Dev: {res.ks1Developing}</span>
                                        <span className="text-red-700 bg-red-50 px-1 rounded" title="Emerging">Emg: {res.ks1Emerging}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-black text-indigo-900">
                                        {res.averageMps !== null ? `${res.averageMps}%` : '—'}
                                      </span>
                                      <span className="text-[9px] text-indigo-600 font-bold uppercase">Average MPS</span>
                                    </div>
                                  )}
                                </td>

                                {/* Competency Summary */}
                                <td className="py-3.5 px-3 text-center border-r border-purple-100 bg-purple-50/20">
                                  <div className="text-[10px] font-bold space-y-1">
                                    <div className="flex justify-between gap-2 text-purple-900">
                                      <span>Intended:</span>
                                      <span className="font-black">{res.totalIntended}</span>
                                    </div>
                                    <div className="flex justify-between gap-2 text-emerald-700">
                                      <span>Taught:</span>
                                      <span className="font-black">{res.totalTaught}</span>
                                    </div>
                                    <div className="flex justify-between gap-2 text-rose-700">
                                      <span>Not Taught:</span>
                                      <span className="font-black">{res.totalNotTaught}</span>
                                    </div>
                                  </div>
                                </td>

                                {/* Top 5 Most Learned */}
                                <td className="py-3.5 px-4 border-r border-purple-100 bg-emerald-50/20">
                                  {res.mostLearned.length === 0 ? (
                                    <span className="text-slate-300 italic text-[10px]">—</span>
                                  ) : (
                                    <ol className="list-decimal list-inside space-y-1">
                                      {res.mostLearned.slice(0, 5).map((item, i) => (
                                        <li key={i} className="text-[10px] text-emerald-950 font-medium leading-snug">
                                          <span className="font-bold text-slate-800">{item.competency_text}</span>{' '}
                                          <span className="text-[9px] text-emerald-700 font-mono">({item.count})</span>
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                </td>

                                {/* Top 5 Least Mastered */}
                                <td className="py-3.5 px-4 border-r border-purple-100 bg-amber-50/20">
                                  {res.leastMastered.length === 0 ? (
                                    <span className="text-slate-300 italic text-[10px]">—</span>
                                  ) : (
                                    <ol className="list-decimal list-inside space-y-1">
                                      {res.leastMastered.slice(0, 5).map((item, i) => (
                                        <li key={i} className="text-[10px] text-amber-950 font-medium leading-snug">
                                          <span className="font-bold text-slate-800">{item.competency_text}</span>{' '}
                                          <span className="text-[9px] text-amber-700 font-mono">({item.count})</span>
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                </td>

                                {/* Top 5 Most Difficult / Factors */}
                                <td className="py-3.5 px-4 bg-rose-50/20">
                                  {(!res.mostDifficult || res.mostDifficult.length === 0) && (!res.factorsContributing || res.factorsContributing.length === 0) ? (
                                    <span className="text-slate-300 italic text-[10px]">—</span>
                                  ) : (
                                    <ol className="list-decimal list-inside space-y-1">
                                      {((res.mostDifficult && res.mostDifficult.length > 0) ? res.mostDifficult : (res.factorsContributing || [])).slice(0, 5).map((item, i) => (
                                        <li key={i} className="text-[10px] text-rose-950 font-medium leading-snug">
                                          <span className="font-bold text-slate-800">{item.competency_text}</span>{' '}
                                          <span className="text-[9px] text-rose-700 font-mono">({item.count})</span>
                                        </li>
                                      ))}
                                    </ol>
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
                      <p className="text-[10px] text-slate-500 font-semibold">
                        Displaying consolidated data for {learningAreas.find(l => l.id === bySubjLAId)?.name} across {subjectGradeConsolidationRows.length} grade levels
                      </p>
                      <span className="text-[10px] text-purple-600 font-bold">Subject-by-Grade TERMCAT Consolidation Engine</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAVED REPORTS HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[#2D2638]">Saved Consolidated Reports</h2>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-3.5 py-1.5 rounded-xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20 text-xs font-bold hover:bg-[#8B72F4] hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
                <span>Refresh History</span>
              </button>
            </div>

            <div className="clay-card overflow-hidden p-1.5 bg-white border border-purple-100 shadow-md rounded-3xl">
              {loadingHistory ? (
                <div className="p-8 text-center text-xs text-[#7A7289]">Loading saved history...</div>
              ) : savedReports.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#7A7289]">
                  No saved consolidations found. Perform a consolidation above to save reports to Supabase.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#F8F9FD] text-[#7A7289] font-extrabold uppercase tracking-wider border-b border-purple-100 text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Report Title</th>
                      <th className="py-3 px-4">School Year & Term</th>
                      <th className="py-3 px-4 text-center">Schools</th>
                      <th className="py-3 px-4 text-center">Learners</th>
                      <th className="py-3 px-4 text-center">Avg MPS</th>
                      <th className="py-3 px-4">Generated By</th>
                      <th className="py-3 px-4">Date Saved</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50/70">
                    {savedReports.map(rep => (
                      <tr key={rep.id} className="hover:bg-[#F6EFFF]/30 transition-colors">
                        <td className="py-3 px-4 font-extrabold text-[#2D2638]">{rep.title}</td>
                        <td className="py-3 px-4 font-semibold text-[#7A7289]">
                          {rep.school_year?.name} · {rep.term?.name}
                        </td>
                        <td className="py-3 px-4 text-center font-extrabold text-[#8B72F4]">{rep.total_schools_included}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-[#2D2638]">{rep.total_learners_count}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-emerald-600">
                          {rep.average_mps !== null ? `${rep.average_mps}%` : '—'}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#7A7289]">{rep.created_by_name || 'Admin'}</td>
                        <td className="py-3 px-4 text-[#7A7289]">{format(new Date(rep.created_at), 'MMM d, yyyy · h:mm a')}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingSavedReport(rep)}
                              className="px-2.5 py-1.5 rounded-xl bg-purple-50 text-[#8B72F4] hover:bg-[#8B72F4] hover:text-white border border-purple-200 transition-all font-bold text-xs flex items-center gap-1 cursor-pointer"
                              title="View and Reprint Report Template"
                            >
                              <Eye size={13} />
                              <span>View & Reprint</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteConsolidatedReport(rep.id)
                                  toast('Report deleted.', 'success')
                                  loadHistory()
                                } catch {
                                  toast('Failed to delete report.', 'error')
                                }
                              }}
                              className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
      )}



      {/* Competency Grouping Breakdown Modal */}
      {breakdownModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2D2638]">{breakdownModal.categoryTitle} — Grouping Breakdown</h3>
                  <p className="text-xs text-[#7A7289]">
                    Inspection of reported schools and exact sentences combined into this single consolidated result.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBreakdownModal(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Combined Representative Sentence Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-purple-50 border border-purple-200 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-[#8B72F4] uppercase tracking-wider">
                <span>Single Combined Result</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#8B72F4] text-white text-[10px] font-black">
                  {breakdownModal.competency.count} {breakdownModal.competency.count === 1 ? 'School' : 'Schools'} ({Math.round((breakdownModal.competency.count / Math.max(breakdownModal.totalSubmissions, 1)) * 100)}%)
                </span>
              </div>
              <p className="text-sm font-black text-[#2D2638] leading-snug">{breakdownModal.competency.competency_text}</p>
            </div>

            {/* Reported Schools & Verbatim Sentences */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#7A7289]">
                  Reported Schools & Verbatim Sentences ({breakdownModal.competency.reported_details?.length || breakdownModal.competency.count})
                </h4>
                <span className="text-[11px] text-slate-500 italic">Showing exact sentences encoded by teachers</span>
              </div>

              <div className="space-y-2.5">
                {(breakdownModal.competency.reported_details || []).map((detail, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 hover:bg-white hover:shadow-xs transition-all">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2 font-black text-[#2D2638]">
                        <Building2 size={14} className="text-[#8B72F4] shrink-0" />
                        <span>{detail.school_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                        <span>Teacher: {detail.teacher_name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-[#8B72F4] font-mono text-[10px]">{detail.reference_number}</span>
                      </div>
                    </div>

                    {/* Exact Sentence Box */}
                    <div className="p-2.5 rounded-xl bg-white border border-purple-100 text-xs font-medium text-slate-800 leading-relaxed font-mono">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Exact Sentence Encoded by Teacher:</span>
                      "{detail.exact_text}"
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setBreakdownModal(null)}
                className="px-5 py-2 rounded-xl bg-[#8B72F4] text-white text-xs font-bold hover:bg-[#795CEE] transition-all cursor-pointer shadow-sm"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Saved Report View & Reprint Modal */}
      {viewingSavedReport && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#2D2638]">{viewingSavedReport.title}</h3>
                  <p className="text-xs text-[#7A7289] font-medium mt-0.5">
                    Saved Report · {viewingSavedReport.school_year?.name || 'SY'} · {viewingSavedReport.term?.name || 'Term'} · Saved {format(new Date(viewingSavedReport.created_at), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingSavedReport(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                title="Close Viewer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Container */}
            <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
              <OfficialTermcatTemplate
                submission={(() => {
                  const rep = viewingSavedReport
                  const gl = rep.grade_level as GradeLevel | undefined
                  const isKS1 = rep.level_type === 'elementary' || gl?.key_stage === 'ks1' || (gl?.grade_number && gl.grade_number <= 3)
                  const cData = (rep.consolidated_data || {}) as Record<string, any>

                  return {
                    id: rep.id,
                    reference_number: `SAVED-${rep.id.slice(0, 8)}`,
                    teacher_name: rep.created_by_name || 'Admin Consolidated',
                    school_id: 'consolidated',
                    school: { id: 'consolidated', name: 'All Division Schools (Consolidated)', school_type: 'public' },
                    grade_level_id: rep.grade_level_id || '',
                    grade_level: gl || {
                      id: rep.grade_level_id || '',
                      name: rep.grade_level_id ? `Grade ${rep.grade_level_id}` : 'All Grades',
                      grade_number: 1,
                      key_stage: isKS1 ? 'ks1' : 'ks2to4',
                    },
                    learning_area_id: rep.learning_area_id || '',
                    learning_area: rep.learning_area || { id: rep.learning_area_id || '', name: 'Learning Area' },
                    school_year_id: rep.school_year_id || '',
                    school_year: rep.school_year || { id: rep.school_year_id || '', name: '' },
                    term_id: rep.term_id || '',
                    term: rep.term || { id: rep.term_id || '', name: '' },
                    key_stage: isKS1 ? 'ks1' : 'ks2to4',
                    form_type: isKS1 ? 'ks1' : 'ks2to4',
                    status: 'finalized',
                    submitted_at: rep.created_at,
                    ks1_learner_data: isKS1 ? {
                      id: rep.id,
                      submission_id: rep.id,
                      total_learners: rep.total_learners_count,
                      advancing: cData.ks1Advancing || 0,
                      benchmarking: cData.ks1Benchmarking || 0,
                      connecting: cData.ks1Connecting || 0,
                      developing: cData.ks1Developing || 0,
                      emerging: cData.ks1Emerging || 0,
                    } : undefined,
                    ks2to4_learner_data: !isKS1 ? {
                      id: rep.id,
                      submission_id: rep.id,
                      total_learners: rep.total_learners_count,
                      mps: rep.average_mps,
                    } : undefined,
                    competency_summary: {
                      id: rep.id,
                      submission_id: rep.id,
                      total_intended_competencies: cData.totalIntended || 0,
                      competencies_taught: cData.totalTaught || 0,
                      competencies_not_taught: cData.totalNotTaught || 0,
                      reasons_for_untaught: '',
                    },
                    submission_competencies: [
                      ...((cData.mostLearnedTop3 || []).map((c: any, i: number) => ({
                        id: `ml-${i}`,
                        submission_id: rep.id,
                        category: 'most_learned' as const,
                        rank: i + 1,
                        competency_text: typeof c === 'string' ? c : (c.competency_text || ''),
                      }))),
                      ...((cData.leastMasteredTop3 || []).map((c: any, i: number) => ({
                        id: `lm-${i}`,
                        submission_id: rep.id,
                        category: 'least_mastered' as const,
                        rank: i + 1,
                        competency_text: typeof c === 'string' ? c : (c.competency_text || ''),
                      }))),
                    ],
                    instructional_difficulty: {
                      id: rep.id,
                      submission_id: rep.id,
                      factors_text: '',
                    }
                  } as unknown as TermcatSubmission
                })()}
                learningAreaName={viewingSavedReport.learning_area?.name}
                termName={viewingSavedReport.term?.name}
                schoolYearName={viewingSavedReport.school_year?.name}
                epsName="Cristina F. Fallarme"
                showPrintButton
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
