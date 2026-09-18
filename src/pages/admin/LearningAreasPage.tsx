import { useEffect, useState, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { PageHeader } from '@/components/ui/PageHeader'
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
import { formatDetailedError } from '@/utils/formatError'
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
      toast(formatDetailedError(err, { action: 'Failed to load learning areas data from Supabase', table: 'sc_learning_areas' }), 'error')
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
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to save learning area to Supabase', table: 'sc_learning_areas' }), 'error')
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
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to save grade subject assignments to Supabase', table: 'sc_learning_area_grades' }), 'error')
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
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Header Banner */}
        <PageHeader
          badge="Curriculum Master Data"
          title="Learning Areas & Subject Allocation"
          description="Manage master learning areas, configure curriculum designations, and allocate standard subject offerings per grade level."
          actions={
            <button
              onClick={() => setModal({ open: true })}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:animate-button-sparkle"
            >
              <Plus size={16} />
              <span>Add Learning Area</span>
            </button>
          }
        />

        {/* Split Grid: Left Grade Levels Sidebar + Right Main View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 3D Clay Sidebar on the Left */}
          <div className="lg:col-span-4 bg-[#EFE6FA] rounded-[32px] border-2 border-white p-4 shadow-[0_14px_30px_rgba(185,170,210,0.18)] space-y-3 font-sans shrink-0">
            <div className="px-3 py-2 flex items-center justify-between border-b border-purple-200/60">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-[#8B72F4]" />
                <h3 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display">Curriculum Navigation</h3>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1 custom-scrollbar">
              {/* All Master Subjects Option */}
              <button
                onClick={() => setSelectedGradeId('all')}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                  selectedGradeId === 'all'
                    ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white/80 text-[#2D2638] hover:bg-white hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpen size={16} className={selectedGradeId === 'all' ? 'text-white' : 'text-[#8B72F4]'} />
                  <div>
                    <span className="block font-black text-xs font-display">All Master Subjects</span>
                    <span className={`text-[10px] font-medium block ${selectedGradeId === 'all' ? 'text-white/80' : 'text-[#7A7289]'}`}>
                      Full subject catalog ({learningAreas.length})
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  selectedGradeId === 'all' ? 'bg-white/20 text-white' : 'bg-white text-[#8B72F4] border border-white'
                }`}>
                  ALL
                </span>
              </button>

              <div className="pt-2 px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-[#A39BAF] font-display">
                Assign Subjects per Grade
              </div>

              {/* Grade Levels List */}
              {grades.map(g => {
                const isSelected = selectedGradeId === g.id
                const subCount = Object.entries(gradeAssignments).filter(([_, gIds]) => gIds.includes(g.id)).length

                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGradeId(g.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md shadow-indigo-500/20 scale-[1.01]'
                        : 'bg-white/80 text-[#2D2638] hover:bg-white hover:shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="block font-black text-xs font-display truncate">{g.name}</span>
                      <span className={`text-[10px] font-medium block truncate ${isSelected ? 'text-white/80' : 'text-[#7A7289]'}`}>
                        {subCount} allocated subjects
                      </span>
                    </div>

                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#FAF5F0] text-[#8B72F4] border border-white'
                    }`}>
                      KS{g.key_stage.replace('ks', '')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="lg:col-span-8 space-y-4">
            {selectedGradeId === 'all' ? (
              /* MASTER LEARNING AREAS CATALOG VIEW */
              <div className="space-y-4">
                {/* Search & Status Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border-2 border-white shadow-xs">
                  <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search subject name..."
                      className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-purple-100 bg-[#FAF5F0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 font-medium transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <div className="flex items-center gap-1.5 text-xs text-[#7A7289] font-bold">
                      <Filter size={14} />
                      <span>Status:</span>
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="text-xs font-bold py-2 px-3 rounded-xl border border-purple-100 bg-[#FAF5F0] focus:outline-none text-[#2D2638]"
                    >
                      <option value="all">All Statuses ({learningAreas.length})</option>
                      <option value="active">🟢 Active Only ({learningAreas.filter(la => la.is_active).length})</option>
                      <option value="inactive">🔴 Inactive Only ({learningAreas.filter(la => !la.is_active).length})</option>
                    </select>
                  </div>
                </div>

                {/* List of Subjects */}
                <div className="bg-white rounded-[28px] border-2 border-white shadow-xs overflow-hidden">
                  {loading ? (
                    <DepEdSpinner size="lg" label="Loading Learning Areas Master Data..." subtitle="Fetching subject mappings & grade level assignments from Supabase" />
                  ) : filteredLearningAreas.length === 0 ? (
                    <div className="p-8 text-center text-[#7A7289]">
                      <EmptyState
                        title="No learning areas found"
                        description={searchQuery ? `No subjects matching "${searchQuery}".` : 'Get started by creating a learning area.'}
                        icon={<BookOpen size={28} />}
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0E8F5]">
                      {filteredLearningAreas.map(la => {
                        const gids = gradeAssignments[la.id] || []
                        const assignedGrades = grades
                          .filter(g => gids.includes(g.id))
                          .sort((a, b) => a.grade_number - b.grade_number)

                        return (
                          <div
                            key={la.id}
                            className="flex items-center justify-between p-4 sm:p-5 gap-4 hover:bg-[#F6EFFF]/50 transition-colors flex-wrap font-sans"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5">
                                <p className={`text-sm font-black font-display ${la.is_active ? 'text-[#2D2638]' : 'text-[#A39BAF] line-through'}`}>
                                  {la.name}
                                </p>
                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                  la.is_active ? 'bg-[#EDFAF3] text-[#059669] border border-[#A7F3D0]' : 'bg-[#FFE0E6] text-[#E11D48] border border-[#FFCCD4]'
                                }`}>
                                  {la.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                <span className="text-xs text-[#7A7289] font-bold">Assigned Grades:</span>
                                {assignedGrades.length === 0 ? (
                                  <span className="text-xs text-[#E11D48] font-semibold italic">No grades assigned yet</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {assignedGrades.map(g => (
                                      <span key={g.id} className="px-2.5 py-0.5 rounded-full bg-[#F2EEFD] text-[#6D4AE4] text-[11px] font-bold border border-[#E2D5FE]">
                                        {g.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                className="px-3.5 py-1.5 rounded-full bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#2D2638] text-xs font-bold transition-all border border-white shadow-2xs flex items-center gap-1 cursor-pointer"
                                onClick={() => setModal({ open: true, la })}
                              >
                                <Pencil size={13} className="text-[#8B72F4]" />
                                <span>Edit</span>
                              </button>
                              <button
                                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer ${
                                  la.is_active ? 'bg-[#FFE0E6] text-[#E11D48] hover:bg-[#FFCCD4]' : 'bg-[#EDFAF3] text-[#059669] hover:bg-[#A7F3D0]'
                                }`}
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
            ) : (
              /* SPECIFIC GRADE SUBJECT ALLOCATION CHECKLIST VIEW */
              selectedGradeObj && (
                <div className="bg-white rounded-[28px] border-2 border-white p-5 sm:p-6 shadow-[0_12px_30px_rgba(185,170,210,0.14)] space-y-5 font-sans">
                  {/* Selected Grade Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0E8F5] pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#F2EEFD] text-[#6D4AE4] font-black text-sm flex items-center justify-center shrink-0 border border-[#E2D5FE] shadow-2xs font-display">
                        G{selectedGradeObj.grade_number}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-[#2D2638] font-display">
                          {selectedGradeObj.name} Subject Allocation
                        </h3>
                        <p className="text-xs text-[#7A7289] font-medium">
                          School Type: <span className="capitalize font-bold text-[#2D2638]">{selectedGradeObj.school_type}</span> &bull; Key Stage: <span className="uppercase font-bold text-[#8B72F4]">KS{selectedGradeObj.key_stage.replace('ks', '')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <button
                        onClick={selectAllActiveForGrade}
                        className="px-3 py-1.5 rounded-full bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#2D2638] text-xs font-bold transition-all flex items-center gap-1 border border-white cursor-pointer shadow-2xs"
                      >
                        <CheckSquare size={13} className="text-[#8B72F4]" />
                        <span>Select Active</span>
                      </button>
                      <button
                        onClick={clearAllForGrade}
                        className="px-3 py-1.5 rounded-full bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#2D2638] text-xs font-bold transition-all flex items-center gap-1 border border-white cursor-pointer shadow-2xs"
                      >
                        <Square size={13} className="text-[#7A7289]" />
                        <span>Clear All</span>
                      </button>
                      <button
                        onClick={() => setCopyModalOpen(true)}
                        className="px-3 py-1.5 rounded-full bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#2D2638] text-xs font-bold transition-all flex items-center gap-1 border border-white cursor-pointer shadow-2xs"
                      >
                        <Copy size={13} className="text-[#0284C7]" />
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={handleSaveGradeSubjects}
                        disabled={savingGradeSubjects}
                        className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save size={14} />
                        <span>{savingGradeSubjects ? 'Saving...' : 'Save Allocation'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Subjects Selection Checklist */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display">
                      Check subjects taught in {selectedGradeObj.name}: ({selectedSubjectIdsForGrade.length} Selected)
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {learningAreas.map(la => {
                        const isChecked = selectedSubjectIdsForGrade.includes(la.id)

                        return (
                          <div
                            key={la.id}
                            onClick={() => toggleSubjectForGrade(la.id)}
                            className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                              isChecked
                                ? 'bg-[#EDFAF3] border-[#A7F3D0] text-[#059669] font-bold shadow-2xs'
                                : 'bg-[#FAF5F0]/60 border-white text-[#2D2638] hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div
                                className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-black text-xs transition-colors ${
                                  isChecked ? 'bg-[#059669]' : 'bg-[#A39BAF]/40'
                                }`}
                              >
                                {isChecked && <Check size={12} />}
                              </div>
                              <span className="text-xs font-extrabold truncate">{la.name}</span>
                            </div>

                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                la.is_active ? 'bg-white text-[#059669] shadow-2xs' : 'bg-[#FFE0E6] text-[#E11D48]'
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
              )
            )}
          </div>
        </div>
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

