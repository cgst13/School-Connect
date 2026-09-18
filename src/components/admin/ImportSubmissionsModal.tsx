import { useState, useRef, useEffect, useMemo } from 'react'
import type { School, GradeLevel, LearningArea, LearningAreaGrade, SchoolYear, Term, TermcatSubmission, FormType } from '@/types'
import {
  parseSubjectImportExcel,
  getExcelSheetNames,
  downloadImportTemplate,
  type ParsedSubjectRow
} from '@/lib/excel/excelImport'
import { createSubmission, generateReferenceNumber, insertAuditLog, checkDuplicateSubmission, fetchLearningAreaGrades } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'
import { SuggestionInput } from '@/components/forms/SuggestionInput'
import {
  fetchTeacherNameSuggestions,
  fetchTeacherPreviousSchool,
  saveLocalSuggestion,
  saveTeacherSchoolMapping
} from '@/lib/supabase/suggestions'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw,
  User, Building2, GraduationCap, Calendar, Clock, AlertCircle, Layers, Eye, Printer, Sparkles, Lock
} from 'lucide-react'
import { useGenieModal } from '@/utils/genieAnimation'

interface ImportSubmissionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  schools: School[]
  grades: GradeLevel[]
  learningAreas: LearningArea[]
  schoolYears: SchoolYear[]
  terms: Term[]
}

export function ImportSubmissionsModal({
  isOpen,
  onClose,
  onSuccess,
  schools,
  grades,
  learningAreas,
  schoolYears,
  terms,
}: ImportSubmissionsModalProps) {
  const { admin } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { shouldRender, triggerClose, containerClass, backdropClass } = useGenieModal(isOpen, onClose)

  // Tagging parameters
  const [teacherName, setTeacherName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [schoolYearId, setSchoolYearId] = useState('')
  const [termId, setTermId] = useState('')

  // Suggestion & Auto-select state
  const [teacherSuggestions, setTeacherSuggestions] = useState<string[]>([])
  const [autoSelectedSchoolName, setAutoSelectedSchoolName] = useState<string>('')

  // File & parsing state
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [parsedRows, setParsedRows] = useState<ParsedSubjectRow[]>([])
  const [duplicateMap, setDuplicateMap] = useState<Record<number, boolean>>({})
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // Official Template Preview Modal State
  const [showOfficialPreview, setShowOfficialPreview] = useState(false)
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])

  // Set default values & load teacher suggestions when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeSY = schoolYears.find(sy => sy.is_active)
      if (activeSY && !schoolYearId) setSchoolYearId(activeSY.id)

      const defaultTerm = terms.find(t => t.is_default || t.is_active)
      if (defaultTerm && !termId) setTermId(defaultTerm.id)

      fetchTeacherNameSuggestions().then(setTeacherSuggestions)
      fetchLearningAreaGrades().then(setLearningAreaGrades)
    }
  }, [isOpen, schoolYears, terms, schoolYearId, termId])

  // Filter learning areas assigned to the selected grade level only
  const availableLearningAreas = useMemo(() => {
    if (!gradeLevelId || learningAreaGrades.length === 0) return learningAreas
    const mappedLAIds = new Set(
      learningAreaGrades
        .filter(lag => lag.grade_level_id === gradeLevelId)
        .map(lag => lag.learning_area_id)
    )
    if (mappedLAIds.size > 0) {
      return learningAreas.filter(la => mappedLAIds.has(la.id))
    }
    return learningAreas
  }, [gradeLevelId, learningAreaGrades, learningAreas])

  const isTaggingComplete = Boolean(schoolId && gradeLevelId)

  // Auto-select school when teacher name is typed or selected from suggestions
  const handleTeacherNameSelect = async (name: string) => {
    setTeacherName(name)
    setAutoSelectedSchoolName('')
    if (!name || name.trim().length < 2) return

    const prevSchoolId = await fetchTeacherPreviousSchool(name)
    if (prevSchoolId && schools.some(s => s.id === prevSchoolId)) {
      setSchoolId(prevSchoolId)
      const school = schools.find(s => s.id === prevSchoolId)
      if (school) setAutoSelectedSchoolName(school.name)
    }
  }

  // Construct transient TermcatSubmissions for Official Template Preview
  const previewSubmissions = useMemo<TermcatSubmission[]>(() => {
    if (!parsedRows.length) return []

    const selectedSchool = schools.find(s => s.id === schoolId) || {
      id: 's-preview',
      name: 'School (Pending Selection)',
      school_type: 'secondary' as const,
      is_active: true,
      created_at: '',
      updated_at: '',
    }
    const selectedGrade = grades.find(g => g.id === gradeLevelId) || {
      id: 'g-preview',
      name: 'Grade Level (Pending Selection)',
      grade_number: 5,
      school_type: 'secondary' as const,
      key_stage: 'ks2' as const,
      is_active: true,
    }
    const selectedSY = schoolYears.find(sy => sy.id === schoolYearId) || {
      id: 'sy-preview',
      name: 'School Year',
      is_active: true,
      created_at: '',
    }
    const selectedTerm = terms.find(t => t.id === termId) || {
      id: 'term-preview',
      name: 'Quarter / Term',
      sort_order: 1,
      is_active: true,
      created_at: '',
    }

    return parsedRows.map((row, idx) => {
      const matchedLA = learningAreas.find(la => la.id === row.learningAreaId) || {
        id: `temp-${idx}`,
        name: row.learningAreaRaw,
        is_active: true,
        created_at: '',
        updated_at: '',
      }

      const isKS1 = row.formType === 'ks1' || selectedGrade.grade_number <= 3
      const formType: FormType = isKS1 ? 'ks1' : 'ks2to4'

      const competencies: any[] = [
        ...row.mostLearned.map((txt, i) => ({ id: `ml-${idx}-${i}`, category: 'most_learned', rank: i + 1, competency_text: txt })),
        ...row.leastMastered.map((txt, i) => ({ id: `lm-${idx}-${i}`, category: 'least_mastered', rank: i + 1, competency_text: txt })),
        ...row.mostDifficult.map((txt, i) => ({ id: `md-${idx}-${i}`, category: 'most_difficult_to_teach', rank: i + 1, competency_text: txt })),
      ]

      return {
        id: `preview-${row.rowIndex}`,
        reference_number: `PREVIEW-${idx + 1}`,
        teacher_name: teacherName.trim() || 'Teacher Name (Pending)',
        school_id: selectedSchool.id,
        grade_level_id: selectedGrade.id,
        learning_area_id: matchedLA.id,
        school_year_id: selectedSY.id,
        term_id: selectedTerm.id,
        key_stage: selectedGrade.key_stage,
        form_type: formType,
        status: 'submitted',
        return_reason: null,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        returned_at: null,
        returned_by: null,
        finalized_at: null,
        finalized_by: null,
        last_edited_by: null,
        last_edited_at: null,
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        school: selectedSchool,
        grade_level: selectedGrade,
        learning_area: matchedLA,
        school_year: selectedSY,
        term: selectedTerm,
        ks1_learner_data: isKS1
          ? {
              total_learners: row.totalLearners,
              advancing: row.advancing || 0,
              benchmarking: row.benchmarking || 0,
              connecting: row.connecting || 0,
              developing: row.developing || 0,
              emerging: row.emerging || 0,
            }
          : undefined,
        ks2to4_learner_data: !isKS1
          ? { total_learners: row.totalLearners, mps: row.mps }
          : undefined,
        competency_summary: {
          total_intended_competencies: row.totalIntended,
          competencies_taught: row.taught,
          competencies_not_taught: row.notTaught,
          reasons_for_untaught: row.reasonsUntaught,
        },
        submission_competencies: competencies,
        instructional_difficulty: {
          factors_text: row.instructionalFactors,
        },
      }
    })
  }, [parsedRows, teacherName, schoolId, gradeLevelId, schoolYearId, termId, schools, grades, learningAreas, schoolYears, terms])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTaggingComplete) {
      toast('Please select both a School and Grade Level in Step 1 first.', 'warning')
      return
    }
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isTaggingComplete) {
      toast('Please select both a School and Grade Level in Step 1 first.', 'warning')
      return
    }
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  // Grade & Template format validation
  const selectedGrade = grades.find(g => g.id === gradeLevelId)
  const expectedFormType: 'ks1' | 'ks2to4' | null = selectedGrade
    ? selectedGrade.grade_number <= 3
      ? 'ks1'
      : 'ks2to4'
    : null

  const parsedFormType: 'ks1' | 'ks2to4' | null = parsedRows.length > 0 ? parsedRows[0].formType : null

  const isTemplateMismatch = Boolean(
    expectedFormType && parsedFormType && expectedFormType !== parsedFormType
  )

  const findBestSheetForGrade = (sheets: string[], expectedType: 'ks1' | 'ks2to4' | null) => {
    if (!sheets.length) return ''
    if (expectedType === 'ks1') {
      const match = sheets.find(s => {
        const lower = s.toLowerCase()
        return lower.includes('ks1') || lower.includes('ks 1') || lower.includes('key stage 1')
      })
      return match || sheets[0]
    }
    if (expectedType === 'ks2to4') {
      const match = sheets.find(s => {
        const lower = s.toLowerCase()
        return lower.includes('ks2') || lower.includes('ks3') || lower.includes('ks4') || lower.includes('ks 2') || lower.includes('key stage 2')
      })
      return match || sheets[0]
    }
    return sheets[0]
  }

  const processFile = async (file: File) => {
    if (!isTaggingComplete) {
      toast('Please select both a School and Grade Level in Step 1 first.', 'warning')
      return
    }
    setFileName(file.name)
    setIsParsing(true)
    setParseError(null)
    setParsedRows([])
    setDuplicateMap({})

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)

      const sheets = await getExcelSheetNames(buffer)
      setSheetNames(sheets)

      if (sheets.length === 0) {
        throw new Error('No worksheets found in the uploaded Excel file.')
      }

      const initialSheet = findBestSheetForGrade(sheets, expectedFormType)
      setSelectedSheet(initialSheet)

      await parseSheet(buffer, initialSheet)
    } catch (err: any) {
      console.error(err)
      setParseError(err.message || 'Failed to parse Excel file.')
      toast(err.message || 'Failed to parse Excel file.', 'error')
    } finally {
      setIsParsing(false)
    }
  }

  const handleGradeLevelSelect = async (gId: string) => {
    setGradeLevelId(gId)
    const newGrade = grades.find(g => g.id === gId)
    const newExpectedType: 'ks1' | 'ks2to4' | null = newGrade
      ? newGrade.grade_number <= 3
        ? 'ks1'
        : 'ks2to4'
      : null

    const newMappedLAIds = new Set(
      learningAreaGrades
        .filter(lag => lag.grade_level_id === gId)
        .map(lag => lag.learning_area_id)
    )
    const newAvailableLAs = newMappedLAIds.size > 0
      ? learningAreas.filter(la => newMappedLAIds.has(la.id))
      : learningAreas

    if (fileBuffer && sheetNames.length > 0) {
      const bestSheet = findBestSheetForGrade(sheetNames, newExpectedType)
      const targetSheet = (bestSheet || selectedSheet)
      if (bestSheet && bestSheet !== selectedSheet) {
        setSelectedSheet(bestSheet)
      }
      setIsParsing(true)
      await parseSheet(fileBuffer, targetSheet, newAvailableLAs)
      setIsParsing(false)
    }
  }

  const handleSheetChange = async (sheetName: string) => {
    setSelectedSheet(sheetName)
    if (!fileBuffer) return
    setIsParsing(true)
    setParseError(null)
    await parseSheet(fileBuffer, sheetName)
    setIsParsing(false)
  }

  const parseSheet = async (buffer: ArrayBuffer, sheetName: string, customLAs?: LearningArea[]) => {
    try {
      const targetLAs = customLAs || availableLearningAreas
      const rows = await parseSubjectImportExcel(buffer, targetLAs, sheetName)
      setParsedRows(rows)

      if (rows.length === 0) {
        toast(`No valid subject data rows found in worksheet "${sheetName}".`, 'info')
      } else {
        toast(`Successfully parsed ${rows.length} subject block(s) from sheet "${sheetName}".`, 'success')
        await checkDuplicatesForRows(rows)
      }
    } catch (err: any) {
      console.error(err)
      setParseError(err.message || `Failed to parse sheet "${sheetName}".`)
      toast(err.message || `Failed to parse sheet "${sheetName}".`, 'error')
    }
  }

  const checkDuplicatesForRows = async (rows: ParsedSubjectRow[]) => {
    if (!schoolId || !gradeLevelId || !schoolYearId || !termId) return
    const dupes: Record<number, boolean> = {}

    for (const row of rows) {
      if (!row.learningAreaId) continue
      try {
        const isDup = await checkDuplicateSubmission(
          schoolId,
          gradeLevelId,
          row.learningAreaId,
          schoolYearId,
          termId,
          teacherName.trim()
        )
        dupes[row.rowIndex] = Boolean(isDup)
      } catch {
        // ignore duplicate check error
      }
    }
    setDuplicateMap(dupes)
  }

  const handleLearningAreaChange = (rowIndex: number, newLAId: string) => {
    setParsedRows(prev =>
      prev.map(row => {
        if (row.rowIndex !== rowIndex) return row
        const newLA = availableLearningAreas.find(la => la.id === newLAId) || learningAreas.find(la => la.id === newLAId)
        const updatedErrors = row.errors.filter(e => !e.includes('not recognized'))
        return {
          ...row,
          learningAreaId: newLAId || null,
          learningAreaRaw: newLA ? newLA.name : row.learningAreaRaw,
          errors: updatedErrors,
        }
      })
    )
  }

  const handleImport = async () => {
    if (!teacherName.trim()) {
      toast('Please enter the Teacher\'s Name to tag the import.', 'error')
      return
    }
    if (!schoolId) {
      toast('Please select a School.', 'error')
      return
    }
    if (!gradeLevelId) {
      toast('Please select a Grade Level.', 'error')
      return
    }
    if (!schoolYearId) {
      toast('Please select a School Year.', 'error')
      return
    }
    if (!termId) {
      toast('Please select a Term / Quarter.', 'error')
      return
    }

    if (isTemplateMismatch) {
      toast(`Cannot import: The selected worksheet "${selectedSheet}" does not match the template format required for ${selectedGrade?.name}.`, 'error')
      return
    }

    const validRows = parsedRows.filter(r => r.learningAreaId)
    if (validRows.length === 0) {
      toast('No valid subject rows available to import. Please ensure all subjects are mapped.', 'error')
      return
    }

    setIsImporting(true)
    setImportProgress(0)

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const isKS1 = row.formType === 'ks1' || (selectedGrade && selectedGrade.grade_number <= 3)

      try {
        let refNum = `TC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        try {
          refNum = await generateReferenceNumber()
        } catch {
          // fallback client side reference
        }

        const formData: any = {
          teacherInfo: {
            teacher_name: teacherName.trim(),
            school_id: schoolId,
            grade_level_id: gradeLevelId,
            learning_area_id: row.learningAreaId,
            school_year_id: schoolYearId,
            term_id: termId,
          },
          competencySummary: {
            total_intended_competencies: row.totalIntended,
            competencies_taught: row.taught,
            competencies_not_taught: row.notTaught,
            reasons_for_untaught: row.reasonsUntaught,
          },
          topCompetencies: {
            most_learned: row.mostLearned,
            least_mastered: row.leastMastered,
            most_difficult_to_teach: row.mostDifficult,
          },
          instructionalDifficulty: {
            factors_text: row.instructionalFactors,
          },
        }

        if (isKS1) {
          formData.ks1LearnerData = {
            total_learners: row.totalLearners,
            advancing: row.advancing || 0,
            benchmarking: row.benchmarking || 0,
            connecting: row.connecting || 0,
            developing: row.developing || 0,
            emerging: row.emerging || 0,
          }
        } else {
          formData.ks2to4LearnerData = {
            total_learners: row.totalLearners,
            mps: row.mps,
          }
        }

        await createSubmission(formData, refNum)
        successCount++
      } catch (err: any) {
        console.error(`Failed to import row for subject ${row.learningAreaRaw}:`, err)
        failCount++
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100))
    }

    if (admin) {
      await insertAuditLog({
        admin_id: admin.id,
        admin_name: admin.full_name,
        action: 'import_submissions_per_subject',
        entity_type: 'submission_batch',
        entity_id: undefined,
        entity_label: `Teacher: ${teacherName}, Subjects: ${successCount}`,
        details: { teacherName, schoolId, gradeLevelId, schoolYearId, termId, count: successCount },
      })
    }

    setIsImporting(false)

    if (successCount > 0) {
      saveLocalSuggestion('teachers', teacherName)
      saveTeacherSchoolMapping(teacherName, schoolId)
      toast(`Successfully imported ${successCount} subject submission(s)!${failCount > 0 ? ` (${failCount} failed)` : ''}`, 'success')
      onSuccess()
      onClose()
    } else {
      toast('Failed to import submissions. Please try again.', 'error')
    }
  }

  const validRowsCount = parsedRows.filter(r => r.learningAreaId).length

  return (
    <>
      <div className={`fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 ${backdropClass}`}>
        <div className={`bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_25px_60px_-15px_rgba(139,114,244,0.3)] w-full max-w-4xl overflow-hidden my-6 ${containerClass}`}>
          {/* 3D Soft Pastel Clay Header */}
          <div className="bg-gradient-to-r from-[#8B72F4] via-[#9F85F7] to-[#A88BEB] text-white px-6 py-5 flex items-center justify-between border-b-2 border-white/20 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black font-display tracking-tight text-white flex items-center gap-2.5">
                  <span>Import Submissions per Subject</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                    Excel Batch
                  </span>
                </h2>
                <p className="text-xs text-purple-100 font-medium">
                  Upload Excel template with single or multiple learning areas. Each subject block creates its own submission.
                </p>
              </div>
            </div>
            <button
              onClick={triggerClose}
              className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 text-white hover:bg-white/40 flex items-center justify-center font-extrabold text-lg shadow-xs transition-all cursor-pointer"
              title="Close dialog"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-[#FAF5F0]">
            {/* STEP 1: TAGGING PARAMETERS FORM */}
            <div className="bg-white/90 rounded-[28px] border-2 border-white p-5 shadow-[0_8px_20px_rgba(185,170,210,0.12)] space-y-4">
              <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                <h3 className="text-xs font-black text-[#2D2638] uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-[#8B72F4]" />
                  <span>1. Tagging Parameters (Target Context)</span>
                </h3>
                <span className="text-[10px] font-bold text-[#8B72F4] bg-[#F6EFFF] px-2.5 py-0.5 rounded-full border border-[#8B72F4]/20">
                  Required Information
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Teacher Name */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">
                    Teacher's Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF] z-10" />
                    <SuggestionInput
                      id="import_teacher_name"
                      placeholder="e.g. Maria Santos"
                      suggestions={teacherSuggestions}
                      value={teacherName}
                      onChange={e => handleTeacherNameSelect(e.target.value)}
                      onSelectSuggestion={val => handleTeacherNameSelect(val)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#FAF5F0]/70 border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                    />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">
                    School <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF] pointer-events-none z-10" />
                    <select
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#FAF5F0]/70 border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                      value={schoolId}
                      onChange={e => {
                        setSchoolId(e.target.value)
                        setAutoSelectedSchoolName('')
                      }}
                    >
                      <option value="">Select School</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.school_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  {autoSelectedSchoolName && schoolId && (
                    <p className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1 animate-fade-in">
                      <Sparkles size={11} className="text-amber-500 shrink-0" />
                      <span>Auto-filled from teacher's previous records.</span>
                    </p>
                  )}
                </div>

                {/* Grade Level */}
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">
                    Grade Level <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF] pointer-events-none" />
                    <select
                      required
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#FAF5F0]/70 border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                      value={gradeLevelId}
                      onChange={e => handleGradeLevelSelect(e.target.value)}
                    >
                      <option value="">Select Grade</option>
                      {grades.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} (Key Stage {g.key_stage.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* School Year */}
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">School Year</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF] pointer-events-none" />
                    <select
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#FAF5F0]/70 border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                      value={schoolYearId}
                      onChange={e => setSchoolYearId(e.target.value)}
                    >
                      <option value="">Select School Year</option>
                      {schoolYears.map(sy => (
                        <option key={sy.id} value={sy.id}>
                          {sy.name} {sy.is_active ? '(Active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Term / Quarter */}
                <div>
                  <label className="block text-xs font-bold text-[#2D2638] mb-1">Term / Quarter</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF] pointer-events-none" />
                    <select
                      className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-[#FAF5F0]/70 border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                      value={termId}
                      onChange={e => setTermId(e.target.value)}
                    >
                      <option value="">Select Quarter</option>
                      {terms.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2: FILE SELECTION & DOWNLOAD TEMPLATE */}
            <div className="bg-white/90 rounded-[28px] border-2 border-white p-5 shadow-[0_8px_20px_rgba(185,170,210,0.12)] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-purple-100 pb-3">
                <h3 className="text-xs font-black text-[#2D2638] uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <span>2. Select Excel Data File</span>
                </h3>
                <button
                  type="button"
                  onClick={() => downloadImportTemplate()}
                  className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#86EFAC] to-[#34D399] text-[#065F46] text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-white"
                >
                  <Download size={14} />
                  <span>Download Combined Excel Template</span>
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isTaggingComplete) {
                    toast('Please select both a School and Grade Level in Step 1 first before attaching an Excel file.', 'warning')
                    return
                  }
                  fileInputRef.current?.click()
                }}
                className={`border-2 border-dashed rounded-[28px] p-6 text-center transition-all ${
                  !isTaggingComplete
                    ? 'border-amber-200 bg-amber-50/40 cursor-not-allowed'
                    : fileName
                    ? 'border-[#8B72F4] bg-[#F6EFFF] cursor-pointer'
                    : 'border-purple-200 bg-[#FAF5F0]/60 hover:bg-[#F6EFFF]/60 cursor-pointer'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  disabled={!isTaggingComplete}
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  {!isTaggingComplete ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                        <Lock size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[#2D2638]">
                          File Upload Blocked
                        </p>
                        <p className="text-xs text-amber-800 font-bold mt-0.5">
                          🔒 Please select both a <span className="text-[#8B72F4] font-black underline">School</span> and <span className="text-[#8B72F4] font-black underline">Grade Level</span> in Step 1 above to enable Excel file attachment.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white shadow-xs ${fileName ? 'bg-[#8B72F4] text-white' : 'bg-white text-[#8B72F4]'}`}>
                        {isParsing ? <RefreshCw size={24} className="animate-spin" /> : fileName ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
                      </div>
                      {fileName ? (
                        <div>
                          <p className="text-sm font-black text-[#2D2638]">{fileName}</p>
                          <p className="text-xs text-[#7A7289] font-medium mt-0.5">Click or drag a new file to replace</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-[#2D2638]">
                            Click to upload or drag & drop your Excel file here
                          </p>
                          <p className="text-xs text-[#7A7289] font-medium mt-0.5">File contains Key Stage 1 (KS1) and Key Stages 2–4 (KS2–4) template sheets</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Worksheet Selector */}
              {sheetNames.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#F6EFFF] border border-[#8B72F4]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#8B72F4] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Layers size={16} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#2D2638] block">Worksheet / Sheet Tab</label>
                      <p className="text-[10px] text-[#7A7289] font-medium">Choose tab containing subject evaluation data</p>
                    </div>
                  </div>

                  <select
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    disabled={isParsing}
                    className="px-3 py-2 rounded-xl bg-white border border-[#8B72F4]/30 text-xs font-bold text-[#8B72F4] focus:outline-none min-w-[200px]"
                  >
                    {sheetNames.map(name => (
                      <option key={name} value={name}>
                        Sheet: {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* TEMPLATE MISMATCH ERROR BANNER */}
              {isTemplateMismatch && (
                <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2 shadow-xs animate-fade-in">
                  <div className="flex items-center gap-2 font-black text-sm text-rose-800">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                    <span>Incorrect Template Sheet Selected for Grade Level</span>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed font-medium">
                    Selected Grade Level <strong>{selectedGrade?.name}</strong> requires the{' '}
                    <span className="font-bold underline text-rose-900">
                      {expectedFormType === 'ks1' ? 'Key Stage 1 (KS1: Cols A–O)' : 'Key Stages 2–4 (KS2–4: Cols A–K)'}
                    </span>{' '}
                    template layout. Please switch worksheet tabs above.
                  </p>
                </div>
              )}

              {/* PARSED ROWS PREVIEW TABLE */}
              {parsedRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#2D2638] flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>Parsed Subjects ({parsedRows.length} Blocks Detected)</span>
                    </h4>
                    <span className="text-xs font-extrabold text-[#8B72F4]">
                      {validRowsCount} of {parsedRows.length} ready to import
                    </span>
                  </div>

                  <div className="rounded-2xl border border-purple-100 overflow-hidden bg-white shadow-2xs">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-[#FAF5F0] sticky top-0 border-b border-purple-100 text-[11px] font-extrabold text-[#7A7289] uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">Excel Subject</th>
                            <th className="py-3 px-4">Mapped Subject</th>
                            <th className="py-3 px-4">Learners</th>
                            <th className="py-3 px-4">Format</th>
                            <th className="py-3 px-4">Metrics</th>
                            <th className="py-3 px-4">Intended</th>
                            <th className="py-3 px-4">Taught</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-100">
                          {parsedRows.map((row, idx) => {
                            const isDup = duplicateMap[row.rowIndex]
                            return (
                              <tr key={idx} className={!row.learningAreaId ? 'bg-amber-50/50' : isDup ? 'bg-purple-50/40' : ''}>
                                <td className="py-3 px-4 font-bold text-[#A39BAF]">{idx + 1}</td>
                                <td className="py-3 px-4 font-bold text-[#2D2638]">{row.learningAreaRaw}</td>
                                <td className="py-3 px-4">
                                  <select
                                    className="px-2.5 py-1.5 rounded-xl border border-purple-100 text-xs font-bold text-[#2D2638] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                                    value={row.learningAreaId || ''}
                                    onChange={e => handleLearningAreaChange(row.rowIndex, e.target.value)}
                                  >
                                    <option value="">-- Select Subject ({availableLearningAreas.length} assigned) --</option>
                                    {availableLearningAreas.map(la => (
                                      <option key={la.id} value={la.id}>
                                        {la.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3 px-4 font-semibold text-[#2D2638]">{row.totalLearners}</td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${row.formType === 'ks1' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                    {row.formType === 'ks1' ? 'KS 1' : 'KS 2–4'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {row.formType === 'ks1' ? (
                                    <span className="text-[11px] font-medium text-[#7A7289]">
                                      Adv: {row.advancing} · Bch: {row.benchmarking}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-[#8B72F4]">
                                      {row.mps !== null ? `${row.mps}% MPS` : 'N/A'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-medium text-[#7A7289]">{row.totalIntended}</td>
                                <td className="py-3 px-4 font-medium text-[#7A7289]">{row.taught}</td>
                                <td className="py-3 px-4">
                                  {!row.learningAreaId ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                      <AlertTriangle size={11} /> Unmapped
                                    </span>
                                  ) : isDup ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-md">
                                      Duplicate
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                      <CheckCircle2 size={11} /> Ready
                                    </span>
                                  )}
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
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-white/90 px-6 py-4 border-t border-purple-100 flex items-center justify-between">
            <div className="text-xs text-[#7A7289] font-medium">
              {isImporting && (
                <div className="flex items-center gap-2.5 text-[#8B72F4] font-bold">
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Importing submissions... {importProgress}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {parsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/30 font-bold text-xs hover:bg-[#8B72F4] hover:text-white transition-all shadow-xs inline-flex items-center gap-2 cursor-pointer"
                >
                  <Eye size={15} />
                  <span>Preview Official Template</span>
                </button>
              )}
              <button
                type="button"
                onClick={triggerClose}
                disabled={isImporting}
                className="px-5 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#7A7289] hover:bg-purple-50 transition-all shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validRowsCount === 0 || isTemplateMismatch || !teacherName.trim() || !schoolId || !gradeLevelId}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white font-black text-xs shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    <span>Import {validRowsCount} Submission(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3D SOFT PASTEL CLAYMORPHIC OFFICIAL TERMCAT TEMPLATE OVERLAY MODAL */}
      {showOfficialPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/40 backdrop-blur-md flex flex-col items-center p-2 sm:p-4 animate-fade-in">
          <div className="bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_25px_60px_-15px_rgba(139,114,244,0.3)] w-full max-w-[96vw] overflow-hidden flex flex-col my-auto max-h-[94vh]">
            {/* Header Controls */}
            <div className="bg-gradient-to-r from-[#8B72F4] via-[#9F85F7] to-[#A88BEB] text-white px-6 py-4.5 flex items-center justify-between border-b-2 border-white/20 no-print shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 text-white flex items-center justify-center shadow-xs">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-display tracking-tight text-white flex items-center gap-2">
                    Official TERMCAT Printable Template Preview ({previewSubmissions[0]?.form_type === 'ks1' ? 'Key Stage 1' : 'Key Stage 2–4'})
                  </h3>
                  <p className="text-xs text-purple-100 font-medium">
                    Showing {previewSubmissions.length} subject submission(s) formatted in the official TERMCAT layout
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-2xl bg-white text-[#795CEE] font-black text-xs shadow-md hover:bg-purple-50 transition-all flex items-center gap-2 cursor-pointer border border-white"
                >
                  <Printer size={15} />
                  <span>Print Official Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(false)}
                  className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 text-white hover:bg-white/40 flex items-center justify-center font-extrabold text-lg shadow-xs transition-all cursor-pointer"
                  title="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Template Render Area */}
            <div className="p-4 sm:p-6 overflow-y-auto overflow-x-auto flex-1 bg-[#FAF5F0]">
              <div className="w-full bg-white rounded-[28px] border-2 border-white shadow-[0_10px_30px_rgba(185,170,210,0.15)] p-4 sm:p-6 overflow-x-auto">
                <OfficialTermcatTemplate
                  submissions={previewSubmissions}
                  formType={previewSubmissions[0]?.form_type || (selectedGrade && selectedGrade.grade_number <= 3 ? 'ks1' : 'ks2to4')}
                  epsName={teacherName || 'Education Program Supervisor / Teacher'}
                  sdoName="Division of Romblon"
                  learningAreaName={previewSubmissions.length === 1 ? previewSubmissions[0].learning_area?.name : 'Multiple Learning Areas'}
                  termName={terms.find(t => t.id === termId)?.name || 'Term'}
                  schoolYearName={schoolYears.find(sy => sy.id === schoolYearId)?.name || 'School Year'}
                  showPrintButton={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white/90 px-6 py-4 border-t border-purple-100 flex items-center justify-between no-print shrink-0">
              <span className="text-xs text-[#7A7289] font-medium">
                Verify that all competencies, performance metrics, and factors match before importing.
              </span>
              <button
                type="button"
                onClick={() => setShowOfficialPreview(false)}
                className="px-5 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-bold text-[#7A7289] hover:bg-purple-50 transition-all shadow-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
