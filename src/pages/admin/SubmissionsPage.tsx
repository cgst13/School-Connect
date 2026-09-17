import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { ImportSubmissionsModal } from '@/components/admin/ImportSubmissionsModal'
import { EmptyState, TableSkeleton } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import {
  fetchSubmissions, fetchSchools, fetchGradeLevels, fetchLearningAreas,
  fetchSchoolYears, fetchTerms, fetchLearningAreaGrades, deleteSubmission, insertAuditLog
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
  const [statusGradeId, setStatusGradeId] = useState<string>('')
  const [statusLAId, setStatusLAId] = useState<string>('')
  const [statusSearch, setStatusSearch] = useState<string>('')
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'missing' | 'submitted'>('all')
  const [statusSubmissions, setStatusSubmissions] = useState<TermcatSubmission[]>([])
  const [statusLoading, setStatusLoading] = useState<boolean>(false)

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

      const activeSY = sy.find(item => item.is_active)
      if (activeSY) setStatusSY(activeSY.id)

      const defaultTerm = t.find(item => item.is_default || item.is_active)
      if (defaultTerm) setStatusTerm(defaultTerm.id)
    })
  }, [])

  const { admin, getPermittedSchoolIds, getPermittedSchools, hasFullAccess, isSchoolPermitted } = useAuth()
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

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
      search: '', status: '', school_year_id: '', term_id: '', school_id: '',
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
    filters.status, filters.school_year_id, filters.term_id, filters.school_id,
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

      // Applicable grade levels for school type
      const applicableGrades = grades.filter(g => {
        if (!g.is_active) return false
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
  }, [schools, grades, learningAreas, learningAreaGrades, statusSubmissions, statusSchoolId, statusGradeId, statusLAId, statusSearch, complianceFilter])

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
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-1 border border-blue-200">
              <Sparkles size={12} /> Data Collection Management
            </div>
            <h1 className="page-title">Submissions & Monitoring</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Review teacher evaluations and track school submission compliance by grade level and learning area.
            </p>
          </div>

          {/* Navigation Tabs & Import Action */}
          <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
            <button
              onClick={(e) => { captureGenieOrigin(e); setIsImportModalOpen(true) }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all active:animate-button-sparkle"
            >
              <FileSpreadsheet size={16} />
              <span>Import Submission (Excel)</span>
            </button>

            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setActiveTab('submissions')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'submissions'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={16} />
                <span>Submissions List</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                  {total}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'status'
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={16} />
                <span>Status & Compliance</span>
                {summaryStats.missing > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200">
                    {summaryStats.missing} Missing
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: SUBMISSIONS LIST */}
        {activeTab === 'submissions' && (
          <div className="space-y-4 animate-fade-in">
            {/* Search & Filter Toggle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" aria-hidden="true" />
                <input
                  type="search"
                  className="form-input pl-9"
                  placeholder="Search teacher name..."
                  value={filters.search || ''}
                  onChange={e => setFilter('search', e.target.value)}
                  aria-label="Search submissions"
                />
              </div>
              <button
                className={`btn-md btn-secondary relative ${showFilters ? 'bg-deped-blue-light text-deped-blue border-deped-blue/30' : ''}`}
                onClick={() => setShowFilters(v => !v)}
                aria-expanded={showFilters}
                aria-controls="filter-panel"
              >
                <Filter size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-deped-blue text-white text-[10px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {activeFilterCount > 0 && (
                <button className="btn-md btn-ghost text-deped-red" onClick={clearFilters} aria-label="Clear all filters">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div id="filter-panel" className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-slide-up">
                <div>
                  <label className="form-label text-xs">School Year</label>
                  <select className="form-select text-sm" value={filters.school_year_id || ''} onChange={e => setFilter('school_year_id', e.target.value)}>
                    <option value="">All</option>
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Term</label>
                  <select className="form-select text-sm" value={filters.term_id || ''} onChange={e => setFilter('term_id', e.target.value)}>
                    <option value="">All</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">School</label>
                  <select className="form-select text-sm" value={filters.school_id || ''} onChange={e => setFilter('school_id', e.target.value)}>
                    <option value="">All</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">School Type</label>
                  <select className="form-select text-sm" value={filters.school_type || ''} onChange={e => setFilter('school_type', e.target.value)}>
                    <option value="">All</option>
                    <option value="elementary">Elementary</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Grade Level</label>
                  <select className="form-select text-sm" value={filters.grade_level_id || ''} onChange={e => setFilter('grade_level_id', e.target.value)}>
                    <option value="">All</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Learning Area</label>
                  <select className="form-select text-sm" value={filters.learning_area_id || ''} onChange={e => setFilter('learning_area_id', e.target.value)}>
                    <option value="">All</option>
                    {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Key Stage</label>
                  <select className="form-select text-sm" value={filters.key_stage || ''} onChange={e => setFilter('key_stage', e.target.value)}>
                    <option value="">All</option>
                    <option value="ks1">Key Stage 1</option>
                    <option value="ks2">Key Stage 2</option>
                    <option value="ks3">Key Stage 3</option>
                    <option value="ks4">Key Stage 4</option>
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Status</label>
                  <select className="form-select text-sm" value={filters.status || ''} onChange={e => setFilter('status', e.target.value)}>
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
            <div className="card overflow-hidden">
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
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th><button onClick={() => toggleSort('reference_number')} className="flex items-center gap-1 hover:text-content-primary">Ref No. <SortIcon field="reference_number" /></button></th>
                        <th><button onClick={() => toggleSort('teacher_name')} className="flex items-center gap-1 hover:text-content-primary">Teacher <SortIcon field="teacher_name" /></button></th>
                        <th>School</th>
                        <th>Grade</th>
                        <th>Learning Area</th>
                        <th>Term</th>
                        <th>Status</th>
                        <th><button onClick={() => toggleSort('submitted_at')} className="flex items-center gap-1 hover:text-content-primary">Date <SortIcon field="submitted_at" /></button></th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map(sub => (
                        <tr key={sub.id}>
                          <td><span className="font-mono text-xs font-semibold text-deped-blue">{sub.reference_number}</span></td>
                          <td className="font-semibold">
                            <a
                              href={`/teacher-submissions?name=${encodeURIComponent(sub.teacher_name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                              title={`Click to view all public submissions by ${sub.teacher_name} (opens in new tab)`}
                            >
                              {sub.teacher_name}
                              <ExternalLink size={12} className="text-blue-500 opacity-60" />
                            </a>
                          </td>
                          <td className="max-w-[160px]"><span className="truncate block">{sub.school?.name}</span></td>
                          <td>{sub.grade_level?.name}</td>
                          <td>{sub.learning_area?.name}</td>
                          <td>{sub.term?.name}</td>
                          <td><StatusBadge status={sub.status} size="sm" /></td>
                          <td className="text-content-secondary text-xs">{format(new Date(sub.submitted_at), 'MMM d, yyyy')}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to={`/admin/submissions/${sub.id}`}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 transition-colors"
                                title="View Details"
                              >
                                <Eye size={12} /> View
                              </Link>
                              <Link
                                to={`/admin/submissions/${sub.id}/edit`}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 inline-flex items-center gap-1 transition-colors"
                                title="Edit Submission"
                              >
                                <Pencil size={12} /> Edit
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => { captureGenieOrigin(e); setSubToDelete(sub) }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 inline-flex items-center gap-1 transition-colors active:animate-button-sparkle"
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
            <div className="card p-4 sm:p-5 space-y-4 bg-white border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <Calendar size={14} className="text-blue-600" />
                    <span>School Year:</span>
                    <select
                      value={statusSY}
                      onChange={e => setStatusSY(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none"
                    >
                      <option value="">All SY</option>
                      {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <Clock size={14} className="text-amber-600" />
                    <span>Quarter / Term:</span>
                    <select
                      value={statusTerm}
                      onChange={e => setStatusTerm(e.target.value)}
                      className="bg-transparent font-bold text-slate-900 focus:outline-none"
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
                  className="btn-sm btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold self-start md:self-auto"
                >
                  <RefreshCw size={14} className={statusLoading ? 'animate-spin text-blue-600' : ''} />
                  <span>Refresh Status</span>
                </button>
              </div>

              {/* Filters grid for Status Tab */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="form-label text-xs">Search Matrix</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="School, grade, or teacher..."
                      className="form-input text-xs pl-8 py-1.5"
                      value={statusSearch}
                      onChange={e => setStatusSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label text-xs">Filter School</label>
                  <select
                    className="form-select text-xs py-1.5"
                    value={statusSchoolId}
                    onChange={e => setStatusSchoolId(e.target.value)}
                  >
                    <option value="">All Schools ({schools.length})</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Filter Grade Level</label>
                  <select
                    className="form-select text-xs py-1.5"
                    value={statusGradeId}
                    onChange={e => setStatusGradeId(e.target.value)}
                  >
                    <option value="">All Grades ({grades.length})</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Filter Learning Area</label>
                  <select
                    className="form-select text-xs py-1.5"
                    value={statusLAId}
                    onChange={e => setStatusLAId(e.target.value)}
                  >
                    <option value="">All Subjects ({learningAreas.length})</option>
                    {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Compliance Rate Card */}
              <div className="card p-5 border-l-4 border-l-blue-600 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Compliance Rate</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    %
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {summaryStats.rate}%
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${summaryStats.rate}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {summaryStats.submitted} of {summaryStats.total} expected items logged
                </p>
              </div>

              {/* Submitted Card */}
              <div className="card p-5 border-l-4 border-l-emerald-500 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Submitted Data</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 mt-2">
                  {summaryStats.submitted}
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Valid evaluation forms submitted
                </p>
              </div>

              {/* Missing Submissions Card */}
              <div className="card p-5 border-l-4 border-l-red-500 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Missing Submissions</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <AlertCircle size={18} />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-red-600 mt-2">
                  {summaryStats.missing}
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Pending school grade/subject assignments
                </p>
              </div>

              {/* Fully Compliant Schools Card */}
              <div className="card p-5 border-l-4 border-l-amber-500 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fully Compliant Schools</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Building2 size={18} />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  {summaryStats.fullSchools} / {summaryStats.totalSchools}
                </div>
                <p className="text-[11px] text-slate-500 mt-3">
                  Schools with 100% submission completion
                </p>
              </div>
            </div>

            {/* Compliance Filter Pills */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Filter View:</span>
                <button
                  onClick={() => setComplianceFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    complianceFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Matrix Items ({summaryStats.total})
                </button>
                <button
                  onClick={() => setComplianceFilter('missing')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    complianceFilter === 'missing'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  🔴 Missing Submissions Only ({summaryStats.missing})
                </button>
                <button
                  onClick={() => setComplianceFilter('submitted')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    complianceFilter === 'submitted'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  🟢 Submitted Only ({summaryStats.submitted})
                </button>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Showing {statusMatrix.length} matrix entries
              </span>
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
                    <span>{schools.find(s => s.id === statusSchoolId)?.name} — Grade Level Compliance Breakdown</span>
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
                              <h3 className="text-base font-extrabold text-slate-900">
                                {sGroup.school.name}
                              </h3>
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

