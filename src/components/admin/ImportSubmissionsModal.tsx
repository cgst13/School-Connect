import { useState, useRef, useEffect, useMemo } from 'react'
import type { School, GradeLevel, LearningArea, LearningAreaGrade, SchoolYear, Term, TermcatSubmission, FormType, AdminProfile } from '@/types'
import {
  parseSubjectImportExcel,
  getExcelSheetNames,
  downloadImportTemplate,
  type ParsedSubjectRow
} from '@/lib/excel/excelImport'
import { createSubmission, generateReferenceNumber, insertAuditLog, checkDuplicateSubmission, fetchLearningAreaGrades, fetchAllAdmins } from '@/lib/supabase/queries'
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
  User, Building2, GraduationCap, Calendar, Clock, Layers, Eye, Printer, Sparkles, Lock, BookOpen, Users
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
  const { triggerClose, containerClass, backdropClass } = useGenieModal(isOpen, onClose)

  // Import Mode state ('per_grade' | 'per_learning_area')
  const [importMode, setImportMode] = useState<'per_grade' | 'per_learning_area'>('per_grade')

  // Tagging parameters
  const [teacherName, setTeacherName] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [gradeLevelId, setGradeLevelId] = useState('')
  const [learningAreaId, setLearningAreaId] = useState('')
  const [schoolYearId, setSchoolYearId] = useState('')
  const [termId, setTermId] = useState('')

  // Teacher Tagging Mode for Option 1 (per_grade): 'all_same' vs 'per_subject'
  const [teacherTaggingMode, setTeacherTaggingMode] = useState<'all_same' | 'per_subject'>('all_same')
  const [perSubjectTeachers, setPerSubjectTeachers] = useState<Record<string, string>>({})
  const [staffList, setStaffList] = useState<AdminProfile[]>([])

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
  const [, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  // Official Template Preview Modal State
  const [showOfficialPreview, setShowOfficialPreview] = useState(false)
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])

  // Set default values & load teacher suggestions and staff directory when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeSY = schoolYears.find(sy => sy.is_active)
      if (activeSY && !schoolYearId) setSchoolYearId(activeSY.id)

      const defaultTerm = terms.find(t => t.is_default || t.is_active)
      if (defaultTerm && !termId) setTermId(defaultTerm.id)

      fetchTeacherNameSuggestions().then(localSugg => {
        fetchAllAdmins().then(admins => {
          setStaffList(admins)
          const staffNames = admins.map(a => a.full_name).filter(Boolean)
          const combined = Array.from(new Set([...localSugg, ...staffNames]))
          setTeacherSuggestions(combined)
        })
      })
      fetchLearningAreaGrades().then(setLearningAreaGrades)
    }
  }, [isOpen, schoolYears, terms, schoolYearId, termId])

  const handleModeChange = (newMode: 'per_grade' | 'per_learning_area') => {
    if (newMode === importMode) return
    setImportMode(newMode)
    setParsedRows([])
    setFileName(null)
    setFileBuffer(null)
    setSheetNames([])
    setSelectedSheet('')
    setDuplicateMap({})
  }

  // Filter learning areas assigned to the selected grade level only (for per_grade mode)
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

  const isTaggingComplete = importMode === 'per_grade'
    ? Boolean(schoolId && gradeLevelId)
    : Boolean(schoolId && learningAreaId)

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

  // Find default assigned teacher for a specific school + grade + subject from Faculty Directory
  const getAssignedTeacherForSubject = (sId: string, gId: string, laId: string): AdminProfile | null => {
    if (!sId || !gId || !laId || staffList.length === 0) return null
    const activeTeachers = staffList.filter(s => s.role === 'teacher' && s.is_active !== false)
    return activeTeachers.find(t => {
      if (t.assigned_school_ids?.length && !t.assigned_school_ids.includes(sId)) return false
      if (t.assigned_grade_ids?.length && !t.assigned_grade_ids.includes(gId)) return false

      if (t.assigned_grade_subject_ids && t.assigned_grade_subject_ids[gId]) {
        return t.assigned_grade_subject_ids[gId].includes(laId)
      }
      return t.assigned_subject_ids?.includes(laId)
    }) || null
  }

  // Auto-populate default teachers for each learning area in per_subject mode
  useEffect(() => {
    if (importMode === 'per_grade' && schoolId && gradeLevelId && availableLearningAreas.length > 0 && staffList.length > 0) {
      setPerSubjectTeachers(prev => {
        const next = { ...prev }
        availableLearningAreas.forEach(la => {
          if (next[la.id] === undefined || next[la.id] === '') {
            const defaultTeacher = getAssignedTeacherForSubject(schoolId, gradeLevelId, la.id)
            if (defaultTeacher) {
              next[la.id] = defaultTeacher.full_name
            }
          }
        })
        return next
      })
    }
  }, [importMode, schoolId, gradeLevelId, availableLearningAreas, staffList])

  const handleAutoFillDefaultTeachers = () => {
    const newMap: Record<string, string> = {}
    availableLearningAreas.forEach(la => {
      const defaultTeacher = getAssignedTeacherForSubject(schoolId, gradeLevelId, la.id)
      if (defaultTeacher) {
        newMap[la.id] = defaultTeacher.full_name
      } else if (teacherName.trim()) {
        newMap[la.id] = teacherName.trim()
      }
    })
    setPerSubjectTeachers(newMap)
    toast('Auto-filled assigned teachers from Faculty Directory.', 'success')
  }

  const handleApplyTeacherToAllSubjects = () => {
    if (!teacherName.trim()) {
      toast('Please enter a Teacher\'s Name in the main input first.', 'warning')
      return
    }
    const newMap: Record<string, string> = {}
    availableLearningAreas.forEach(la => {
      newMap[la.id] = teacherName.trim()
    })
    setPerSubjectTeachers(newMap)
    toast(`Applied "${teacherName.trim()}" to all learning areas.`, 'success')
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
    const selectedLA = learningAreas.find(la => la.id === learningAreaId) || {
      id: 'la-preview',
      name: 'Learning Area (Pending Selection)',
      is_active: true,
      created_at: '',
      updated_at: '',
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
      let currentGrade = selectedGrade
      let currentLA = selectedLA

      if (importMode === 'per_grade') {
        currentLA = learningAreas.find(la => la.id === row.learningAreaId) || {
          id: `temp-${idx}`,
          name: row.labelRaw || row.learningAreaRaw || 'Subject',
          is_active: true,
          created_at: '',
          updated_at: '',
        }
      } else {
        currentGrade = grades.find(g => g.id === row.gradeLevelId) || {
          id: `temp-g-${idx}`,
          name: row.labelRaw || row.gradeLevelRaw || 'Grade Level',
          grade_number: 5,
          school_type: 'secondary' as const,
          key_stage: 'ks2' as const,
          is_active: true,
        }
      }

      const isKS1 = row.formType === 'ks1' || currentGrade.grade_number <= 3
      const formType: FormType = isKS1 ? 'ks1' : 'ks2to4'

      const effectiveTeacher = importMode === 'per_grade' && teacherTaggingMode === 'per_subject' && currentLA.id && perSubjectTeachers[currentLA.id]
        ? perSubjectTeachers[currentLA.id].trim()
        : teacherName.trim()

      const competencies: any[] = [
        ...row.mostLearned.map((txt, i) => ({ id: `ml-${idx}-${i}`, category: 'most_learned', rank: i + 1, competency_text: txt })),
        ...row.leastMastered.map((txt, i) => ({ id: `lm-${idx}-${i}`, category: 'least_mastered', rank: i + 1, competency_text: txt })),
        ...row.mostDifficult.map((txt, i) => ({ id: `md-${idx}-${i}`, category: 'most_difficult_to_teach', rank: i + 1, competency_text: txt })),
      ]

      return {
        id: `preview-${row.rowIndex}`,
        reference_number: `PREVIEW-${idx + 1}`,
        teacher_name: effectiveTeacher || 'Teacher Name (Pending)',
        school_id: selectedSchool.id,
        grade_level_id: currentGrade.id,
        learning_area_id: currentLA.id,
        school_year_id: selectedSY.id,
        term_id: selectedTerm.id,
        key_stage: currentGrade.key_stage,
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
        grade_level: currentGrade,
        learning_area: currentLA,
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
  }, [parsedRows, teacherName, schoolId, gradeLevelId, learningAreaId, schoolYearId, termId, schools, grades, learningAreas, schoolYears, terms, importMode, teacherTaggingMode, perSubjectTeachers])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTaggingComplete) {
      toast(`Please select both a School and ${importMode === 'per_grade' ? 'Grade Level' : 'Learning Area'} in Step 1 first.`, 'warning')
      return
    }
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!isTaggingComplete) {
      toast(`Please select both a School and ${importMode === 'per_grade' ? 'Grade Level' : 'Learning Area'} in Step 1 first.`, 'warning')
      return
    }
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    await processFile(file)
  }

  // Grade & Template format validation
  const selectedGrade = grades.find(g => g.id === gradeLevelId)
  const expectedFormType: 'ks1' | 'ks2to4' | null = importMode === 'per_grade' && selectedGrade
    ? selectedGrade.grade_number <= 3
      ? 'ks1'
      : 'ks2to4'
    : null

  const parsedFormType: 'ks1' | 'ks2to4' | null = parsedRows.length > 0 ? parsedRows[0].formType : null

  const isTemplateMismatch = Boolean(
    importMode === 'per_grade' && expectedFormType && parsedFormType && expectedFormType !== parsedFormType
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
      toast(`Please select both a School and ${importMode === 'per_grade' ? 'Grade Level' : 'Learning Area'} in Step 1 first.`, 'warning')
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

  const handleLearningAreaSelect = async (laId: string) => {
    setLearningAreaId(laId)
    if (fileBuffer && sheetNames.length > 0) {
      setIsParsing(true)
      await parseSheet(fileBuffer, selectedSheet)
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
      const rows = await parseSubjectImportExcel(buffer, targetLAs, grades, sheetName, importMode)
      setParsedRows(rows)

      if (rows.length === 0) {
        toast(`No valid data blocks found in worksheet "${sheetName}".`, 'info')
      } else {
        toast(`Successfully parsed ${rows.length} block(s) from sheet "${sheetName}".`, 'success')
        await checkDuplicatesForRows(rows)
      }
    } catch (err: any) {
      console.error(err)
      setParseError(err.message || `Failed to parse sheet "${sheetName}".`)
      toast(err.message || `Failed to parse sheet "${sheetName}".`, 'error')
    }
  }

  const checkDuplicatesForRows = async (rows: ParsedSubjectRow[]) => {
    if (!schoolId || !schoolYearId || !termId) return
    const dupes: Record<number, boolean> = {}

    for (const row of rows) {
      const gId = importMode === 'per_grade' ? gradeLevelId : row.gradeLevelId
      const laId = importMode === 'per_grade' ? row.learningAreaId : learningAreaId
      if (!gId || !laId) continue

      const effectiveTeacher = importMode === 'per_grade' && teacherTaggingMode === 'per_subject' && laId && perSubjectTeachers[laId]
        ? perSubjectTeachers[laId].trim()
        : teacherName.trim()

      try {
        const isDup = await checkDuplicateSubmission(
          schoolId,
          gId,
          laId,
          schoolYearId,
          termId,
          effectiveTeacher
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

  const handleGradeLevelChange = (rowIndex: number, newGradeId: string) => {
    setParsedRows(prev =>
      prev.map(row => {
        if (row.rowIndex !== rowIndex) return row
        const newGrade = grades.find(g => g.id === newGradeId)
        const updatedErrors = row.errors.filter(e => !e.includes('not recognized'))
        const formType = newGrade ? (newGrade.grade_number <= 3 ? 'ks1' : 'ks2to4') : row.formType
        return {
          ...row,
          gradeLevelId: newGradeId || null,
          gradeLevelRaw: newGrade ? newGrade.name : row.gradeLevelRaw,
          formType,
          errors: updatedErrors,
        }
      })
    )
  }

  const handleImport = async () => {
    if (!schoolId) {
      toast('Please select a School.', 'error')
      return
    }
    if (importMode === 'per_grade' && !gradeLevelId) {
      toast('Please select a Grade Level.', 'error')
      return
    }
    if (importMode === 'per_learning_area' && !learningAreaId) {
      toast('Please select a Learning Area.', 'error')
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

    if (importMode === 'per_grade' && teacherTaggingMode === 'per_subject') {
      const validRows = parsedRows.filter(r => r.learningAreaId)
      for (const r of validRows) {
        const tName = (perSubjectTeachers[r.learningAreaId!] || teacherName).trim()
        if (!tName) {
          const la = availableLearningAreas.find(a => a.id === r.learningAreaId)
          toast(`Please assign or enter a Teacher's Name for subject "${la?.name || r.labelRaw}".`, 'error')
          return
        }
      }
    } else {
      if (!teacherName.trim()) {
        toast('Please enter the Teacher\'s Name to tag the import.', 'error')
        return
      }
    }

    if (isTemplateMismatch) {
      toast(`Cannot import: The selected worksheet "${selectedSheet}" does not match the template format required for ${selectedGrade?.name}.`, 'error')
      return
    }

    const validRows = parsedRows.filter(r => importMode === 'per_grade' ? r.learningAreaId : r.gradeLevelId)
    if (validRows.length === 0) {
      toast(`No valid ${importMode === 'per_grade' ? 'subject' : 'grade level'} rows available to import. Please ensure all items are mapped.`, 'error')
      return
    }

    setIsImporting(true)
    setImportProgress(0)

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const gId = importMode === 'per_grade' ? gradeLevelId : row.gradeLevelId!
      const laId = importMode === 'per_grade' ? row.learningAreaId! : learningAreaId

      const rowTeacherName = importMode === 'per_grade' && teacherTaggingMode === 'per_subject'
        ? (perSubjectTeachers[laId] || teacherName).trim()
        : teacherName.trim()

      const currentGrade = grades.find(g => g.id === gId)
      const isKS1 = row.formType === 'ks1' || (currentGrade && currentGrade.grade_number <= 3)

      try {
        let refNum = `TC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
        try {
          refNum = await generateReferenceNumber()
        } catch {
          // fallback client side reference
        }

        const formData: any = {
          teacherInfo: {
            teacher_name: rowTeacherName,
            school_id: schoolId,
            grade_level_id: gId,
            learning_area_id: laId,
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
        console.error(`Failed to import row for ${row.labelRaw}:`, err)
        failCount++
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100))
    }

    if (admin) {
      await insertAuditLog({
        admin_id: admin.id,
        admin_name: admin.full_name,
        action: 'import_submissions_batch',
        entity_type: 'submission_batch',
        entity_id: undefined,
        entity_label: `Teacher(s) batch, Mode: ${importMode}, Submissions: ${successCount}`,
        details: { teacherName, perSubjectTeachers, teacherTaggingMode, schoolId, gradeLevelId, learningAreaId, importMode, schoolYearId, termId, count: successCount },
      })
    }

    setIsImporting(false)

    if (successCount > 0) {
      if (teacherName.trim()) {
        saveLocalSuggestion('teachers', teacherName.trim())
        saveTeacherSchoolMapping(teacherName.trim(), schoolId)
      }
      Object.values(perSubjectTeachers).forEach(t => {
        if (t.trim()) {
          saveLocalSuggestion('teachers', t.trim())
          saveTeacherSchoolMapping(t.trim(), schoolId)
        }
      })
      toast(`Successfully imported ${successCount} submission(s)!${failCount > 0 ? ` (${failCount} failed)` : ''}`, 'success')
      onSuccess()
      onClose()
    } else {
      toast('Failed to import submissions. Please try again.', 'error')
    }
  }

  const isTeacherTaggingValid = importMode === 'per_grade'
    ? teacherTaggingMode === 'all_same'
      ? Boolean(teacherName.trim())
      : availableLearningAreas.some(la => Boolean((perSubjectTeachers[la.id] || teacherName).trim()))
    : Boolean(teacherName.trim())

  const validRowsCount = parsedRows.filter(r => importMode === 'per_grade' ? r.learningAreaId : r.gradeLevelId).length

  return (
    <>
      <div className={`fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 ${backdropClass}`}>
        <div className={`bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-4xl overflow-hidden my-6 ${containerClass}`}>
          {/* Royal Blue Modal Header */}
          <div className="bg-[#2563EB] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-white/10 text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Import Submissions Excel</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white border border-white/20">
                    {importMode === 'per_grade' ? 'Per Grade Level' : 'Per Learning Area'}
                  </span>
                </h2>
                <p className="text-[11px] text-blue-100 font-normal">
                  {importMode === 'per_grade'
                    ? 'Upload Excel containing multiple Learning Areas for a single Grade Level.'
                    : 'Upload Excel containing multiple Grade Levels for a single Learning Area.'}
                </p>
              </div>
            </div>
            <button
              onClick={triggerClose}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-all cursor-pointer"
              title="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto bg-slate-50/50">
            {/* MODE SELECTION TABS */}
            <div className="bg-white p-1.5 rounded-md border border-slate-200 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('per_grade')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  importMode === 'per_grade'
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <GraduationCap size={15} />
                  <span>Option 1: Import per Grade Level</span>
                </div>
                <span className={`text-[10px] ${importMode === 'per_grade' ? 'text-blue-100' : 'text-slate-400'}`}>
                  Excel rows = Learning Areas / Subjects
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('per_learning_area')}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  importMode === 'per_learning_area'
                    ? 'bg-[#2563EB] text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <BookOpen size={15} />
                  <span>Option 2: Import per Learning Area</span>
                </div>
                <span className={`text-[10px] ${importMode === 'per_learning_area' ? 'text-blue-100' : 'text-slate-400'}`}>
                  Excel rows = Grade Levels (Grades 1–12)
                </span>
              </button>
            </div>

            {/* STEP 1: TAGGING PARAMETERS FORM */}
            <div className="bg-white rounded-md border border-slate-200 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <User size={15} className="text-[#2563EB]" />
                  <span>1. Tagging Parameters (Target Context)</span>
                </h3>
                <span className="text-[10px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Required Information
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* School */}
                <div className="lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    School <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                    <select
                      required
                      className="form-select pl-8"
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
                    <p className="text-[10px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-500 shrink-0" />
                      <span>Auto-filled from teacher's records.</span>
                    </p>
                  )}
                </div>

                {/* Conditional Field: Grade Level (for per_grade) vs Learning Area (for per_learning_area) */}
                {importMode === 'per_grade' ? (
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Grade Level <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <GraduationCap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        required
                        className="form-select pl-8"
                        value={gradeLevelId}
                        onChange={e => handleGradeLevelSelect(e.target.value)}
                      >
                        <option value="">Select Grade Level</option>
                        {grades.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} (Key Stage {g.key_stage.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Learning Area / Subject <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <BookOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        required
                        className="form-select pl-8"
                        value={learningAreaId}
                        onChange={e => handleLearningAreaSelect(e.target.value)}
                      >
                        <option value="">Select Learning Area</option>
                        {learningAreas.map(la => (
                          <option key={la.id} value={la.id}>
                            {la.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* School Year */}
                <div className="lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">School Year</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      className="form-select pl-8"
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
                <div className="lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Term / Quarter</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      className="form-select pl-8"
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

                {/* TEACHER TAGGING SECTION */}
                {importMode === 'per_grade' ? (
                  <div className="sm:col-span-2 lg:col-span-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <User size={14} className="text-[#2563EB]" />
                          <span>Teacher Tagging Option (Option 1: Per Grade Level)</span>
                        </label>
                        <p className="text-[11px] text-slate-500 font-normal">
                          Choose whether to tag all subjects to a single teacher or assign each subject to its specific teacher.
                        </p>
                      </div>

                      {/* Mode Switcher Tabs */}
                      <div className="bg-slate-100 p-0.5 rounded-md border border-slate-200 flex items-center gap-1 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setTeacherTaggingMode('all_same')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            teacherTaggingMode === 'all_same'
                              ? 'bg-[#2563EB] text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <User size={13} />
                          <span>Single Teacher</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeacherTaggingMode('per_subject')}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            teacherTaggingMode === 'per_subject'
                              ? 'bg-[#2563EB] text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Users size={13} />
                          <span>Per Subject</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode A: Single Teacher for All Subjects */}
                    {teacherTaggingMode === 'all_same' ? (
                      <div className="max-w-md pt-1">
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          Teacher's Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                          <SuggestionInput
                            id="import_teacher_name_single"
                            placeholder="e.g. Maria Santos"
                            suggestions={teacherSuggestions}
                            value={teacherName}
                            onChange={e => handleTeacherNameSelect(e.target.value)}
                            onSelectSuggestion={val => handleTeacherNameSelect(val)}
                            className="form-input pl-8"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal mt-1">
                          This teacher name will be applied to all imported learning areas under {selectedGrade ? selectedGrade.name : 'this grade level'}.
                        </p>
                      </div>
                    ) : (
                      /* Mode B: Per Subject Teacher Assignment List */
                      <div className="space-y-2.5 bg-slate-50 p-3 rounded-md border border-slate-200">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            <BookOpen size={14} className="text-[#2563EB]" />
                            <span>Subject-to-Teacher Allocation ({availableLearningAreas.length} Subject(s))</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleAutoFillDefaultTeachers}
                              className="btn btn-secondary btn-sm px-2 py-1 text-[11px]"
                              title="Reset all to assigned teachers from Faculty Directory"
                            >
                              <Sparkles size={12} className="text-amber-500" />
                              <span>Auto-fill Directory</span>
                            </button>
                            {teacherName.trim() && (
                              <button
                                type="button"
                                onClick={handleApplyTeacherToAllSubjects}
                                className="btn btn-secondary btn-sm px-2 py-1 text-[11px]"
                              >
                                <span>Apply "{teacherName.trim()}"</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {!gradeLevelId ? (
                          <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-md border border-amber-200">
                            Please select a Grade Level above to list subjects and their assigned default teachers.
                          </p>
                        ) : availableLearningAreas.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No learning areas assigned to this grade level.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                            {availableLearningAreas.map(la => {
                              const assignedTeacher = getAssignedTeacherForSubject(schoolId, gradeLevelId, la.id)
                              const currentVal = perSubjectTeachers[la.id] ?? (assignedTeacher ? assignedTeacher.full_name : '')
                              const isDefaultAssigned = Boolean(assignedTeacher && currentVal === assignedTeacher.full_name)

                              return (
                                <div key={la.id} className="bg-white p-2.5 rounded-md border border-slate-200 space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-semibold text-slate-900 truncate" title={la.name}>
                                      {la.name}
                                    </span>
                                    {assignedTeacher ? (
                                      <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                        Directory Match
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                        Unassigned
                                      </span>
                                    )}
                                  </div>

                                  <div className="relative">
                                    <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                                    <SuggestionInput
                                      id={`la_teacher_${la.id}`}
                                      placeholder={assignedTeacher ? `Default: ${assignedTeacher.full_name}` : "Teacher's Name"}
                                      suggestions={teacherSuggestions}
                                      value={currentVal}
                                      onChange={e => {
                                        const val = e.target.value
                                        setPerSubjectTeachers(prev => ({ ...prev, [la.id]: val }))
                                      }}
                                      onSelectSuggestion={val => {
                                        setPerSubjectTeachers(prev => ({ ...prev, [la.id]: val }))
                                      }}
                                      className="form-input pl-7 text-xs py-1"
                                    />
                                  </div>
                                  {isDefaultAssigned && (
                                    <p className="text-[9px] font-semibold text-emerald-700 flex items-center gap-1">
                                      <Sparkles size={9} className="text-amber-500 shrink-0" />
                                      <span>Pre-filled teacher</span>
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Option 2 (per_learning_area): Single Teacher Field */
                  <div className="sm:col-span-2 lg:col-span-4 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      Teacher's Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative max-w-md">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                      <SuggestionInput
                        id="import_teacher_name_option2"
                        placeholder="e.g. Maria Santos"
                        suggestions={teacherSuggestions}
                        value={teacherName}
                        onChange={e => handleTeacherNameSelect(e.target.value)}
                        onSelectSuggestion={val => handleTeacherNameSelect(val)}
                        className="form-input pl-8"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: FILE SELECTION & DOWNLOAD TEMPLATE */}
            <div className="bg-white rounded-md border border-slate-200 p-4 space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-emerald-600" />
                  <span>2. Select Excel Data File</span>
                </h3>
                <button
                  type="button"
                  onClick={() => downloadImportTemplate(importMode)}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download Excel Template</span>
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isTaggingComplete) {
                    toast(`Please select both a School and ${importMode === 'per_grade' ? 'Grade Level' : 'Learning Area'} in Step 1 first before attaching an Excel file.`, 'warning')
                    return
                  }
                  fileInputRef.current?.click()
                }}
                className={`border border-dashed rounded-md p-5 text-center transition-all ${
                  !isTaggingComplete
                    ? 'border-amber-200 bg-amber-50/50 cursor-not-allowed'
                    : fileName
                    ? 'border-[#2563EB] bg-blue-50/50 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70 cursor-pointer'
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
                <div className="flex flex-col items-center justify-center space-y-1.5">
                  {!isTaggingComplete ? (
                    <>
                      <div className="w-10 h-10 rounded-md bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center">
                        <Lock size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          File Upload Blocked
                        </p>
                        <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                          🔒 Please select both a <span className="text-[#2563EB] font-bold">School</span> and <span className="text-[#2563EB] font-bold">{importMode === 'per_grade' ? 'Grade Level' : 'Learning Area'}</span> in Step 1 above to enable Excel attachment.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-10 h-10 rounded-md flex items-center justify-center border ${fileName ? 'bg-[#2563EB] text-white border-transparent' : 'bg-white text-[#2563EB] border-slate-200'}`}>
                        {isParsing ? <RefreshCw size={20} className="animate-spin" /> : fileName ? <FileSpreadsheet size={20} /> : <Upload size={20} />}
                      </div>
                      {fileName ? (
                        <div>
                          <p className="text-xs font-bold text-slate-900">{fileName}</p>
                          <p className="text-[11px] text-slate-500 font-normal mt-0.5">Click or drag a new file to replace</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Click to upload or drag & drop your Excel file here
                          </p>
                          <p className="text-[11px] text-slate-500 font-normal mt-0.5">File contains Key Stage 1 (KS1) and Key Stages 2–4 (KS2–4) template sheets</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Worksheet Selector */}
              {sheetNames.length > 0 && (
                <div className="p-3 rounded-md bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                      <Layers size={15} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-900 block">Worksheet / Sheet Tab</label>
                      <p className="text-[10px] text-slate-500 font-normal">Choose tab containing evaluation data</p>
                    </div>
                  </div>

                  <select
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    disabled={isParsing}
                    className="form-select w-auto py-1 text-xs"
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
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 space-y-1 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span>Incorrect Template Sheet Selected for Grade Level</span>
                  </div>
                  <p className="text-[11px] text-rose-700 font-normal">
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
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>
                        Parsed Items ({parsedRows.length} Block(s) Detected)
                      </span>
                    </h4>
                    <span className="text-xs font-semibold text-[#2563EB]">
                      {validRowsCount} of {parsedRows.length} ready to import
                    </span>
                  </div>

                  <div className="rounded-md border border-slate-200 overflow-hidden bg-white">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>{importMode === 'per_grade' ? 'Excel Subject' : 'Excel Grade Level'}</th>
                            <th>{importMode === 'per_grade' ? 'Mapped Subject' : 'Mapped Grade Level'}</th>
                            {importMode === 'per_grade' && <th>Teacher Tagged</th>}
                            <th>Learners</th>
                            <th>Format</th>
                            <th>Metrics</th>
                            <th>Intended</th>
                            <th>Taught</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.map((row, idx) => {
                            const isDup = duplicateMap[row.rowIndex]
                            const isMapped = importMode === 'per_grade' ? Boolean(row.learningAreaId) : Boolean(row.gradeLevelId)
                            const currentSubjectTeacher = importMode === 'per_grade' && teacherTaggingMode === 'per_subject' && row.learningAreaId
                              ? (perSubjectTeachers[row.learningAreaId] ?? '')
                              : teacherName

                            return (
                              <tr key={idx} className={!isMapped ? 'bg-amber-50/50' : isDup ? 'bg-blue-50/30' : ''}>
                                <td className="font-semibold text-slate-400">{idx + 1}</td>
                                <td className="font-bold text-slate-900">{row.labelRaw}</td>
                                <td>
                                  {importMode === 'per_grade' ? (
                                    <select
                                      className="form-select py-1 text-xs"
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
                                  ) : (
                                    <select
                                      className="form-select py-1 text-xs"
                                      value={row.gradeLevelId || ''}
                                      onChange={e => handleGradeLevelChange(row.rowIndex, e.target.value)}
                                    >
                                      <option value="">-- Select Grade Level --</option>
                                      {grades.map(g => (
                                        <option key={g.id} value={g.id}>
                                          {g.name} (Key Stage {g.key_stage.toUpperCase()})
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </td>

                                {importMode === 'per_grade' && (
                                  <td>
                                    {teacherTaggingMode === 'per_subject' ? (
                                      <div className="min-w-[140px]">
                                        <SuggestionInput
                                          id={`table_la_teacher_${row.rowIndex}`}
                                          placeholder="Teacher's Name"
                                          suggestions={teacherSuggestions}
                                          value={currentSubjectTeacher}
                                          onChange={e => {
                                            if (row.learningAreaId) {
                                              const val = e.target.value
                                              setPerSubjectTeachers(prev => ({ ...prev, [row.learningAreaId!]: val }))
                                            }
                                          }}
                                          onSelectSuggestion={val => {
                                            if (row.learningAreaId) {
                                              setPerSubjectTeachers(prev => ({ ...prev, [row.learningAreaId!]: val }))
                                            }
                                          }}
                                          className="form-input py-1 text-xs"
                                        />
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-slate-900">
                                        {teacherName ? teacherName : <span className="text-amber-600 italic">Not set</span>}
                                      </span>
                                    )}
                                  </td>
                                )}

                                <td className="font-semibold text-slate-900">{row.totalLearners}</td>
                                <td>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${row.formType === 'ks1' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#2563EB]'}`}>
                                    {row.formType === 'ks1' ? 'KS 1' : 'KS 2–4'}
                                  </span>
                                </td>
                                <td>
                                  {row.formType === 'ks1' ? (
                                    <span className="text-[11px] text-slate-500">
                                      Adv: {row.advancing} · Bch: {row.benchmarking}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-[#2563EB]">
                                      {row.mps !== null ? `${row.mps}% MPS` : 'N/A'}
                                    </span>
                                  )}
                                </td>
                                <td className="text-slate-600">{row.totalIntended}</td>
                                <td className="text-slate-600">{row.taught}</td>
                                <td>
                                  {!isMapped ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                      <AlertTriangle size={11} /> Unmapped
                                    </span>
                                  ) : isDup ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded">
                                      Duplicate
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
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
          <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {isImporting && (
                <div className="flex items-center gap-2 text-[#2563EB] font-semibold">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Importing submissions... {importProgress}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {parsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(true)}
                  className="btn btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                >
                  <Eye size={14} />
                  <span>Preview Form</span>
                </button>
              )}
              <button
                type="button"
                onClick={triggerClose}
                disabled={isImporting}
                className="btn btn-secondary text-xs px-4 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validRowsCount === 0 || isTemplateMismatch || !isTeacherTaggingValid || !schoolId || (importMode === 'per_grade' ? !gradeLevelId : !learningAreaId)}
                className="btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Import {validRowsCount} Submission(s)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OFFICIAL TERMCAT TEMPLATE OVERLAY MODAL */}
      {showOfficialPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex flex-col items-center p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-[96vw] overflow-hidden flex flex-col my-auto max-h-[94vh]">
            {/* Header Controls */}
            <div className="bg-[#2563EB] text-white px-5 py-3 flex items-center justify-between border-b border-slate-200 no-print shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-white/10 text-white flex items-center justify-center shrink-0">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                    Official TERMCAT Printable Template Preview ({previewSubmissions[0]?.form_type === 'ks1' ? 'Key Stage 1' : 'Key Stage 2–4'})
                  </h3>
                  <p className="text-[11px] text-blue-100 font-normal">
                    Showing {previewSubmissions.length} submission(s) formatted in the official TERMCAT layout
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const scrollables = document.querySelectorAll('div, main, section, dialog')
                    scrollables.forEach(el => { if (el.scrollTop > 0) el.scrollTop = 0 })
                    window.scrollTo(0, 0)
                    setTimeout(() => window.print(), 50)
                  }}
                  className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>Print Official Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(false)}
                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs transition-all cursor-pointer"
                  title="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Template Render Area */}
            <div className="p-4 overflow-y-auto overflow-x-auto flex-1 bg-slate-50">
              <div className="w-full bg-white rounded-md border border-slate-200 p-4 overflow-x-auto">
                <OfficialTermcatTemplate
                  submissions={previewSubmissions}
                  formType={previewSubmissions[0]?.form_type || (selectedGrade && selectedGrade.grade_number <= 3 ? 'ks1' : 'ks2to4')}
                  epsName={teacherName || 'Education Program Supervisor / Teacher'}
                  sdoName="Division of Romblon"
                  learningAreaName={importMode === 'per_learning_area' ? (learningAreas.find(la => la.id === learningAreaId)?.name || 'Learning Area') : (previewSubmissions.length === 1 ? previewSubmissions[0].learning_area?.name : 'Multiple Learning Areas')}
                  termName={terms.find(t => t.id === termId)?.name || 'Term'}
                  schoolYearName={schoolYears.find(sy => sy.id === schoolYearId)?.name || 'School Year'}
                  showPrintButton={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between no-print shrink-0">
              <span className="text-xs text-slate-500 font-normal">
                Verify that all competencies, performance metrics, and factors match before importing.
              </span>
              <button
                type="button"
                onClick={() => setShowOfficialPreview(false)}
                className="btn btn-secondary text-xs px-4 py-1.5"
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
