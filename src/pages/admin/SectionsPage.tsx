import { useEffect, useState, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { academicMasterDataNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  fetchSections,
  fetchSchools,
  fetchGradeLevels,
  fetchAllAdmins,
  upsertSection,
  deleteSection,
  insertAuditLog,
} from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
import type { Section, School, GradeLevel, AdminProfile } from '@/types'
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Building2,
  GraduationCap,
  Layers,
  User,
  Sparkles,
  X,
  Zap,
  Bookmark
} from 'lucide-react'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'

export function SectionsPage() {
  const { admin } = useAuth()
  const { toast } = useToast()

  const [sections, setSections] = useState<Section[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [teachers, setTeachers] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('all')
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const {
    shouldRender: shouldRenderModal,
    triggerClose: closeModal,
    containerClass: modalContainerClass,
    backdropClass: modalBackdropClass
  } = useGenieModal(isModalOpen, () => setIsModalOpen(false))

  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [formName, setFormName] = useState('')
  const [formSchoolId, setFormSchoolId] = useState('')
  const [formGradeId, setFormGradeId] = useState('')
  const [formTrackStrand, setFormTrackStrand] = useState('')
  const [formAdviserName, setFormAdviserName] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)

  // Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchSchoolId, setBatchSchoolId] = useState('')
  const [batchGradeId, setBatchGradeId] = useState('')
  const [batchCount, setBatchCount] = useState<number>(3)
  const [batchPrefix, setBatchPrefix] = useState('Section')
  const [batchSaving, setBatchSaving] = useState(false)

  // Delete Section State
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [secList, schList, gList, sList] = await Promise.all([
        fetchSections(),
        fetchSchools(true),
        fetchGradeLevels(),
        fetchAllAdmins(),
      ])

      setSections(secList)
      setSchools(schList)
      setGrades(gList)
      setTeachers(sList.filter(s => s.role === 'teacher' && s.is_active !== false))

      if (schList.length > 0 && !formSchoolId) setFormSchoolId(schList[0].id)
      if (gList.length > 0 && !formGradeId) setFormGradeId(gList[0].id)
    } catch (err) {
      console.error('Failed to load sections data:', err)
      toast(formatDetailedError(err, { action: 'Failed to load school sections data', table: 'sc_sections' }), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'School Sections & Class Governance | School Connect'
    loadData()
  }, [])

  // Helper to narrow down offered grade levels based on selected school
  const getOfferedGradesForSchool = (schoolId: string) => {
    const sch = schools.find(s => s.id === schoolId)
    if (!sch) return grades

    if (sch.offered_grade_numbers && sch.offered_grade_numbers.length > 0) {
      return grades.filter(g => sch.offered_grade_numbers!.includes(g.grade_number))
    }
    if (sch.school_type === 'elementary') {
      return grades.filter(g => g.grade_number >= 1 && g.grade_number <= 6)
    }
    if (sch.school_type === 'secondary') {
      return grades.filter(g => g.grade_number >= 7 && g.grade_number <= 12)
    }
    return grades
  }

  // Narrowed grades for Add/Edit Section Modal
  const offeredGradesForModal = useMemo(() => {
    return getOfferedGradesForSchool(formSchoolId)
  }, [formSchoolId, schools, grades])

  // Automatically update formGradeId if current selection is not in narrowed offeredGradesForModal
  useEffect(() => {
    if (formSchoolId && offeredGradesForModal.length > 0) {
      if (!offeredGradesForModal.some(g => g.id === formGradeId)) {
        setFormGradeId(offeredGradesForModal[0].id)
      }
    }
  }, [formSchoolId, offeredGradesForModal])

  // Narrowed teachers for Add/Edit Section Modal (teachers assigned to selected school)
  const availableTeachersForModal = useMemo(() => {
    if (!formSchoolId) return teachers
    const schoolTeachers = teachers.filter(t => t.assigned_school_ids?.includes(formSchoolId))
    if (schoolTeachers.length === 0) return teachers // fallback if no specific teacher assigned to school
    return schoolTeachers
  }, [formSchoolId, teachers])

  // Narrowed grades for Batch Add Modal
  const offeredGradesForBatch = useMemo(() => {
    return getOfferedGradesForSchool(batchSchoolId)
  }, [batchSchoolId, schools, grades])

  useEffect(() => {
    if (batchSchoolId && offeredGradesForBatch.length > 0) {
      if (!offeredGradesForBatch.some(g => g.id === batchGradeId)) {
        setBatchGradeId(offeredGradesForBatch[0].id)
      }
    }
  }, [batchSchoolId, offeredGradesForBatch])

  // Narrowed grades for Main Page Filters toolbar
  const offeredGradesForFilter = useMemo(() => {
    if (selectedSchoolFilter === 'all') return grades
    return getOfferedGradesForSchool(selectedSchoolFilter)
  }, [selectedSchoolFilter, schools, grades])

  useEffect(() => {
    if (selectedSchoolFilter !== 'all' && selectedGradeFilter !== 'all') {
      if (!offeredGradesForFilter.some(g => g.id === selectedGradeFilter)) {
        setSelectedGradeFilter('all')
      }
    }
  }, [selectedSchoolFilter, offeredGradesForFilter])

  // Open modal for new section
  const handleOpenAdd = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    const initialSchoolId = schools[0]?.id || ''
    const initialOfferedGrades = getOfferedGradesForSchool(initialSchoolId)
    setEditingSection(null)
    setFormName('')
    setFormSchoolId(initialSchoolId)
    setFormGradeId(initialOfferedGrades[0]?.id || '')
    setFormTrackStrand('')
    setFormAdviserName('')
    setFormIsActive(true)
    setIsModalOpen(true)
  }

  // Open modal for editing section
  const handleOpenEdit = (sec: Section, e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingSection(sec)
    setFormName(sec.name)
    setFormSchoolId(sec.school_id)
    setFormGradeId(sec.grade_level_id)
    setFormTrackStrand(sec.track_strand || '')
    setFormAdviserName(sec.adviser_name || '')
    setFormIsActive(sec.is_active)
    setIsModalOpen(true)
  }

  // Save Section handler
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formSchoolId || !formGradeId) {
      toast('Please fill out Section Name, School, and Grade Level.', 'warning')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Section> = {
        id: editingSection?.id,
        name: formName.trim(),
        school_id: formSchoolId,
        grade_level_id: formGradeId,
        track_strand: formTrackStrand.trim() || undefined,
        adviser_name: formAdviserName.trim() || undefined,
        is_active: formIsActive,
      }

      const saved = await upsertSection(payload)

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: editingSection ? 'edit_school_section' : 'add_school_section',
        entity_label: saved.name,
      })

      toast(editingSection ? 'Class section updated.' : 'New class section created.', 'success')
      closeModal()
      loadData()
    } catch (err) {
      console.error('Failed to save section:', err)
      toast('Error saving class section.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Batch Add Sections handler
  const handleSaveBatchSections = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchSchoolId || !batchGradeId || batchCount <= 0) {
      toast('Please select school, grade, and valid count.', 'warning')
      return
    }

    setBatchSaving(true)
    try {
      const newSections: Partial<Section>[] = []
      for (let i = 1; i <= batchCount; i++) {
        newSections.push({
          name: `${batchPrefix.trim() || 'Section'} ${i}`,
          school_id: batchSchoolId,
          grade_level_id: batchGradeId,
          is_active: true,
        })
      }

      await Promise.all(newSections.map(s => upsertSection(s)))

      const targetSch = schools.find(s => s.id === batchSchoolId)
      const targetG = grades.find(g => g.id === batchGradeId)

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: 'batch_add_school_sections',
        entity_label: `${batchCount} sections for ${targetSch?.name || ''} (${targetG?.name || ''})`,
      })

      toast(`Successfully created ${batchCount} class sections!`, 'success')
      setIsBatchModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Failed batch section creation:', err)
      toast('Failed to batch create sections.', 'error')
    } finally {
      setBatchSaving(false)
    }
  }

  // Delete section handler
  const handleDeleteSection = async () => {
    if (!sectionToDelete) return
    setDeleting(true)
    try {
      await deleteSection(sectionToDelete.id)

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: 'delete_school_section',
        entity_label: sectionToDelete.name,
      })

      toast(`Deleted section ${sectionToDelete.name}.`, 'success')
      setSectionToDelete(null)
      loadData()
    } catch (err) {
      console.error('Failed to delete section:', err)
      toast('Error deleting class section.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Filtered Sections List
  const filteredSections = useMemo(() => {
    return sections.filter(sec => {
      if (selectedSchoolFilter !== 'all' && sec.school_id !== selectedSchoolFilter) return false
      if (selectedGradeFilter !== 'all' && sec.grade_level_id !== selectedGradeFilter) return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = sec.name.toLowerCase().includes(query)
        const matchesAdviser = sec.adviser_name?.toLowerCase().includes(query) || false
        const matchesStrand = sec.track_strand?.toLowerCase().includes(query) || false
        const schObj = schools.find(s => s.id === sec.school_id)
        const gObj = grades.find(g => g.id === sec.grade_level_id)
        const matchesSchool = schObj?.name.toLowerCase().includes(query) || false
        const matchesGrade = gObj?.name.toLowerCase().includes(query) || false

        if (!matchesName && !matchesAdviser && !matchesStrand && !matchesSchool && !matchesGrade) return false
      }

      return true
    })
  }, [sections, selectedSchoolFilter, selectedGradeFilter, searchQuery, schools, grades])

  // Summary counts
  const activeCount = sections.filter(s => s.is_active).length
  const esSectionCount = useMemo(() => {
    const elemGradeIds = grades.filter(g => g.school_type === 'elementary').map(g => g.id)
    return sections.filter(s => elemGradeIds.includes(s.grade_level_id)).length
  }, [sections, grades])
  const hsSectionCount = sections.length - esSectionCount

  const selectedGradeObjForForm = grades.find(g => g.id === formGradeId)
  const isSHSForm = selectedGradeObjForForm && selectedGradeObjForForm.grade_number >= 11

  return (
    <SchoolConnectLayout systemTitle="School & Class Sections Master Data" navGroups={academicMasterDataNavGroups}>
      <div className="space-y-5 w-full pb-12 animate-fade-in">
        {/* Header Banner */}
        <PageHeader
          badge="Academic Structure & Master Data"
          title="School Sections & Class Management"
          description="Configure class sections, advisers, and track/strand specializations across schools and grade levels."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBatchSchoolId(schools[0]?.id || '')
                  setBatchGradeId(grades[0]?.id || '')
                  setIsBatchModalOpen(true)
                }}
                className="btn btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
              >
                <Zap size={14} className="text-[#2563EB]" />
                <span>Batch Add Sections</span>
              </button>
              <button
                onClick={(e) => handleOpenAdd(e)}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Add Class Section</span>
              </button>
            </div>
          }
        />

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Sections</span>
              <p className="text-base font-bold text-slate-900">{sections.length}</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active Sections</span>
              <p className="text-base font-bold text-slate-900">{activeCount}</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Elementary (ES)</span>
              <p className="text-base font-bold text-slate-900">{esSectionCount}</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
              <GraduationCap size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">High School (HS)</span>
              <p className="text-base font-bold text-slate-900">{hsSectionCount}</p>
            </div>
          </div>
        </div>

        {/* Filters & Control Bar */}
        <div className="card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search section name, adviser, strand..."
              className="form-input pl-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
            <select
              value={selectedSchoolFilter}
              onChange={e => setSelectedSchoolFilter(e.target.value)}
              className="form-select py-1.5 w-auto"
            >
              <option value="all">All Schools ({schools.length})</option>
              {schools.map(sch => (
                <option key={sch.id} value={sch.id}>{sch.name}</option>
              ))}
            </select>

            <select
              value={selectedGradeFilter}
              onChange={e => setSelectedGradeFilter(e.target.value)}
              className="form-select py-1.5 w-auto"
            >
              <option value="all">All Grade Levels ({offeredGradesForFilter.length})</option>
              {offeredGradesForFilter.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table / List */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12">
              <DepEdSpinner size="lg" label="Loading Class Sections..." subtitle="Fetching sections and school grade assignments from Supabase" />
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <EmptyState
                title="No class sections found"
                description={searchQuery ? `No sections matching "${searchQuery}".` : 'Get started by creating class sections for your schools.'}
                icon={<Bookmark size={32} className="text-[#2563EB]" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Section Name</th>
                    <th>School & Type</th>
                    <th>Grade Level</th>
                    <th>Track / Strand</th>
                    <th>Class Adviser</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSections.map(sec => {
                    const schObj = schools.find(s => s.id === sec.school_id)
                    const gObj = grades.find(g => g.id === sec.grade_level_id)

                    return (
                      <tr key={sec.id}>
                        <td>
                          <div className="font-semibold text-slate-900">{sec.name}</div>
                        </td>
                        <td>
                          <span className="text-xs font-medium text-slate-700">{schObj?.name || 'N/A'}</span>
                        </td>
                        <td>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-200">
                            {gObj?.name || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-normal text-slate-500">{sec.track_strand || 'General Academic'}</span>
                        </td>
                        <td>
                          <span className="text-xs font-medium text-slate-800">{sec.adviser_name || 'Unassigned'}</span>
                        </td>
                        <td>
                          {sec.is_active ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleOpenEdit(sec, e)}
                              className="btn btn-secondary btn-sm px-2 py-1"
                              title="Edit Section"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setSectionToDelete(sec)}
                              className="btn btn-danger btn-sm p-1"
                              title="Delete Section"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Section Modal */}
      {shouldRenderModal && (
        <div className={`fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto ${modalBackdropClass}`}>
          <div className={`bg-[#FAF5F0] rounded-[36px] max-w-lg w-full shadow-[0_25px_60px_rgba(139,114,244,0.3)] overflow-hidden border-4 border-white ${modalContainerClass}`}>
            <div className="px-6 py-4 bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-amber-300">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight font-display">{editingSection ? 'Edit Class Section' : 'Add Class Section'}</h2>
                  <p className="text-[11px] text-white/80 font-medium">Configure section details & class adviser</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1 font-display">Assigned School *</label>
                <select
                  required
                  value={formSchoolId}
                  onChange={e => setFormSchoolId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                >
                  {schools.map(sch => (
                    <option key={sch.id} value={sch.id}>{sch.name} ({sch.school_type.toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1 font-display">
                  Grade Level * ({offeredGradesForModal.length} Available)
                </label>
                <select
                  required
                  value={formGradeId}
                  onChange={e => setFormGradeId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                >
                  {offeredGradesForModal.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.school_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1 font-display">Section Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sampaguita, Section A, Einstein"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] font-semibold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                />
              </div>

              {isSHSForm && (
                <div>
                  <label className="block text-xs font-black text-[#2D2638] mb-1 font-display">Track / Strand Specialization (SHS)</label>
                  <input
                    type="text"
                    placeholder="e.g. STEM, HUMSS, ABM, TVL-ICT"
                    value={formTrackStrand}
                    onChange={e => setFormTrackStrand(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] font-semibold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1 font-display">
                  Class Adviser Teacher (Optional - {availableTeachersForModal.length} Faculty Available at School)
                </label>
                <select
                  value={formAdviserName}
                  onChange={e => setFormAdviserName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                >
                  <option value="">-- No Class Adviser --</option>
                  {availableTeachersForModal.map(t => {
                    const isGradeAssigned = formGradeId && t.assigned_grade_ids?.includes(formGradeId)
                    return (
                      <option key={t.id} value={t.full_name}>
                        {t.full_name} {isGradeAssigned ? '★ (Teaches Grade)' : ''} ({t.email})
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="sec-active"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="rounded text-[#8B72F4] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="sec-active" className="text-xs font-bold text-[#2D2638] cursor-pointer">
                  Active Section Status
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F0E6DD]">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-full bg-white text-[#7A7289] font-black text-xs border border-white hover:bg-[#F6EFFF] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black text-xs shadow-md cursor-pointer hover:brightness-105"
                >
                  {saving ? 'Saving...' : (editingSection ? 'Update Section' : 'Save Section')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FAF5F0] rounded-[36px] max-w-md w-full shadow-2xl overflow-hidden border-4 border-white animate-fade-in">
            <div className="px-6 py-4 bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-300" />
                <h3 className="text-base font-black font-display">Batch Add Class Sections</h3>
              </div>
              <button onClick={() => setIsBatchModalOpen(false)} className="p-1 rounded-full text-white/80 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBatchSections} className="p-6 space-y-4 font-sans">
              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1">Target School *</label>
                <select
                  value={batchSchoolId}
                  onChange={e => setBatchSchoolId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-bold"
                >
                  {schools.map(sch => (
                    <option key={sch.id} value={sch.id}>{sch.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1">
                  Target Grade Level * ({offeredGradesForBatch.length} Available)
                </label>
                <select
                  value={batchGradeId}
                  onChange={e => setBatchGradeId(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-bold"
                >
                  {offeredGradesForBatch.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1">Section Naming Prefix</label>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={e => setBatchPrefix(e.target.value)}
                  placeholder="e.g. Section"
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1">Number of Sections to Create</label>
                <select
                  value={batchCount}
                  onChange={e => setBatchCount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-bold"
                >
                  {[2, 3, 4, 5, 6, 8, 10].map(num => (
                    <option key={num} value={num}>{num} Sections ({batchPrefix} 1 to {batchPrefix} {num})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F0E6DD]">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-white text-[#7A7289] font-black text-xs border border-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSaving}
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-black text-xs shadow-md cursor-pointer"
                >
                  {batchSaving ? 'Generating...' : `Create ${batchCount} Sections`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!sectionToDelete}
        title="Delete Class Section"
        message={`Are you sure you want to delete class section "${sectionToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Section"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDeleteSection}
        onCancel={() => setSectionToDelete(null)}
      />
    </SchoolConnectLayout>
  )
}
