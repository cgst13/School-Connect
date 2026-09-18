import { useEffect, useState, useMemo, useCallback } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import {
  fetchConsolidationData, fetchSchools, fetchGradeLevels, fetchLearningAreas,
  fetchSchoolYears, fetchTerms, fetchLearningAreaGrades, saveConsolidatedReport, fetchConsolidatedReports,
  deleteConsolidatedReport
} from '@/lib/supabase/queries'
import type {
  ConsolidationFilters, ConsolidationResult, TermcatSubmission, CompetencyCount,
  School, GradeLevel, LearningArea, LearningAreaGrade, SchoolYear, Term, SubmissionStatus,
  TermcatConsolidatedReport
} from '@/types'
import {
  Download, RefreshCw, Printer, FileSpreadsheet, LayoutList, CheckCircle2,
  AlertCircle, XCircle, Building2, BookOpen, GraduationCap, Calendar, Clock,
  Sparkles, Save, History, Trash2, Eye, ShieldCheck, FileText, Check
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/features/auth/useAuth'
import { generateExcelExport } from '@/lib/excel/excelExport'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import { PageHeader } from '@/components/ui/PageHeader'
import { format } from 'date-fns'

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

  const totalIntended = submissions.reduce((acc, s) => acc + (s.competency_summary?.total_intended_competencies || 0), 0)
  const totalTaught = submissions.reduce((acc, s) => acc + (s.competency_summary?.competencies_taught || 0), 0)
  const totalNotTaught = submissions.reduce((acc, s) => acc + (s.competency_summary?.competencies_not_taught || 0), 0)

  // Competency frequency
  function aggregateCompetencies(category: string): CompetencyCount[] {
    const counts: Record<string, number> = {}
    for (const sub of submissions) {
      for (const c of (sub.submission_competencies || [])) {
        if (c.category === category && c.competency_text.trim()) {
          counts[c.competency_text] = (counts[c.competency_text] || 0) + 1
        }
      }
    }
    return Object.entries(counts).map(([text, count]) => ({ competency_text: text, count })).sort((a, b) => b.count - a.count)
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

  const [activeTab, setActiveTab] = useState<'consolidate' | 'history'>('consolidate')
  const [viewMode, setViewMode] = useState<'single_table' | 'official_template' | 'cards'>('single_table')

  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

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

  // Saved reports history
  const [savedReports, setSavedReports] = useState<TermcatConsolidatedReport[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchSchools(false), fetchGradeLevels(), fetchLearningAreas(false),
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
    })
  }, [])

  // Filter grade levels dynamically by School Level Selection
  const availableGrades = useMemo(() => {
    if (filters.school_level === 'elementary') {
      return grades.filter(g => g.grade_number >= 1 && g.grade_number <= 6)
    }
    if (filters.school_level === 'junior_hs') {
      return grades.filter(g => g.grade_number >= 7 && g.grade_number <= 10)
    }
    if (filters.school_level === 'senior_hs') {
      return grades.filter(g => g.grade_number >= 11 && g.grade_number <= 12)
    }
    return grades
  }, [filters.school_level, grades])

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

  // Expected schools based on school_level filter
  const expectedSchools = useMemo(() => {
    if (filters.school_level === 'elementary') {
      return permittedSchools.filter(s => s.school_type === 'elementary')
    }
    if (filters.school_level === 'junior_hs' || filters.school_level === 'senior_hs') {
      return permittedSchools.filter(s => s.school_type === 'secondary')
    }
    return permittedSchools
  }, [filters.school_level, permittedSchools])

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
      setCurrentSubmissions(data)
    } catch {
      console.warn('Compliance check failed')
    } finally {
      setCheckingCompliance(false)
    }
  }, [filters, hasFullAccess, getPermittedSchoolIds, schools])

  useEffect(() => {
    performComplianceCheck()
  }, [performComplianceCheck])

  // Identify which expected schools have submitted and which are missing
  const { submittedSchools, missingSchools, isSpecificFilterSelected, canConsolidate } = useMemo(() => {
    const submittedSchoolIds = new Set(currentSubmissions.map(s => s.school_id))
    const submitted = expectedSchools.filter(s => submittedSchoolIds.has(s.id))
    const missing = expectedSchools.filter(s => !submittedSchoolIds.has(s.id))
    
    // Validation requires selecting a specific Grade Level AND a specific Learning Area
    const isSpecific = filters.grade_level_id !== 'all' && filters.learning_area_id !== 'all'
    
    // Can consolidate ONLY if all expected schools have submitted for that specific Grade & Subject
    const allowed = isSpecific && missing.length === 0 && expectedSchools.length > 0

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

  // Consolidate & Save to Supabase
  const handleConsolidateAndSave = async () => {
    if (!canConsolidate) {
      toast('Cannot consolidate. Some schools are missing submission entries.', 'warning')
      return
    }

    setLoading(true)
    setSaving(true)
    try {
      const computed = computeConsolidation(currentSubmissions, filters)
      setResult(computed)

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

      // Save result to Supabase database
      await saveConsolidatedReport({
        title,
        school_year_id: filters.school_year_id,
        term_id: filters.term_id,
        level_type: filters.school_level,
        grade_level_id: filters.grade_level_id,
        learning_area_id: filters.learning_area_id,
        total_schools_included: expectedSchools.length,
        total_submissions_count: computed.totalSubmissions,
        total_learners_count: computed.totalLearners,
        average_mps: computed.averageMps,
        consolidated_data: {
          ks1Advancing: computed.ks1Advancing,
          ks1Benchmarking: computed.ks1Benchmarking,
          ks1Connecting: computed.ks1Connecting,
          ks1Developing: computed.ks1Developing,
          ks1Emerging: computed.ks1Emerging,
          totalIntended: computed.totalIntended,
          totalTaught: computed.totalTaught,
          totalNotTaught: computed.totalNotTaught,
          mostLearnedTop3: computed.mostLearned.slice(0, 5),
          leastMasteredTop3: computed.leastMastered.slice(0, 5),
          instructionalDifficultiesCount: computed.instructionalDifficultyTexts.length,
        },
        created_by: admin?.id || null,
        created_by_name: admin?.full_name || 'Admin',
      })

      setIsSaved(true)
      setLastSavedTime(format(new Date(), 'MMM d, yyyy · h:mm a'))
      toast('Consolidation generated & saved to Supabase successfully!', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to save consolidation result to Supabase.', 'error')
    } finally {
      setLoading(false)
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
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          badge="District Data Consolidation"
          title="Data Consolidation & Verification"
          description="Validate 100% school submission completion across Elementary, Junior HS, and Senior HS levels before consolidating evaluation metrics into Supabase."
          actions={
            <div className="inline-flex p-1 bg-white/90 rounded-2xl border border-purple-100 shadow-2xs">
              <button
                onClick={() => setActiveTab('consolidate')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'consolidate'
                    ? 'bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638] hover:bg-[#F6EFFF]/50'
                }`}
              >
                <LayoutList size={15} />
                <span>New Consolidation</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
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

                {/* 3. School Level */}
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 flex items-center gap-1">
                    <Building2 size={13} className="text-[#8B72F4]" />
                    <span>School Level *</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-purple-100 text-xs font-black text-[#8B72F4] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={filters.school_level}
                    onChange={e => setF('school_level', e.target.value)}
                  >
                    <option value="all">All School Levels</option>
                    <option value="elementary">Elementary (Grades 1-6)</option>
                    <option value="junior_hs">Junior High School (Grades 7-10)</option>
                    <option value="senior_hs">Senior High School (Grades 11-12)</option>
                  </select>
                </div>

                {/* 4. Grade Level */}
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

                {/* 5. Learning Area */}
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
                  onClick={handleConsolidateAndSave}
                  disabled={!canConsolidate || loading}
                  title={
                    !isSpecificFilterSelected
                      ? 'Please select a specific Grade Level and Learning Area first.'
                      : !canConsolidate
                      ? `Consolidation blocked: ${missingSchools.length} school(s) have not submitted evaluation forms.`
                      : 'Consolidate and save data to Supabase'
                  }
                  className={`px-6 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md ${
                    canConsolidate && !loading
                      ? 'bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                  }`}
                >
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                  <span>{loading ? 'Processing Consolidation...' : 'Consolidate & Save to Supabase'}</span>
                </button>
              </div>
            </div>

            {/* REAL-TIME PRE-CHECK & COMPLIANCE VALIDATION ALERT CARD */}
            {isSpecificFilterSelected ? (
              canConsolidate ? (
                /* SUCCESS: 100% SUBMISSIONS COMPLETE */
                <div className="clay-card p-5 bg-gradient-to-br from-[#EDFAF3] via-white to-[#D1FAE5]/60 border border-[#A7F3D0] shadow-sm rounded-3xl animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-emerald-950">
                            Submissions 100% Complete ({submittedSchools.length} of {expectedSchools.length} Schools Submitted)
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-black border border-emerald-300">
                            READY TO CONSOLIDATE
                          </span>
                        </div>
                        <p className="text-xs font-medium text-emerald-800 mt-0.5">
                          All {expectedSchools.length} eligible schools for <strong className="font-extrabold">{levelLabel} — {selectedGrade} — {selectedLA}</strong> have logged valid evaluation forms. Click the button above to execute consolidation.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/90 px-3.5 py-1.5 rounded-full border border-emerald-200">
                        {currentSubmissions.length} Submissions Logged
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* BLOCKED: MISSING SUBMISSIONS ALERT */
                <div className="clay-card p-6 bg-gradient-to-br from-[#FFF0F3] via-white to-[#FFE0E6]/60 border border-[#FFCCD4] shadow-md rounded-3xl animate-fade-in space-y-4">
                  <div className="flex items-start justify-between gap-4 border-b border-[#FFCCD4]/60 pb-3.5">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E11D48] to-rose-600 text-white flex items-center justify-center font-bold shadow-md shrink-0 mt-0.5">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-black text-[#881337]">
                            Consolidation Blocked — Missing School Submissions
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#FFE0E6] text-[#E11D48] text-[10px] font-black border border-[#FFCCD4]">
                            {submittedSchools.length} of {expectedSchools.length} Schools Submitted
                          </span>
                        </div>
                        <p className="text-xs font-medium text-[#9F1239] mt-1">
                          DepEd consolidation requires complete 100% data entry across all schools for <strong className="font-extrabold">{levelLabel} — {selectedGrade} — {selectedLA}</strong>. Consolidation is disabled until the following missing schools submit forms.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SPECIFIC MISSING SCHOOLS LIST */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#881337] flex items-center gap-1.5">
                        <XCircle size={15} className="text-[#E11D48]" />
                        <span>The following {missingSchools.length} school(s) have NOT submitted entries:</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {missingSchools.map(school => (
                        <div
                          key={school.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#FFCCD4] shadow-2xs text-xs font-bold text-[#881337]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Building2 size={15} className="text-[#E11D48] shrink-0" />
                            <span className="truncate">{school.name}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#FFE0E6] text-[#E11D48] text-[10px] font-extrabold border border-[#FFCCD4] shrink-0">
                            Missing
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : (
              /* PROMPT TO SELECT GRADE & SUBJECT */
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
                      onClick={handleExport}
                      disabled={exporting}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} />
                      <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
                    </button>
                  </div>
                </div>

                {/* VIEW 1: UNIFIED SINGLE CONSOLIDATED MATRIX TABLE */}
                {viewMode === 'single_table' && (
                  <div className="space-y-6">
                    {/* Consolidated Metrics KPI Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      <div className="clay-card p-4 text-center border border-purple-100 bg-white">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A7289]">Schools Included</p>
                        <p className="text-2xl font-black text-[#8B72F4] mt-1">{submittedSchools.length}</p>
                      </div>
                      <div className="clay-card p-4 text-center border border-purple-100 bg-white">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A7289]">Total Learners Evaluated</p>
                        <p className="text-2xl font-black text-[#795CEE] mt-1">{result.totalLearners}</p>
                      </div>
                      <div className="clay-card p-4 text-center border border-purple-100 bg-white">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A7289]">District Average MPS</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">
                          {result.averageMps !== null ? `${result.averageMps}%` : 'KS1 Levels'}
                        </p>
                      </div>
                      <div className="clay-card p-4 text-center border border-purple-100 bg-white">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7A7289]">Competencies Taught</p>
                        <p className="text-2xl font-black text-[#6366F1] mt-1">{result.totalTaught}</p>
                      </div>
                    </div>

                    {/* Single Consolidated Master Table */}
                    <div className="clay-card overflow-hidden p-1.5 bg-white border border-purple-100 shadow-md rounded-3xl">
                      <div className="px-5 py-4 bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#FAF5F0] border-b border-purple-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-[#2D2638] font-display">
                            Unified Consolidated Data Matrix — {levelLabel} ({selectedGrade})
                          </h3>
                          <p className="text-xs text-[#7A7289] font-medium mt-0.5">
                            Combined teacher ratings and learner performance for {selectedLA} ({selectedSY} · {selectedTerm})
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-[#8B72F4] text-white text-xs font-black shadow-2xs">
                          {result.submissions.length} Entries Combined
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-[#F8F9FD] text-[#7A7289] font-extrabold uppercase tracking-wider border-b border-purple-100 text-[10px]">
                            <tr>
                              <th className="py-3 px-3.5 text-center w-10">#</th>
                              <th className="py-3 px-4">School Name</th>
                              <th className="py-3 px-4">Assigned Teacher</th>
                              <th className="py-3 px-4">Ref No.</th>
                              <th className="py-3 px-3 text-center">Learners</th>
                              <th className="py-3 px-4 text-center">Performance Rating</th>
                              <th className="py-3 px-3 text-center">Taught</th>
                              <th className="py-3 px-3 text-center">Not Taught</th>
                              <th className="py-3 px-4">Top Most Learned Competencies</th>
                              <th className="py-3 px-4">Top Least Mastered Competencies</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-50/70">
                            {result.submissions.map((sub, index) => {
                              const ks1Data = sub.ks1_learner_data
                              const ks24Data = sub.ks2to4_learner_data
                              const compSummary = sub.competency_summary
                              const mostLearnedList = sub.submission_competencies?.filter(c => c.category === 'most_learned') || []
                              const leastMasteredList = sub.submission_competencies?.filter(c => c.category === 'least_mastered') || []

                              return (
                                <tr key={sub.id} className="hover:bg-[#F6EFFF]/30 transition-colors">
                                  <td className="py-3 px-3.5 text-center font-bold text-[#7A7289]">{index + 1}</td>
                                  <td className="py-3 px-4 font-extrabold text-[#2D2638]">
                                    <div className="flex items-center gap-1.5">
                                      <Building2 size={13} className="text-[#8B72F4] shrink-0" />
                                      <span>{sub.school?.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-[#2D2638]">
                                    <a
                                      href={`/teacher-submissions?name=${encodeURIComponent(sub.teacher_name)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-[#8B72F4] hover:underline"
                                    >
                                      {sub.teacher_name}
                                    </a>
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-[#8B72F4]">{sub.reference_number}</td>
                                  <td className="py-3 px-3 text-center font-extrabold text-[#2D2638]">
                                    {ks1Data?.total_learners || ks24Data?.total_learners || '—'}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {sub.form_type === 'ks1' ? (
                                      <div className="inline-flex gap-1 text-[10px] font-extrabold flex-wrap justify-center">
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800" title="Advancing">Adv: {ks1Data?.advancing || 0}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800" title="Benchmarking">Bench: {ks1Data?.benchmarking || 0}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Developing">Dev: {ks1Data?.developing || 0}</span>
                                      </div>
                                    ) : (
                                      <span className="font-extrabold text-sm text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                                        {ks24Data?.mps !== null && ks24Data?.mps !== undefined ? `${ks24Data.mps}% MPS` : '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-emerald-600">
                                    {compSummary?.competencies_taught || 0}
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-rose-600">
                                    {compSummary?.competencies_not_taught || 0}
                                  </td>
                                  <td className="py-3 px-4 max-w-[200px]">
                                    {mostLearnedList.length > 0 ? (
                                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#2D2638] font-medium truncate">
                                        {mostLearnedList.slice(0, 2).map((c, i) => (
                                          <li key={i} className="truncate">{c.competency_text}</li>
                                        ))}
                                      </ul>
                                    ) : <span className="text-[#A39BAF] italic">None listed</span>}
                                  </td>
                                  <td className="py-3 px-4 max-w-[200px]">
                                    {leastMasteredList.length > 0 ? (
                                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-[#2D2638] font-medium truncate">
                                        {leastMasteredList.slice(0, 2).map((c, i) => (
                                          <li key={i} className="truncate">{c.competency_text}</li>
                                        ))}
                                      </ul>
                                    ) : <span className="text-[#A39BAF] italic">None listed</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: OFFICIAL DEPED TEMPLATE FORM */}
                {viewMode === 'official_template' && (
                  <div className="space-y-6">
                    {(filters.key_stage === 'all' || filters.key_stage === 'ks1') && (
                      <OfficialTermcatTemplate
                        submissions={result.submissions.filter(s => s.form_type === 'ks1')}
                        formType="ks1"
                        learningAreaName={selectedLA}
                        termName={selectedTerm}
                        schoolYearName={selectedSY}
                        showPrintButton
                      />
                    )}

                    {(filters.key_stage === 'all' || filters.key_stage !== 'ks1') && (
                      <OfficialTermcatTemplate
                        submissions={result.submissions.filter(s => s.form_type === 'ks2to4')}
                        formType="ks2to4"
                        learningAreaName={selectedLA}
                        termName={selectedTerm}
                        schoolYearName={selectedSY}
                        showPrintButton
                      />
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

        {/* TAB 2: SAVED REPORTS HISTORY */}
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
    </AdminLayout>
  )
}
