import { useState, useEffect, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { gradingNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  fetchSchools,
  fetchGradeLevels,
  fetchSections,
  fetchLearningAreas,
  fetchLearners,
  fetchClassRecord,
  upsertClassRecord,
  fetchLearnerGradesByFilters,
  saveLearnerGradesBatch,
} from '@/lib/supabase/queries'
import {
  getSubjectWeightProfile,
  transmuteInitialGrade,
  getDepEdProficiencyLevel,
  SubjectWeightConfig
} from '@/utils/gradingCalculator'
import type { School, GradeLevel, Section, LearningArea, Learner, ClassRecord, LearnerGrade } from '@/types'
import {
  ClipboardList,
  Save,
  RotateCcw,
  Sparkles,
  Download,
  Printer,
  ChevronDown,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  Building2,
  Users,
  Award,
  ArrowUpDown,
  BookOpen
} from 'lucide-react'

interface StudentECRScore {
  learnerId: string
  // Written works raw scores
  wwScores: (number | null)[]
  // Performance tasks raw scores
  ptScores: (number | null)[]
  // Quarterly assessment raw score
  qaScore: number | null
}

export function GradingClassRecordPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Selection Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedQuarter, setSelectedQuarter] = useState<'q1' | 'q2' | 'q3' | 'q4'>('q1')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026')

  // Maximum / Highest Possible Scores (HPS)
  const [hpsWW, setHpsWW] = useState<number[]>([20, 20, 25, 25, 30])
  const [hpsPT, setHpsPT] = useState<number[]>([25, 25, 30, 30, 40])
  const [hpsQA, setHpsQA] = useState<number>(50)

  // Student Score Matrix
  const [studentScores, setStudentScores] = useState<Record<string, StudentECRScore>>({})

  // Load Base Reference Data
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [sch, gr, sec, la, ln] = await Promise.all([
          fetchSchools(true, true),
          fetchGradeLevels(undefined, true),
          fetchSections(),
          fetchLearningAreas(),
          fetchLearners()
        ])
        setSchools(sch)
        setGradeLevels(gr)
        setSections(sec)
        setLearningAreas(la)
        setLearners(ln)

        if (sch.length > 0) setSelectedSchoolId(sch[0].id)
        if (gr.length > 0) setSelectedGradeId(gr[0].id)
        if (la.length > 0) setSelectedSubjectId(la[0].id)
      } catch (err) {
        console.error('Failed to load grading setup data:', err)
        toast('Failed to load class record setup data.', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Auto-select first matching section when grade/school changes
  const filteredSections = useMemo(() => {
    return sections.filter(s => {
      const matchSchool = !selectedSchoolId || s.school_id === selectedSchoolId
      const matchGrade = !selectedGradeId || s.grade_level_id === selectedGradeId
      return matchSchool && matchGrade
    })
  }, [sections, selectedSchoolId, selectedGradeId])

  useEffect(() => {
    if (filteredSections.length > 0 && (!selectedSectionId || !filteredSections.some(s => s.id === selectedSectionId))) {
      setSelectedSectionId(filteredSections[0].id)
    }
  }, [filteredSections, selectedSectionId])

  // Filter learners by selected school, grade, and section
  const sectionLearners = useMemo(() => {
    return learners.filter(l => {
      const matchSchool = !selectedSchoolId || l.school_id === selectedSchoolId
      const matchGrade = !selectedGradeId || l.grade_level_id === selectedGradeId
      const matchSec = !selectedSectionId || l.section_id === selectedSectionId
      return matchSchool && matchGrade && matchSec
    }).sort((a, b) => {
      if (a.sex !== b.sex) return a.sex === 'Male' ? -1 : 1
      return (a.last_name || '').localeCompare(b.last_name || '')
    })
  }, [learners, selectedSchoolId, selectedGradeId, selectedSectionId])

  // Current Subject and Weight Distribution
  const currentSubject = useMemo(() => {
    return learningAreas.find(la => la.id === selectedSubjectId)
  }, [learningAreas, selectedSubjectId])

  const weightConfig: SubjectWeightConfig = useMemo(() => {
    return getSubjectWeightProfile(currentSubject?.name || 'Languages')
  }, [currentSubject])

  // Generate storage key for saving this class record
  const quarterNum = useMemo(() => {
    switch (selectedQuarter) {
      case 'q1': return 1
      case 'q2': return 2
      case 'q3': return 3
      case 'q4': return 4
      default: return 1
    }
  }, [selectedQuarter])

  // Load saved scores for the selected section/subject/quarter from Supabase / Local cache
  useEffect(() => {
    if (!selectedSectionId || !selectedSubjectId || !selectedSchoolId || !selectedGradeId) return
    let isCancelled = false

    async function loadClassRecordData() {
      try {
        const [cr, dbGrades] = await Promise.all([
          fetchClassRecord(selectedSchoolId, selectedGradeId, selectedSectionId, selectedSubjectId, quarterNum, selectedSchoolYear),
          fetchLearnerGradesByFilters(selectedSchoolId, selectedGradeId, selectedSectionId, selectedSubjectId, quarterNum, selectedSchoolYear)
        ])

        if (isCancelled) return

        if (cr) {
          if (Array.isArray(cr.hps_written_works) && cr.hps_written_works.length > 0) setHpsWW(cr.hps_written_works)
          if (Array.isArray(cr.hps_performance_tasks) && cr.hps_performance_tasks.length > 0) setHpsPT(cr.hps_performance_tasks)
          if (cr.hps_quarterly_assessment !== undefined) setHpsQA(cr.hps_quarterly_assessment)
        }

        const scoresMap: Record<string, StudentECRScore> = {}
        sectionLearners.forEach(l => {
          const matchedGrade = dbGrades.find(g => g.learner_id === l.id)
          if (matchedGrade) {
            scoresMap[l.id] = {
              learnerId: l.id,
              wwScores: Array.isArray(matchedGrade.scores_written_works) ? matchedGrade.scores_written_works : new Array(hpsWW.length).fill(null),
              ptScores: Array.isArray(matchedGrade.scores_performance_tasks) ? matchedGrade.scores_performance_tasks : new Array(hpsPT.length).fill(null),
              qaScore: matchedGrade.score_quarterly_assessment ?? null
            }
          } else {
            // Fresh empty scores for learner - DO NOT add default fake grades!
            scoresMap[l.id] = {
              learnerId: l.id,
              wwScores: new Array(hpsWW.length).fill(null),
              ptScores: new Array(hpsPT.length).fill(null),
              qaScore: null
            }
          }
        })
        setStudentScores(scoresMap)
      } catch (err) {
        console.warn('Failed to load class record from Supabase:', err)
      }
    }

    loadClassRecordData()
    return () => { isCancelled = true }
  }, [selectedSchoolId, selectedGradeId, selectedSectionId, selectedSubjectId, quarterNum, selectedSchoolYear, sectionLearners])

  // HPS Totals
  const totalHpsWW = useMemo(() => hpsWW.reduce((sum, v) => sum + (v || 0), 0), [hpsWW])
  const totalHpsPT = useMemo(() => hpsPT.reduce((sum, v) => sum + (v || 0), 0), [hpsPT])
  const totalHpsQA = hpsQA || 1

  // Handle cell score changes
  const handleScoreChange = (learnerId: string, type: 'ww' | 'pt' | 'qa', index: number, value: string) => {
    const num = value === '' ? null : Math.max(0, parseInt(value, 10) || 0)
    setStudentScores(prev => {
      const current = prev[learnerId] || {
        learnerId,
        wwScores: new Array(hpsWW.length).fill(null),
        ptScores: new Array(hpsPT.length).fill(null),
        qaScore: null
      }

      if (type === 'ww') {
        const newWW = [...current.wwScores]
        newWW[index] = num !== null ? Math.min(num, hpsWW[index] || 100) : null
        return { ...prev, [learnerId]: { ...current, wwScores: newWW } }
      }
      if (type === 'pt') {
        const newPT = [...current.ptScores]
        newPT[index] = num !== null ? Math.min(num, hpsPT[index] || 100) : null
        return { ...prev, [learnerId]: { ...current, ptScores: newPT } }
      }
      if (type === 'qa') {
        return { ...prev, [learnerId]: { ...current, qaScore: num !== null ? Math.min(num, hpsQA) : null } }
      }
      return prev
    })
  }

  // Calculate ECR for a student
  const calculateStudentECR = (learnerId: string) => {
    const score = studentScores[learnerId]
    const hasEnteredScores = score && (
      score.wwScores.some(s => s !== null && s !== undefined) ||
      score.ptScores.some(s => s !== null && s !== undefined) ||
      (score.qaScore !== null && score.qaScore !== undefined)
    )

    if (!score || !hasEnteredScores) {
      return {
        hasEnteredScores: false,
        totalWW: 0,
        psWW: 0,
        wsWW: 0,
        totalPT: 0,
        psPT: 0,
        wsPT: 0,
        totalQA: 0,
        psQA: 0,
        wsQA: 0,
        initialGrade: null,
        transmutedGrade: null,
        remarks: 'No scores' as const
      }
    }

    const totalWW = score.wwScores.reduce<number>((sum, v) => sum + (v || 0), 0)
    const psWW = totalHpsWW > 0 ? (totalWW / totalHpsWW) * 100 : 0
    const wsWW = (psWW * weightConfig.writtenWorks) / 100

    const totalPT = score.ptScores.reduce<number>((sum, v) => sum + (v || 0), 0)
    const psPT = totalHpsPT > 0 ? (totalPT / totalHpsPT) * 100 : 0
    const wsPT = (psPT * weightConfig.performanceTasks) / 100

    const totalQA = score.qaScore || 0
    const psQA = totalHpsQA > 0 ? (totalQA / totalHpsQA) * 100 : 0
    const wsQA = (psQA * weightConfig.quarterlyAssessment) / 100

    const initialGrade = Math.round((wsWW + wsPT + wsQA) * 100) / 100
    const transmutedGrade = transmuteInitialGrade(initialGrade)
    const { remarks } = getDepEdProficiencyLevel(transmutedGrade)

    return {
      hasEnteredScores: true,
      totalWW,
      psWW: Math.round(psWW * 10) / 10,
      wsWW: Math.round(wsWW * 10) / 10,
      totalPT,
      psPT: Math.round(psPT * 10) / 10,
      wsPT: Math.round(wsPT * 10) / 10,
      totalQA,
      psQA: Math.round(psQA * 10) / 10,
      wsQA: Math.round(wsQA * 10) / 10,
      initialGrade,
      transmutedGrade,
      remarks
    }
  }

  // Save Class Record & Synchronize with Supabase & LIS Learner Profiles
  const handleSaveClassRecord = async () => {
    setSaving(true)
    try {
      // 1. Save Class Record to Supabase
      const classRecordPayload: ClassRecord = {
        school_id: selectedSchoolId,
        grade_level_id: selectedGradeId,
        section_id: selectedSectionId || null,
        learning_area_id: selectedSubjectId,
        school_year: selectedSchoolYear,
        quarter: quarterNum,
        hps_written_works: hpsWW,
        hps_performance_tasks: hpsPT,
        hps_quarterly_assessment: hpsQA,
        created_by: user?.id || null
      }
      const savedCR = await upsertClassRecord(classRecordPayload)

      // 2. Save individual Learner Grades batch to Supabase
      const currentSubjectName = currentSubject?.name || 'General'
      const learnerGradesBatch: Partial<LearnerGrade>[] = []

      sectionLearners.forEach(l => {
        const score = studentScores[l.id]
        const calc = calculateStudentECR(l.id)

        learnerGradesBatch.push({
          learner_id: l.id,
          class_record_id: savedCR.id,
          learning_area_id: selectedSubjectId,
          school_id: selectedSchoolId,
          grade_level_id: selectedGradeId,
          section_id: selectedSectionId || null,
          school_year: selectedSchoolYear,
          quarter: quarterNum,
          scores_written_works: score?.wwScores || [],
          scores_performance_tasks: score?.ptScores || [],
          score_quarterly_assessment: score?.qaScore ?? null,
          total_ww_score: calc.hasEnteredScores ? calc.totalWW : null,
          total_pt_score: calc.hasEnteredScores ? calc.totalPT : null,
          initial_grade: calc.hasEnteredScores ? calc.initialGrade : null,
          quarterly_grade: calc.hasEnteredScores ? calc.transmutedGrade : null,
          remarks: calc.hasEnteredScores ? calc.remarks : null
        })

        // Also update local cache for profile view
        const studentGradesKey = `sc_learner_grades_${l.id}`
        const existingGradesRaw = localStorage.getItem(studentGradesKey)
        let gradesList: any[] = []
        if (existingGradesRaw) {
          try {
            gradesList = JSON.parse(existingGradesRaw)
          } catch {}
        }
        if (!Array.isArray(gradesList)) gradesList = []

        const matchIdx = gradesList.findIndex(g => g.subjectName?.toLowerCase() === currentSubjectName.toLowerCase() || g.learning_area_id === selectedSubjectId)

        if (matchIdx >= 0) {
          gradesList[matchIdx][selectedQuarter] = calc.hasEnteredScores ? calc.transmutedGrade : null
          const quarters = [gradesList[matchIdx].q1, gradesList[matchIdx].q2, gradesList[matchIdx].q3, gradesList[matchIdx].q4].filter((q): q is number => q !== null && q !== undefined && !isNaN(q))
          gradesList[matchIdx].finalRating = quarters.length > 0 ? Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length) : null
          gradesList[matchIdx].remarks = gradesList[matchIdx].finalRating !== null ? (gradesList[matchIdx].finalRating >= 75 ? 'Passed' : 'Failed') : 'Pending'
        } else {
          gradesList.push({
            id: selectedSubjectId,
            learning_area_id: selectedSubjectId,
            subjectName: currentSubjectName,
            q1: selectedQuarter === 'q1' && calc.hasEnteredScores ? calc.transmutedGrade : null,
            q2: selectedQuarter === 'q2' && calc.hasEnteredScores ? calc.transmutedGrade : null,
            q3: selectedQuarter === 'q3' && calc.hasEnteredScores ? calc.transmutedGrade : null,
            q4: selectedQuarter === 'q4' && calc.hasEnteredScores ? calc.transmutedGrade : null,
            finalRating: calc.hasEnteredScores ? calc.transmutedGrade : null,
            remarks: calc.hasEnteredScores ? (calc.transmutedGrade! >= 75 ? 'Passed' : 'Failed') : 'Pending'
          })
        }
        localStorage.setItem(studentGradesKey, JSON.stringify(gradesList))
      })

      if (learnerGradesBatch.length > 0) {
        await saveLearnerGradesBatch(learnerGradesBatch)
      }

      toast('e-Class Record and grades saved to Supabase successfully!', 'success')
    } catch (err: any) {
      toast(err?.message || 'Failed to save class record', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Split learners into Male and Female
  const maleLearners = sectionLearners.filter(l => l.sex === 'Male')
  const femaleLearners = sectionLearners.filter(l => l.sex === 'Female')

  return (
    <SchoolConnectLayout systemTitle="e-Class Record & Grading Portal" navGroups={gradingNavGroups}>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
        
        {/* Page Header */}
        <PageHeader
          title="e-Class Record & Grading Portal"
          description="Official DepEd Electronic Class Record (DO 8, s. 2015 / MATATAG Curriculum) with auto-transmutation & LIS sync"
          badge="DepEd DO 8, s. 2015"
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} className="text-slate-500" />
                Print Class Record
              </button>
              <button
                type="button"
                onClick={handleSaveClassRecord}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save & Sync to LIS'}
              </button>
            </div>
          }
        />

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            
            {/* School */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                School
              </label>
              <select
                value={selectedSchoolId}
                onChange={e => setSelectedSchoolId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Grade Level */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Grade Level
              </label>
              <select
                value={selectedGradeId}
                onChange={e => setSelectedGradeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {gradeLevels.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Section
              </label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {filteredSections.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
            </div>

            {/* Learning Area / Subject */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Learning Area / Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                {learningAreas.map(la => (
                  <option key={la.id} value={la.id}>{la.name}</option>
                ))}
              </select>
            </div>

            {/* Quarter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Grading Period
              </label>
              <select
                value={selectedQuarter}
                onChange={e => setSelectedQuarter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-700 focus:outline-none focus:border-blue-500"
              >
                <option value="q1">1st Quarter (Q1)</option>
                <option value="q2">2nd Quarter (Q2)</option>
                <option value="q3">3rd Quarter (Q3)</option>
                <option value="q4">4th Quarter (Q4)</option>
              </select>
            </div>

            {/* School Year */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                School Year
              </label>
              <select
                value={selectedSchoolYear}
                onChange={e => setSelectedSchoolYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value="2025-2026">2025 - 2026</option>
                <option value="2026-2027">2026 - 2027</option>
              </select>
            </div>

          </div>

          {/* DepEd Weight Pill Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">DepEd Weight Distribution:</span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-200">
                Written Works (WW): {weightConfig.writtenWorks}%
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200">
                Performance Tasks (PT): {weightConfig.performanceTasks}%
              </span>
              <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-lg border border-blue-200">
                Quarterly Assessment (QA): {weightConfig.quarterlyAssessment}%
              </span>
            </div>
            <div className="text-slate-500 font-medium">
              Total Students in Section: <strong className="text-slate-800">{sectionLearners.length}</strong> (Male: {maleLearners.length}, Female: {femaleLearners.length})
            </div>
          </div>
        </div>

        {/* ECR SPREADSHEET TABLE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {/* Master Category Row */}
                <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-800">
                  <th colSpan={3} className="py-2.5 px-3 text-left border-r border-slate-800">
                    LEARNER INFORMATION
                  </th>
                  <th colSpan={hpsWW.length + 3} className="py-2.5 px-2 bg-amber-900/90 border-r border-slate-800">
                    WRITTEN WORKS ({weightConfig.writtenWorks}%)
                  </th>
                  <th colSpan={hpsPT.length + 3} className="py-2.5 px-2 bg-emerald-900/90 border-r border-slate-800">
                    PERFORMANCE TASKS ({weightConfig.performanceTasks}%)
                  </th>
                  <th colSpan={3} className="py-2.5 px-2 bg-blue-900/90 border-r border-slate-800">
                    QUARTERLY ASSESSMENT ({weightConfig.quarterlyAssessment}%)
                  </th>
                  <th colSpan={3} className="py-2.5 px-2 bg-purple-900/90">
                    QUARTERLY SUMMARY
                  </th>
                </tr>

                {/* Sub-Header Column Labels */}
                <tr className="bg-slate-100 text-slate-700 font-bold text-center text-[11px] border-b border-slate-300 select-none">
                  <th className="py-2 px-2 w-8 text-center border-r border-slate-200">#</th>
                  <th className="py-2 px-3 text-left w-28 border-r border-slate-200">LRN</th>
                  <th className="py-2 px-3 text-left min-w-[200px] border-r border-slate-200">Learner Full Name</th>

                  {/* WW Columns */}
                  {hpsWW.map((_, idx) => (
                    <th key={`ww-h-${idx}`} className="py-2 px-1 w-11 border-r border-slate-200 bg-amber-50/50">
                      WW{idx + 1}
                    </th>
                  ))}
                  <th className="py-2 px-1.5 w-12 bg-amber-100 text-amber-900 font-bold border-r border-slate-200">Total</th>
                  <th className="py-2 px-1.5 w-12 bg-amber-100 text-amber-900 font-bold border-r border-slate-200">PS</th>
                  <th className="py-2 px-1.5 w-12 bg-amber-200 text-amber-950 font-black border-r border-slate-300">WS</th>

                  {/* PT Columns */}
                  {hpsPT.map((_, idx) => (
                    <th key={`pt-h-${idx}`} className="py-2 px-1 w-11 border-r border-slate-200 bg-emerald-50/50">
                      PT{idx + 1}
                    </th>
                  ))}
                  <th className="py-2 px-1.5 w-12 bg-emerald-100 text-emerald-900 font-bold border-r border-slate-200">Total</th>
                  <th className="py-2 px-1.5 w-12 bg-emerald-100 text-emerald-900 font-bold border-r border-slate-200">PS</th>
                  <th className="py-2 px-1.5 w-12 bg-emerald-200 text-emerald-950 font-black border-r border-slate-300">WS</th>

                  {/* QA Columns */}
                  <th className="py-2 px-1.5 w-12 bg-blue-50 border-r border-slate-200">Score</th>
                  <th className="py-2 px-1.5 w-12 bg-blue-100 text-blue-900 font-bold border-r border-slate-200">PS</th>
                  <th className="py-2 px-1.5 w-12 bg-blue-200 text-blue-950 font-black border-r border-slate-300">WS</th>

                  {/* Final Summary */}
                  <th className="py-2 px-2 w-14 bg-purple-100 text-purple-900 font-bold border-r border-slate-200">Initial</th>
                  <th className="py-2 px-2 w-16 bg-purple-700 text-white font-black border-r border-purple-800">Quarterly</th>
                  <th className="py-2 px-2 w-16 bg-slate-200 text-slate-900 font-bold">Remarks</th>
                </tr>

                {/* Highest Possible Score (HPS) Row */}
                <tr className="bg-slate-200/70 text-slate-900 font-bold text-center text-xs border-b-2 border-slate-400">
                  <td colSpan={3} className="py-2 px-3 text-right font-black uppercase text-[11px] text-slate-700 border-r border-slate-300">
                    Highest Possible Score (HPS)
                  </td>

                  {/* HPS WW Inputs */}
                  {hpsWW.map((val, idx) => (
                    <td key={`hps-ww-${idx}`} className="p-0.5 border-r border-slate-300 bg-amber-100/70">
                      <input
                        type="number"
                        value={val}
                        onChange={e => {
                          const newHps = [...hpsWW]
                          newHps[idx] = parseInt(e.target.value, 10) || 0
                          setHpsWW(newHps)
                        }}
                        className="w-full text-center font-bold text-amber-900 py-1 bg-transparent focus:bg-white rounded"
                      />
                    </td>
                  ))}
                  <td className="py-1 px-1 bg-amber-200 font-black text-amber-950 border-r border-slate-300">{totalHpsWW}</td>
                  <td className="py-1 px-1 bg-amber-200 font-black text-amber-950 border-r border-slate-300">100.0</td>
                  <td className="py-1 px-1 bg-amber-300 font-black text-amber-950 border-r border-slate-400">{weightConfig.writtenWorks}%</td>

                  {/* HPS PT Inputs */}
                  {hpsPT.map((val, idx) => (
                    <td key={`hps-pt-${idx}`} className="p-0.5 border-r border-slate-300 bg-emerald-100/70">
                      <input
                        type="number"
                        value={val}
                        onChange={e => {
                          const newHps = [...hpsPT]
                          newHps[idx] = parseInt(e.target.value, 10) || 0
                          setHpsPT(newHps)
                        }}
                        className="w-full text-center font-bold text-emerald-900 py-1 bg-transparent focus:bg-white rounded"
                      />
                    </td>
                  ))}
                  <td className="py-1 px-1 bg-emerald-200 font-black text-emerald-950 border-r border-slate-300">{totalHpsPT}</td>
                  <td className="py-1 px-1 bg-emerald-200 font-black text-emerald-950 border-r border-slate-300">100.0</td>
                  <td className="py-1 px-1 bg-emerald-300 font-black text-emerald-950 border-r border-slate-400">{weightConfig.performanceTasks}%</td>

                  {/* HPS QA Input */}
                  <td className="p-0.5 border-r border-slate-300 bg-blue-100/70">
                    <input
                      type="number"
                      value={hpsQA}
                      onChange={e => setHpsQA(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-center font-bold text-blue-900 py-1 bg-transparent focus:bg-white rounded"
                    />
                  </td>
                  <td className="py-1 px-1 bg-blue-200 font-black text-blue-950 border-r border-slate-300">100.0</td>
                  <td className="py-1 px-1 bg-blue-300 font-black text-blue-950 border-r border-slate-400">{weightConfig.quarterlyAssessment}%</td>

                  {/* Summary HPS */}
                  <td className="py-1 px-1 bg-purple-200 font-black text-purple-950 border-r border-slate-300">100.0</td>
                  <td className="py-1 px-1 bg-purple-800 text-white font-black border-r border-purple-900">100</td>
                  <td className="py-1 px-1 bg-slate-300 font-black text-slate-800">Passed</td>
                </tr>
              </thead>

              <tbody>
                {/* MALE LEARNERS SECTION */}
                <tr className="bg-blue-900/10 font-bold text-blue-950 text-xs border-y border-blue-200">
                  <td colSpan={24} className="py-1.5 px-3 uppercase tracking-wider">
                    MALE LEARNERS ({maleLearners.length})
                  </td>
                </tr>

                {maleLearners.map((learner, idx) => {
                  const student = studentScores[learner.id] || { learnerId: learner.id, wwScores: [], ptScores: [], qaScore: null }
                  const calc = calculateStudentECR(learner.id)

                  return (
                    <tr key={learner.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-700 border-r border-slate-100 text-[11px]">
                        {learner.lrn}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {learner.last_name?.toUpperCase()}, {learner.first_name} {learner.middle_name ? `${learner.middle_name[0]}.` : ''}
                      </td>

                      {/* WW Inputs */}
                      {hpsWW.map((_, wIdx) => (
                        <td key={`ww-${wIdx}`} className="p-0.5 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            value={student.wwScores[wIdx] ?? ''}
                            onChange={e => handleScoreChange(learner.id, 'ww', wIdx, e.target.value)}
                            className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-amber-50 focus:outline-none rounded hover:bg-slate-100"
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-bold text-amber-900 bg-amber-50/50 border-r border-slate-100">{calc.totalWW}</td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-amber-50/50 border-r border-slate-100">{calc.psWW}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-amber-900 bg-amber-100/70 border-r border-slate-200">{calc.wsWW}</td>

                      {/* PT Inputs */}
                      {hpsPT.map((_, pIdx) => (
                        <td key={`pt-${pIdx}`} className="p-0.5 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            value={student.ptScores[pIdx] ?? ''}
                            onChange={e => handleScoreChange(learner.id, 'pt', pIdx, e.target.value)}
                            className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-emerald-50 focus:outline-none rounded hover:bg-slate-100"
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-bold text-emerald-900 bg-emerald-50/50 border-r border-slate-100">{calc.totalPT}</td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-emerald-50/50 border-r border-slate-100">{calc.psPT}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-emerald-900 bg-emerald-100/70 border-r border-slate-200">{calc.wsPT}</td>

                      {/* QA Inputs */}
                      <td className="p-0.5 border-r border-slate-100 text-center">
                        <input
                          type="number"
                          value={student.qaScore ?? ''}
                          onChange={e => handleScoreChange(learner.id, 'qa', 0, e.target.value)}
                          className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-blue-50 focus:outline-none rounded hover:bg-slate-100"
                        />
                      </td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-blue-50/50 border-r border-slate-100">{calc.psQA}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-blue-900 bg-blue-100/70 border-r border-slate-200">{calc.wsQA}</td>

                      {/* Summary Results */}
                      <td className="py-1.5 px-2 text-center font-bold text-purple-900 bg-purple-50 border-r border-slate-200 font-mono">
                        {calc.hasEnteredScores && calc.initialGrade !== null ? calc.initialGrade.toFixed(2) : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-black text-sm border-r font-mono ${
                        calc.hasEnteredScores && calc.transmutedGrade !== null ? 'text-white bg-purple-700 border-purple-800' : 'text-slate-400 bg-slate-100 border-slate-200'
                      }`}>
                        {calc.hasEnteredScores && calc.transmutedGrade !== null ? calc.transmutedGrade : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-bold text-[11px] ${
                        !calc.hasEnteredScores ? 'text-slate-400 bg-slate-50' : calc.remarks === 'Passed' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                      }`}>
                        {calc.hasEnteredScores ? calc.remarks : 'Pending'}
                      </td>
                    </tr>
                  )
                })}

                {/* FEMALE LEARNERS SECTION */}
                <tr className="bg-rose-900/10 font-bold text-rose-950 text-xs border-y border-rose-200">
                  <td colSpan={24} className="py-1.5 px-3 uppercase tracking-wider">
                    FEMALE LEARNERS ({femaleLearners.length})
                  </td>
                </tr>

                {femaleLearners.map((learner, idx) => {
                  const student = studentScores[learner.id] || { learnerId: learner.id, wwScores: [], ptScores: [], qaScore: null }
                  const calc = calculateStudentECR(learner.id)

                  return (
                    <tr key={learner.id} className="border-b border-slate-100 hover:bg-rose-50/30 transition-colors">
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-3 font-mono font-bold text-slate-700 border-r border-slate-100 text-[11px]">
                        {learner.lrn}
                      </td>
                      <td className="py-1.5 px-3 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                        {learner.last_name?.toUpperCase()}, {learner.first_name} {learner.middle_name ? `${learner.middle_name[0]}.` : ''}
                      </td>

                      {/* WW Inputs */}
                      {hpsWW.map((_, wIdx) => (
                        <td key={`ww-${wIdx}`} className="p-0.5 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            value={student.wwScores[wIdx] ?? ''}
                            onChange={e => handleScoreChange(learner.id, 'ww', wIdx, e.target.value)}
                            className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-amber-50 focus:outline-none rounded hover:bg-slate-100"
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-bold text-amber-900 bg-amber-50/50 border-r border-slate-100">{calc.totalWW}</td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-amber-50/50 border-r border-slate-100">{calc.psWW}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-amber-900 bg-amber-100/70 border-r border-slate-200">{calc.wsWW}</td>

                      {/* PT Inputs */}
                      {hpsPT.map((_, pIdx) => (
                        <td key={`pt-${pIdx}`} className="p-0.5 border-r border-slate-100 text-center">
                          <input
                            type="number"
                            value={student.ptScores[pIdx] ?? ''}
                            onChange={e => handleScoreChange(learner.id, 'pt', pIdx, e.target.value)}
                            className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-emerald-50 focus:outline-none rounded hover:bg-slate-100"
                          />
                        </td>
                      ))}
                      <td className="py-1 px-1.5 text-center font-bold text-emerald-900 bg-emerald-50/50 border-r border-slate-100">{calc.totalPT}</td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-emerald-50/50 border-r border-slate-100">{calc.psPT}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-emerald-900 bg-emerald-100/70 border-r border-slate-200">{calc.wsPT}</td>

                      {/* QA Inputs */}
                      <td className="p-0.5 border-r border-slate-100 text-center">
                        <input
                          type="number"
                          value={student.qaScore ?? ''}
                          onChange={e => handleScoreChange(learner.id, 'qa', 0, e.target.value)}
                          className="w-full text-center py-1 text-slate-800 font-semibold focus:bg-blue-50 focus:outline-none rounded hover:bg-slate-100"
                        />
                      </td>
                      <td className="py-1 px-1.5 text-center text-slate-600 bg-blue-50/50 border-r border-slate-100">{calc.psQA}</td>
                      <td className="py-1 px-1.5 text-center font-bold text-blue-900 bg-blue-100/70 border-r border-slate-200">{calc.wsQA}</td>

                      {/* Summary Results */}
                      <td className="py-1.5 px-2 text-center font-bold text-purple-900 bg-purple-50 border-r border-slate-200 font-mono">
                        {calc.hasEnteredScores && calc.initialGrade !== null ? calc.initialGrade.toFixed(2) : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-black text-sm border-r font-mono ${
                        calc.hasEnteredScores && calc.transmutedGrade !== null ? 'text-white bg-purple-700 border-purple-800' : 'text-slate-400 bg-slate-100 border-slate-200'
                      }`}>
                        {calc.hasEnteredScores && calc.transmutedGrade !== null ? calc.transmutedGrade : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-bold text-[11px] ${
                        !calc.hasEnteredScores ? 'text-slate-400 bg-slate-50' : calc.remarks === 'Passed' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                      }`}>
                        {calc.hasEnteredScores ? calc.remarks : 'Pending'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </SchoolConnectLayout>
  )
}
