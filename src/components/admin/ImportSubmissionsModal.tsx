import { useState, useRef, useEffect, useMemo } from 'react'
import type { School, GradeLevel, LearningArea, SchoolYear, Term, TermcatSubmission, FormType } from '@/types'
import {
  parseSubjectImportExcel,
  getExcelSheetNames,
  downloadImportTemplate,
  type ParsedSubjectRow
} from '@/lib/excel/excelImport'
import { createSubmission, generateReferenceNumber, insertAuditLog, checkDuplicateSubmission } from '@/lib/supabase/queries'
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
  User, Building2, GraduationCap, Calendar, Clock, AlertCircle, Layers, Eye, Printer, Sparkles
} from 'lucide-react'

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

  // Set default values & load teacher suggestions when modal opens
  useEffect(() => {
    if (isOpen) {
      const activeSY = schoolYears.find(sy => sy.is_active)
      if (activeSY && !schoolYearId) setSchoolYearId(activeSY.id)

      const defaultTerm = terms.find(t => t.is_default || t.is_active)
      if (defaultTerm && !termId) setTermId(defaultTerm.id)

      fetchTeacherNameSuggestions().then(setTeacherSuggestions)
    }
  }, [isOpen, schoolYears, terms, schoolYearId, termId])

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
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
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
    } else if (expectedType === 'ks2to4') {
      const match = sheets.find(s => {
        const lower = s.toLowerCase()
        return lower.includes('ks2') || lower.includes('ks 2') || lower.includes('key stage 2') || lower.includes('ks2-4') || lower.includes('ks 2-4')
      })
      return match || (sheets.length > 1 ? sheets[1] : sheets[0])
    }
    return sheets[0]
  }

  const handleGradeLevelSelect = async (newGradeId: string) => {
    setGradeLevelId(newGradeId)
    const newGrade = grades.find(g => g.id === newGradeId)
    if (fileBuffer && sheetNames.length > 0 && newGrade) {
      const newExpectedType = newGrade.grade_number <= 3 ? 'ks1' : 'ks2to4'
      const bestSheet = findBestSheetForGrade(sheetNames, newExpectedType)
      if (bestSheet && bestSheet !== selectedSheet) {
        setSelectedSheet(bestSheet)
        await parseSheetData(fileBuffer, bestSheet)
      }
    }
  }

  const processFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseError('Please select a valid Excel file (.xlsx or .xls).')
      return
    }

    setIsParsing(true)
    setParseError(null)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)

      const sheets = await getExcelSheetNames(buffer)
      setSheetNames(sheets)

      const initialSheet = findBestSheetForGrade(sheets, expectedFormType)
      setSelectedSheet(initialSheet)

      await parseSheetData(buffer, initialSheet)
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse Excel file. Make sure it is not corrupted.')
      setParsedRows([])
    } finally {
      setIsParsing(false)
    }
  }

  const parseSheetData = async (buffer: ArrayBuffer, sheetName: string) => {
    setIsParsing(true)
    setParseError(null)
    try {
      const rows = await parseSubjectImportExcel(buffer, learningAreas, sheetName)
      if (rows.length === 0) {
        setParseError(`No subject data rows found in worksheet "${sheetName}". Try selecting another sheet or check template headers.`)
        setParsedRows([])
      } else {
        setParsedRows(rows)
        if (teacherName && schoolId && gradeLevelId && schoolYearId && termId) {
          checkDuplicates(rows)
        }
      }
    } catch (err: any) {
      setParseError(err?.message || `Failed to parse worksheet "${sheetName}".`)
      setParsedRows([])
    } finally {
      setIsParsing(false)
    }
  }

  const handleSheetChange = async (sheetName: string) => {
    setSelectedSheet(sheetName)
    if (fileBuffer) {
      await parseSheetData(fileBuffer, sheetName)
    }
  }

  const checkDuplicates = async (rows: ParsedSubjectRow[]) => {
    const dupes: Record<number, boolean> = {}
    for (const r of rows) {
      if (r.learningAreaId) {
        try {
          const existing = await checkDuplicateSubmission(
            teacherName,
            schoolId,
            gradeLevelId,
            r.learningAreaId,
            schoolYearId,
            termId
          )
          dupes[r.rowIndex] = !!existing
        } catch {
          dupes[r.rowIndex] = false
        }
      }
    }
    setDuplicateMap(dupes)
  }

  const handleLearningAreaChange = (rowIndex: number, newLAId: string) => {
    setParsedRows(prev =>
      prev.map(row => {
        if (row.rowIndex !== rowIndex) return row
        const newLA = learningAreas.find(la => la.id === newLAId)
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
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-8">
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold flex items-center gap-2">
                  Import Submissions per Subject
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Excel Batch
                  </span>
                </h2>
                <p className="text-xs text-slate-300">
                  Upload Excel template with single or multiple learning areas. Each subject block automatically creates its own separate submission upon import.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* STEP 1: TAGGING PARAMETERS FORM */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} className="text-blue-600" />
                1. Tagging Parameters (Target Context)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Teacher Name */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="form-label text-xs">
                    Teacher's Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <SuggestionInput
                      id="import_teacher_name"
                      placeholder="e.g. Maria Santos"
                      suggestions={teacherSuggestions}
                      value={teacherName}
                      onChange={e => handleTeacherNameSelect(e.target.value)}
                      onSelectSuggestion={val => handleTeacherNameSelect(val)}
                      className="form-input text-xs pl-8 py-2 font-medium"
                    />
                  </div>
                </div>

                {/* School */}
                <div>
                  <label className="form-label text-xs">
                    School <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                    <select
                      required
                      className="form-select text-xs pl-8 py-2 font-medium"
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
                    <p className="text-[10px] font-semibold text-emerald-700 mt-1 flex items-center gap-1 animate-fade-in">
                      <Sparkles size={11} className="text-amber-500 shrink-0" />
                      <span>Auto-filled from teacher's previous records (editable).</span>
                    </p>
                  )}
                </div>

                {/* Grade Level */}
                <div>
                  <label className="form-label text-xs">
                    Grade Level <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      required
                      className="form-select text-xs pl-8 py-2 font-medium"
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
                  <label className="form-label text-xs">School Year</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      className="form-select text-xs pl-8 py-2"
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
                  <label className="form-label text-xs">Term / Quarter</label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      className="form-select text-xs pl-8 py-2"
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
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet size={14} className="text-emerald-600" />
                  2. Select Excel Data File
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => downloadImportTemplate()}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-300 shadow-2xs transition-colors"
                  >
                    <Download size={13} />
                    Download Combined Excel Template (KS1 & KS2–4)
                  </button>
                </div>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  fileName
                    ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${fileName ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    {isParsing ? <RefreshCw size={24} className="animate-spin" /> : fileName ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
                  </div>
                  {fileName ? (
                    <div>
                      <p className="text-sm font-bold text-slate-800">{fileName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Click or drag a new file to replace</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        Click to upload or drag & drop your Excel file here
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Single file contains both Key Stage 1 (KS1) and Key Stages 2–4 (KS2–4) template sheets</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Worksheet / Tab Selector */}
              {sheetNames.length > 0 && (
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <Layers size={14} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-900 block">Select Worksheet / Sheet Tab</label>
                      <p className="text-[11px] text-blue-700">Choose which tab in your Excel file contains the subject data</p>
                    </div>
                  </div>

                  <select
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    disabled={isParsing}
                    className="form-select text-xs font-bold text-blue-900 bg-white border border-blue-300 py-1.5 px-3 min-w-[200px]"
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
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-xs text-red-800 space-y-2 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2 text-red-900 font-extrabold text-sm">
                    <AlertTriangle size={18} className="text-red-600 shrink-0" />
                    <span>Incorrect Template Sheet Selected for Grade Level</span>
                  </div>
                  <p className="text-xs text-red-700 leading-relaxed">
                    Selected Grade Level <strong>{selectedGrade?.name}</strong> requires the{' '}
                    <span className="font-bold underline text-red-900">
                      {expectedFormType === 'ks1' ? 'Key Stage 1 (KS1: Cols A–O)' : 'Key Stages 2–4 (KS2–4: Cols A–K)'}
                    </span>{' '}
                    template format, but worksheet tab "<strong>{selectedSheet}</strong>" contains{' '}
                    <strong>{parsedFormType === 'ks1' ? 'Key Stage 1 (Cols A–O)' : 'Key Stages 2–4 (Cols A–K)'}</strong> format.
                  </p>
                  {sheetNames.length > 1 ? (
                    <div className="text-[11px] font-semibold text-red-800 bg-red-100/80 p-2.5 rounded-lg border border-red-200 flex items-center gap-2">
                      <Layers size={14} className="text-red-600 shrink-0" />
                      <span>Please switch the <strong>Worksheet / Sheet Tab</strong> dropdown above to select the matching template tab before importing.</span>
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-red-800 bg-red-100/80 p-2.5 rounded-lg border border-red-200">
                      ⚠️ Please upload an Excel file containing the matching {expectedFormType === 'ks1' ? 'Key Stage 1 (KS1)' : 'Key Stages 2–4 (KS2–4)'} template sheet.
                    </div>
                  )}
                </div>
              )}

              {parseError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <span className="font-semibold">{parseError}</span>
                  </div>
                  {sheetNames.length > 1 && (
                    <p className="text-[11px] text-red-600 pl-6">
                      Try switching the <strong>Worksheet / Sheet Tab</strong> above to select the tab containing your subject rows.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* STEP 3: PARSED DATA PREVIEW TABLE */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-blue-600" />
                    3. Parsed Data Preview & Subject Mapping ({parsedRows.length} subject{parsedRows.length > 1 ? 's' : ''} found in "{selectedSheet}" — creates {parsedRows.length} separate submission{parsedRows.length > 1 ? 's' : ''})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowOfficialPreview(true)}
                      className="btn-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold inline-flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg shadow-2xs transition-colors"
                    >
                      <Eye size={14} />
                      <span>Preview Official TERMCAT Template</span>
                    </button>
                    <span className="text-xs font-semibold text-slate-600">
                      {validRowsCount} of {parsedRows.length} ready
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="data-table text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th>#</th>
                          <th>Subject (Excel Text)</th>
                          <th>Mapped Subject</th>
                          <th>Learners</th>
                          <th>Format</th>
                          <th>Metrics</th>
                          <th>Intended</th>
                          <th>Taught</th>
                          <th>Top Competencies</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, idx) => {
                          const isDup = duplicateMap[row.rowIndex]
                          return (
                            <tr key={idx} className={!row.learningAreaId ? 'bg-amber-50/50' : isDup ? 'bg-blue-50/30' : ''}>
                              <td className="font-bold text-slate-400">{idx + 1}</td>
                              <td className="font-semibold text-slate-800">{row.learningAreaRaw}</td>
                              <td>
                                <select
                                  className="form-select text-xs py-1 px-2 font-medium"
                                  value={row.learningAreaId || ''}
                                  onChange={e => handleLearningAreaChange(row.rowIndex, e.target.value)}
                                >
                                  <option value="">-- Select Subject --</option>
                                  {learningAreas.map(la => (
                                    <option key={la.id} value={la.id}>
                                      {la.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>{row.totalLearners}</td>
                              <td>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.formType === 'ks1' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {row.formType === 'ks1' ? 'KS 1' : 'KS 2–4'}
                                </span>
                              </td>
                              <td>
                                {row.formType === 'ks1' ? (
                                  <span className="text-[11px] font-medium text-slate-700">
                                    Adv: {row.advancing} · Bch: {row.benchmarking} · Con: {row.connecting}
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold text-blue-800">
                                    {row.mps !== null ? `${row.mps}% MPS` : 'N/A'}
                                  </span>
                                )}
                              </td>
                              <td>{row.totalIntended}</td>
                              <td>{row.taught}</td>
                              <td>
                                <span className="text-[11px] font-medium text-slate-600">
                                  {row.mostLearned.length} ML · {row.leastMastered.length} LM · {row.mostDifficult.length} MD
                                </span>
                              </td>
                              <td>
                                {!row.learningAreaId ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                    <AlertTriangle size={11} /> Unmapped
                                  </span>
                                ) : isDup ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded" title="A submission for this teacher, school, grade, and subject already exists">
                                    Duplicate Warning
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
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

          {/* Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {isImporting && (
                <div className="flex items-center gap-3">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  <span>Importing submissions... {importProgress}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {parsedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(true)}
                  className="btn-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold inline-flex items-center gap-2"
                >
                  <Eye size={16} />
                  Preview Official TERMCAT Template
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="btn-md btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || validRowsCount === 0 || isTemplateMismatch || !teacherName.trim() || !schoolId || !gradeLevelId}
                className={`btn-md btn-primary inline-flex items-center gap-2 ${
                  isTemplateMismatch ? 'opacity-50 cursor-not-allowed bg-slate-400 border-slate-400 hover:bg-slate-400' : ''
                }`}
                title={isTemplateMismatch ? 'Cannot import: Incorrect sheet template for selected Grade Level' : undefined}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import {validRowsCount} Submission(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* OFFICIAL TERMCAT PRINTABLE TEMPLATE OVERLAY MODAL */}
      {showOfficialPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col items-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header Controls */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/30 flex items-center justify-center text-blue-300">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    Official TERMCAT Printable Template Preview ({previewSubmissions[0]?.form_type === 'ks1' ? 'Key Stage 1' : 'Key Stage 2–4'})
                  </h3>
                  <p className="text-xs text-slate-300">
                    Showing {previewSubmissions.length} subject submission(s) formatted in the official TERMCAT layout
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-sm btn-primary inline-flex items-center gap-1.5 font-bold shadow-md"
                >
                  <Printer size={14} /> Print Official Form
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficialPreview(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Template Render Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100">
              <div className="max-w-4xl mx-auto">
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
            <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between no-print shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Verify that all competencies, performance metrics, and factors match before importing.
              </span>
              <button
                type="button"
                onClick={() => setShowOfficialPreview(false)}
                className="btn-md btn-secondary"
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
