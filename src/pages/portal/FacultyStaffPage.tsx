import { useState, useEffect, useMemo, useCallback } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import {
  Users,
  Plus,
  Search,
  Building2,
  GraduationCap,
  ShieldCheck,
  Award,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Edit2,
  Sparkles,
  MapPin,
  Briefcase,
  Check,
  Eye,
  EyeOff,
  Key,
  Trash2,
  UserX,
  Camera,
  Upload,
  Image as ImageIcon,
  Network,
  Crown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clock,
  BookOpen,
  CheckSquare
} from 'lucide-react'
import { fetchSchools, fetchGradeLevels, fetchLearningAreas, fetchLearningAreaGrades, fetchAllAdmins, upsertStaffProfile, deleteStaffProfile, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { School, GradeLevel, LearningArea, LearningAreaGrade, AdminProfile, UserRole, TeacherCategory } from '@/types'
import { format } from 'date-fns'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'

export function FacultyStaffPage() {
  const { admin, updateAdminProfile } = useAuth()
  const { toast } = useToast()

  const [staffList, setStaffList] = useState<AdminProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learningAreaGrades, setLearningAreaGrades] = useState<LearningAreaGrade[]>([])
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<string[]>([])
  const [assignedGradeSubjectIds, setAssignedGradeSubjectIds] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  // Filter & Search & Org Chart Sidebar states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all')
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string | null>(null)
  const [onlineStatusFilter, setOnlineStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [expandedSchoolIds, setExpandedSchoolIds] = useState<Record<string, boolean>>({})
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(10)

  // Reset page to 1 when filters or items per page change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedRoleFilter, selectedSchoolFilter, onlineStatusFilter, itemsPerPage])

  // Detail Modal State (row click)
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<AdminProfile | null>(null)
  const {
    shouldRender: shouldRenderDetailModal,
    triggerClose: closeDetailModal,
    containerClass: detailModalContainerClass,
    backdropClass: detailModalBackdropClass
  } = useGenieModal(!!selectedStaffDetail, () => setSelectedStaffDetail(null))

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const {
    shouldRender: shouldRenderStaffModal,
    triggerClose: closeStaffModal,
    containerClass: staffModalContainerClass,
    backdropClass: staffModalBackdropClass
  } = useGenieModal(isModalOpen, () => setIsModalOpen(false))

  const [editingStaff, setEditingStaff] = useState<AdminProfile | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete Staff Modal State
  const [staffToDelete, setStaffToDelete] = useState<AdminProfile | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [role, setRole] = useState<UserRole>('teacher')
  const [teacherCategory, setTeacherCategory] = useState<TeacherCategory>('grade_1_6')
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<string[]>([])
  const [assignedGradeIds, setAssignedGradeIds] = useState<string[]>([])
  const [schoolSessions, setSchoolSessions] = useState<Record<string, 'am' | 'pm' | 'full_day'>>({})
  const [workingHoursPreset, setWorkingHoursPreset] = useState<'option_1' | 'option_2'>('option_1')
  const [aoScope, setAoScope] = useState<'district' | 'school' | 'both'>('school')
  const [isActive, setIsActive] = useState(true)

  const loadData = async (forceRefresh = false) => {
    if (!staffList.length) {
      setLoading(true)
    }
    try {
      const [sList, schList, gList, laList, lagList] = await Promise.all([
        fetchAllAdmins(forceRefresh),
        fetchSchools(true, forceRefresh),
        fetchGradeLevels(undefined, forceRefresh),
        fetchLearningAreas(false, forceRefresh),
        fetchLearningAreaGrades(forceRefresh),
      ])
      setStaffList(sList)
      setSchools(schList)
      setGrades(gList)
      setLearningAreas(laList)
      setLearningAreaGrades(lagList)
    } catch (err) {
      console.error('Failed to load faculty & staff data:', err)
      toast('Failed to load staff list.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Faculty & Staff Governance | School Connect'
    loadData()
  }, [])

  const toggleSchoolExpand = (schoolId: string) => {
    setExpandedSchoolIds(prev => ({
      ...prev,
      [schoolId]: !prev[schoolId]
    }))
  }

  // Open modal for new staff
  const handleOpenAdd = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingStaff(null)
    setFullName('')
    setEmail('')
    setPassword('password123')
    setShowFormPassword(false)
    setAvatarUrl('/images/clay/avatar_girl.jpg')
    setRole('teacher')
    setTeacherCategory('grade_1_6')
    setAssignedSchoolIds([])
    setAssignedGradeIds([])
    setAssignedSubjectIds([])
    setAssignedGradeSubjectIds({})
    setSchoolSessions({})
    setWorkingHoursPreset('option_1')
    setAoScope('school')
    setIsActive(true)
    setIsModalOpen(true)
  }

  // Open modal for editing staff
  const handleOpenEdit = (staff: AdminProfile, e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingStaff(staff)
    setFullName(staff.full_name)
    setEmail(staff.email)
    setPassword(staff.password || 'password123')
    setShowFormPassword(false)
    setAvatarUrl(staff.avatar_url || '/images/clay/avatar_girl.jpg')
    setRole(staff.role === 'admin' && staff.assigned_school_ids && staff.assigned_school_ids.length > 0 ? 'ao_2' : staff.role)
    if (staff.role === 'ao_2' || staff.role === 'admin') {
      if (staff.district_name && staff.assigned_school_ids && staff.assigned_school_ids.length > 0) {
        setAoScope('both')
      } else if (staff.district_name) {
        setAoScope('district')
      } else {
        setAoScope('school')
      }
    } else {
      setAoScope('school')
    }
    setTeacherCategory(staff.teacher_category || 'grade_1_6')
    setAssignedSchoolIds(staff.assigned_school_ids || [])
    setAssignedGradeIds(staff.assigned_grade_ids || [])
    setAssignedSubjectIds(staff.assigned_subject_ids || [])
    setAssignedGradeSubjectIds(staff.assigned_grade_subject_ids || {})
    setSchoolSessions(staff.school_sessions || {})
    setWorkingHoursPreset(staff.working_hours_preset || 'option_1')
    setIsActive(staff.is_active)
    setIsModalOpen(true)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast('Image file size should be less than 2MB.', 'warning')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) {
          setAvatarUrl(reader.result.toString())
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Toggle school checkbox
  const toggleSchoolSelection = (schoolId: string) => {
    setAssignedSchoolIds(prev =>
      prev.includes(schoolId) ? prev.filter(id => id !== schoolId) : [...prev, schoolId]
    )
  }

  // Toggle grade checkbox
  const toggleGradeSelection = (gradeId: string) => {
    setAssignedGradeIds(prev => {
      const isRemoving = prev.includes(gradeId)
      const nextGrades = isRemoving ? prev.filter(id => id !== gradeId) : [...prev, gradeId]

      if (isRemoving) {
        setAssignedGradeSubjectIds(prevSubj => {
          const copy = { ...prevSubj }
          delete copy[gradeId]
          const allAssigned = new Set<string>()
          Object.values(copy).forEach(ids => ids.forEach(id => allAssigned.add(id)))
          setAssignedSubjectIds(Array.from(allAssigned))
          return copy
        })
      }
      return nextGrades
    })
  }

  const getLearningAreasForGrade = (gradeId: string) => {
    const mappedIds = new Set(
      learningAreaGrades
        .filter(lag => lag.grade_level_id === gradeId)
        .map(lag => lag.learning_area_id)
    )
    if (mappedIds.size > 0) {
      return learningAreas.filter(la => mappedIds.has(la.id))
    }
    return learningAreas
  }

  // Check if specific subject for a grade at a school is already assigned to another teacher
  const getOtherTeacherAssignedToSubject = (schoolId: string, gradeId: string, subjectId: string) => {
    if (!schoolId || !gradeId || !subjectId) return null

    return staffList.find(s => {
      if (editingStaff && s.id === editingStaff.id) return false
      if (s.role !== 'teacher') return false
      if (s.is_active === false) return false

      const isSchoolMatch = s.assigned_school_ids?.includes(schoolId)
      if (!isSchoolMatch) return false

      const isGradeMatch = s.assigned_grade_ids?.includes(gradeId)
      if (!isGradeMatch) return false

      if (s.assigned_grade_subject_ids && s.assigned_grade_subject_ids[gradeId]) {
        return s.assigned_grade_subject_ids[gradeId].includes(subjectId)
      }

      return s.assigned_subject_ids?.includes(subjectId)
    }) || null
  }

  const toggleSubjectForGrade = (gradeId: string, subjectId: string) => {
    const currentSchoolId = assignedSchoolIds[0]
    if (currentSchoolId) {
      const otherTeacher = getOtherTeacherAssignedToSubject(currentSchoolId, gradeId, subjectId)
      if (otherTeacher) {
        toast(`This subject is already assigned to ${otherTeacher.full_name} for this grade level.`, 'warning')
        return
      }
    }

    setAssignedGradeSubjectIds(prev => {
      const current = prev[gradeId] || []
      const updatedForGrade = current.includes(subjectId)
        ? current.filter(id => id !== subjectId)
        : [...current, subjectId]
      
      const nextGradeSubjectMap = {
        ...prev,
        [gradeId]: updatedForGrade,
      }

      const allAssigned = new Set<string>()
      Object.values(nextGradeSubjectMap).forEach(ids => {
        ids.forEach(id => allAssigned.add(id))
      })
      setAssignedSubjectIds(Array.from(allAssigned))

      return nextGradeSubjectMap
    })
  }

  const toggleAllSubjectsForGrade = (gradeId: string, availableLAs: LearningArea[]) => {
    const currentSchoolId = assignedSchoolIds[0]
    const assignableLAs = availableLAs.filter(la => {
      if (!currentSchoolId) return true
      const otherTeacher = getOtherTeacherAssignedToSubject(currentSchoolId, gradeId, la.id)
      return !otherTeacher
    })

    setAssignedGradeSubjectIds(prev => {
      const current = prev[gradeId] || []
      const assignableIds = assignableLAs.map(la => la.id)
      const allSelected = assignableIds.length > 0 && assignableIds.every(id => current.includes(id))

      const updatedForGrade = allSelected ? [] : Array.from(new Set([...current, ...assignableIds]))

      const nextGradeSubjectMap = {
        ...prev,
        [gradeId]: updatedForGrade,
      }

      const allAssigned = new Set<string>()
      Object.values(nextGradeSubjectMap).forEach(ids => {
        ids.forEach(id => allAssigned.add(id))
      })
      setAssignedSubjectIds(Array.from(allAssigned))

      return nextGradeSubjectMap
    })
  }

  // Toggle password visibility
  const togglePasswordVisibility = (staffId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }))
  }

  // Toggle Active / Disabled System Access for a staff member
  const handleToggleAccessStatus = async (staff: AdminProfile) => {
    try {
      const updated = await upsertStaffProfile({
        ...staff,
        is_active: !staff.is_active,
      })

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: staff.is_active ? 'disable_staff_access' : 'enable_staff_access',
        entity_type: 'staff',
        entity_id: staff.id,
        entity_label: staff.full_name,
        details: { newStatus: updated.is_active ? 'active' : 'disabled' }
      })

      toast(
        staff.is_active
          ? `System login access disabled for ${staff.full_name}.`
          : `System login access enabled for ${staff.full_name}.`,
        'success'
      )
      loadData()
    } catch (err) {
      console.error('Failed to toggle status:', err)
      toast('Failed to change access status.', 'error')
    }
  }

  // Save staff handler (Add or Update)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      toast('Please enter both name and email.', 'warning')
      return
    }

    if (role === 'teacher') {
      if (assignedSchoolIds.length === 0) {
        toast('Please select a school for the teacher first.', 'warning')
        return
      }
      if (teacherCategory !== 'kindergarten' && assignedGradeIds.length === 0) {
        toast('Please select at least one grade level for the teacher.', 'warning')
        return
      }
    }

    if (role === 'ao_2') {
      if ((aoScope === 'school' || aoScope === 'both') && assignedSchoolIds.length === 0) {
        toast('Please select at least one school for the Administrative Officer II.', 'warning')
        return
      }
    }

    setSaving(true)
    try {
      let finalRole: UserRole = role
      let finalSchoolIds: string[] = assignedSchoolIds
      let finalDistrictName: string | undefined = undefined

      if (role === 'ao_2') {
        finalRole = 'ao_2'
        if (aoScope === 'district') {
          finalSchoolIds = []
          finalDistrictName = 'Concepcion District'
        } else if (aoScope === 'both') {
          finalSchoolIds = assignedSchoolIds
          finalDistrictName = 'Concepcion District'
        } else {
          finalSchoolIds = assignedSchoolIds
          finalDistrictName = undefined
        }
      } else if (role === 'psds') {
        finalSchoolIds = schools.map(s => s.id)
        finalDistrictName = 'Concepcion District'
      } else if (role === 'admin' || role === 'superadmin') {
        finalSchoolIds = assignedSchoolIds.length > 0 ? assignedSchoolIds : (editingStaff?.assigned_school_ids || [])
      }

      const payload: Partial<AdminProfile> = {
        id: editingStaff?.id,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || 'password123',
        role: finalRole,
        is_active: isActive,
        avatar_url: avatarUrl.trim() || undefined,
        teacher_category: role === 'teacher' ? teacherCategory : undefined,
        assigned_school_ids: finalSchoolIds,
        assigned_grade_ids: role === 'teacher' && teacherCategory !== 'kindergarten' ? assignedGradeIds : [],
        assigned_subject_ids: role === 'teacher' ? assignedSubjectIds : [],
        assigned_grade_subject_ids: role === 'teacher' ? assignedGradeSubjectIds : {},
        school_sessions: schoolSessions,
        working_hours_preset: workingHoursPreset,
        district_name: finalDistrictName,
      }

      const saved = await upsertStaffProfile(payload)
      
      // If updating currently logged in user, update active auth context state & localStorage immediately!
      if (saved && admin && (saved.id === admin.id || editingStaff?.id === admin.id)) {
        updateAdminProfile(saved)
      }

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: editingStaff ? 'update_staff_profile' : 'create_staff_profile',
        entity_type: 'staff',
        entity_id: saved.id,
        entity_label: saved.full_name,
        details: { role: saved.role, assignedSchoolsCount: saved.assigned_school_ids?.length || 0 },
      })

      toast(editingStaff ? 'Staff profile updated successfully.' : 'New staff member added successfully.', 'success')
      closeStaffModal()
      loadData()
    } catch (err) {
      console.error('Failed to save staff:', err)
      toast('Error saving staff profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Delete staff handler
  const handleDeleteStaff = async () => {
    if (!staffToDelete) return
    setDeleting(true)
    try {
      await deleteStaffProfile(staffToDelete.id)

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: 'delete_staff_profile',
        entity_type: 'staff',
        entity_id: staffToDelete.id,
        entity_label: staffToDelete.full_name,
      })

      toast(`Permanently deleted profile for ${staffToDelete.full_name}.`, 'success')
      setStaffToDelete(null)
      loadData()
    } catch (err) {
      console.error('Failed to delete staff profile:', err)
      toast('Failed to delete personnel record.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Track internet network connectivity (navigator.onLine)
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true)
    const handleOffline = () => setIsNetworkOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Helper: Determine if staff member is currently online and connected to internet
  const isStaffOnline = useCallback((s: AdminProfile) => {
    // Must be connected to the internet
    if (!isNetworkOnline) return false

    // Account must be active
    if (s.is_active === false) return false

    // Currently logged in active user session
    if (admin && (s.id === admin.id || (s.email && admin.email && s.email.toLowerCase() === admin.email.toLowerCase()))) {
      return true
    }

    // Other user with active heartbeat timestamp within the last 2 minutes
    if (s.last_seen_at) {
      const diff = Date.now() - new Date(s.last_seen_at).getTime()
      return diff >= 0 && diff < 2 * 60 * 1000
    }

    return false
  }, [admin, isNetworkOnline])

  const { onlineCount, offlineCount } = useMemo(() => {
    let online = 0
    staffList.forEach(s => {
      if (isStaffOnline(s)) online++
    })
    return { onlineCount: online, offlineCount: staffList.length - online }
  }, [staffList, isStaffOnline])

  // Fast hash lookup maps
  const schoolMap = useMemo(() => {
    const map = new Map<string, School>()
    schools.forEach(s => map.set(s.id, s))
    return map
  }, [schools])

  const gradeMap = useMemo(() => {
    const map = new Map<string, GradeLevel>()
    grades.forEach(g => map.set(g.id, g))
    return map
  }, [grades])

  const laMap = useMemo(() => {
    const map = new Map<string, LearningArea>()
    learningAreas.forEach(la => map.set(la.id, la))
    return map
  }, [learningAreas])

  // Pre-computed Org Chart tree data per school
  const schoolStaffTree = useMemo(() => {
    return schools.map(school => {
      const schoolStaff = staffList.filter(s => s.assigned_school_ids?.includes(school.id))
      const schoolHeads = schoolStaff.filter(s => s.role === 'school_head')
      const ao2s = schoolStaff.filter(s => s.role === 'ao_2')
      const teachers = schoolStaff.filter(s => s.role === 'teacher')
      return {
        school,
        schoolStaff,
        schoolHeads,
        ao2s,
        teachers,
      }
    })
  }, [schools, staffList])

  // Memoized Filtered staff list
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return staffList.filter(s => {
      const matchesSearch = !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)

      const matchesRole =
        selectedRoleFilter === 'all' ||
        (selectedRoleFilter === 'ao_2' &&
          (s.role === 'ao_2' || (s.role === 'admin' && s.assigned_school_ids && s.assigned_school_ids.length > 0))) ||
        (selectedRoleFilter === 'admin' &&
          (s.role === 'admin' || s.role === 'superadmin' || (s.role === 'ao_2' && !!s.district_name))) ||
        s.role === selectedRoleFilter

      const matchesSchool = !selectedSchoolFilter ||
        s.role === 'psds' ||
        s.assigned_school_ids?.includes(selectedSchoolFilter)

      const isOnline = isStaffOnline(s)
      const matchesOnline =
        onlineStatusFilter === 'all' ||
        (onlineStatusFilter === 'online' && isOnline) ||
        (onlineStatusFilter === 'offline' && !isOnline)

      return matchesSearch && matchesRole && matchesSchool && matchesOnline
    })
  }, [staffList, searchQuery, selectedRoleFilter, selectedSchoolFilter, onlineStatusFilter, isStaffOnline])

  // Pagination calculations
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage) || 1
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredStaff.length)
  const paginatedStaff = filteredStaff.slice(startIndex, startIndex + itemsPerPage)

  // Role pill formatter
  const getRoleBadge = (s: AdminProfile) => {
    switch (s.role) {
      case 'admin':
      case 'superadmin':
        if (s.assigned_school_ids && s.assigned_school_ids.length > 0) {
          return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">System Admin / AO II (District & School)</span>
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">System Admin (District)</span>
      case 'psds':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">PSDS (District Supervisor)</span>
      case 'ao_2':
        if (s.district_name && s.assigned_school_ids && s.assigned_school_ids.length > 0) {
          return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">System Admin / AO II (District & School)</span>
        } else if (s.district_name) {
          return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">System Admin / AO II (District)</span>
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Administrative Officer II (School)</span>
      case 'school_head':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">School Head / Principal</span>
      case 'teacher':
        const catLabel = s.teacher_category === 'kindergarten'
          ? 'Kinder (ES)'
          : s.teacher_category === 'jhs'
          ? 'JHS'
          : s.teacher_category === 'shs'
          ? 'SHS'
          : s.teacher_category === 'subject_teacher'
          ? 'Subject Teacher'
          : 'ES (G1–6)'
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Teacher ({catLabel})
          </span>
        )
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">Staff</span>
    }
  }

  // Teacher grade level badge formatter
  const formatTeacherGradeBadge = (t: AdminProfile) => {
    if (t.assigned_grade_ids && t.assigned_grade_ids.length > 0) {
      const matched = grades.filter(g => t.assigned_grade_ids?.includes(g.id))
      if (matched.length > 0) {
        const sorted = [...matched].sort((a, b) => a.grade_number - b.grade_number)
        if (sorted.length === 1) {
          return sorted[0].name.startsWith('Grade') ? `Grade ${sorted[0].grade_number}` : sorted[0].name
        }
        if (sorted.length === 6 && sorted[0].grade_number === 1 && sorted[5].grade_number === 6) {
          return 'Grade 1-6'
        }
        if (sorted.length === 4 && sorted[0].grade_number === 7 && sorted[3].grade_number === 10) {
          return 'JHS (G7-10)'
        }
        if (sorted.length === 2 && sorted[0].grade_number === 11 && sorted[1].grade_number === 12) {
          return 'SHS (G11-12)'
        }
        return sorted.map(g => (g.grade_number ? `G${g.grade_number}` : g.name)).join(', ')
      }
    }
    if (t.teacher_category === 'kindergarten') return 'Kindergarten'
    if (t.teacher_category === 'jhs') return 'JHS (G7-10)'
    if (t.teacher_category === 'shs') return 'SHS (G11-12)'
    if (t.teacher_category === 'subject_teacher') return 'Grade 1-12'
    return 'Grade 1-6'
  }

  // Helper: School Name to Abbreviation
  const getSchoolAbbreviation = (schoolName: string, session?: string) => {
    const knownMap: Record<string, string> = {
      'San Pedro (Agbatang) Elementary School': 'SPAES',
      'Calabasahan Elementary School': 'CES',
      'Sampong Elementary School': 'SES',
      'Concepcion National High School': 'CNHS',
      'Macalacad Elementary School': 'MES',
    }

    let baseAbbrev = knownMap[schoolName]
    if (!baseAbbrev) {
      baseAbbrev = schoolName
        .replace(/\(.*\)/g, '')
        .split(' ')
        .filter(w => w.length > 0 && !['of', 'the', 'and', 'in'].includes(w.toLowerCase()))
        .map(w => w[0].toUpperCase())
        .join('')
    }

    if (session === 'am') return `${baseAbbrev} (A.M.)`
    if (session === 'pm') return `${baseAbbrev} (P.M.)`
    return baseAbbrev
  }

  // Helper: Format Designation Title (clean title without raw internal role string)
  const getStaffDesignation = (s: AdminProfile) => {
    if (s.role === 'admin' || s.role === 'superadmin') {
      return 'System Administrator'
    }
    if (s.role === 'psds') {
      return 'District Supervisor (PSDS)'
    }
    if (s.role === 'school_head') {
      return 'School Head / Principal'
    }
    if (s.role === 'ao_2') {
      return 'Administrative Officer II'
    }
    if (s.role === 'teacher') {
      switch (s.teacher_category) {
        case 'kindergarten':
          return 'Kindergarten Teacher'
        case 'jhs':
          return 'Junior HS Teacher'
        case 'shs':
          return 'Senior HS Teacher'
        case 'subject_teacher':
          return 'Subject Teacher'
        default:
          return 'Elementary Teacher'
      }
    }
    return 'Staff Member'
  }

  const getStaffGradeSimple = (s: AdminProfile) => {
    if (s.role !== 'teacher') return 'Administrative'
    if (s.teacher_category === 'kindergarten') return 'Kindergarten'
    return formatTeacherGradeBadge(s)
  }

  return (
    <SchoolConnectLayout systemTitle="Faculty & Staff Governance Directory">
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Top Header Section Banner */}
        <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white rounded-[36px] p-6 sm:p-9 shadow-[0_20px_40px_rgba(139,114,244,0.28)] border-4 border-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold backdrop-blur-md shadow-xs">
                  <Users size={14} className="text-amber-300" />
                  Personnel & Staff Governance
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 text-xs font-extrabold backdrop-blur-md shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{onlineCount} Online Now</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">Faculty & Staff Directory</h1>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed font-medium">
                Add, edit, update, or delete faculty & staff profiles across schools, configure school & grade assignments, and manage system access permissions.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <a
                href="/org-chart"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 border border-white/30 backdrop-blur-md cursor-pointer"
                title="Open Public Org Chart in a new browser tab"
              >
                <Network size={16} />
                Public Org Chart ↗
              </a>

              <button
                onClick={(e) => handleOpenAdd(e)}
                className="px-6 py-3.5 rounded-full bg-white text-[#795CEE] hover:bg-[#F6EFFF] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:animate-button-sparkle border border-white"
              >
                <Plus size={16} />
                Add Personnel
              </button>
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMN LAYOUT WITH ORG CHART SIDEBAR */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT SIDEBAR: ORGANIZATIONAL CHART NAVIGATION */}
          <div className="clay-card p-5 space-y-4 w-full lg:w-84 xl:w-96 shrink-0 self-start">
            {/* Sidebar Title Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-xs">
                  <Network size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#2D2638] font-display">District Org Chart</h3>
                  <p className="text-[10px] text-[#7A7289] font-medium">Governance Hierarchy</p>
                </div>
              </div>
              {selectedSchoolFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedSchoolFilter(null)}
                  className="text-[10px] font-extrabold text-[#8B72F4] hover:underline bg-[#F6EFFF] px-2.5 py-1 rounded-full cursor-pointer border border-[#8B72F4]/20"
                >
                  View All
                </button>
              )}
            </div>

            {/* TOP NODE: DISTRICT SUPERVISOR (PSDS) */}
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#A39BAF] px-1 flex items-center justify-between">
                <span>District Governance Head</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-extrabold border border-indigo-200">
                  Concepcion District
                </span>
              </div>

              {staffList.filter(s => s.role === 'psds').map(psds => (
                <div
                  key={psds.id}
                  onClick={() => setSelectedSchoolFilter(null)}
                  className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                    selectedSchoolFilter === null
                      ? 'bg-gradient-to-br from-[#F6EFFF] via-[#EEF0FF] to-[#E5E8FF] border-[#8B72F4] shadow-xs'
                      : 'bg-white border-white hover:bg-[#FAF5F0]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={psds.avatar_url || '/images/clay/login_girl.jpg'}
                      alt={psds.full_name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs bg-[#F6EFFF]"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-indigo-600 text-white rounded-full">
                      <Crown size={10} />
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-[#2D2638] truncate font-display">{psds.full_name}</h4>
                    <p className="text-[10px] font-bold text-indigo-700">District Supervisor (PSDS)</p>
                    <p className="text-[9px] text-[#7A7289] truncate">{psds.email}</p>
                  </div>
                </div>
              ))}

              {staffList.filter(s => s.role === 'psds').length === 0 && (
                <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                    <Award size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">District Supervisor Node</h4>
                    <p className="text-[10px] text-indigo-700">Concepcion District Office</p>
                  </div>
                </div>
              )}
            </div>

            {/* EXPANDABLE SCHOOLS ORGANIZATIONAL TREE */}
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-[#A39BAF] px-1 flex items-center justify-between">
                <span>Schools Hierarchy ({schools.length})</span>
                <span className="text-[9px] text-[#8B72F4] font-bold">Click to filter</span>
              </div>

              <div className="border-l-2 border-dashed border-[#8B72F4]/30 ml-3 pl-3 space-y-3">
                {schoolStaffTree.map(({ school, schoolStaff, schoolHeads, ao2s, teachers }: any) => {
                  const isExpanded = !!expandedSchoolIds[school.id]
                  const isSelected = selectedSchoolFilter === school.id

                  return (
                    <div key={school.id} className="space-y-2">
                      {/* School Node Accordion Button */}
                      <button
                        type="button"
                        onClick={() => {
                          toggleSchoolExpand(school.id)
                          setSelectedSchoolFilter(isSelected ? null : school.id)
                        }}
                        className={`w-full text-left p-2.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#F6EFFF] to-[#EEF0FF] border-[#8B72F4] shadow-xs'
                            : 'bg-white border-white hover:bg-[#FAF5F0]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#8B72F4] shrink-0">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                          <Building2 size={15} className={isSelected ? 'text-[#8B72F4]' : 'text-[#A39BAF]'} />
                          <span className="text-xs font-black text-[#2D2638] truncate">{school.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 border ${
                          isSelected ? 'bg-[#8B72F4] text-white border-[#8B72F4]' : 'bg-[#FAF5F0] text-[#7A7289] border-white'
                        }`}>
                          {schoolStaff.length}
                        </span>
                      </button>

                      {/* Expanded Tree Items (Ordered Hierarchy) */}
                      {isExpanded && (
                        <div className="border-l-2 border-[#8B72F4]/20 ml-3.5 pl-3 space-y-2 text-xs animate-fade-in">
                          {/* Rank 1: School Head / Principal */}
                          {schoolHeads.length > 0 ? (
                            schoolHeads.map((sh: AdminProfile) => (
                              <div key={sh.id} className="p-2 rounded-xl bg-amber-50/90 border border-amber-200/70 flex items-center gap-2.5 shadow-2xs">
                                <img
                                  src={sh.avatar_url || '/images/clay/avatar_girl.jpg'}
                                  alt={sh.full_name}
                                  className="w-7 h-7 rounded-full object-cover border border-white shadow-2xs shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <Crown size={11} className="text-amber-600 shrink-0" />
                                    <span className="font-extrabold text-[#2D2638] text-[11px] truncate">{sh.full_name}</span>
                                  </div>
                                  <p className="text-[9px] font-bold text-amber-800">School Head / Principal</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-2 rounded-xl bg-white/60 border border-dashed border-amber-200 text-[10px] text-amber-700/70 italic flex items-center gap-1.5">
                              <Crown size={11} className="text-amber-400 shrink-0" />
                              <span>No School Head assigned</span>
                            </div>
                          )}

                          {/* Rank 2: Administrative Officer II */}
                          {ao2s.length > 0 && (
                            ao2s.map((ao: AdminProfile) => (
                              <div key={ao.id} className="p-2 rounded-xl bg-blue-50/90 border border-blue-200/70 flex items-center gap-2.5 shadow-2xs">
                                <img
                                  src={ao.avatar_url || '/images/clay/avatar_girl.jpg'}
                                  alt={ao.full_name}
                                  className="w-7 h-7 rounded-full object-cover border border-white shadow-2xs shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1">
                                    <Briefcase size={11} className="text-blue-600 shrink-0" />
                                    <span className="font-extrabold text-[#2D2638] text-[11px] truncate">{ao.full_name}</span>
                                  </div>
                                  <p className="text-[9px] font-bold text-blue-800">Administrative Officer II</p>
                                </div>
                              </div>
                            ))
                          )}

                          {/* Rank 3: Teachers */}
                          {teachers.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/70 space-y-1.5 shadow-2xs">
                              <div className="flex items-center justify-between text-emerald-950 font-black text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap size={12} className="text-emerald-600" />
                                  <span>Teachers</span>
                                </div>
                                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                                  {teachers.length}
                                </span>
                              </div>
                              <div className="space-y-1 pt-0.5">
                                {teachers.map((t: AdminProfile) => (
                                  <div key={t.id} className="flex items-center gap-2 py-0.5">
                                    <img
                                      src={t.avatar_url || '/images/clay/avatar_girl.jpg'}
                                      alt={t.full_name}
                                      className="w-6 h-6 rounded-full object-cover border border-white shrink-0"
                                    />
                                    <span className="font-bold text-[#2D2638] text-[11px] truncate">{t.full_name}</span>
                                    <span className="text-[9px] font-extrabold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-full shrink-0 ml-auto border border-emerald-200/80 shadow-2xs">
                                      {formatTeacherGradeBadge(t)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {schoolStaff.length === 0 && (
                            <div className="p-2 rounded-xl bg-white/50 border border-dashed border-slate-200 text-[10px] text-[#A39BAF] italic">
                              No personnel assigned yet
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* RIGHT MAIN COLUMN: SEARCH, ROLE FILTERS, TABLE */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
            {/* Active School Filter Banner */}
            {selectedSchoolFilter && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#E5E8FF] border-2 border-[#8B72F4] flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Building2 size={18} className="text-[#8B72F4] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-[#7A7289] uppercase tracking-wider block">School Filter Active:</span>
                    <h4 className="text-xs font-black text-[#2D2638] truncate font-display">
                      {schools.find(s => s.id === selectedSchoolFilter)?.name || 'Selected School'}
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSchoolFilter(null)}
                  className="px-3 py-1 rounded-full bg-white text-[#8B72F4] hover:bg-[#8B72F4] hover:text-white font-extrabold text-xs transition-all cursor-pointer border border-[#8B72F4]/30 shrink-0"
                >
                  Clear Filter ✕
                </button>
              </div>
            )}

            {/* 3D Clay Filter Controls Bar */}
            <div className="clay-card p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-3.5">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-full text-xs bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white transition-all font-semibold"
                />
              </div>

              {/* Dropdown Filters Container */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                {/* Online Status Dropdown Filter */}
                <div className="relative w-full sm:w-48">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B72F4]">
                    <Globe size={14} />
                  </div>
                  <select
                    value={onlineStatusFilter}
                    onChange={e => setOnlineStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
                    className="w-full pl-9 pr-8 py-2.5 rounded-full text-xs font-extrabold bg-[#FAF5F0] border border-white text-[#2D2638] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white transition-all shadow-2xs appearance-none cursor-pointer"
                  >
                    <option value="all">All Statuses ({staffList.length})</option>
                    <option value="online">🟢 Online ({onlineCount})</option>
                    <option value="offline">⚪ Offline ({offlineCount})</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#A39BAF]">
                    <ChevronDown size={14} />
                  </div>
                </div>

                {/* Role Filter Dropdown */}
                <div className="relative w-full sm:w-56">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B72F4]">
                    <Users size={14} />
                  </div>
                  <select
                    value={selectedRoleFilter}
                    onChange={e => setSelectedRoleFilter(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 rounded-full text-xs font-extrabold bg-[#FAF5F0] border border-white text-[#2D2638] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white transition-all shadow-2xs appearance-none cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="teacher">Teachers</option>
                    <option value="school_head">School Heads</option>
                    <option value="psds">District Supervisor (PSDS)</option>
                    <option value="ao_2">Administrative Officer II (AO II)</option>
                    <option value="admin">System Administrators</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#A39BAF]">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Staff Table Container */}
            <div className="clay-card overflow-hidden p-1">
              {loading ? (
                <div className="p-12">
                  <DepEdSpinner size="lg" label="Loading Faculty & Staff Directory..." subtitle="Fetching assigned schools and grade scope from Supabase" />
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={32} className="mx-auto text-[#A39BAF] mb-2" />
                  <h3 className="text-sm font-black text-[#2D2638]">No staff members match your criteria</h3>
                  <p className="text-xs text-[#7A7289] mt-1 font-medium">Try clearing your search query or role/school filter.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Data Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAFBFF] border-b border-[#E8EAF0] text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                          <th className="py-3.5 px-4 sm:px-6">Staff Member</th>
                          <th className="py-3.5 px-4">Online Status</th>
                          <th className="py-3.5 px-4">Designation</th>
                          <th className="py-3.5 px-4">Assigned School</th>
                          <th className="py-3.5 px-4">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F7]">
                        {paginatedStaff.map((s: AdminProfile) => {
                          const assignedSchoolNames = s.assigned_school_ids
                            ?.map((id: string) => schoolMap.get(id)?.name)
                            .filter(Boolean) as string[] || []

                          const isCurrentSelf = s.id === admin?.id
                          const isOnline = isStaffOnline(s)

                          return (
                            <tr
                              key={s.id}
                              onClick={(e) => {
                                captureGenieOrigin(e)
                                setSelectedStaffDetail(s)
                              }}
                              className="hover:bg-[#F6EFFF]/40 transition-colors cursor-pointer group"
                              title="Click to view complete details of staff"
                            >
                              <td className="py-4 px-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <img
                                      src={s.avatar_url || '/images/clay/avatar_girl.jpg'}
                                      alt={s.full_name}
                                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                                    />
                                    {isOnline && (
                                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-2xs" title="Currently Online"></span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-black text-[#1F2937] truncate flex items-center gap-1.5 group-hover:text-[#8B72F4] transition-colors">
                                      <span>{s.full_name}</span>
                                      {isCurrentSelf && (
                                        <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[9px] font-extrabold border border-purple-200">You</span>
                                      )}
                                    </h4>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4">
                                {isOnline ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    Offline
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 font-extrabold text-xs text-[#2D2638]">
                                {getStaffDesignation(s)}
                              </td>

                              <td className="py-4 px-4">
                                {s.role === 'psds' ? (
                                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    All Schools
                                  </span>
                                ) : assignedSchoolNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {s.assigned_school_ids?.map((schId: string) => {
                                      const sch = schoolMap.get(schId)
                                      if (!sch) return null
                                      const sess = s.school_sessions?.[schId]
                                      const abbrev = getSchoolAbbreviation(sch.name, sess)
                                      return (
                                        <span key={schId} className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#EEF0FF] text-[#3B49B8] border border-[#BFD7FF]">
                                          {abbrev}
                                        </span>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-[#94A3B8] italic">Unassigned</span>
                                )}
                              </td>

                              <td className="py-4 px-4 font-bold text-xs text-[#2D2638]">
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block">
                                  {getStaffGradeSimple(s)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Cards */}
                  <div className="grid grid-cols-1 md:hidden divide-y divide-[#F0F2F7]">
                    {paginatedStaff.map(s => {
                      const isCurrentSelf = s.id === admin?.id
                      const isOnline = isStaffOnline(s)
                      const assignedSchoolNames = s.assigned_school_ids
                        ?.map((id: string) => schoolMap.get(id)?.name)
                        .filter(Boolean) as string[] || []

                      return (
                        <div
                          key={s.id}
                          onClick={(e) => {
                            captureGenieOrigin(e)
                            setSelectedStaffDetail(s)
                          }}
                          className="p-4 space-y-2.5 hover:bg-[#F6EFFF]/40 transition-colors cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={s.avatar_url || '/images/clay/avatar_girl.jpg'}
                                alt={s.full_name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                              />
                              <div>
                                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                                  <span>{s.full_name}</span>
                                  {isCurrentSelf && (
                                    <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 text-[9px] font-extrabold border border-purple-200">You</span>
                                  )}
                                </h3>
                                <p className="text-xs font-bold text-[#8B72F4]">{getStaffDesignation(s)}</p>
                              </div>
                            </div>

                            {isOnline ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">Online</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 shrink-0">Offline</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <div className="flex flex-wrap gap-1">
                              {s.role === 'psds' ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">All Schools</span>
                              ) : assignedSchoolNames.length > 0 ? (
                                s.assigned_school_ids?.map((schId: string) => {
                                  const sch = schoolMap.get(schId)
                                  if (!sch) return null
                                  const sess = s.school_sessions?.[schId]
                                  return (
                                    <span key={schId} className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-[#EEF0FF] text-[#3B49B8]">
                                      {getSchoolAbbreviation(sch.name, sess)}
                                    </span>
                                  )
                                })
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                              )}
                            </div>

                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {getStaffGradeSimple(s)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 3D Soft Claymorphic Pagination Controls Bar */}
                  {filteredStaff.length > 0 && (
                    <div className="p-4 bg-[#FAFBFF] border-t border-[#E8EAF0] flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Items per page selector & Total status */}
                      <div className="flex items-center gap-3 text-xs font-semibold text-[#64748B]">
                        <div className="flex items-center gap-1.5">
                          <span>Show</span>
                          <select
                            value={itemsPerPage}
                            onChange={e => setItemsPerPage(Number(e.target.value))}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-[#CBD5E1] text-[#1E293B] font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 cursor-pointer shadow-2xs"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                          <span>per page</span>
                        </div>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <span>
                          Showing <strong className="text-[#1E293B] font-extrabold">{filteredStaff.length > 0 ? startIndex + 1 : 0}</strong> to <strong className="text-[#1E293B] font-extrabold">{endIndex}</strong> of <strong className="text-[#1E293B] font-extrabold">{filteredStaff.length}</strong> personnel
                        </span>
                      </div>

                      {/* Page Navigation Buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={safeCurrentPage <= 1}
                          className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#8B72F4] hover:bg-[#F6EFFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                          title="Previous Page"
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              if (totalPages <= 7) return true
                              return (
                                page === 1 ||
                                page === totalPages ||
                                Math.abs(page - safeCurrentPage) <= 1
                              )
                            })
                            .reduce<(number | string)[]>((acc, page, index, array) => {
                              if (index > 0 && page - (array[index - 1] as number) > 1) {
                                acc.push('...')
                              }
                              acc.push(page)
                              return acc
                            }, [])
                            .map((item, idx) => {
                              if (item === '...') {
                                return (
                                  <span key={`ellipsis-${idx}`} className="px-2 text-xs font-bold text-[#A39BAF]">
                                    ...
                                  </span>
                                )
                              }
                              const pageNum = item as number
                              const isActivePage = pageNum === safeCurrentPage
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                                    isActivePage
                                      ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-sm scale-105'
                                      : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F6EFFF] hover:text-[#8B72F4]'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              )
                            })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage >= totalPages}
                          className="p-2 rounded-xl border border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#8B72F4] hover:bg-[#F6EFFF] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                          title="Next Page"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Add / Edit Staff Modal */}
        {shouldRenderStaffModal && (
          <div className={`fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto ${staffModalBackdropClass}`}>
            <div className={`bg-[#FAF5F0] rounded-[36px] max-w-4xl w-full shadow-[0_25px_60px_rgba(139,114,244,0.3)] overflow-hidden border-4 border-white ${staffModalContainerClass}`}>
              {/* Modal Header */}
              <div className="px-7 py-5 bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white flex items-center justify-between shadow-xs relative overflow-hidden">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-amber-300">
                    <Briefcase size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black tracking-tight font-display">{editingStaff ? 'Edit Staff Profile' : 'Add New Faculty / Staff'}</h2>
                    <p className="text-[11px] text-white/80 font-medium">Configure credentials, roles, and school scope</p>
                  </div>
                </div>
                <button
                  onClick={closeStaffModal}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all cursor-pointer border border-white/30 active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveStaff} className="p-7 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                {/* Profile Avatar Selection Section */}
                <div className="p-5 rounded-[28px] bg-white/90 border-2 border-white shadow-xs space-y-3">
                  <label className="block text-xs font-black text-[#2D2638] flex items-center gap-1.5 font-display">
                    <Camera size={15} className="text-[#8B72F4]" />
                    Staff Profile Picture / Avatar
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={avatarUrl || '/images/clay/avatar_girl.jpg'}
                        alt="Staff Avatar Preview"
                        className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md bg-[#F6EFFF]"
                      />
                      <span className="absolute bottom-0 right-0 p-1 bg-[#8B72F4] text-white rounded-full shadow-xs">
                        <Sparkles size={12} />
                      </span>
                    </div>

                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer text-xs font-bold text-[#8B72F4] bg-[#FAF5F0] hover:bg-[#F6EFFF] border border-[#8B72F4]/30 px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-2xs transition-all">
                          <Upload size={13} />
                          Upload Photo
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>

                        <div className="relative flex-1">
                          <input
                            type="text"
                            placeholder="Or paste image URL..."
                            value={avatarUrl}
                            onChange={e => setAvatarUrl(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-[11px] rounded-full border-2 border-white bg-[#FAF5F0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white text-[#2D2638] font-semibold"
                          />
                          <ImageIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 font-semibold transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. m.santos@deped.gov.ph"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 font-semibold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Login Password Credentials *</label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      required
                      placeholder="e.g. password123"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 font-mono transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A39BAF] hover:text-[#2D2638] p-1 transition-colors"
                    >
                      {showFormPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-black text-[#2D2638] mb-2 font-display">Assign Designation / Role</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'teacher', label: 'Teacher', icon: GraduationCap },
                      { id: 'school_head', label: 'School Head', icon: Building2 },
                      { id: 'psds', label: 'PSDS Supervisor', icon: Award },
                      { id: 'ao_2', label: 'Admin Officer II', icon: Briefcase },
                    ].map(rOption => {
                      const IconComp = rOption.icon
                      const isSelected = role === rOption.id
                      return (
                        <div
                          key={rOption.id}
                          onClick={() => setRole(rOption.id as UserRole)}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer select-none transition-all flex flex-col items-center justify-center text-center gap-1.5 ${
                            isSelected
                              ? 'bg-gradient-to-br from-[#F6EFFF] via-[#EEF0FF] to-[#E5E8FF] border-[#8B72F4] text-[#6542F1] shadow-xs font-black'
                              : 'bg-white border-white text-[#7A7289] hover:bg-[#F6EFFF] shadow-2xs font-bold'
                          }`}
                        >
                          <IconComp size={20} className={isSelected ? 'text-[#8B72F4]' : 'text-[#A39BAF]'} />
                          <span className="text-xs">{rOption.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ROLE SPECIFIC ASSIGNMENT RULES */}
                {role === 'teacher' && (
                  <div className="p-5 bg-white/90 rounded-[28px] border-2 border-white shadow-xs space-y-4">
                    {/* STEP 1: SELECT SCHOOL FIRST */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#2D2638] block font-display flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={16} className="text-[#8B72F4]" />
                          1. Select School Assignment (Choose School First):
                        </span>
                        {assignedSchoolIds.length > 0 && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={12} /> School Selected
                          </span>
                        )}
                      </label>
                      
                      <select
                        value={assignedSchoolIds[0] || ''}
                        onChange={e => {
                          const schoolId = e.target.value
                          if (schoolId) {
                            setAssignedSchoolIds([schoolId])
                            const selSchool = schools.find(s => s.id === schoolId)
                            if (selSchool) {
                              if (selSchool.school_type === 'elementary' && (teacherCategory === 'jhs' || teacherCategory === 'shs')) {
                                setTeacherCategory('grade_1_6')
                              } else if (selSchool.school_type === 'secondary' && (teacherCategory === 'grade_1_6' || teacherCategory === 'kindergarten')) {
                                setTeacherCategory('jhs')
                              }
                            }
                          } else {
                            setAssignedSchoolIds([])
                            setAssignedGradeIds([])
                            setAssignedSubjectIds([])
                            setAssignedGradeSubjectIds({})
                          }
                        }}
                        className="w-full px-4 py-2.5 text-xs rounded-2xl bg-[#FAF5F0] border-2 border-white text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                      >
                        <option value="">-- Choose Assigned School --</option>
                        {schools.map(sch => (
                          <option key={sch.id} value={sch.id}>
                            {sch.name} ({sch.school_type.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* IF NO SCHOOL IS SELECTED YET */}
                    {assignedSchoolIds.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-200/60 text-amber-900 text-xs font-semibold flex items-center gap-3">
                        <AlertCircle size={18} className="text-amber-600 shrink-0" />
                        <div>
                          <span className="font-black block font-display">Please select a school first</span>
                          <span className="text-[11px] text-amber-800 font-medium">
                            Choosing a school will narrow down the available grade levels and subject options specifically offered at that school.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* STEP 2: TEACHER GRADE LEVEL / CATEGORY OPTION */}
                        <div className="space-y-2 pt-2 border-t border-[#F0E6DD]">
                          <label className="block text-xs font-black text-[#2D2638] font-display">
                            2. Teacher Level / Category Option:
                          </label>
                          {(() => {
                            const currentSchool = schools.find(s => s.id === assignedSchoolIds[0])
                            const isElem = currentSchool?.school_type === 'elementary'
                            const isSec = currentSchool?.school_type === 'secondary'

                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {(!isSec) && (
                                  <button
                                    type="button"
                                    onClick={() => setTeacherCategory('kindergarten')}
                                    className={`p-2.5 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                                      teacherCategory === 'kindergarten'
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-white shadow-xs'
                                        : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                                    }`}
                                  >
                                    Kindergarten
                                  </button>
                                )}
                                {(!isSec) && (
                                  <button
                                    type="button"
                                    onClick={() => setTeacherCategory('grade_1_6')}
                                    className={`p-2.5 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                                      teacherCategory === 'grade_1_6'
                                        ? 'bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white border-white shadow-xs'
                                        : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                                    }`}
                                  >
                                    ES (G1–6)
                                  </button>
                                )}
                                {(!isElem) && (
                                  <button
                                    type="button"
                                    onClick={() => setTeacherCategory('jhs')}
                                    className={`p-2.5 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                                      teacherCategory === 'jhs'
                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-white shadow-xs'
                                        : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                                    }`}
                                  >
                                    JHS (G7–10)
                                  </button>
                                )}
                                {(!isElem) && (
                                  <button
                                    type="button"
                                    onClick={() => setTeacherCategory('shs')}
                                    className={`p-2.5 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                                      teacherCategory === 'shs'
                                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-white shadow-xs'
                                        : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                                    }`}
                                  >
                                    SHS (G11–12)
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setTeacherCategory('subject_teacher')}
                                  className={`p-2.5 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${isElem || isSec ? 'col-span-1' : 'sm:col-span-2'} ${
                                    teacherCategory === 'subject_teacher'
                                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-white shadow-xs'
                                      : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                                  }`}
                                >
                                  Multi-Grade / Subject Teacher
                                </button>
                              </div>
                            )
                          })()}
                        </div>

                        {/* STEP 3: ASSIGN GRADES (IF NOT KINDERGARTEN) */}
                        {teacherCategory !== 'kindergarten' && (
                          <div className="space-y-3.5 pt-3 border-t border-[#F0E6DD]">
                            <div>
                              <label className="text-xs font-black text-[#2D2638] block mb-1.5 font-display flex items-center justify-between">
                                <span>3. Assign Grade Levels (Select Multiple):</span>
                                {assignedGradeIds.length > 0 && (
                                  <span className="text-[10px] font-bold text-[#8B72F4] bg-[#F6EFFF] px-2 py-0.5 rounded-full border border-[#8B72F4]/20">
                                    {assignedGradeIds.length} Grade(s) Selected
                                  </span>
                                )}
                              </label>
                              <div className="grid grid-cols-2 gap-2 p-3 bg-[#FAF5F0] rounded-2xl border-2 border-white max-h-48 overflow-y-auto custom-scrollbar">
                                {grades
                                  .filter(g => {
                                    const currentSchool = schools.find(s => s.id === assignedSchoolIds[0])
                                    if (currentSchool?.offered_grade_numbers && currentSchool.offered_grade_numbers.length > 0) {
                                      if (!currentSchool.offered_grade_numbers.includes(g.grade_number)) return false
                                    } else if (currentSchool?.school_type === 'elementary') {
                                      if (g.grade_number > 6) return false
                                    } else if (currentSchool?.school_type === 'secondary') {
                                      if (g.grade_number < 7) return false
                                    }

                                    if (teacherCategory === 'grade_1_6') return g.grade_number >= 1 && g.grade_number <= 6
                                    if (teacherCategory === 'jhs') return g.grade_number >= 7 && g.grade_number <= 10
                                    if (teacherCategory === 'shs') return g.grade_number >= 11 && g.grade_number <= 12
                                    return g.grade_number >= 1 && g.grade_number <= 12
                                  })
                                  .map(g => (
                                    <label
                                      key={g.id}
                                      className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer text-xs transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={assignedGradeIds.includes(g.id)}
                                        onChange={() => toggleGradeSelection(g.id)}
                                        className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4 cursor-pointer"
                                      />
                                      <span className="font-bold text-[#2D2638]">{g.name}</span>
                                    </label>
                                  ))}
                              </div>
                            </div>

                            {/* STEP 4: ASSIGN SPECIFIC SUBJECTS PER GRADE LEVEL */}
                            {assignedGradeIds.length > 0 && (
                              <div className="space-y-3 pt-3 border-t border-[#F0E6DD]">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-black text-[#2D2638] flex items-center gap-1.5 font-display">
                                    <BookOpen size={15} className="text-[#8B72F4]" />
                                    4. Assign Specific Subjects per Grade Level:
                                  </label>
                                  <span className="text-[10px] font-bold text-[#8B72F4] bg-[#F6EFFF] px-2.5 py-0.5 rounded-full border border-[#8B72F4]/20">
                                    {assignedSubjectIds.length} Total Subject(s) Selected
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#7A7289]">
                                  Select the specific subjects/learning areas assigned to this teacher for each selected grade level.
                                </p>

                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                  {assignedGradeIds.map(gId => {
                                    const gradeObj = grades.find(g => g.id === gId)
                                    if (!gradeObj) return null

                                    const availableLAs = getLearningAreasForGrade(gId)
                                    const selectedSubjectIdsForGrade = assignedGradeSubjectIds[gId] || []
                                    const isAllSelected = availableLAs.length > 0 && availableLAs.every(la => selectedSubjectIdsForGrade.includes(la.id))

                                    return (
                                      <div key={gId} className="p-3.5 rounded-2xl bg-[#FAF5F0] border-2 border-white space-y-2.5 text-xs shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-black text-[#2D2638] text-xs">
                                              {gradeObj.name}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F6EFFF] text-[#8B72F4] border border-[#8B72F4]/20">
                                              {selectedSubjectIdsForGrade.length} of {availableLAs.length} subjects
                                            </span>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => toggleAllSubjectsForGrade(gId, availableLAs)}
                                            className="text-[10px] font-bold text-[#8B72F4] hover:underline cursor-pointer"
                                          >
                                            {isAllSelected ? 'Deselect All' : 'Select All Subjects'}
                                          </button>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                          {availableLAs.map(la => {
                                            const isSelected = selectedSubjectIdsForGrade.includes(la.id)
                                            const otherTeacher = assignedSchoolIds[0] ? getOtherTeacherAssignedToSubject(assignedSchoolIds[0], gId, la.id) : null
                                            const isDisabled = !!otherTeacher

                                            return (
                                              <label
                                                key={la.id}
                                                title={otherTeacher ? `Already assigned to ${otherTeacher.full_name}` : undefined}
                                                className={`flex items-center justify-between gap-1.5 p-2 rounded-xl border text-[11px] font-bold transition-all ${
                                                  isDisabled
                                                    ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed opacity-80'
                                                    : isSelected
                                                    ? 'bg-white border-[#8B72F4] text-[#8B72F4] shadow-2xs cursor-pointer'
                                                    : 'bg-white/60 border-transparent text-[#7A7289] hover:bg-white hover:text-[#2D2638] cursor-pointer'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <input
                                                    type="checkbox"
                                                    disabled={isDisabled}
                                                    checked={isSelected}
                                                    onChange={() => toggleSubjectForGrade(gId, la.id)}
                                                    className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-3.5 h-3.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                                  />
                                                  <span className="truncate">{la.name}</span>
                                                </div>

                                                {otherTeacher && (
                                                  <span
                                                    className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0 truncate max-w-[90px]"
                                                    title={`Assigned to ${otherTeacher.full_name}`}
                                                  >
                                                    {otherTeacher.full_name.split(' ')[0]}
                                                  </span>
                                                )}
                                              </label>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Daily Session Duty & Working Hours Options */}
                        {assignedSchoolIds.length > 0 && (
                          <div className="space-y-3 pt-3 border-t border-[#F0E6DD]">
                            <div className="space-y-2">
                              <span className="text-xs font-black text-[#2D2638] block font-display flex items-center gap-1.5">
                                <Clock size={15} className="text-[#FA6B6B]" />
                                Daily Session Duty per School (A.M. Morning vs P.M. Afternoon):
                              </span>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {assignedSchoolIds.map((schId, idx) => {
                                  const sch = schools.find(s => s.id === schId)
                                  if (!sch) return null
                                  const sessionVal = schoolSessions[schId] || (assignedSchoolIds.length > 1 && teacherCategory === 'kindergarten' ? (idx === 0 ? 'am' : 'pm') : 'full_day')

                                  return (
                                    <div key={schId} className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF5F0] border-2 border-white text-xs">
                                      <span className="font-bold text-[#2D2638] truncate max-w-[55%]">
                                        {sch.name}
                                      </span>
                                      <select
                                        value={sessionVal}
                                        onChange={e => {
                                          const val = e.target.value as 'am' | 'pm' | 'full_day'
                                          setSchoolSessions(prev => ({ ...prev, [schId]: val }))
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FA6B6B]/20"
                                      >
                                        <option value="am">🌅 Morning Session Only (A.M.)</option>
                                        <option value="pm">🌆 Afternoon Session Only (P.M.)</option>
                                        <option value="full_day">☀️ Full Day Duty (A.M. & P.M.)</option>
                                      </select>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t border-[#F0E6DD]">
                              <label className="text-xs font-black text-[#2D2638] block font-display flex items-center gap-1.5">
                                <Clock size={15} className="text-[#8B72F4]" />
                                Prescribed Working Hours Schedule Option:
                              </label>
                              <select
                                value={workingHoursPreset}
                                onChange={e => setWorkingHoursPreset(e.target.value as 'option_1' | 'option_2')}
                                className="w-full px-4 py-2.5 text-xs rounded-2xl bg-[#FAF5F0] border-2 border-white text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                              >
                                <option value="option_1">Option 1: 7:00 AM – 11:30 AM & 1:00 PM – 5:00 PM (Default)</option>
                                <option value="option_2">Option 2: 8:00 AM – 12:00 PM & 1:00 PM – 5:00 PM</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {role === 'school_head' && (
                  <div className="p-5 bg-amber-50/80 rounded-[28px] border-2 border-amber-100 space-y-2">
                    <label className="block text-xs font-black text-amber-950 font-display">Assign School for Principal / School Head</label>
                    <select
                      value={assignedSchoolIds[0] || ''}
                      onChange={e => setAssignedSchoolIds([e.target.value])}
                      className="w-full px-4 py-2.5 text-xs rounded-2xl bg-white border-2 border-white text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-amber-500/20"
                    >
                      <option value="">-- Choose Assigned School --</option>
                      {schools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name} ({sch.school_type.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>
                )}

                {role === 'psds' && (
                  <div className="p-5 bg-indigo-50/80 rounded-[28px] border-2 border-indigo-100 flex items-center gap-3.5">
                    <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 shrink-0">
                      <MapPin size={22} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 font-display">District Supervisor Scope</h4>
                      <p className="text-[11px] text-indigo-800/90 mt-0.5 font-medium leading-relaxed">
                        PSDS is automatically assigned to <strong>Concepcion District</strong> with full monitoring access across all schools in the district.
                      </p>
                    </div>
                  </div>
                )}

                {role === 'ao_2' && (
                  <div className="p-5 bg-blue-50/80 rounded-[28px] border-2 border-blue-100 space-y-4">
                    <div>
                      <h4 className="text-xs font-black text-blue-950 flex items-center gap-2 font-display">
                        <Briefcase size={16} className="text-blue-600" />
                        Administrative Officer II (AO II) Assignment Scope
                      </h4>
                      <p className="text-[11px] text-blue-800 font-medium mt-0.5">
                        Choose assignment scope. Assigning to District automatically grants full System Administrator access.
                      </p>
                    </div>

                    {/* Scope Option Selector Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAoScope('school')}
                        className={`p-3 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 ${
                          aoScope === 'school'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-[#7A7289] border-white hover:bg-blue-50'
                        }`}
                      >
                        <Building2 size={16} />
                        <span>School Only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAoScope('district')}
                        className={`p-3 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 ${
                          aoScope === 'district'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-[#7A7289] border-white hover:bg-purple-50'
                        }`}
                      >
                        <Globe size={16} />
                        <span>District Only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAoScope('both')}
                        className={`p-3 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1 ${
                          aoScope === 'both'
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-[#7A7289] border-white hover:bg-indigo-50'
                        }`}
                      >
                        <Network size={16} />
                        <span>School & District</span>
                      </button>
                    </div>

                    {/* Automatic Admin Access Alert Banner */}
                    {(aoScope === 'district' || aoScope === 'both') && (
                      <div className="p-3.5 rounded-2xl bg-purple-100/90 border border-purple-200 text-purple-900 text-xs font-semibold flex items-start gap-2.5 animate-fade-in shadow-2xs">
                        <ShieldCheck size={16} className="text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black block text-purple-950 font-display">Automatic Admin Access Granted</span>
                          <span className="text-[11px] text-purple-800 leading-snug block mt-0.5 font-medium">
                            Because this AO II is assigned to {aoScope === 'both' ? 'both District & School' : 'District Office'}, system access is automatically elevated to <strong>System Administrator</strong> across all modules.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* School Selector Checkboxes */}
                    {(aoScope === 'school' || aoScope === 'both') && (
                      <div className="space-y-2 pt-2 border-t border-blue-200/60">
                        <label className="text-xs font-black text-blue-950 block font-display">
                          Assign School(s) for AO II:
                        </label>
                        <div className="max-h-44 overflow-y-auto space-y-1.5 p-3 bg-white rounded-2xl border-2 border-white custom-scrollbar">
                          {schools.map(sch => (
                            <label
                              key={sch.id}
                              className="flex items-center gap-2.5 p-2 hover:bg-blue-50 rounded-xl cursor-pointer text-xs transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={assignedSchoolIds.includes(sch.id)}
                                onChange={() => toggleSchoolSelection(sch.id)}
                                className="rounded text-blue-600 w-4 h-4 cursor-pointer"
                              />
                              <span className="font-bold text-[#2D2638]">{sch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-3 border-t border-[#F0E6DD]">
                  <input
                    type="checkbox"
                    id="staff-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="staff-active" className="text-xs font-black text-[#2D2638] cursor-pointer select-none">
                    System Access Enabled (Active)
                  </label>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#F0E6DD]">
                  <button
                    type="button"
                    onClick={closeStaffModal}
                    className="px-6 py-3 rounded-full bg-white text-[#7A7289] hover:bg-[#F6EFFF] hover:text-[#2D2638] font-black text-xs border border-white shadow-2xs transition-all cursor-pointer active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-7 py-3 rounded-full bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white font-black text-xs shadow-md hover:brightness-105 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:animate-button-sparkle border border-white/50"
                  >
                    {saving ? 'Saving Profile...' : (editingStaff ? 'Update Staff Profile' : 'Save Staff Profile')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Staff Details Popup Modal */}
        {shouldRenderDetailModal && selectedStaffDetail && (
          <div className={`fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto ${detailModalBackdropClass}`}>
            <div className={`bg-[#FAF5F0] rounded-[36px] max-w-2xl w-full shadow-[0_25px_60px_rgba(139,114,244,0.3)] overflow-hidden border-4 border-white ${detailModalContainerClass}`}>
              {/* Header */}
              <div className="px-7 py-6 bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white flex items-center justify-between relative overflow-hidden">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={selectedStaffDetail.avatar_url || '/images/clay/avatar_girl.jpg'}
                      alt={selectedStaffDetail.full_name}
                      className="w-14 h-14 rounded-full object-cover border-4 border-white/90 shadow-md bg-[#F6EFFF]"
                    />
                    {isStaffOnline(selectedStaffDetail) && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-2xs" title="Currently Online" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight font-display flex items-center gap-2">
                      <span>{selectedStaffDetail.full_name}</span>
                      {selectedStaffDetail.id === admin?.id && (
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-extrabold border border-white/30">You</span>
                      )}
                    </h2>
                    <p className="text-xs text-white/90 font-medium">{selectedStaffDetail.email}</p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black border border-white/30 backdrop-blur-xs">
                        {getStaffDesignation(selectedStaffDetail)}
                      </span>
                      {isStaffOnline(selectedStaffDetail) ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] font-black border border-emerald-300/40 backdrop-blur-xs flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online Now
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px] font-bold border border-white/20">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={closeDetailModal}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all cursor-pointer border border-white/30 active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body Content */}
              <div className="p-7 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {/* Credentials & Access */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-white border-2 border-white shadow-2xs space-y-1">
                    <span className="text-[10px] font-black text-[#A39BAF] uppercase tracking-wider block">Login Password</span>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-xs font-bold text-[#2D2638]">
                        {visiblePasswords[selectedStaffDetail.id] ? (selectedStaffDetail.password || 'password123') : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(selectedStaffDetail.id)}
                        className="text-[#8B72F4] hover:text-[#795CEE] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        {visiblePasswords[selectedStaffDetail.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{visiblePasswords[selectedStaffDetail.id] ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border-2 border-white shadow-2xs space-y-1">
                    <span className="text-[10px] font-black text-[#A39BAF] uppercase tracking-wider block">Access Status</span>
                    <div className="flex items-center justify-between pt-1">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-black ${selectedStaffDetail.is_active ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${selectedStaffDetail.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {selectedStaffDetail.is_active ? 'Active Access' : 'Disabled'}
                      </span>

                      {selectedStaffDetail.id !== admin?.id && (
                        <button
                          type="button"
                          onClick={() => {
                            handleToggleAccessStatus(selectedStaffDetail)
                            setSelectedStaffDetail(prev => prev ? { ...prev, is_active: !prev.is_active } : null)
                          }}
                          className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#F6EFFF] text-[#8B72F4] hover:bg-[#8B72F4] hover:text-white transition-all border border-[#8B72F4]/20 cursor-pointer"
                        >
                          Toggle Status
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assigned Schools */}
                <div className="p-4 rounded-2xl bg-white border-2 border-white shadow-2xs space-y-2">
                  <span className="text-[10px] font-black text-[#A39BAF] uppercase tracking-wider block flex items-center gap-1.5">
                    <Building2 size={13} className="text-[#8B72F4]" />
                    Assigned School(s)
                  </span>

                  {selectedStaffDetail.role === 'psds' ? (
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-900 text-xs font-bold border border-indigo-200">
                      District Wide Access: Concepcion District (All Schools)
                    </div>
                  ) : selectedStaffDetail.assigned_school_ids && selectedStaffDetail.assigned_school_ids.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedStaffDetail.assigned_school_ids.map(schId => {
                        const sch = schoolMap.get(schId)
                        if (!sch) return null
                        const sess = selectedStaffDetail.school_sessions?.[schId]
                        const sessText = sess === 'am' ? ' (Morning Session A.M.)' : sess === 'pm' ? ' (Afternoon Session P.M.)' : ' (Full Day Duty)'

                        return (
                          <div key={schId} className="p-2.5 rounded-xl bg-[#FAF5F0] border border-[#F0E6DD] text-xs font-bold text-[#2D2638] flex items-center justify-between">
                            <span>{sch.name}</span>
                            <span className="text-[10px] font-extrabold text-[#8B72F4] bg-white px-2 py-0.5 rounded-md border border-[#8B72F4]/20">
                              {getSchoolAbbreviation(sch.name)}{sessText}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#A39BAF] italic">No school assigned</p>
                  )}
                </div>

                {/* Grade Level & Subject Scope Details */}
                <div className="p-4 rounded-2xl bg-white border-2 border-white shadow-2xs space-y-2.5">
                  <span className="text-[10px] font-black text-[#A39BAF] uppercase tracking-wider block flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-[#8B72F4]" />
                    Grade Level & Teaching Scope
                  </span>

                  <div className="text-xs space-y-2">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF5F0]">
                      <span className="font-bold text-[#7A7289]">Grade Level Scope:</span>
                      <span className="font-black text-[#2D2638] bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                        {getStaffGradeSimple(selectedStaffDetail)}
                      </span>
                    </div>

                    {selectedStaffDetail.role === 'teacher' && selectedStaffDetail.assigned_grade_subject_ids && Object.keys(selectedStaffDetail.assigned_grade_subject_ids).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold text-[#2D2638] block">Assigned Learning Areas per Grade:</span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                          {selectedStaffDetail.assigned_grade_ids?.map(gId => {
                            const gObj = gradeMap.get(gId)
                            const subjectIds = selectedStaffDetail.assigned_grade_subject_ids?.[gId] || []
                            if (!gObj || subjectIds.length === 0) return null
                            const subjectNames = learningAreas
                              .filter(la => subjectIds.includes(la.id))
                              .map(la => la.name)

                            return (
                              <div key={gId} className="p-2 rounded-xl bg-[#FAF5F0] border border-[#F0E6DD] text-xs">
                                <span className="font-black text-[#8B72F4] block mb-1">{gObj.name}:</span>
                                <div className="flex flex-wrap gap-1">
                                  {subjectNames.map((sName, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white text-[#2D2638] text-[10px] font-bold border border-slate-200">
                                      {sName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Action Footer Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-[#F0E6DD] gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        closeDetailModal()
                        handleOpenEdit(selectedStaffDetail, e)
                      }}
                      className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white text-xs font-black shadow-xs hover:brightness-105 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      Edit Profile
                    </button>

                    {selectedStaffDetail.id !== admin?.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          captureGenieOrigin(e)
                          closeDetailModal()
                          setStaffToDelete(selectedStaffDetail)
                        }}
                        className="px-4 py-2.5 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-black transition-all border border-rose-200 cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 size={13} />
                        Delete Profile
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={closeDetailModal}
                    className="px-5 py-2.5 rounded-full bg-white text-[#7A7289] hover:bg-[#F6EFFF] hover:text-[#2D2638] text-xs font-black transition-all border border-white shadow-2xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={!!staffToDelete}
          title="Delete Personnel Record"
          message={`Are you sure you want to permanently delete the faculty profile for ${staffToDelete?.full_name}? This will remove their profile and access credentials. This action cannot be undone.`}
          confirmLabel="Delete Personnel"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={deleting}
          onConfirm={handleDeleteStaff}
          onCancel={() => setStaffToDelete(null)}
        />
      </div>
    </SchoolConnectLayout>
  )
}
