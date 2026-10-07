import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { ImportSubmissionsModal } from '@/components/admin/ImportSubmissionsModal'
import { EmptyState, TableSkeleton } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  fetchSubmissions, fetchSchools, fetchGradeLevels, fetchLearningAreas,
  fetchSchoolYears, fetchTerms, fetchLearningAreaGrades, fetchSubmitterTeacherNames, deleteSubmission, insertAuditLog
} from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type {
  TermcatSubmission, SubmissionFilters, School, GradeLevel, LearningArea,
  SchoolYear, Term, LearningAreaGrade
} from '@/types'
import {
  Search, Filter, ChevronUp, ChevronDown, X, FileText, CheckCircle2,
  AlertCircle, Building2, BookOpen, Clock, Calendar, Sparkles, RefreshCw, Pencil, Trash2, Eye, ExternalLink, FileSpreadsheet
} from 'lucide-react'
import { format } from 'date-fns'

import { captureGenieOrigin } from '@/utils/genieAnimation'

const PAGE_SIZE = 20

function isGradeOfferedBySchool(school: School, gradeNumber: number): boolean {
  if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
    return school.offered_grade_numbers.includes(gradeNumber)
  }
  if (school.school_type === 'elementary') return gradeNumber <= 6
  if (school.school_type === 'secondary') return gradeNumber >= 7
  return true
}

function getSchoolOfferedGradeNumbers(school: School): number[] {
  if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
    return school.offered_grade_numbers
  }
  if (school.school_type === 'elementary') return [1, 2, 3, 4, 5, 6]
  if (school.school_type === 'secondary') return [7, 8, 9, 10, 11, 12]
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

function getGradeNumbersForLevel(level: string): number[] | null {
  switch (level) {
    case 'elementary': return [1, 2, 3, 4, 5, 6]
    case 'jhs': return [7, 8, 9, 10]
    case 'shs': return [11, 12]
    case 'ks1': return [1, 2, 3]
    case 'ks2': return [4, 5, 6]
    case 'ks3': return [7, 8, 9, 10]
    case 'ks4': return [11, 12]
    default: return null
  }
}

interface StatusMatrixItem {
  id: string
  school: School
  gradeLevel: GradeLevel
  learningArea: LearningArea
  submission?: TermcatSubmission
  isSubmitted: boolean
}

export function SubmissionsPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'submissions' | 'status'>('submissions')
  
  // Submissions Tab State
  const [submissions, setSubmissions] = useState<TermcatSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [subToDelete, setSubToDelete] = useState<TermcatSubmission | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const handleDeleteSubmission = async () => {
    if (!subToDelete || !admin) return
    setIsDeleting(true)
    try {
      await deleteSubmission(subToDelete.id)
      await insertAuditLog({
        admin_id: admin.id,
        admin_name: admin.full_name,
        action: 'delete_submission',
        entity_type: 'submission',
        entity_id: subToDelete.id,
        entity_label: subToDelete.reference_number,
      })
      toast(`Submission ${subToDelete.reference_number} deleted.`, 'success')
      setSubToDelete(null)
      loadSubmissions()
    } catch {
      toast('Failed to delete submission.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // Master data
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])

  // Filters for Submissions List tab
  const [filters, setFilters] = useState<Partial<SubmissionFilters>>({
    search: '',
    teacher_name: '',
    status: '',
    school_year_id: '',
    term_id: '',
    school_id: '',
    grade_level_id: '',
    learning_area_id: '',
    key_stage: '',
    school_type: '',
    page: 1,
    page_size: PAGE_SIZE,
    sort_by: 'submitted_at',
    sort_dir: 'desc',
  })

  // Status Monitoring Tab State
  const [statusSY, setStatusSY] = useState<string>('')
  const [statusTerm, setStatusTerm] = useState<string>('')
  const [statusSchoolId, setStatusSchoolId] = useState<string>('')
  const [statusLevel, setStatusLevel] = useState<'all' | 'jhs' | 'shs' | 'elementary'>('all')
  const [statusGradeId, setStatusGradeId] = useState<string>('')
  const [statusLAId, setStatusLAId] = useState<string>('')
  const [statusTeacherName, setStatusTeacherName] = useState<string>('')
  const [statusSearch, setStatusSearch] = useState<string>('')
  const [complianceFilter] = useState<'all' | 'missing' | 'submitted'>('all')
  const [statusSubmissions, setStatusSubmissions] = useState<TermcatSubmission[]>([])
  const [statusLoading, setStatusLoading] = useState<boolean>(false)

  // Submitter teacher names from teacher_name column of termcat_submissions
  const [submitterTeachers, setSubmitterTeachers] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetchSchools(false), fetchGradeLevels(), fetchLearningAreas(false),
      fetchSchoolYears(false), fetchTerms(false), fetchLearningAreaGrades(),
      fetchSubmitterTeacherNames()
    ]).then(([s, g, la, sy, t, lag, teachers]) => {
      setSchools(s)
      setGrades(g)
      setLearningAreas(la)
      setSchoolYears(sy)
      setTerms(t)
      setLearningAreaGrades(lag)
      if (Array.isArray(teachers)) {
        setSubmitterTeachers(teachers)
      }

      const activeSY = sy.find(item => item.is_active)
      if (activeSY) setStatusSY(activeSY.id)

      const defaultTerm = t.find(item => item.is_default || item.is_active)
      if (defaultTerm) setStatusTerm(defaultTerm.id)
    }).catch(() => {})
  }, [])

  const { admin, getPermittedSchoolIds, getPermittedSchools, hasFullAccess, isSchoolPermitted } = useAuth()
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

  // Unique Teacher Options: STRICTLY teachers who submitted TERMCAT reports (from teacher_name column)
  const availableTeacherOptions = useMemo(() => {
    const names = new Set<string>()
    submitterTeachers.forEach(n => { if (n && n.trim()) names.add(n.trim()) })
    submissions.forEach(s => { if (s.teacher_name && s.teacher_name.trim()) names.add(s.teacher_name.trim()) })
    statusSubmissions.forEach(s => { if (s.teacher_name && s.teacher_name.trim()) names.add(s.teacher_name.trim()) })
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [submitterTeachers, submissions, statusSubmissions])

  // Learning Area <-> Grade mappings
  const { gradeToLAsMap, laToGradesMap } = useMemo(() => {
    const gradeToLAs = new Map<string, Set<string>>()
    const laToGrades = new Map<string, Set<string>>()
    learningAreaGrades.forEach(lag => {
      if (!gradeToLAs.has(lag.grade_level_id)) gradeToLAs.set(lag.grade_level_id, new Set())
      gradeToLAs.get(lag.grade_level_id)!.add(lag.learning_area_id)

      if (!laToGrades.has(lag.learning_area_id)) laToGrades.set(lag.learning_area_id, new Set())
      laToGrades.get(lag.learning_area_id)!.add(lag.grade_level_id)
    })
    return { gradeToLAsMap: gradeToLAs, laToGradesMap: laToGrades }
  }, [learningAreaGrades])

  // Consolidated submissions map for teacher/dropdown lookups across the system
  const allSubmissionsForFiltering = useMemo(() => {
    const map = new Map<string, TermcatSubmission>()
    statusSubmissions.forEach(s => map.set(s.id, s))
    submissions.forEach(s => map.set(s.id, s))
    return Array.from(map.values())
  }, [statusSubmissions, submissions])

  // =========================================================================
  // TAB 1 (Submissions List) - Dynamic Interdependent Narrowed Dropdowns
  // =========================================================================

  const filteredSchoolsForSubmissions = useMemo(() => {
    return permittedSchools.filter(school => {
      if (filters.school_type && school.school_type !== filters.school_type) return false
      if (filters.grade_level_id) {
        const selectedGrade = grades.find(g => g.id === filters.grade_level_id)
        if (selectedGrade && !isGradeOfferedBySchool(school, selectedGrade.grade_number)) return false
      }
      if (filters.key_stage) {
        const targetGradeNumbers = getGradeNumbersForLevel(filters.key_stage)
        if (targetGradeNumbers) {
          const schoolGrades = getSchoolOfferedGradeNumbers(school)
          if (!schoolGrades.some(gn => targetGradeNumbers.includes(gn))) return false
        }
      }
      if (filters.learning_area_id) {
        const gradeIdsForLA = laToGradesMap.get(filters.learning_area_id)
        if (gradeIdsForLA && gradeIdsForLA.size > 0) {
          const schoolGrades = grades.filter(g => isGradeOfferedBySchool(school, g.grade_number))
          if (!schoolGrades.some(g => gradeIdsForLA.has(g.id))) return false
        }
      }
      if (filters.teacher_name) {
        const tName = filters.teacher_name.trim().toLowerCase()
        const teacherSubs = allSubmissionsForFiltering.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.school_id === school.id)) return false
      }
      return true
    })
  }, [permittedSchools, filters.school_type, filters.grade_level_id, filters.key_stage, filters.learning_area_id, filters.teacher_name, grades, laToGradesMap, allSubmissionsForFiltering])

  const filteredGradesForSubmissions = useMemo(() => {
    return grades.filter(grade => {
      if (!grade.is_active) return false
      if (filters.school_id) {
        const school = schools.find(s => s.id === filters.school_id)
        if (school && !isGradeOfferedBySchool(school, grade.grade_number)) return false
      }
      if (filters.school_type) {
        if (filters.school_type === 'elementary' && grade.grade_number > 6) return false
        if (filters.school_type === 'secondary' && grade.grade_number < 7) return false
      }
      if (filters.key_stage) {
        const targetGradeNumbers = getGradeNumbersForLevel(filters.key_stage)
        if (targetGradeNumbers && !targetGradeNumbers.includes(grade.grade_number)) return false
      }
      if (filters.learning_area_id) {
        const gradeIdsForLA = laToGradesMap.get(filters.learning_area_id)
        if (gradeIdsForLA && gradeIdsForLA.size > 0 && !gradeIdsForLA.has(grade.id)) return false
      }
      if (filters.teacher_name) {
        const tName = filters.teacher_name.trim().toLowerCase()
        const teacherSubs = allSubmissionsForFiltering.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.grade_level_id === grade.id)) return false
      }
      return true
    })
  }, [grades, filters.school_id, filters.school_type, filters.key_stage, filters.learning_area_id, filters.teacher_name, schools, laToGradesMap, allSubmissionsForFiltering])

  const filteredLearningAreasForSubmissions = useMemo(() => {
    return learningAreas.filter(la => {
      if (!la.is_active) return false
      if (filters.grade_level_id) {
        const assignedLAs = gradeToLAsMap.get(filters.grade_level_id)
        if (assignedLAs && assignedLAs.size > 0 && !assignedLAs.has(la.id)) return false
      }
      if (filters.school_id) {
        const school = schools.find(s => s.id === filters.school_id)
        if (school) {
          const schoolGrades = grades.filter(g => isGradeOfferedBySchool(school, g.grade_number))
          const allowedLAIds = new Set<string>()
          schoolGrades.forEach(g => {
            const las = gradeToLAsMap.get(g.id)
            if (las) las.forEach(id => allowedLAIds.add(id))
          })
          if (allowedLAIds.size > 0 && !allowedLAIds.has(la.id)) return false
        }
      }
      const activeLevel = filters.key_stage || (filters.school_type === 'elementary' ? 'elementary' : filters.school_type === 'secondary' ? 'jhs' : null)
      if (activeLevel) {
        const targetGradeNumbers = getGradeNumbersForLevel(activeLevel)
        if (targetGradeNumbers) {
          const targetGradeIds = grades.filter(g => targetGradeNumbers.includes(g.grade_number)).map(g => g.id)
          const allowedLAIds = new Set<string>()
          targetGradeIds.forEach(gid => {
            const las = gradeToLAsMap.get(gid)
            if (las) las.forEach(id => allowedLAIds.add(id))
          })
          if (allowedLAIds.size > 0 && !allowedLAIds.has(la.id)) return false
        }
      }
      if (filters.teacher_name) {
        const tName = filters.teacher_name.trim().toLowerCase()
        const teacherSubs = allSubmissionsForFiltering.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.learning_area_id === la.id)) return false
      }
      return true
    })
  }, [learningAreas, filters.grade_level_id, filters.school_id, filters.key_stage, filters.school_type, filters.teacher_name, schools, grades, gradeToLAsMap, allSubmissionsForFiltering])

  const filteredTeachersForSubmissions = useMemo(() => {
    if (!filters.school_id && !filters.grade_level_id && !filters.learning_area_id && !filters.school_year_id && !filters.term_id && !filters.school_type && !filters.key_stage) {
      return availableTeacherOptions
    }

    const matchingSubmissions = allSubmissionsForFiltering.filter(sub => {
      if (filters.school_id && sub.school_id !== filters.school_id) return false
      if (filters.grade_level_id && sub.grade_level_id !== filters.grade_level_id) return false
      if (filters.learning_area_id && sub.learning_area_id !== filters.learning_area_id) return false
      if (filters.school_year_id && sub.school_year_id !== filters.school_year_id) return false
      if (filters.term_id && sub.term_id !== filters.term_id) return false

      if (filters.school_type) {
        const school = schools.find(s => s.id === sub.school_id)
        if (school && school.school_type !== filters.school_type) return false
      }

      if (filters.key_stage) {
        const grade = grades.find(g => g.id === sub.grade_level_id)
        const targetGradeNumbers = getGradeNumbersForLevel(filters.key_stage)
        if (grade && targetGradeNumbers && !targetGradeNumbers.includes(grade.grade_number)) return false
      }

      return true
    })

    const teacherNames = new Set<string>()
    matchingSubmissions.forEach(s => {
      if (s.teacher_name && s.teacher_name.trim()) teacherNames.add(s.teacher_name.trim())
    })

    return availableTeacherOptions.filter(name => teacherNames.has(name))
  }, [availableTeacherOptions, filters.school_id, filters.grade_level_id, filters.learning_area_id, filters.school_year_id, filters.term_id, filters.school_type, filters.key_stage, allSubmissionsForFiltering, schools, grades])

  // =========================================================================
  // TAB 2 (Status & Compliance) - Dynamic Interdependent Narrowed Dropdowns
  // =========================================================================

  const statusFilteredSchools = useMemo(() => {
    return permittedSchools.filter(school => {
      if (statusLevel && statusLevel !== 'all') {
        const targetGradeNumbers = getGradeNumbersForLevel(statusLevel)
        if (targetGradeNumbers) {
          const schoolGrades = getSchoolOfferedGradeNumbers(school)
          if (!schoolGrades.some(gn => targetGradeNumbers.includes(gn))) return false
        }
      }
      if (statusGradeId) {
        const selectedGrade = grades.find(g => g.id === statusGradeId)
        if (selectedGrade && !isGradeOfferedBySchool(school, selectedGrade.grade_number)) return false
      }
      if (statusLAId) {
        const gradeIdsForLA = laToGradesMap.get(statusLAId)
        if (gradeIdsForLA && gradeIdsForLA.size > 0) {
          const schoolGrades = grades.filter(g => isGradeOfferedBySchool(school, g.grade_number))
          if (!schoolGrades.some(g => gradeIdsForLA.has(g.id))) return false
        }
      }
      if (statusTeacherName) {
        const tName = statusTeacherName.trim().toLowerCase()
        const teacherSubs = statusSubmissions.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.school_id === school.id)) return false
      }
      return true
    })
  }, [permittedSchools, statusLevel, statusGradeId, statusLAId, statusTeacherName, grades, laToGradesMap, statusSubmissions])

  const statusFilteredGrades = useMemo(() => {
    return grades.filter(grade => {
      if (!grade.is_active) return false
      if (statusLevel && statusLevel !== 'all') {
        const targetGradeNumbers = getGradeNumbersForLevel(statusLevel)
        if (targetGradeNumbers && !targetGradeNumbers.includes(grade.grade_number)) return false
      }
      if (statusSchoolId) {
        const school = schools.find(s => s.id === statusSchoolId)
        if (school && !isGradeOfferedBySchool(school, grade.grade_number)) return false
      }
      if (statusLAId) {
        const gradeIdsForLA = laToGradesMap.get(statusLAId)
        if (gradeIdsForLA && gradeIdsForLA.size > 0 && !gradeIdsForLA.has(grade.id)) return false
      }
      if (statusTeacherName) {
        const tName = statusTeacherName.trim().toLowerCase()
        const teacherSubs = statusSubmissions.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.grade_level_id === grade.id)) return false
      }
      return true
    })
  }, [grades, statusLevel, statusSchoolId, statusLAId, statusTeacherName, schools, laToGradesMap, statusSubmissions])

  const statusFilteredLAs = useMemo(() => {
    return learningAreas.filter(la => {
      if (!la.is_active) return false
      if (statusGradeId) {
        const assignedLAs = gradeToLAsMap.get(statusGradeId)
        if (assignedLAs && assignedLAs.size > 0 && !assignedLAs.has(la.id)) return false
      }
      if (statusSchoolId) {
        const school = schools.find(s => s.id === statusSchoolId)
        if (school) {
          const schoolGrades = grades.filter(g => isGradeOfferedBySchool(school, g.grade_number))
          const allowedLAIds = new Set<string>()
          schoolGrades.forEach(g => {
            const las = gradeToLAsMap.get(g.id)
            if (las) las.forEach(id => allowedLAIds.add(id))
          })
          if (allowedLAIds.size > 0 && !allowedLAIds.has(la.id)) return false
        }
      }
      if (statusLevel && statusLevel !== 'all') {
        const targetGradeNumbers = getGradeNumbersForLevel(statusLevel)
        if (targetGradeNumbers) {
          const targetGradeIds = grades.filter(g => targetGradeNumbers.includes(g.grade_number)).map(g => g.id)
          const allowedLAIds = new Set<string>()
          targetGradeIds.forEach(gid => {
            const las = gradeToLAsMap.get(gid)
            if (las) las.forEach(id => allowedLAIds.add(id))
          })
          if (allowedLAIds.size > 0 && !allowedLAIds.has(la.id)) return false
        }
      }
      if (statusTeacherName) {
        const tName = statusTeacherName.trim().toLowerCase()
        const teacherSubs = statusSubmissions.filter(
          s => s.teacher_name?.trim().toLowerCase() === tName
        )
        if (!teacherSubs.some(s => s.learning_area_id === la.id)) return false
      }
      return true
    })
  }, [learningAreas, statusGradeId, statusSchoolId, statusLevel, statusTeacherName, schools, grades, gradeToLAsMap, statusSubmissions])

  const statusFilteredTeachers = useMemo(() => {
    if (!statusSchoolId && !statusGradeId && !statusLAId && !statusSY && !statusTerm && statusLevel === 'all') {
      return availableTeacherOptions
    }

    const matchingSubmissions = statusSubmissions.filter(sub => {
      if (statusSchoolId && sub.school_id !== statusSchoolId) return false
      if (statusGradeId && sub.grade_level_id !== statusGradeId) return false
      if (statusLAId && sub.learning_area_id !== statusLAId) return false
      if (statusSY && sub.school_year_id !== statusSY) return false
      if (statusTerm && sub.term_id !== statusTerm) return false

      if (statusLevel && statusLevel !== 'all') {
        const grade = grades.find(g => g.id === sub.grade_level_id)
        const targetGradeNumbers = getGradeNumbersForLevel(statusLevel)
        if (grade && targetGradeNumbers && !targetGradeNumbers.includes(grade.grade_number)) return false
      }

      return true
    })

    const teacherNames = new Set<string>()
    matchingSubmissions.forEach(s => {
      if (s.teacher_name && s.teacher_name.trim()) teacherNames.add(s.teacher_name.trim())
    })

    return availableTeacherOptions.filter(name => teacherNames.has(name))
  }, [availableTeacherOptions, statusSchoolId, statusGradeId, statusLAId, statusSY, statusTerm, statusLevel, statusSubmissions, grades])

  // Reset dependent filters if currently selected value is invalid in narrowed list
  useEffect(() => {
    if (filters.school_id && !filteredSchoolsForSubmissions.some(s => s.id === filters.school_id)) {
      setFilter('school_id', '')
    }
  }, [filteredSchoolsForSubmissions, filters.school_id])

  useEffect(() => {
    if (filters.grade_level_id && !filteredGradesForSubmissions.some(g => g.id === filters.grade_level_id)) {
      setFilter('grade_level_id', '')
    }
  }, [filteredGradesForSubmissions, filters.grade_level_id])

  useEffect(() => {
    if (filters.learning_area_id && !filteredLearningAreasForSubmissions.some(la => la.id === filters.learning_area_id)) {
      setFilter('learning_area_id', '')
    }
  }, [filteredLearningAreasForSubmissions, filters.learning_area_id])

  useEffect(() => {
    if (filters.teacher_name && !filteredTeachersForSubmissions.includes(filters.teacher_name)) {
      setFilter('teacher_name', '')
    }
  }, [filteredTeachersForSubmissions, filters.teacher_name])

  useEffect(() => {
    if (statusSchoolId && !statusFilteredSchools.some(s => s.id === statusSchoolId)) {
      setStatusSchoolId('')
    }
  }, [statusFilteredSchools, statusSchoolId])

  useEffect(() => {
    if (statusGradeId && !statusFilteredGrades.some(g => g.id === statusGradeId)) {
      setStatusGradeId('')
    }
  }, [statusFilteredGrades, statusGradeId])

  useEffect(() => {
    if (statusLAId && !statusFilteredLAs.some(la => la.id === statusLAId)) {
      setStatusLAId('')
    }
  }, [statusFilteredLAs, statusLAId])

  useEffect(() => {
    if (statusTeacherName && !statusFilteredTeachers.includes(statusTeacherName)) {
      setStatusTeacherName('')
    }
  }, [statusFilteredTeachers, statusTeacherName])

  const loadSubmissions = useCallback(() => {
    setLoading(true)
    const effectiveFilters = { ...filters }
    if (!hasFullAccess() && schools.length > 0) {
      effectiveFilters.school_ids = getPermittedSchoolIds(schools.map(s => s.id))
    }
    fetchSubmissions(effectiveFilters).then(({ data, count }) => {
      setSubmissions(data)
      setTotal(count)
    }).finally(() => setLoading(false))
  }, [filters, hasFullAccess, getPermittedSchoolIds, schools])

  useEffect(() => { loadSubmissions() }, [loadSubmissions])

  // Load submissions for Status Tab monitoring
  const loadStatusData = useCallback(() => {
    setStatusLoading(true)
    const filtersObj: any = { page_size: 2000 }
    if (statusSY) filtersObj.school_year_id = statusSY
    if (statusTerm) filtersObj.term_id = statusTerm
    if (!hasFullAccess() && schools.length > 0) {
      filtersObj.school_ids = getPermittedSchoolIds(schools.map(s => s.id))
    }

    fetchSubmissions(filtersObj)
      .then(({ data }) => setStatusSubmissions(data))
      .finally(() => setStatusLoading(false))
  }, [statusSY, statusTerm, hasFullAccess, getPermittedSchoolIds, schools])

  useEffect(() => {
    if (activeTab === 'status') {
      loadStatusData()
    }
  }, [activeTab, loadStatusData])

  const setFilter = (key: string, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      search: '', teacher_name: '', status: '', school_year_id: '', term_id: '', school_id: '',
      grade_level_id: '', learning_area_id: '', key_stage: '', school_type: '',
      page: 1, page_size: PAGE_SIZE, sort_by: 'submitted_at', sort_dir: 'desc',
    })
  }

  const toggleSort = (field: string) => {
    setFilters(prev => ({
      ...prev,
      sort_by: field,
      sort_dir: prev.sort_by === field && prev.sort_dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (filters.sort_by !== field) return null
    return filters.sort_dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
  }

  const activeFilterCount = [
    filters.status, filters.teacher_name, filters.school_year_id, filters.term_id, filters.school_id,
    filters.grade_level_id, filters.learning_area_id, filters.key_stage, filters.school_type,
  ].filter(Boolean).length

  // Construct Status Compliance Matrix
  const { statusMatrix, summaryStats } = useMemo(() => {
    if (!schools.length || !grades.length || !learningAreas.length) {
      return { statusMatrix: [], summaryStats: { total: 0, submitted: 0, missing: 0, rate: 0, fullSchools: 0, totalSchools: 0 } }
    }

    // Map grade_level_id -> Set of assigned learning_area_ids
    const gradeToLAsMap = new Map<string, Set<string>>()
    learningAreaGrades.forEach(lag => {
      if (!gradeToLAsMap.has(lag.grade_level_id)) {
        gradeToLAsMap.set(lag.grade_level_id, new Set())
      }
      gradeToLAsMap.get(lag.grade_level_id)!.add(lag.learning_area_id)
    })

    // Submissions map by key `${school_id}_${grade_level_id}_${learning_area_id}`
    const subMap = new Map<string, TermcatSubmission>()
    statusSubmissions.forEach(sub => {
      const key = `${sub.school_id}_${sub.grade_level_id}_${sub.learning_area_id}`
      if (!subMap.has(key)) {
        subMap.set(key, sub)
      }
    })

    const allItems: StatusMatrixItem[] = []
    const schoolComplianceCounts = new Map<string, { total: number; submitted: number }>()

    const allSchoolIds = schools.map(s => s.id)
    const permittedSchoolIds = getPermittedSchoolIds(allSchoolIds)
    const activeSchools = schools.filter(s => s.is_active && permittedSchoolIds.includes(s.id))

    activeSchools.forEach(school => {

      let schoolTotal = 0
      let schoolSubmitted = 0

      // Applicable grade levels for school type & school offered grades assigned in School Directory & Governance
      const applicableGrades = grades.filter(g => {
        if (!g.is_active) return false
        if (Array.isArray(school.offered_grade_numbers) && school.offered_grade_numbers.length > 0) {
          return school.offered_grade_numbers.includes(g.grade_number)
        }
        if (school.school_type === 'elementary') return g.grade_number <= 6
        if (school.school_type === 'secondary') return g.grade_number >= 7
        return true
      })

      applicableGrades.forEach(grade => {
        const assignedLAIds = gradeToLAsMap.get(grade.id)
        const relevantLAs = assignedLAIds && assignedLAIds.size > 0
          ? learningAreas.filter(la => la.is_active && assignedLAIds.has(la.id))
          : learningAreas.filter(la => la.is_active)

        relevantLAs.forEach(la => {
          const key = `${school.id}_${grade.id}_${la.id}`
          const submission = subMap.get(key)
          const isSubmitted = !!submission

          schoolTotal++
          if (isSubmitted) schoolSubmitted++

          allItems.push({
            id: key,
            school,
            gradeLevel: grade,
            learningArea: la,
            submission,
            isSubmitted,
          })
        })
      })

      schoolComplianceCounts.set(school.id, { total: schoolTotal, submitted: schoolSubmitted })
    })

    // Calculate Summary Stats
    const totalRequired = allItems.length
    const totalSubmitted = allItems.filter(i => i.isSubmitted).length
    const totalMissing = totalRequired - totalSubmitted
    const rate = totalRequired > 0 ? Math.round((totalSubmitted / totalRequired) * 100) : 0

    let fullSchools = 0
    schoolComplianceCounts.forEach(({ total, submitted }) => {
      if (total > 0 && total === submitted) fullSchools++
    })

    // Filter items based on user criteria
    const filteredItems = allItems.filter(item => {
      if (statusSchoolId && item.school.id !== statusSchoolId) return false
      if (statusGradeId && item.gradeLevel.id !== statusGradeId) return false
      if (statusLAId && item.learningArea.id !== statusLAId) return false
      if (statusTeacherName) {
        const tQ = statusTeacherName.toLowerCase()
        if (!item.submission || !item.submission.teacher_name.toLowerCase().includes(tQ)) return false
      }

      if (statusLevel === 'jhs') {
        if (item.gradeLevel.grade_number < 7 || item.gradeLevel.grade_number > 10) return false
      } else if (statusLevel === 'shs') {
        if (item.gradeLevel.grade_number < 11 || item.gradeLevel.grade_number > 12) return false
      } else if (statusLevel === 'elementary') {
        if (item.gradeLevel.grade_number < 1 || item.gradeLevel.grade_number > 6) return false
      }

      if (complianceFilter === 'missing' && item.isSubmitted) return false
      if (complianceFilter === 'submitted' && !item.isSubmitted) return false

      if (statusSearch) {
        const q = statusSearch.toLowerCase()
        const matchesSchool = item.school.name.toLowerCase().includes(q)
        const matchesGrade = item.gradeLevel.name.toLowerCase().includes(q)
        const matchesLA = item.learningArea.name.toLowerCase().includes(q)
        const matchesTeacher = item.submission?.teacher_name.toLowerCase().includes(q)
        if (!matchesSchool && !matchesGrade && !matchesLA && !matchesTeacher) return false
      }

      return true
    })

    return {
      statusMatrix: filteredItems,
      summaryStats: {
        total: totalRequired,
        submitted: totalSubmitted,
        missing: totalMissing,
        rate,
        fullSchools,
        totalSchools: activeSchools.length,
      }
    }
  }, [schools, grades, learningAreas, learningAreaGrades, statusSubmissions, statusSchoolId, statusGradeId, statusLAId, statusTeacherName, statusSearch, complianceFilter, statusLevel])

  // Expanded Grade Accordion State for School Filtered View
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())

  // Calculate Grouped Grade Levels when Filtered by School
  const gradeGroups = useMemo(() => {
    if (!statusSchoolId || !statusMatrix.length) return []

    const groupMap = new Map<string, StatusMatrixItem[]>()
    statusMatrix.forEach(item => {
      const gid = item.gradeLevel.id
      if (!groupMap.has(gid)) {
        groupMap.set(gid, [])
      }
      groupMap.get(gid)!.push(item)
    })

    const sortedGradeIds = Array.from(groupMap.keys()).sort((a, b) => {
      const gA = grades.find(g => g.id === a)?.grade_number || 0
      const gB = grades.find(g => g.id === b)?.grade_number || 0
      return gA - gB
    })

    return sortedGradeIds.map(gid => {
      const gradeLevel = grades.find(g => g.id === gid) || statusMatrix.find(i => i.gradeLevel.id === gid)!.gradeLevel
      const items = groupMap.get(gid)!
      const totalSubjects = items.length
      const submittedSubjects = items.filter(i => i.isSubmitted).length
      const missingSubjects = totalSubjects - submittedSubjects
      const compliancePercentage = totalSubjects > 0 ? Math.round((submittedSubjects / totalSubjects) * 100) : 0

      let status: 'complete' | 'partial' | 'none' = 'none'
      if (submittedSubjects === totalSubjects && totalSubjects > 0) {
        status = 'complete'
      } else if (submittedSubjects > 0) {
        status = 'partial'
      }

      return {
        gradeLevel,
        items,
        totalSubjects,
        submittedSubjects,
        missingSubjects,
        compliancePercentage,
        status,
      }
    })
  }, [statusSchoolId, statusMatrix, grades])

  // Auto-expand all grades when school filter changes
  useEffect(() => {
    if (statusSchoolId && gradeGroups.length > 0) {
      setExpandedGrades(new Set(gradeGroups.map(g => g.gradeLevel.id)))
    }
  }, [statusSchoolId, gradeGroups.length])

  // Expanded School Accordion State for All Schools View (when no school filter is selected)
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set())

  // Calculate Grouped Schools when NO specific school filter is selected
  const schoolGroups = useMemo(() => {
    if (statusSchoolId || !statusMatrix.length) return []

    const map = new Map<string, { school: School; items: StatusMatrixItem[] }>()
    statusMatrix.forEach(item => {
      const sid = item.school.id
      if (!map.has(sid)) {
        map.set(sid, { school: item.school, items: [] })
      }
      map.get(sid)!.items.push(item)
    })

    const result = Array.from(map.values()).map(({ school, items }) => {
      const total = items.length
      const submitted = items.filter(i => i.isSubmitted).length
      const missing = total - submitted
      const rate = total > 0 ? Math.round((submitted / total) * 100) : 0

      let status: 'complete' | 'partial' | 'none' = 'none'
      if (submitted === total && total > 0) {
        status = 'complete'
      } else if (submitted > 0) {
        status = 'partial'
      }

      // Group items by grade level inside this school
      const gradeMap = new Map<string, StatusMatrixItem[]>()
      items.forEach(item => {
        const gid = item.gradeLevel.id
        if (!gradeMap.has(gid)) {
          gradeMap.set(gid, [])
        }
        gradeMap.get(gid)!.push(item)
      })

      const sortedGradeIds = Array.from(gradeMap.keys()).sort((a, b) => {
        const gA = grades.find(g => g.id === a)?.grade_number || 0
        const gB = grades.find(g => g.id === b)?.grade_number || 0
        return gA - gB
      })

      const schoolGradeGroups = sortedGradeIds.map(gid => {
        const gradeLevel = grades.find(g => g.id === gid) || items.find(i => i.gradeLevel.id === gid)!.gradeLevel
        const gradeItems = gradeMap.get(gid)!
        const gTotal = gradeItems.length
        const gSubmitted = gradeItems.filter(i => i.isSubmitted).length
        const gRate = gTotal > 0 ? Math.round((gSubmitted / gTotal) * 100) : 0
        let gStatus: 'complete' | 'partial' | 'none' = 'none'
        if (gSubmitted === gTotal && gTotal > 0) gStatus = 'complete'
        else if (gSubmitted > 0) gStatus = 'partial'

        return {
          gradeLevel,
          items: gradeItems,
          total: gTotal,
          submitted: gSubmitted,
          missing: gTotal - gSubmitted,
          rate: gRate,
          status: gStatus,
        }
      })

      return {
        school,
        items,
        total,
        submitted,
        missing,
        rate,
        status,
        gradeGroups: schoolGradeGroups,
      }
    })

    return result.sort((a, b) => a.school.name.localeCompare(b.school.name))
  }, [statusSchoolId, statusMatrix, grades])


  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header Card */}
        <PageHeader
          badge="Data Collection & Monitoring"
          title="Submissions & Compliance Monitoring"
          description="Review teacher evaluation submissions and track school compliance across grade levels and learning areas."
          actions={
            <>
              <button
                onClick={(e) => { captureGenieOrigin(e); setIsImportModalOpen(true) }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>Import (Excel)</span>
              </button>

              <div className="inline-flex p-1 bg-slate-100 rounded-md border border-slate-200">
                <button
                  onClick={() => setActiveTab('submissions')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                    activeTab === 'submissions'
                      ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText size={15} />
                  <span>Submissions List</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    activeTab === 'submissions' ? 'bg-blue-50 text-[#2563EB] border border-blue-100' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {total}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('status')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                    activeTab === 'status'
                      ? 'bg-white text-[#2563EB] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 size={15} />
                  <span>Status & Compliance</span>
                  {summaryStats.missing > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 text-[10px] font-bold border border-rose-200">
                      {summaryStats.missing} Missing
                    </span>
                  )}
                </button>
              </div>
            </>
          }
        />

        {/* TAB 1: SUBMISSIONS LIST */}
        {activeTab === 'submissions' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search & Filter Toggle */}
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  className="w-full px-3 py-2 pl-9 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] shadow-2xs"
                  placeholder="Search teacher name..."
                  value={filters.search || ''}
                  onChange={e => setFilter('search', e.target.value)}
                  aria-label="Search submissions"
                />
              </div>
              <button
                className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-2 border ${
                  showFilters
                    ? 'bg-[#2563EB] text-white border-[#2563EB]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setShowFilters(v => !v)}
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <Filter size={15} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button
                  className="p-2 rounded-md text-rose-600 hover:bg-rose-50 transition-all cursor-pointer border border-rose-200"
                  onClick={clearFilters}
                  aria-label="Clear all filters"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div id="filter-panel" className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-slide-up">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">School Year</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.school_year_id || ''} onChange={e => setFilter('school_year_id', e.target.value)}>
                    <option value="">All</option>
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Term</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.term_id || ''} onChange={e => setFilter('term_id', e.target.value)}>
                    <option value="">All</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">School</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.school_id || ''} onChange={e => setFilter('school_id', e.target.value)}>
                    <option value="">All Schools ({filteredSchoolsForSubmissions.length})</option>
                    {filteredSchoolsForSubmissions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">School Type</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.school_type || ''} onChange={e => setFilter('school_type', e.target.value)}>
                    <option value="">All</option>
                    <option value="elementary">ES (Elementary)</option>
                    <option value="secondary">HS (Secondary)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Grade Level</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.grade_level_id || ''} onChange={e => setFilter('grade_level_id', e.target.value)}>
                    <option value="">All Grades ({filteredGradesForSubmissions.length})</option>
                    {filteredGradesForSubmissions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Learning Area</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.learning_area_id || ''} onChange={e => setFilter('learning_area_id', e.target.value)}>
                    <option value="">All Subjects ({filteredLearningAreasForSubmissions.length})</option>
                    {filteredLearningAreasForSubmissions.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Key Stage</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.key_stage || ''} onChange={e => setFilter('key_stage', e.target.value)}>
                    <option value="">All</option>
                    <option value="ks1">Key Stage 1</option>
                    <option value="ks2">Key Stage 2</option>
                    <option value="ks3">Key Stage 3</option>
                    <option value="ks4">Key Stage 4</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Teacher Name</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.teacher_name || ''} onChange={e => setFilter('teacher_name', e.target.value)}>
                    <option value="">All Teachers ({filteredTeachersForSubmissions.length})</option>
                    {filteredTeachersForSubmissions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Status</label>
                  <select className="w-full px-2.5 py-1.5 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]" value={filters.status || ''} onChange={e => setFilter('status', e.target.value)}>
                    <option value="">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="returned">Returned</option>
                    <option value="finalized">Finalized</option>
                  </select>
                </div>
              </div>
            )}

            {/* Submissions Table */}
            <div className="bg-white border border-slate-200 shadow-2xs rounded-lg overflow-hidden">
              <div className="hidden lg:block">
                {loading ? (
                  <TableSkeleton rows={8} cols={8} />
                ) : submissions.length === 0 ? (
                  <EmptyState
                    title="No submissions found"
                    description="Try changing your filters or search criteria."
                    icon={<Search size={28} />}
                  />
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4"><button onClick={() => toggleSort('reference_number')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">Ref No. <SortIcon field="reference_number" /></button></th>
                        <th className="py-2.5 px-4"><button onClick={() => toggleSort('teacher_name')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">Teacher <SortIcon field="teacher_name" /></button></th>
                        <th className="py-2.5 px-4">School</th>
                        <th className="py-2.5 px-4">Grade</th>
                        <th className="py-2.5 px-4">Learning Area</th>
                        <th className="py-2.5 px-4">Term</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4"><button onClick={() => toggleSort('submitted_at')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">Date <SortIcon field="submitted_at" /></button></th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4"><span className="font-mono text-xs font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 inline-block">{sub.reference_number}</span></td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900">
                            <a
                              href={`/teacher-submissions?name=${encodeURIComponent(sub.teacher_name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-900 hover:text-[#2563EB] transition-colors inline-flex items-center gap-1.5"
                              title={`Click to view all public submissions by ${sub.teacher_name} (opens in new tab)`}
                            >
                              {sub.teacher_name}
                              <ExternalLink size={12} className="text-[#2563EB] opacity-60" />
                            </a>
                          </td>
                          <td className="py-2.5 px-4 max-w-[180px]">
                            <a
                              href={`/school-submissions?id=${sub.school_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-900 font-semibold hover:text-[#2563EB] transition-colors inline-flex items-center gap-1 group"
                              title={`Click to view all data linked to ${sub.school?.name} in a new tab`}
                            >
                              <span className="truncate">{sub.school?.name}</span>
                              <ExternalLink size={12} className="text-[#2563EB] opacity-60 group-hover:opacity-100 shrink-0" />
                            </a>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{sub.grade_level?.name}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">{sub.learning_area?.name}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-500">{sub.term?.name}</td>
                          <td className="py-2.5 px-4"><StatusBadge status={sub.status} size="sm" /></td>
                          <td className="py-2.5 px-4 text-slate-500 text-xs font-medium">{format(new Date(sub.submitted_at), 'MMM d, yyyy')}</td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/admin/submissions/${sub.id}`}
                                className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-[#2563EB] hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={12} /> View
                              </Link>
                              <Link
                                to={`/admin/submissions/${sub.id}/edit`}
                                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Edit Submission"
                              >
                                <Pencil size={12} /> Edit
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => { captureGenieOrigin(e); setSubToDelete(sub) }}
                                className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-600 hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Delete Submission"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-surface-border">
                {loading ? (
                  <div className="p-4"><TableSkeleton rows={5} cols={1} /></div>
                ) : submissions.length === 0 ? (
                  <EmptyState title="No submissions found" description="Try changing your filters." />
                ) : (
                  submissions.map(sub => (
                    <Link key={sub.id} to={`/admin/submissions/${sub.id}`} className="block px-4 py-3 hover:bg-surface-light">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-semibold text-deped-blue">{sub.reference_number}</p>
                          <p className="text-sm font-medium text-content-primary truncate mt-0.5">{sub.teacher_name}</p>
                          <p className="text-xs text-content-secondary truncate">{sub.school?.name}</p>
                          <p className="text-xs text-content-tertiary mt-0.5">
                            {sub.grade_level?.name} · {sub.learning_area?.name} · {sub.term?.name}
                          </p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <StatusBadge status={sub.status} size="sm" />
                          <p className="text-xs text-content-tertiary mt-1">{format(new Date(sub.submitted_at), 'MMM d')}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <Pagination
                page={filters.page || 1}
                pageSize={PAGE_SIZE}
                total={total}
                onPageChange={p => setFilters(prev => ({ ...prev, page: p }))}
              />
            </div>
          </div>
        )}

        {/* TAB 2: STATUS & COMPLIANCE MONITORING */}
        {activeTab === 'status' && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Control & Selector Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                    <Calendar size={15} className="text-[#8B72F4]" />
                    <span>School Year:</span>
                    <select
                      value={statusSY}
                      onChange={e => setStatusSY(e.target.value)}
                      className="bg-transparent font-black text-[#8B72F4] focus:outline-none cursor-pointer"
                    >
                      <option value="">All SY</option>
                      {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-[#2D2638] bg-[#F6EFFF] px-3.5 py-2 rounded-2xl border border-[#8B72F4]/20 shadow-2xs">
                    <Clock size={15} className="text-[#795CEE]" />
                    <span>Quarter / Term:</span>
                    <select
                      value={statusTerm}
                      onChange={e => setStatusTerm(e.target.value)}
                      className="bg-transparent font-black text-[#795CEE] focus:outline-none cursor-pointer"
                    >
                      <option value="">All Terms</option>
                      {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Refresh Button */}
                <button
                  onClick={loadStatusData}
                  disabled={statusLoading}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white text-xs font-black shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 self-start md:self-auto"
                >
                  <RefreshCw size={14} className={statusLoading ? 'animate-spin' : ''} />
                  <span>Refresh Status</span>
                </button>
              </div>

              {/* Filters grid for Status Tab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 pt-3 border-t border-purple-100/60">
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Search Matrix</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                    <input
                      type="search"
                      placeholder="School, grade, teacher..."
                      className="w-full px-3.5 py-2 pl-8 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs"
                      value={statusSearch}
                      onChange={e => setStatusSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Level Category</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={statusLevel}
                    onChange={e => {
                      setStatusLevel(e.target.value as any)
                      setStatusGradeId('')
                    }}
                  >
                    <option value="all">All Levels</option>
                    <option value="jhs">Junior HS (Grades 7–10)</option>
                    <option value="shs">Senior HS (Grades 11–12)</option>
                    <option value="elementary">Elementary ES (Grades 1–6)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Filter School</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs"
                    value={statusSchoolId}
                    onChange={e => setStatusSchoolId(e.target.value)}
                  >
                    <option value="">All Schools ({statusFilteredSchools.length})</option>
                    {statusFilteredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Filter Grade Level</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs"
                    value={statusGradeId}
                    onChange={e => setStatusGradeId(e.target.value)}
                  >
                    <option value="">All Grades ({statusFilteredGrades.length})</option>
                    {statusFilteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Filter Learning Area</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs"
                    value={statusLAId}
                    onChange={e => setStatusLAId(e.target.value)}
                  >
                    <option value="">All Subjects ({statusFilteredLAs.length})</option>
                    {statusFilteredLAs.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7A7289] mb-1 block">Filter Teacher</label>
                  <select
                    className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-2xs cursor-pointer"
                    value={statusTeacherName}
                    onChange={e => setStatusTeacherName(e.target.value)}
                  >
                    <option value="">All Teachers ({statusFilteredTeachers.length})</option>
                    {statusFilteredTeachers.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>



            {/* Status Matrix Area: Expandable Grade-level View when Filtered by School, Flat Table otherwise */}
            {statusLoading ? (
              <div className="card overflow-hidden bg-white p-8">
                <TableSkeleton rows={8} cols={6} />
              </div>
            ) : statusMatrix.length === 0 ? (
              <div className="card overflow-hidden bg-white p-8">
                <EmptyState
                  title="No compliance entries match your filters"
                  description="Adjust your search query, grade level, or school filters above."
                  icon={<CheckCircle2 size={32} />}
                />
              </div>
            ) : statusSchoolId ? (
              /* ============================================================ */
              /* SCHOOL-FILTERED VIEW: EXPANDABLE GRADE LEVEL ACCORDIONS      */
              /* ============================================================ */
              <div className="space-y-3 animate-fade-in">
                {/* Control bar for Expand / Collapse All */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs">
                  <div className="flex items-center gap-2 text-blue-900 font-bold">
                    <Building2 size={16} className="text-blue-600" />
                    <a
                      href={`/school-submissions?id=${statusSchoolId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-700 hover:underline inline-flex items-center gap-1 text-xs font-black text-blue-900"
                      title="Open school submissions profile in new tab"
                    >
                      <span>{schools.find(s => s.id === statusSchoolId)?.name}</span>
                      <ExternalLink size={13} className="text-blue-600" />
                    </a>
                    <span>— Grade Level Compliance Breakdown</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold border border-blue-200">
                      {gradeGroups.length} Grades Listed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedGrades(new Set(gradeGroups.map(g => g.gradeLevel.id)))}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedGrades(new Set())}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {/* Grade Accordion Cards */}
                {gradeGroups.map(group => {
                  const isExpanded = expandedGrades.has(group.gradeLevel.id)
                  const toggleExpand = () => {
                    setExpandedGrades(prev => {
                      const next = new Set(prev)
                      if (next.has(group.gradeLevel.id)) {
                        next.delete(group.gradeLevel.id)
                      } else {
                        next.add(group.gradeLevel.id)
                      }
                      return next
                    })
                  }

                  return (
                    <div
                      key={group.gradeLevel.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all"
                    >
                      {/* Grade Accordion Header */}
                      <div
                        onClick={toggleExpand}
                        className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none transition-colors ${
                          group.status === 'complete'
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500'
                            : group.status === 'partial'
                            ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                            : 'bg-red-50/30 hover:bg-red-50/60 border-l-4 border-l-red-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 transition-transform ${
                              isExpanded ? 'rotate-180 bg-slate-200/70' : 'bg-slate-100'
                            }`}
                          >
                            <ChevronDown size={16} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold text-slate-900">
                                {group.gradeLevel.name}
                              </h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Key Stage {group.gradeLevel.key_stage.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {group.submittedSubjects} of {group.totalSubjects} subjects submitted ({group.compliancePercentage}% completed)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Compliance Status Badge */}
                          {group.status === 'complete' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Fully Compliant ({group.submittedSubjects}/{group.totalSubjects})
                            </span>
                          ) : group.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertCircle size={13} className="text-amber-600" />
                              Partial ({group.submittedSubjects}/{group.totalSubjects} Submitted)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                              <AlertCircle size={13} className="text-red-600" />
                              No Submissions (0/{group.totalSubjects})
                            </span>
                          )}

                          {/* Progress bar pill */}
                          <div className="hidden sm:flex items-center gap-2 w-28 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                group.status === 'complete' ? 'bg-emerald-500' : group.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${group.compliancePercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expandable Subject Table */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 animate-fade-in">
                          <table className="data-table text-xs">
                            <thead className="bg-slate-100/80 text-slate-700">
                              <tr>
                                <th className="pl-6">Learning Area / Subject</th>
                                <th>Status</th>
                                <th>Assigned Teacher</th>
                                <th>Reference Number</th>
                                <th>Date Logged</th>
                                <th className="text-right pr-6">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map(item => (
                                <tr
                                  key={item.id}
                                  className={item.isSubmitted ? 'hover:bg-slate-50' : 'bg-red-50/20 hover:bg-red-50/40'}
                                >
                                  <td className="pl-6 font-bold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <BookOpen size={14} className="text-blue-500 shrink-0" />
                                      <span>{item.learningArea.name}</span>
                                    </div>
                                  </td>
                                  <td>
                                    {item.isSubmitted ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                        <CheckCircle2 size={11} className="text-emerald-600" />
                                        Submitted
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                                        <AlertCircle size={11} className="text-red-600" />
                                        Missing
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {item.isSubmitted && item.submission ? (
                                      <a
                                        href={`/teacher-submissions?name=${encodeURIComponent(item.submission.teacher_name)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                                      >
                                        {item.submission.teacher_name}
                                        <ExternalLink size={11} className="text-blue-500 opacity-60" />
                                      </a>
                                    ) : (
                                      <span className="text-slate-400 italic">No teacher data</span>
                                    )}
                                  </td>
                                  <td>
                                    {item.isSubmitted && item.submission ? (
                                      <span className="font-mono text-[11px] font-bold text-blue-600">
                                        {item.submission.reference_number}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="text-slate-500 text-xs">
                                    {item.isSubmitted && item.submission ? (
                                      format(new Date(item.submission.submitted_at), 'MMM d, yyyy')
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="text-right pr-6">
                                    {item.isSubmitted && item.submission ? (
                                      <Link
                                        to={`/admin/submissions/${item.submission.id}`}
                                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1"
                                      >
                                        Review Form
                                      </Link>
                                    ) : (
                                      <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded border border-red-200">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
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
              /* ALL SCHOOLS COLLAPSIBLE VIEW (No School Filter Selected)      */
              /* ============================================================ */
              <div className="space-y-3 animate-fade-in">
                {/* Control bar for Expand / Collapse All Schools */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs shadow-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <Building2 size={16} className="text-blue-400" />
                    <span>Schools Submission & Compliance Directory</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 text-[10px] font-extrabold border border-blue-400/30">
                      {schoolGroups.length} Schools Listed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedSchools(new Set(schoolGroups.map(s => s.school.id)))}
                      className="text-[11px] font-bold text-blue-300 hover:text-white hover:underline cursor-pointer"
                    >
                      Expand All Schools
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => setExpandedSchools(new Set())}
                      className="text-[11px] font-bold text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                    >
                      Collapse All Schools
                    </button>
                  </div>
                </div>

                {/* School Accordion Cards */}
                {schoolGroups.map(sGroup => {
                  const isExpanded = expandedSchools.has(sGroup.school.id)
                  const toggleExpand = () => {
                    setExpandedSchools(prev => {
                      const next = new Set(prev)
                      if (next.has(sGroup.school.id)) {
                        next.delete(sGroup.school.id)
                      } else {
                        next.add(sGroup.school.id)
                      }
                      return next
                    })
                  }

                  return (
                    <div
                      key={sGroup.school.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs transition-all hover:border-slate-300"
                    >
                      {/* School Accordion Header */}
                      <div
                        onClick={toggleExpand}
                        className={`px-5 py-4 flex items-center justify-between cursor-pointer select-none transition-colors ${
                          sGroup.status === 'complete'
                            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500'
                            : sGroup.status === 'partial'
                            ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                            : 'bg-red-50/30 hover:bg-red-50/60 border-l-4 border-l-red-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 transition-transform ${
                              isExpanded ? 'rotate-180 bg-slate-200/80' : 'bg-slate-100'
                            }`}
                          >
                            <ChevronDown size={18} />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <Building2 size={16} className="text-slate-500 shrink-0" />
                              <a
                                href={`/school-submissions?id=${sGroup.school.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-base font-extrabold text-slate-900 hover:text-[#8B72F4] transition-colors inline-flex items-center gap-1 group"
                                title={`Click to view all data linked to ${sGroup.school.name} in a new tab`}
                              >
                                <span>{sGroup.school.name}</span>
                                <ExternalLink size={13} className="text-[#8B72F4] opacity-60 group-hover:opacity-100 shrink-0" />
                              </a>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {sGroup.school.school_type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {sGroup.submitted} of {sGroup.total} expected forms submitted ({sGroup.rate}% completed) • {sGroup.gradeGroups.length} Grade Levels
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Compliance Status Badge */}
                          {sGroup.status === 'complete' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              Fully Compliant ({sGroup.submitted}/{sGroup.total})
                            </span>
                          ) : sGroup.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertCircle size={13} className="text-amber-600" />
                              Partial ({sGroup.submitted}/{sGroup.total} Submitted)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                              <AlertCircle size={13} className="text-red-600" />
                              No Submissions (0/{sGroup.total})
                            </span>
                          )}

                          {/* Progress bar pill */}
                          <div className="hidden sm:flex items-center gap-2 w-28 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full transition-all duration-300 ${
                                sGroup.status === 'complete' ? 'bg-emerald-500' : sGroup.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${sGroup.rate}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content: Grade Levels for this School */}
                      {isExpanded && (
                        <div className="border-t border-slate-200 p-4 space-y-4 bg-slate-50/50 animate-fade-in">
                          {sGroup.gradeGroups.map(gGroup => (
                            <div key={gGroup.gradeLevel.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                              {/* Grade Header */}
                              <div className="px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    {gGroup.gradeLevel.name}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-200/70 rounded">
                                    KS {gGroup.gradeLevel.key_stage.toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium text-slate-500">
                                    {gGroup.submitted}/{gGroup.total} Submitted ({gGroup.rate}%)
                                  </span>
                                  {gGroup.status === 'complete' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Complete</span>
                                  ) : gGroup.status === 'partial' ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Partial</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">Missing</span>
                                  )}
                                </div>
                              </div>

                              {/* Learning Area Table */}
                              <div className="overflow-x-auto">
                                <table className="data-table text-xs">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="pl-5">Learning Area / Subject</th>
                                      <th>Status</th>
                                      <th>Assigned Teacher</th>
                                      <th>Reference Number</th>
                                      <th>Date Logged</th>
                                      <th className="text-right pr-5">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {gGroup.items.map(item => (
                                      <tr
                                        key={item.id}
                                        className={item.isSubmitted ? 'hover:bg-slate-50' : 'bg-red-50/10 hover:bg-red-50/30'}
                                      >
                                        <td className="pl-5 font-bold text-slate-900">
                                          <div className="flex items-center gap-2">
                                            <BookOpen size={14} className="text-blue-500 shrink-0" />
                                            <span>{item.learningArea.name}</span>
                                          </div>
                                        </td>
                                        <td>
                                          {item.isSubmitted ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                              <CheckCircle2 size={11} className="text-emerald-600" />
                                              Submitted
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                                              <AlertCircle size={11} className="text-red-600" />
                                              Missing
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          {item.isSubmitted && item.submission ? (
                                            <a
                                              href={`/teacher-submissions?name=${encodeURIComponent(item.submission.teacher_name)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-semibold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                                            >
                                              {item.submission.teacher_name}
                                              <ExternalLink size={11} className="text-blue-500 opacity-60" />
                                            </a>
                                          ) : (
                                            <span className="text-slate-400 italic">No teacher data</span>
                                          )}
                                        </td>
                                        <td>
                                          {item.isSubmitted && item.submission ? (
                                            <span className="font-mono text-[11px] font-bold text-blue-600">
                                              {item.submission.reference_number}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="text-slate-500 text-xs">
                                          {item.isSubmitted && item.submission ? (
                                            format(new Date(item.submission.submitted_at), 'MMM d, yyyy')
                                          ) : (
                                            <span className="text-slate-400">—</span>
                                          )}
                                        </td>
                                        <td className="text-right pr-5">
                                          {item.isSubmitted && item.submission ? (
                                            <Link
                                              to={`/admin/submissions/${item.submission.id}`}
                                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1"
                                            >
                                              Review Form
                                            </Link>
                                          ) : (
                                            <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-2 py-0.5 rounded border border-red-200">
                                              Pending
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {/* Delete Confirmation Modal */}
        <ConfirmationDialog
          isOpen={!!subToDelete}
          title="Delete Submission"
          message={`Are you sure you want to permanently delete submission ${subToDelete?.reference_number}? This action cannot be undone.`}
          confirmLabel="Delete Submission"
          variant="danger"
          onConfirm={handleDeleteSubmission}
          onCancel={() => setSubToDelete(null)}
          isLoading={isDeleting}
        />

        {/* Excel Import Modal */}
        <ImportSubmissionsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            loadSubmissions()
            if (activeTab === 'status') loadStatusData()
          }}
          schools={schools}
          grades={grades}
          learningAreas={learningAreas}
          schoolYears={schoolYears}
          terms={terms}
        />
      </div>
    </AdminLayout>
  )
}

