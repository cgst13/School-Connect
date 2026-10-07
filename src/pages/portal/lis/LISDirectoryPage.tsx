import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { lisNavGroups } from './lisNavConfig'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  Users,
  UserPlus,
  Search,
  Copy,
  Check,
  Edit2,
  Trash2,
  X,
  Sparkles,
  BookOpen,
  GraduationCap,
  Award,
  UserX,
  FileSpreadsheet,
  Upload,
  Eye,
  Calendar,
  Phone,
  Home,
  ShieldCheck,
  UserCheck,
  MapPin,
  Printer,
  ExternalLink,
  QrCode
} from 'lucide-react'
import {
  fetchLearners,
  upsertLearner,
  deleteLearner,
  fetchSchools,
  fetchGradeLevels,
  fetchSections,
  insertAuditLog,
  upsertSchool,
  upsertSection
} from '@/lib/supabase/queries'
import { parseSF1Excel, calculateAge, type ParsedSF1Result } from '@/utils/sf1Parser'
import { getLearnerDiff, type ImportResultSummary, type DetailedChangeLog } from '@/utils/importReportUtils'
import { useLISRealtimeSync } from '@/hooks/useLISRealtimeSync'
import { ImportResultModal } from '@/components/lis/ImportResultModal'
import { SchoolIDCardModal } from '@/components/lis/SchoolIDCardModal'
import { generateLearnerQRCode } from '@/utils/qrCodeGenerator'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'
import type { Learner, LearnerStatus, LearnerSex, School, GradeLevel, Section } from '@/types'

export function LISDirectoryPage() {
  const navigate = useNavigate()
  const { admin, canEditData, getPermittedSchools } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [learners, setLearners] = useState<Learner[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  // Permitted Schools for current user role scope
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('all')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSex, setSelectedSex] = useState<string>('all')
  const [filter4PsOnly, setFilter4PsOnly] = useState(false)
  const [selectedIDLearner, setSelectedIDLearner] = useState<Learner | null>(null)

  // Auto-select school if user only has 1 assigned school
  useEffect(() => {
    if (permittedSchools.length === 1 && selectedSchoolId === 'all') {
      setSelectedSchoolId(permittedSchools[0].id)
    }
  }, [permittedSchools, selectedSchoolId])

  // Dynamic selected school object
  const selectedSchoolObj = useMemo(
    () => schools.find(s => s.id === selectedSchoolId),
    [schools, selectedSchoolId]
  )


  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // SF1 Import Target School Modal State
  const [importModal, setImportModal] = useState<{
    isOpen: boolean
    file: File | null
    parsed: ParsedSF1Result | null
    targetSchoolId: string
  }>({
    isOpen: false,
    file: null,
    parsed: null,
    targetSchoolId: ''
  })

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingLearner, setEditingLearner] = useState<Learner | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    shouldRender: shouldRenderModal,
    triggerClose: closeModal,
    containerClass: modalContainerClass,
    backdropClass: modalBackdropClass
  } = useGenieModal(isModalOpen, () => {
    setIsModalOpen(false)
    setEditingLearner(null)
  })

  // Learner Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedLearnerDetail, setSelectedLearnerDetail] = useState<Learner | null>(null)

  const {
    shouldRender: shouldRenderDetailsModal,
    triggerClose: closeDetailsModal,
    containerClass: detailsModalContainerClass,
    backdropClass: detailsModalBackdropClass
  } = useGenieModal(isDetailsModalOpen, () => {
    setIsDetailsModalOpen(false)
    setSelectedLearnerDetail(null)
  })

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Form Fields
  const [formData, setFormData] = useState<Partial<Learner>>({
    lrn: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    extension_name: '',
    sex: 'Male',
    birthdate: '2018-05-15',
    mother_tongue: 'Tagalog',
    ip_group: 'N/A',
    religion: 'Roman Catholic',
    address_house_no: '',
    address_street: '',
    address_barangay: 'Poblacion',
    address_city_municipality: 'Concepcion',
    address_province: 'Romblon',
    guardian_name: '',
    guardian_relationship: 'Parent',
    guardian_contact_no: '',
    is_4ps_cct: false,
    is_balik_aral: false,
    is_ecd_alive_sped: false,
    school_id: '',
    grade_level_id: '',
    section_id: '',
    school_year: '2025-2026',
    status: 'enrolled',
    remarks: ''
  })

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const [learnersData, schoolsData, gradesData, sectionsData] = await Promise.all([
        fetchLearners(),
        fetchSchools(true, true),
        fetchGradeLevels(undefined, true),
        fetchSections()
      ])
      setLearners(learnersData)
      setSchools(schoolsData)
      setGradeLevels(gradesData)
      setSections(sectionsData)
    } catch (err) {
      console.error('Failed to load LIS directory data:', err)
      if (showSpinner) toast('Failed to load learner records.', 'error')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  const { isLive } = useLISRealtimeSync({ onUpdate: () => loadData(false) })

  useEffect(() => {
    loadData()
  }, [])

  // Helper to dynamically resolve grade level and section names
  const getGradeNameForLearner = (l: Learner) => {
    if (l.grade_level_name) return l.grade_level_name
    const found = gradeLevels.find(g => g.id === l.grade_level_id)
    return found ? found.name : 'Grade 5'
  }

  const getSectionNameForLearner = (l: Learner) => {
    if (l.section_name) return l.section_name
    const found = sections.find(s => s.id === l.section_id)
    return found ? found.name : 'Maambisyon'
  }

  // File Upload Handler for Official DepEd SF1 Excel (.xls / .xlsx)
  const handleSF1Import = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const parsed = await parseSF1Excel(file)

      if (parsed.learners.length === 0) {
        toast('No learner records found in the uploaded file.', 'warning')
        setImporting(false)
        return
      }

      // Pre-select matching school from user's permitted schools or overall schools list
      let initialSchoolId = ''
      const fileSchoolName = (parsed.metadata.schoolName || '').trim()
      const fileSchoolId = (parsed.metadata.schoolId || '').trim()

      const match = permittedSchools.find(s =>
        (fileSchoolId && ((s as any).school_id === fileSchoolId || s.id === fileSchoolId || s.code === fileSchoolId)) ||
        (fileSchoolName && s.name.toLowerCase() === fileSchoolName.toLowerCase()) ||
        (fileSchoolName && s.name.toLowerCase().includes(fileSchoolName.toLowerCase()))
      )

      if (match) {
        initialSchoolId = match.id
      } else if (fileSchoolName) {
        initialSchoolId = 'create_new'
      } else if (selectedSchoolId !== 'all') {
        initialSchoolId = selectedSchoolId
      } else {
        initialSchoolId = permittedSchools[0]?.id || schools[0]?.id || ''
      }

      setImportModal({
        isOpen: true,
        file,
        parsed,
        targetSchoolId: initialSchoolId
      })
    } catch (err: any) {
      console.error('Failed to import SF1 Excel:', err)
      toast(`Failed to parse SF1 Excel file: ${err?.message || 'Invalid format'}`, 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Import Result Audit Modal State
  const [importSummary, setImportSummary] = useState<ImportResultSummary | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)

  const handleConfirmImportSF1 = async () => {
    if (!importModal.parsed || !importModal.targetSchoolId) {
      toast('Please select a target school for the learners.', 'warning')
      return
    }

    setSaving(true)
    try {
      const parsed = importModal.parsed
      const fileSchoolName = (parsed.metadata.schoolName || '').trim()
      const fileSchoolCode = (parsed.metadata.schoolId || '').trim()
      const fileSchoolYear = (parsed.metadata.schoolYear || '').trim()
      const fileGradeLevel = (parsed.metadata.gradeLevel || '').trim()
      const fileSection = (parsed.metadata.section || '').trim()

      let targetSchoolObj: School | undefined

      if (importModal.targetSchoolId === 'create_new') {
        // Register & Create School from File Header Data
        const newSchoolName = fileSchoolName || 'Imported School'
        targetSchoolObj = await upsertSchool({
          code: fileSchoolCode,
          name: newSchoolName,
          region: parsed.metadata.region || 'MIMAROPA',
          division: parsed.metadata.division || 'Romblon',
          district: parsed.metadata.district || 'Concepcion',
          school_type: fileGradeLevel.toLowerCase().includes('high') || fileGradeLevel.toLowerCase().includes('secondary') ? 'secondary' : 'elementary',
          is_active: true
        })
        toast(`Created and registered school: "${targetSchoolObj.name}" in database.`, 'info')
      } else {
        targetSchoolObj = schools.find(s => s.id === importModal.targetSchoolId)
        if (!targetSchoolObj) {
          toast('Invalid target school selected.', 'error')
          setSaving(false)
          return
        }
        // If target school exists but code is missing and file header has a schoolId, update code
        if (fileSchoolCode && !targetSchoolObj.code) {
          try {
            targetSchoolObj = await upsertSchool({
              ...targetSchoolObj,
              code: fileSchoolCode
            })
          } catch (e) {
            console.warn('Could not update school code:', e)
          }
        }
      }

      // 2. Resolve or Create Grade Level dynamically from File Header
      let targetGradeObj = gradeLevels.find(
        g => fileGradeLevel && g.name.toLowerCase() === fileGradeLevel.toLowerCase()
      )
      if (!targetGradeObj && fileGradeLevel) {
        const numMatch = parseInt(fileGradeLevel.replace(/\D/g, ''), 10)
        if (!isNaN(numMatch)) {
          targetGradeObj = gradeLevels.find(g => g.grade_number === numMatch)
        }
      }

      // 3. Resolve or Create Section dynamically from File Header
      let targetSectionObj = sections.find(
        s => fileSection && s.name.toLowerCase() === fileSection.toLowerCase()
      )
      if (!targetSectionObj && fileSection && targetSchoolObj) {
        try {
          targetSectionObj = await upsertSection({
            name: fileSection,
            school_id: targetSchoolObj.id,
            grade_level_id: targetGradeObj?.id,
            is_active: true
          })
        } catch (err) {
          console.warn('Could not auto-create section record:', err)
        }
      }

      // Final Dynamic Names & Metadata (extracted from file header)
      const finalSchoolName = targetSchoolObj.name || fileSchoolName
      const finalSchoolId = targetSchoolObj.code || fileSchoolCode || targetSchoolObj.id
      const finalGradeLevelName = fileGradeLevel || targetGradeObj?.name || 'Grade 5'
      const finalSectionName = fileSection || targetSectionObj?.name || 'Maambisyon'
      const finalSchoolYear = fileSchoolYear || '2026 - 2027'

      const existingMap = new Map(learners.map(l => [l.lrn, l]))
      let createdCount = 0
      let updatedCount = 0
      let errorCount = 0
      const logs: DetailedChangeLog[] = []

      for (const learnerPayload of parsed.learners) {
        if (!learnerPayload.lrn || !learnerPayload.last_name) {
          errorCount++
          logs.push({
            lrn: learnerPayload.lrn || 'N/A',
            name: `${learnerPayload.last_name || 'Missing Name'}, ${learnerPayload.first_name || ''}`,
            action: 'error',
            changes: [],
            errorReason: 'Invalid LRN format or missing required learner last name'
          })
          continue
        }

        const cleanLRN = learnerPayload.lrn.trim()
        const existing = existingMap.get(cleanLRN)

        // Merge on top of existing record by LRN to preserve existing ID and immutable QR code
        const fullPayload: Partial<Learner> = {
          ...(existing || {}),
          ...learnerPayload,
          id: existing?.id || learnerPayload.id,
          lrn: cleanLRN,
          // CRITICAL: Preserve existing QR code so it won't be changed upon re-importing SF1
          qr_code: existing?.qr_code || learnerPayload.qr_code,
          school_id: targetSchoolObj.id,
          school_name: finalSchoolName,
          grade_level_id: targetGradeObj?.id || learnerPayload.grade_level_id || existing?.grade_level_id,
          grade_level_name: finalGradeLevelName || learnerPayload.grade_level_name || existing?.grade_level_name,
          section_id: targetSectionObj?.id || learnerPayload.section_id || existing?.section_id,
          section_name: finalSectionName || learnerPayload.section_name || existing?.section_name,
          school_year: finalSchoolYear || learnerPayload.school_year || existing?.school_year,
        }

        if (existing) {
          const diff = getLearnerDiff(existing, fullPayload)
          updatedCount++
          logs.push({
            lrn: learnerPayload.lrn,
            name: `${learnerPayload.last_name}, ${learnerPayload.first_name}`,
            action: 'updated',
            changes: diff
          })
        } else {
          createdCount++
          logs.push({
            lrn: learnerPayload.lrn,
            name: `${learnerPayload.last_name}, ${learnerPayload.first_name}`,
            action: 'created',
            changes: [`New enrollee assigned to "${finalSchoolName}", ${finalGradeLevelName} — ${finalSectionName} (SY ${finalSchoolYear})`]
          })
        }

        try {
          await upsertLearner(fullPayload)
        } catch (err: any) {
          errorCount++
          logs.push({
            lrn: learnerPayload.lrn,
            name: `${learnerPayload.last_name}, ${learnerPayload.first_name}`,
            action: 'error',
            changes: [],
            errorReason: err?.message || 'Database write error'
          })
        }
      }

      const summaryRes: ImportResultSummary = {
        totalProcessed: parsed.learners.length,
        createdCount,
        updatedCount,
        errorCount,
        logs,
        schoolName: finalSchoolName,
        schoolId: finalSchoolId,
        schoolYear: finalSchoolYear,
        gradeLevelName: finalGradeLevelName,
        sectionName: finalSectionName,
        fileName: importModal.file?.name
      }

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || null,
        action: 'import_sf1_excel',
        details: {
          filename: importModal.file?.name,
          importedCount: parsed.learners.length,
          createdCount,
          updatedCount,
          errorCount,
          schoolId: targetSchoolObj.id,
          schoolName: finalSchoolName,
          schoolYear: finalSchoolYear,
          gradeLevel: finalGradeLevelName,
          section: finalSectionName
        }
      })

      const msg = `SF1 Import Completed: ${createdCount} new enrollees added, ${updatedCount} existing learner records updated under "${finalSchoolName}" (${finalGradeLevelName} - ${finalSectionName}, SY ${finalSchoolYear})!`
      toast(msg, 'success')
      setImportSummary(summaryRes)
      setShowResultModal(true)
      setImportModal({ isOpen: false, file: null, parsed: null, targetSchoolId: '' })
      loadData()
    } catch (err: any) {
      console.error('Failed to import SF1 Excel:', err)
      toast(`Failed to import learners: ${err?.message || 'Error saving to database'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const filteredLearners = useMemo(() => {
    return learners.filter(l => {
      // Role scope boundary checks
      if (admin) {
        if (admin.role === 'teacher') {
          if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0 && l.school_id) {
            if (!admin.assigned_school_ids.includes(l.school_id)) return false
          }
          if (admin.assigned_grade_ids && admin.assigned_grade_ids.length > 0 && l.grade_level_id) {
            if (!admin.assigned_grade_ids.includes(l.grade_level_id)) return false
          }
        } else if (admin.role === 'school_head' || (admin.role === 'ao_2' && !admin.district_name)) {
          if (admin.assigned_school_ids && admin.assigned_school_ids.length > 0 && l.school_id) {
            if (!admin.assigned_school_ids.includes(l.school_id)) return false
          }
        }
      }

      const matchesSearch =
        !searchTerm.trim() ||
        l.lrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.guardian_name && l.guardian_name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesSchool = selectedSchoolId === 'all'
        ? (permittedSchools.length > 0 && admin?.role !== 'superadmin' && !(admin?.role === 'ao_2' && admin?.district_name)
            ? permittedSchools.some(ps => ps.id === l.school_id || (l.school_name && ps.name.toLowerCase() === l.school_name.toLowerCase()))
            : true)
        : (l.school_id === selectedSchoolId || (selectedSchoolObj && l.school_name && l.school_name.toLowerCase() === selectedSchoolObj.name.toLowerCase()))


      const activeGradeObj = gradeLevels.find(g => g.id === selectedGradeId)
      const matchesGrade =
        selectedGradeId === 'all' ||
        l.grade_level_id === selectedGradeId ||
        (activeGradeObj && (
          (l.grade_level_name && l.grade_level_name.toLowerCase() === activeGradeObj.name.toLowerCase()) ||
          (activeGradeObj.grade_number === 0 && l.grade_level_name && (l.grade_level_name.toLowerCase().includes('kinder') || l.grade_level_name === 'K'))
        ))
      const matchesSection = selectedSectionId === 'all' || l.section_id === selectedSectionId
      const matchesStatus = selectedStatus === 'all' || l.status === selectedStatus
      const matchesSex = selectedSex === 'all' || l.sex === selectedSex
      const matches4Ps = !filter4PsOnly || l.is_4ps_cct === true

      return matchesSearch && matchesSchool && matchesGrade && matchesSection && matchesStatus && matchesSex && matches4Ps
    })
  }, [learners, searchTerm, selectedSchoolId, selectedSchoolObj, permittedSchools, selectedGradeId, selectedSectionId, selectedStatus, selectedSex, filter4PsOnly, admin, gradeLevels])


  const totalEnrolled = useMemo(() => filteredLearners.filter(l => l.status === 'enrolled').length, [filteredLearners])
  const totalMale = useMemo(() => filteredLearners.filter(l => l.sex === 'Male').length, [filteredLearners])
  const totalFemale = useMemo(() => filteredLearners.filter(l => l.sex === 'Female').length, [filteredLearners])
  const total4Ps = useMemo(() => filteredLearners.filter(l => l.is_4ps_cct).length, [filteredLearners])


  const handleOpenAddModal = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingLearner(null)
    const defaultBirthdate = '2018-05-15'
    setFormData({
      lrn: `${101928000000 + Math.floor(Math.random() * 899999)}`,
      first_name: '',
      middle_name: '',
      last_name: '',
      extension_name: '',
      sex: 'Male',
      birthdate: defaultBirthdate,
      age: calculateAge(defaultBirthdate),
      mother_tongue: 'Tagalog',
      ip_group: 'N/A',
      religion: 'Roman Catholic',
      address_house_no: '',
      address_street: '',
      address_barangay: 'Poblacion',
      address_city_municipality: 'Concepcion',
      address_province: 'Romblon',
      guardian_name: '',
      guardian_relationship: 'Parent',
      guardian_contact_no: '',
      is_4ps_cct: false,
      is_balik_aral: false,
      is_ecd_alive_sped: false,
      school_id: schools[0]?.id || '',
      grade_level_id: gradeLevels[0]?.id || '',
      section_id: sections[0]?.id || '',
      school_year: '2025-2026',
      status: 'enrolled',
      remarks: ''
    })
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (learner: Learner, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      captureGenieOrigin(e)
    }
    setEditingLearner(learner)
    const bdate = learner.birthdate || '2018-05-15'
    setFormData({
      ...learner,
      birthdate: bdate,
      age: calculateAge(bdate) || learner.age || 0
    })
    setIsModalOpen(true)
  }

  const handleOpenLearnerProfile = (learner: Learner, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigate(`/lis/learner/${learner.id}`)
  }

  const handleOpenDetailsModal = (learner: Learner, e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setSelectedLearnerDetail(learner)
    setIsDetailsModalOpen(true)
  }

  const handleSaveLearner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.lrn || formData.lrn.length !== 12) {
      toast('LRN must be exactly 12 digits.', 'error')
      return
    }
    if (!formData.first_name || !formData.last_name) {
      toast('First name and last name are required.', 'error')
      return
    }

    setSaving(true)
    try {
      const schoolObj = schools.find(s => s.id === formData.school_id)
      const gradeObj = gradeLevels.find(g => g.id === formData.grade_level_id)
      const sectionObj = sections.find(sec => sec.id === formData.section_id)

      const computedAge = calculateAge(formData.birthdate)

      const payload: Partial<Learner> = {
        ...formData,
        age: computedAge,
        school_name: schoolObj?.name || 'Concepcion Elementary School',
        grade_level_name: gradeObj?.name || 'Grade 1',
        section_name: sectionObj?.name || 'Agoncillo',
      }

      const existingLearner = learners.find(l => l.lrn === formData.lrn || (editingLearner && l.id === editingLearner.id))

      const saved = await upsertLearner(payload)

      let successDetail = ''
      if (existingLearner) {
        const diff = getLearnerDiff(existingLearner, payload)
        successDetail = `Updated record for LRN ${saved.lrn} (${saved.first_name} ${saved.last_name}). Changes: ${diff.join(' • ')}`
      } else {
        successDetail = `Newly enrolled learner ${saved.first_name} ${saved.last_name} (LRN: ${saved.lrn}) added to ${schoolObj?.name || 'School'}!`
      }

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || null,
        action: existingLearner ? 'update_learner' : 'create_learner',
        details: { lrn: saved.lrn, name: `${saved.first_name} ${saved.last_name}` }
      })

      toast(successDetail, 'success')
      closeModal()
      loadData()
    } catch (err) {
      console.error('Failed to save learner:', err)
      toast('Failed to save learner record.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      captureGenieOrigin(e)
    }
    setDeletingId(id)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    try {
      const target = learners.find(l => l.id === deletingId)
      await deleteLearner(deletingId)
      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || null,
        action: 'delete_learner',
        details: { id: deletingId, name: target ? `${target.first_name} ${target.last_name}` : '' }
      })
      toast('Learner record removed from LIS.', 'info')
      loadData()
    } catch (err) {
      console.error('Failed to delete learner:', err)
      toast('Failed to delete learner.', 'error')
    } finally {
      setShowDeleteConfirm(false)
      setDeletingId(null)
    }
  }

  const handleCopyLRN = (lrn: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    navigator.clipboard.writeText(lrn)
    setCopiedId(lrn)
    toast(`Copied LRN ${lrn} to clipboard!`, 'info')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: LearnerStatus) => {
    switch (status) {
      case 'enrolled':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'transferred_in':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'transferred_out':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'dropped':
        return 'bg-rose-50 text-rose-700 border-rose-200'
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200'
    }
  }

  return (
    <SchoolConnectLayout
      activeAppId="lis"
      systemTitle="Learner Information System (LIS)"
      systemSubtitle="Master Learner Profiles Directory & Student Records Registry"
      navGroups={lisNavGroups}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <DepEdSpinner size="lg" label="Loading Master Directory..." />
        </div>
      ) : (
        <div className="space-y-6 font-sans">
          {/* Clean Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Enrolled</span>
                <span className="text-2xl font-bold text-slate-900">{totalEnrolled}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Male / Female</span>
                <span className="text-lg font-bold text-blue-700">👦 {totalMale} | 👧 {totalFemale}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all">
              <div>
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">4Ps Beneficiaries</span>
                <span className="text-2xl font-bold text-amber-700">{total4Ps}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-slate-300 hover:shadow-sm transition-all">
              <div>
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Active Directory</span>
                <span className="text-2xl font-bold text-emerald-700">{filteredLearners.length}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Directory Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-600" />
                  Learner Master Directory
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Click any learner row to view full details profile. Showing {filteredLearners.length} of {learners.length} learners.
                </p>
              </div>

              {/* Action Buttons */}
              {canEditData() && (
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xls,.xlsx"
                    className="hidden"
                    onChange={handleSF1Import}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload size={16} />
                    {importing ? 'Importing File...' : 'Import SF1 Excel File'}
                  </button>

                  <button
                    onClick={handleOpenAddModal}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus size={16} />
                    Register New Learner
                  </button>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="relative lg:col-span-2">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search LRN, Name, Guardian..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* School Filter Dropdown (Assigned to User) */}
              <div>
                <select
                  value={selectedSchoolId}
                  onChange={e => setSelectedSchoolId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {permittedSchools.length > 1 && (
                    <option value="all">🏫 All Assigned Schools ({permittedSchools.length})</option>
                  )}
                  {permittedSchools.length === 0 && (
                    <option value="all">🏫 All Schools ({schools.length})</option>
                  )}
                  {(permittedSchools.length > 0 ? permittedSchools : schools).map(s => (
                    <option key={s.id} value={s.id}>
                      🏫 {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedGradeId}
                  onChange={e => {
                    setSelectedGradeId(e.target.value)
                    setSelectedSectionId('all')
                  }}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Grade Levels</option>
                  {gradeLevels.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Sections</option>
                  {sections
                    .filter(s => selectedGradeId === 'all' || !s.grade_level_id || s.grade_level_id === selectedGradeId)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-center">
                <button
                  onClick={() => setFilter4PsOnly(prev => !prev)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                    filter4PsOnly ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Award size={14} />
                  {filter4PsOnly ? '4Ps Only (Active)' : 'Filter 4Ps'}
                </button>
              </div>
            </div>


            {/* Table */}
            {filteredLearners.length === 0 ? (
              <div className="text-center py-16 space-y-3 bg-[#FAF5F0]/50 rounded-[24px] border border-dashed border-purple-200">
                <UserX className="w-12 h-12 text-[#8B72F4] mx-auto" />
                <h3 className="text-base font-black text-[#2D2638]">No Learners Found</h3>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-purple-100 shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#FAF5F0] border-b border-purple-100 text-[11px] font-black uppercase text-[#2D2638]">
                      <th className="py-3.5 px-4">LRN</th>
                      <th className="py-3.5 px-4">Full Name</th>
                      <th className="py-3.5 px-4">Sex & Age</th>
                      <th className="py-3.5 px-4">Grade & Section</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50 text-xs font-medium text-[#2D2638]">
                    {filteredLearners.map(l => (
                      <tr
                        key={l.id}
                        onClick={e => handleOpenLearnerProfile(l, e)}
                        className="hover:bg-[#F6EFFF]/60 transition-colors cursor-pointer group"
                        title="Click to open complete learner profile"
                      >
                        <td className="py-3 px-4 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-[#FAF5F0] group-hover:bg-white px-2.5 py-1 rounded-lg border border-purple-200/60 font-bold transition-colors">
                              {l.lrn}
                            </span>
                            <button onClick={e => handleCopyLRN(l.lrn, e)} className="p-1 text-[#7A7289] hover:text-[#8B72F4]">
                              {copiedId === l.lrn ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-black">
                          <div className="flex items-center gap-2">
                            <span className="group-hover:text-[#8B72F4] transition-colors">
                              {l.last_name}, {l.first_name} {l.middle_name ? `${l.middle_name[0]}.` : ''} {l.extension_name || ''}
                            </span>
                            <ExternalLink size={13} className="opacity-0 group-hover:opacity-100 text-[#8B72F4] transition-opacity shrink-0" />
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0 ${
                              l.sex === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                            }`}>
                              {l.sex === 'Male' ? '👦 Male' : '👧 Female'}
                            </span>
                            <span className="text-[11px] font-bold text-[#7A7289]">
                              {calculateAge(l.birthdate) || l.age ? `${calculateAge(l.birthdate) || l.age} yrs` : 'N/A'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {permittedSchools.length > 1 && (
                              <span className="text-[10px] font-extrabold text-[#795CEE] bg-[#F6EFFF] px-2 py-0.5 rounded-md border border-purple-200/60 truncate max-w-[150px]">
                                🏫 {l.school_name || schools.find(s => s.id === l.school_id)?.name || 'School'}
                              </span>
                            )}
                            <span className="text-xs font-black text-[#2D2638]">{getGradeNameForLearner(l)}</span>
                            <span className="text-slate-300 font-bold">•</span>
                            <span className="text-[11px] font-bold text-[#8B72F4]">Sec: {getSectionNameForLearner(l)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setSelectedIDLearner(l)
                              }}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                              title="Print School ID & QR Code"
                            >
                              <QrCode size={15} />
                            </button>
                            <button
                              onClick={e => handleOpenLearnerProfile(l, e)}
                              className="p-1.5 text-slate-500 hover:text-[#8B72F4] hover:bg-[#F6EFFF] rounded-xl transition-colors cursor-pointer"
                              title="View Full Profile Details"
                            >
                              <Eye size={15} />
                            </button>
                            {canEditData(l.school_id, l.grade_level_id, l.section_id) && (
                              <>
                                <button
                                  onClick={e => handleOpenEditModal(l, e)}
                                  className="p-1.5 text-[#8B72F4] hover:bg-[#F6EFFF] rounded-xl transition-colors cursor-pointer"
                                  title="Edit Learner Profile"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={e => handleDeleteClick(l.id, e)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Complete Details Genie Modal */}
      {shouldRenderDetailsModal && selectedLearnerDetail && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${detailsModalBackdropClass}`}>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={closeDetailsModal} />

          <div className={`relative w-full max-w-2xl bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_24px_60px_rgba(139,114,244,0.35)] z-10 overflow-hidden ${detailsModalContainerClass} font-sans`}>
            {/* Modal Header Clay Card */}
            <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] p-6 text-white border-b-4 border-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-white shrink-0 ${
                    selectedLearnerDetail.sex === 'Male' ? 'bg-gradient-to-tr from-blue-500 to-indigo-600' : 'bg-gradient-to-tr from-pink-500 to-purple-600'
                  }`}>
                    {selectedLearnerDetail.first_name[0]}{selectedLearnerDetail.last_name[0]}
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full border border-white/30 text-purple-100">
                      DepEd LIS Official Record
                    </span>
                    <h3 className="text-xl font-black tracking-tight font-display mt-1">
                      {selectedLearnerDetail.last_name.toUpperCase()}, {selectedLearnerDetail.first_name} {selectedLearnerDetail.middle_name || ''} {selectedLearnerDetail.extension_name || ''}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-xs font-bold bg-black/20 px-2.5 py-0.5 rounded-md border border-white/20">
                        LRN: {selectedLearnerDetail.lrn}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getStatusBadge(selectedLearnerDetail.status)}`}>
                        {selectedLearnerDetail.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={closeDetailsModal}
                  className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body Info Cards */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Card 1: Personal Details */}
              <div className="p-4 rounded-[24px] bg-white border-2 border-white shadow-xs space-y-3">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Users size={15} className="text-[#8B72F4]" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Sex</span>
                    <span className="font-black text-[#2D2638]">
                      {selectedLearnerDetail.sex === 'Male' ? '👦 Male' : '👧 Female'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Birth Date</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.birthdate}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Calculated Age</span>
                    <span className="font-black text-[#8B72F4]">{calculateAge(selectedLearnerDetail.birthdate) || selectedLearnerDetail.age || 0} years old</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Mother Tongue</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.mother_tongue || 'Tagalog'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">IP Ethnic Group</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.ip_group || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Religion</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.religion || 'Roman Catholic'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Academic & Schooling */}
              <div className="p-4 rounded-[24px] bg-white border-2 border-white shadow-xs space-y-3">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display flex items-center gap-1.5">
                  <GraduationCap size={15} className="text-[#8B72F4]" />
                  Schooling & Academic Assignment
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">School Name</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.school_name || 'San Vicente ES'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Grade Level</span>
                    <span className="font-black text-[#8B72F4]">{getGradeNameForLearner(selectedLearnerDetail)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Section</span>
                    <span className="font-black text-[#8B72F4]">{getSectionNameForLearner(selectedLearnerDetail)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">School Year</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.school_year || '2026 - 2027'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Enrollment Status</span>
                    <span className="font-black text-emerald-700 capitalize">{selectedLearnerDetail.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Parents & Guardian Information */}
              <div className="p-4 rounded-[24px] bg-white border-2 border-white shadow-xs space-y-3">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Phone size={15} className="text-[#8B72F4]" />
                  Parents, Guardian & Residence Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Father's Name</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.father_name || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Mother's Maiden Name</span>
                    <span className="font-black text-[#2D2638]">{selectedLearnerDetail.mother_maiden_name || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Guardian (if Not Parent)</span>
                    <span className="font-black text-[#2D2638]">
                      {selectedLearnerDetail.guardian_name || 'N/A (Living with Parents)'}
                    </span>
                    {selectedLearnerDetail.guardian_relationship && (
                      <span className="text-[10px] text-[#7A7289] block font-semibold">({selectedLearnerDetail.guardian_relationship})</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#7A7289] block">Contact Number</span>
                    <span className="font-mono font-black text-[#2D2638]">{selectedLearnerDetail.guardian_contact_no || 'N/A'}</span>
                  </div>

                  <div className="sm:col-span-2 pt-1 border-t border-purple-50">
                    <span className="text-[10px] font-bold text-[#7A7289] block">Complete Residence Address</span>
                    <span className="font-bold text-[#2D2638]">
                      {selectedLearnerDetail.address_house_no ? `${selectedLearnerDetail.address_house_no} ` : ''}
                      {selectedLearnerDetail.address_street ? `${selectedLearnerDetail.address_street}, ` : ''}
                      {selectedLearnerDetail.address_barangay || 'SAN VICENTE'}, {selectedLearnerDetail.address_city_municipality || 'CONCEPCION'}, {selectedLearnerDetail.address_province || 'ROMBLON'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Programs & Remarks */}
              <div className="p-4 rounded-[24px] bg-white border-2 border-white shadow-xs space-y-3">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display flex items-center gap-1.5">
                  <Award size={15} className="text-amber-500" />
                  Special Programs & Remarks
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedLearnerDetail.is_4ps_cct ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      ✓ DSWD 4Ps CCT Beneficiary
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                      Non-4Ps
                    </span>
                  )}

                  {selectedLearnerDetail.is_balik_aral && (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-300">
                      ✓ Balik-Aral Program
                    </span>
                  )}
                </div>

                {selectedLearnerDetail.remarks && (
                  <div className="pt-2 text-xs">
                    <span className="text-[10px] font-bold text-[#7A7289] block">Remarks Notes:</span>
                    <p className="font-medium text-[#2D2638] bg-[#FAF5F0] p-2.5 rounded-xl border border-purple-100">
                      {selectedLearnerDetail.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-[#FAF5F0] border-t border-[#F0E6DD] flex items-center justify-between">
              <button
                type="button"
                onClick={closeDetailsModal}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-[#7A7289] hover:bg-white transition-all cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeDetailsModal()
                    handleOpenEditModal(selectedLearnerDetail)
                  }}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={14} />
                  Edit Learner Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {shouldRenderModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${modalBackdropClass}`}>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={closeModal} />
          <div className={`relative w-full max-w-2xl bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-2xl z-10 overflow-hidden ${modalContainerClass}`}>
            <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] p-6 text-white flex items-center justify-between border-b-4 border-white">
              <div className="flex items-center gap-3">
                <UserPlus size={20} />
                <h3 className="text-base font-black">{editingLearner ? 'Edit Learner Profile' : 'Register New Learner'}</h3>
              </div>
              <button onClick={closeModal} className="p-2 rounded-2xl hover:bg-white/20"><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveLearner} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black mb-1">LRN (12 digits) *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={formData.lrn || ''}
                    onChange={e => setFormData(p => ({ ...p, lrn: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-4 py-2.5 text-xs font-mono font-bold rounded-2xl bg-white border-2 border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Sex *</label>
                  <select
                    value={formData.sex || 'Male'}
                    onChange={e => setFormData(p => ({ ...p, sex: e.target.value as LearnerSex }))}
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  >
                    <option value="Male">👦 Male</option>
                    <option value="Female">👧 Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name || ''}
                    onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middle_name || ''}
                    onChange={e => setFormData(p => ({ ...p, middle_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name || ''}
                    onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  />
                </div>
              </div>

              {/* Birth Date & Automatically Calculated Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white/70 rounded-2xl border border-purple-100">
                <div>
                  <label className="block text-xs font-black mb-1 text-[#2D2638]">Birth Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.birthdate || ''}
                    onChange={e => {
                      const newBdate = e.target.value
                      const newAge = calculateAge(newBdate)
                      setFormData(p => ({
                        ...p,
                        birthdate: newBdate,
                        age: newAge
                      }))
                    }}
                    className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-purple-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black mb-1 text-[#7A7289]">Calculated Age (Auto)</label>
                  <div className="w-full px-3.5 py-2 text-xs font-black rounded-xl bg-[#F6EFFF] border border-purple-200 text-[#8B72F4] flex items-center justify-between">
                    <span>{calculateAge(formData.birthdate) || 0} years old</span>
                    <span className="text-[10px] bg-[#8B72F4] text-white px-2 py-0.5 rounded-full font-bold">Auto-calculated</span>
                  </div>
                </div>
              </div>

              {/* Academic Assignment & Guardian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">Grade Level</label>
                  <select
                    value={formData.grade_level_id || ''}
                    onChange={e => setFormData(p => ({ ...p, grade_level_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  >
                    {gradeLevels.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Section</label>
                  <select
                    value={formData.section_id || ''}
                    onChange={e => setFormData(p => ({ ...p, section_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">Father's Full Name</label>
                  <input
                    type="text"
                    value={formData.father_name || ''}
                    onChange={e => setFormData(p => ({ ...p, father_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                    placeholder="e.g. DANCALAN, MARVIN SOLO"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Mother's Maiden Name</label>
                  <input
                    type="text"
                    value={formData.mother_maiden_name || ''}
                    onChange={e => setFormData(p => ({ ...p, mother_maiden_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                    placeholder="e.g. FEDEJAS, MARICRIS FAMILARAN"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black mb-1">Guardian Name (if Not Parent)</label>
                  <input
                    type="text"
                    value={formData.guardian_name || ''}
                    onChange={e => setFormData(p => ({ ...p, guardian_name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                    placeholder="Leave blank if living with parents"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">Relationship</label>
                  <input
                    type="text"
                    value={formData.guardian_relationship || ''}
                    onChange={e => setFormData(p => ({ ...p, guardian_relationship: e.target.value }))}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                    placeholder="e.g. Grandmother"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black mb-1">Parent / Guardian Contact No.</label>
                <input
                  type="text"
                  value={formData.guardian_contact_no || ''}
                  onChange={e => setFormData(p => ({ ...p, guardian_contact_no: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-2xl bg-white border-2 border-white"
                  placeholder="0917XXXXXXX"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modal_is_4ps"
                  checked={!!formData.is_4ps_cct}
                  onChange={e => setFormData(p => ({ ...p, is_4ps_cct: e.target.checked }))}
                  className="w-4 h-4 rounded text-[#8B72F4] focus:ring-purple-400 accent-[#8B72F4]"
                />
                <label htmlFor="modal_is_4ps" className="text-xs font-bold text-[#2D2638] cursor-pointer">
                  Learner is a DSWD 4Ps / CCT Beneficiary
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-xs font-bold text-[#7A7289]">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-full bg-[#8B72F4] text-white text-xs font-black">
                  {saving ? 'Saving...' : 'Save Learner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        title="Remove Learner Record"
        message="Are you sure you want to remove this learner from LIS?"
        confirmLabel="Remove Learner"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* SF1 Target School Selection Import Modal */}
      {importModal.isOpen && importModal.parsed && (
        <div className="fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FAF5F0] rounded-[36px] max-w-lg w-full border-4 border-white shadow-[0_25px_60px_rgba(139,114,244,0.3)] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-5 h-5" />
                <h2 className="text-base font-black tracking-tight font-display">SF1 Import: Target School Selection</h2>
              </div>
              <button
                onClick={() => setImportModal({ isOpen: false, file: null, parsed: null, targetSchoolId: '' })}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="p-4 rounded-2xl bg-white border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#7A7289]">Uploaded Excel File:</span>
                  <span className="font-black text-[#2D2638] font-mono">{importModal.file?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#7A7289]">Total Enrollees Found:</span>
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {importModal.parsed.learners.length} Learner Records
                  </span>
                </div>
                {importModal.parsed.metadata.schoolName && (
                  <div className="flex items-center justify-between border-t border-purple-100 pt-2 mt-2">
                    <span className="font-bold text-[#7A7289]">Header School Name (Excel):</span>
                    <span className="font-black text-blue-900 italic">{importModal.parsed.metadata.schoolName}</span>
                  </div>
                )}
                {importModal.parsed.metadata.schoolId && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#7A7289]">Header School ID (Excel):</span>
                    <span className="font-bold text-emerald-700 font-mono">{importModal.parsed.metadata.schoolId}</span>
                  </div>
                )}
                {importModal.parsed.metadata.schoolYear && (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#7A7289]">Header School Year (Excel):</span>
                    <span className="font-bold text-amber-800 font-mono">{importModal.parsed.metadata.schoolYear}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#7A7289]">Header Grade & Section (Excel):</span>
                  <span className="font-black text-[#8B72F4]">
                    {importModal.parsed.metadata.gradeLevel || 'Grade 5'} — {importModal.parsed.metadata.section || 'Section'}
                  </span>
                </div>
                {(importModal.parsed.metadata.region || importModal.parsed.metadata.division || importModal.parsed.metadata.district) && (
                  <div className="flex items-center justify-between border-t border-purple-100 pt-2 text-[11px] text-slate-500">
                    <span>Region • Division • District:</span>
                    <span className="font-semibold text-slate-700">
                      {[importModal.parsed.metadata.region, importModal.parsed.metadata.division, importModal.parsed.metadata.district].filter(Boolean).join(' • ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Target School Selector Dropdown */}
              <div className="space-y-2">
                <label className="block font-black text-[#2D2638] uppercase tracking-wider text-[11px] font-display">
                  Target School Assignment *
                </label>
                <select
                  value={importModal.targetSchoolId}
                  onChange={e => setImportModal(prev => ({ ...prev, targetSchoolId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-purple-200 text-xs font-black text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                >
                  {importModal.parsed.metadata.schoolName && (
                    <option value="create_new">
                      ✨ Register / Use School from File: "{importModal.parsed.metadata.schoolName}" {importModal.parsed.metadata.schoolId ? `(ID: ${importModal.parsed.metadata.schoolId})` : ''}
                    </option>
                  )}
                  {permittedSchools.map(sch => (
                    <option key={sch.id} value={sch.id}>
                      🏫 {sch.name} {sch.code ? `(ID: ${sch.code})` : ''} — ({sch.school_type === 'elementary' ? 'Elementary School' : 'High School'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#7A7289] font-medium">
                  Extracted Header Data (School ID, School Name, School Year, Grade Level & Section) will be automatically linked to all imported learners.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setImportModal({ isOpen: false, file: null, parsed: null, targetSchoolId: '' })}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#7A7289] bg-white border border-slate-200 hover:bg-[#FAF5F0]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving || !importModal.targetSchoolId}
                  onClick={handleConfirmImportSF1}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  {saving ? 'Importing...' : `Import ${importModal.parsed.learners.length} Learners`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SF1 Import Audit Result Detailed Modal */}
      <ImportResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        summary={importSummary}
      />

      {/* School ID Card Print & QR Modal */}
      {selectedIDLearner && (
        <SchoolIDCardModal
          isOpen={Boolean(selectedIDLearner)}
          onClose={() => setSelectedIDLearner(null)}
          learner={selectedIDLearner}
        />
      )}
    </SchoolConnectLayout>
  )
}
