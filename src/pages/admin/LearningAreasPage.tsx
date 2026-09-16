import { useEffect, useState, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import {
  fetchLearningAreas,
  fetchGradeLevels,
  fetchLearningAreaGrades,
  upsertLearningArea,
  setLearningAreaGrades,
  setGradeLearningAreas,
  insertAuditLog,
} from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { LearningArea, GradeLevel } from '@/types'
import {
  Plus,
  Pencil,
  BookOpen,
  X,
  Search,
  Filter,
  GraduationCap,
  Save,
  Copy,
  Check,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  ListFilter
} from 'lucide-react'

// Modal for Adding / Editing a single Learning Area
interface LAModalProps {
  la?: LearningArea & { gradeIds?: string[] }
  grades: GradeLevel[]
  onSave: (data: Partial<LearningArea>, gradeIds: string[]) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function LAModal({ la, grades, onSave, onClose, isLoading }: LAModalProps) {
  const [name, setName] = useState(la?.name || '')
  const [active, setActive] = useState(la?.is_active ?? true)
  const [selectedGrades, setSelectedGrades] = useState<string[]>(la?.gradeIds || [])
  const [error, setError] = useState('')

  const toggleGrade = (id: string) => {
    setSelectedGrades(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]))
  }

  const selectAllType = (type: 'elementary' | 'secondary') => {
    const targetIds = grades.filter(g => g.school_type === type).map(g => g.id)
    const allSelected = targetIds.every(id => selectedGrades.includes(id))

    if (allSelected) {
      setSelectedGrades(prev => prev.filter(id => !targetIds.includes(id)))
    } else {
      setSelectedGrades(prev => Array.from(new Set([...prev, ...targetIds])))
    }
  }

  const handleSave = async () => {
    if (name.trim().length < 1) {
      setError('Subject name is required.')
      return
    }
    await onSave({ id: la?.id, name: name.trim(), is_active: active }, selectedGrades)
  }

  const elementary = grades.filter(g => g.school_type === 'elementary')
  const secondary = grades.filter(g => g.school_type === 'secondary')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-md w-full max-w-lg p-6 space-y-5 animate-slide-up my-auto bg-white shadow-xl rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-deped-blue font-bold">
            <BookOpen size={20} />
            <h2 className="text-base font-bold text-slate-900">
              {la ? 'Edit Learning Area' : 'Add New Learning Area'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost btn-xs text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="form-label text-xs font-semibold text-slate-700" htmlFor="la-name">
              Learning Area / Subject Name *
            </label>
            <input
              id="la-name"
              className="form-input text-sm"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Mathematics, Mother Tongue, Filipino"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="la-active"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="w-4 h-4 text-deped-blue rounded border-slate-300 focus:ring-deped-blue"
            />
            <label htmlFor="la-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active Status (Available for teacher forms)
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="form-label text-xs font-semibold text-slate-700 mb-0">
                Assign to Grade Levels
              </label>
              <span className="text-[11px] text-slate-400">Optional during creation</span>
            </div>

            {/* Elementary Grades */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Elementary (Grades 1–6)</span>
                <button
                  type="button"
                  onClick={() => selectAllType('elementary')}
                  className="text-[11px] font-bold text-deped-blue hover:underline"
                >
                  {elementary.every(g => selectedGrades.includes(g.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {elementary.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGrade(g.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      selectedGrades.includes(g.id)
                        ? 'bg-deped-blue text-white border-deped-blue shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-deped-blue'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Grades */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Secondary (Grades 7–12)</span>
                <button
                  type="button"
                  onClick={() => selectAllType('secondary')}
                  className="text-[11px] font-bold text-deped-blue hover:underline"
                >
                  {secondary.every(g => selectedGrades.includes(g.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {secondary.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGrade(g.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      selectedGrades.includes(g.id)
                        ? 'bg-deped-blue text-white border-deped-blue shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-deped-blue'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button className="btn-md btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button className="btn-md btn-primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Learning Area'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LearningAreasPage() {
  const { admin } = useAuth()
  const { toast } = useToast()

  // Active Tab: 'master' | 'per-grade'
  const [activeTab, setActiveTab] = useState<'master' | 'per-grade'>('master')

  // Master Data
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [gradeAssignments, setGradeAssignments] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  // Master Tab State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [modal, setModal] = useState<{ open: boolean; la?: LearningArea }>({ open: false })
  const [saving, setSaving] = useState(false)

  // Per Grade Tab State
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSubjectIdsForGrade, setSelectedSubjectIdsForGrade] = useState<string[]>([])
  const [savingGradeSubjects, setSavingGradeSubjects] = useState(false)

  // Copy modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [targetGradeIdsToCopy, setTargetGradeIdsToCopy] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [las, gs, gradeAssignmentsData] = await Promise.all([
        fetchLearningAreas(false),
        fetchGradeLevels(),
        fetchLearningAreaGrades(),
      ])

      setLearningAreas(las)
      setGrades(gs)

      // Map: learning_area_id -> grade_level_id[]
      const assignments: Record<string, string[]> = {}
      for (const row of gradeAssignmentsData) {
        if (!assignments[row.learning_area_id]) assignments[row.learning_area_id] = []
        assignments[row.learning_area_id].push(row.grade_level_id)
      }
      setGradeAssignments(assignments)

      if (gs.length > 0 && !selectedGradeId) {
        setSelectedGradeId(gs[0].id)
      }
    } catch (err) {
      console.error('Error loading learning areas:', err)
      toast('Failed to load learning areas data.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Sync selected grade subjects when selectedGradeId or gradeAssignments change
  useEffect(() => {
    if (!selectedGradeId) return

    // Find all learningAreaIds assigned to selectedGradeId
    const assignedLaIds: string[] = []
    Object.entries(gradeAssignments).forEach(([laId, gIds]) => {
      if (gIds.includes(selectedGradeId)) {
        assignedLaIds.push(laId)
      }
    })
    setSelectedSubjectIdsForGrade(assignedLaIds)
  }, [selectedGradeId, gradeAssignments])

  // Filtered Learning Areas for Master Tab
  const filteredLearningAreas = useMemo(() => {
    return learningAreas.filter(la => {
      const matchesSearch = la.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      if (!matchesSearch) return false

      if (statusFilter === 'active') return la.is_active
      if (statusFilter === 'inactive') return !la.is_active

      return true
    })
  }, [learningAreas, searchQuery, statusFilter])

  // Save single Learning Area from modal
  const handleSaveLearningArea = async (data: Partial<LearningArea>, gradeIds: string[]) => {
    setSaving(true)
    try {
      const saved = await upsertLearningArea(data)
      await setLearningAreaGrades(saved.id, gradeIds)
      await insertAuditLog({
        admin_id: admin!.id,
        admin_name: admin!.full_name,
        action: data.id ? 'edit_learning_area' : 'add_learning_area',
        entity_label: data.name,
      })
      toast(data.id ? 'Learning area updated.' : 'Learning area added.', 'success')
      setModal({ open: false })
      load()
    } catch {
      toast('Failed to save learning area.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle single Learning Area Active / Inactive
  const handleToggleActive = async (la: LearningArea) => {
    const gradeIds = gradeAssignments[la.id] || []
    await handleSaveLearningArea({ ...la, is_active: !la.is_active }, gradeIds)
  }

  // Save Subjects assigned to a specific Grade Level
  const handleSaveGradeSubjects = async () => {
    if (!selectedGradeId) return
    setSavingGradeSubjects(true)
    try {
      await setGradeLearningAreas(selectedGradeId, selectedSubjectIdsForGrade)

      const gObj = grades.find(g => g.id === selectedGradeId)
      await insertAuditLog({
        admin_id: admin!.id,
        admin_name: admin!.full_name,
        action: 'assign_grade_learning_areas',
        entity_label: gObj?.name || selectedGradeId,
      })

      toast(`Assigned subjects saved for ${gObj?.name || 'Grade Level'}.`, 'success')
      load()
    } catch (err) {
      console.error(err)
      toast('Failed to save grade subject assignments.', 'error')
    } finally {
      setSavingGradeSubjects(false)
    }
  }

  // Batch toggle subject for current selected grade
  const toggleSubjectForGrade = (laId: string) => {
    setSelectedSubjectIdsForGrade(prev =>
      prev.includes(laId) ? prev.filter(id => id !== laId) : [...prev, laId]
    )
  }

  const selectAllActiveForGrade = () => {
    const activeIds = learningAreas.filter(la => la.is_active).map(la => la.id)
    setSelectedSubjectIdsForGrade(activeIds)
  }

  const clearAllForGrade = () => {
    setSelectedSubjectIdsForGrade([])
  }

  // Copy current selected grade subjects to other grades
  const handleCopyGradeSubjects = async () => {
    if (!selectedGradeId || targetGradeIdsToCopy.length === 0) return
    setSavingGradeSubjects(true)
    try {
      await Promise.all(
        targetGradeIdsToCopy.map(gId => setGradeLearningAreas(gId, selectedSubjectIdsForGrade))
      )
      toast(`Copied subject configuration to ${targetGradeIdsToCopy.length} grade levels.`, 'success')
      setCopyModalOpen(false)
      setTargetGradeIdsToCopy([])
      load()
    } catch (err) {
      console.error(err)
      toast('Failed to copy subject assignments.', 'error')
    } finally {
      setSavingGradeSubjects(false)
    }
  }

  const selectedGradeObj = grades.find(g => g.id === selectedGradeId)

  return (
    <SchoolConnectLayout systemTitle="Learning Areas Master Data">
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <BookOpen size={24} className="text-deped-blue" />
              Learning Areas & Subject Allocation
            </h1>
            <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
              Manage master learning areas and configure standard subject assignments per grade level across the district.
            </p>
          </div>

          <button className="btn-md btn-primary shadow-sm" onClick={() => setModal({ open: true })}>
            <Plus size={16} /> Add Learning Area
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2">
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'master'
                ? 'border-deped-blue text-deped-blue bg-deped-blue-light/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            <span>1. Master Learning Areas</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {learningAreas.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('per-grade')}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs sm:text-sm border-b-2 transition-all ${
              activeTab === 'per-grade'
                ? 'border-deped-blue text-deped-blue bg-deped-blue-light/30'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GraduationCap size={16} />
            <span>2. Assign Subjects per Grade</span>
          </button>
        </div>

        {/* TAB 1: MASTER LEARNING AREAS */}
        {activeTab === 'master' && (
          <div className="space-y-4">
            {/* Search & Status Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search subject name..."
                  className="input-sm pl-9 w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter size={14} />
                  <span>Status:</span>
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="input-sm text-xs font-medium border-slate-300"
                >
                  <option value="all">All Statuses ({learningAreas.length})</option>
                  <option value="active">🟢 Active Only ({learningAreas.filter(la => la.is_active).length})</option>
                  <option value="inactive">🔴 Inactive Only ({learningAreas.filter(la => !la.is_active).length})</option>
                </select>
              </div>
            </div>

            {/* List / Table */}
            <div className="card overflow-hidden bg-white border border-slate-200 shadow-xs">
              {loading ? (
                <DepEdSpinner size="lg" label="Loading Learning Areas Master Data..." subtitle="Fetching subject mappings & grade level assignments from Supabase" />
              ) : filteredLearningAreas.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <EmptyState
                    title="No learning areas found"
                    description={searchQuery ? `No subjects matching "${searchQuery}".` : 'Get started by creating a learning area.'}
                    icon={<BookOpen size={28} />}
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredLearningAreas.map(la => {
                    const gids = gradeAssignments[la.id] || []
                    const assignedGrades = grades
                      .filter(g => gids.includes(g.id))
                      .sort((a, b) => a.grade_number - b.grade_number)

                    return (
                      <div
                        key={la.id}
                        className="flex items-center justify-between p-4 gap-4 hover:bg-slate-50/80 transition-colors flex-wrap"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <p
                              className={`text-sm font-bold ${
                                la.is_active ? 'text-slate-900' : 'text-slate-400 line-through'
                              }`}
                            >
                              {la.name}
                            </p>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                la.is_active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {la.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-xs text-slate-500 font-semibold">Assigned Grades:</span>
                            {assignedGrades.length === 0 ? (
                              <span className="text-xs text-rose-600 font-medium italic">No grades assigned yet</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignedGrades.map(g => (
                                  <span
                                    key={g.id}
                                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200"
                                  >
                                    {g.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            className="btn-sm btn-secondary flex items-center gap-1 text-xs font-semibold"
                            onClick={() => setModal({ open: true, la })}
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            className={`btn-sm ${la.is_active ? 'btn-danger' : 'btn-success'} text-xs font-semibold`}
                            onClick={() => handleToggleActive(la)}
                          >
                            {la.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ASSIGN SUBJECTS PER GRADE */}
        {activeTab === 'per-grade' && (
          <div className="space-y-6">
            <div className="card p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-deped-blue-dark text-white space-y-2 shadow-md">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={16} /> District Standard Curricular Allocation
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold">Grade Level Subject Assignment</h2>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed max-w-2xl">
                Configure standard learning areas for each Grade Level across all district schools. Changes made here apply automatically to teacher submission forms.
              </p>
            </div>

            {/* Grade Level Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <GraduationCap size={16} className="text-deped-blue" />
                Select Grade Level to Configure:
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {grades.map(g => {
                  const isSelected = g.id === selectedGradeId
                  // Count subjects assigned
                  const subCount = Object.entries(gradeAssignments).filter(([_, gIds]) => gIds.includes(g.id)).length

                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGradeId(g.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-deped-blue text-white border-deped-blue shadow-sm ring-2 ring-deped-blue/30'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {g.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          KS{g.key_stage.replace('ks', '')}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-1 font-medium ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {subCount} Subjects
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Grade Configuration Panel */}
            {selectedGradeObj && (
              <div className="card p-5 bg-white border border-slate-200 space-y-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-deped-blue-light text-deped-blue font-bold text-sm flex items-center justify-center">
                        G{selectedGradeObj.grade_number}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {selectedGradeObj.name} Subjects Allocation
                        </h3>
                        <p className="text-xs text-slate-500">
                          School Type: <span className="capitalize font-semibold">{selectedGradeObj.school_type}</span> • Key Stage: <span className="uppercase font-semibold">{selectedGradeObj.key_stage}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={selectAllActiveForGrade}
                      className="btn-xs btn-secondary text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckSquare size={13} /> Select All Active
                    </button>
                    <button
                      onClick={clearAllForGrade}
                      className="btn-xs btn-secondary text-xs font-semibold flex items-center gap-1"
                    >
                      <Square size={13} /> Clear All
                    </button>
                    <button
                      onClick={() => setCopyModalOpen(true)}
                      className="btn-xs btn-secondary text-xs font-semibold flex items-center gap-1"
                    >
                      <Copy size={13} /> Copy to Other Grades
                    </button>
                    <button
                      onClick={handleSaveGradeSubjects}
                      disabled={savingGradeSubjects}
                      className="btn-sm btn-primary flex items-center gap-1.5 shadow-xs ml-1"
                    >
                      <Save size={14} />
                      <span>{savingGradeSubjects ? 'Saving...' : 'Save Assignments'}</span>
                    </button>
                  </div>
                </div>

                {/* Subjects Selection Grid */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Check subjects taught in {selectedGradeObj.name}: ({selectedSubjectIdsForGrade.length} Selected)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {learningAreas.map(la => {
                      const isChecked = selectedSubjectIdsForGrade.includes(la.id)

                      return (
                        <div
                          key={la.id}
                          onClick={() => toggleSubjectForGrade(la.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isChecked
                              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-bold shadow-xs'
                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div
                              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                                isChecked ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}
                            >
                              {isChecked && <Check size={12} />}
                            </div>
                            <span className="text-xs truncate">{la.name}</span>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              la.is_active ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {la.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Add / Edit Single Learning Area */}
      {modal.open && (
        <LAModal
          la={modal.la ? { ...modal.la, gradeIds: gradeAssignments[modal.la.id] || [] } : undefined}
          grades={grades}
          onSave={handleSaveLearningArea}
          onClose={() => setModal({ open: false })}
          isLoading={saving}
        />
      )}

      {/* MODAL 2: Copy Grade Assignments to Other Grades */}
      {copyModalOpen && selectedGradeObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setCopyModalOpen(false)} />
          <div className="relative card-md w-full max-w-md p-6 space-y-4 bg-white shadow-xl rounded-2xl border border-slate-200 my-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Copy size={16} className="text-deped-blue" />
                Copy Subjects from {selectedGradeObj.name}
              </h3>
              <button onClick={() => setCopyModalOpen(false)} className="btn-ghost btn-xs text-slate-400">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Select target grade levels to receive the exact same {selectedSubjectIdsForGrade.length} subject assignments:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {grades
                .filter(g => g.id !== selectedGradeId)
                .map(g => {
                  const isChecked = targetGradeIdsToCopy.includes(g.id)
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                        isChecked ? 'bg-deped-blue-light/50 border-deped-blue text-deped-blue' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>{g.name} ({g.school_type})</span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setTargetGradeIdsToCopy(prev =>
                            prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                          )
                        }}
                        className="w-4 h-4 text-deped-blue rounded border-slate-300"
                      />
                    </label>
                  )
                })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button className="btn-sm btn-secondary" onClick={() => setCopyModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-sm btn-primary"
                onClick={handleCopyGradeSubjects}
                disabled={targetGradeIdsToCopy.length === 0 || savingGradeSubjects}
              >
                {savingGradeSubjects ? 'Copying...' : `Copy to ${targetGradeIdsToCopy.length} Grades`}
              </button>
            </div>
          </div>
        </div>
      )}
    </SchoolConnectLayout>
  )
}

