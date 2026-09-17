import { useState, useEffect } from 'react'
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
  ChevronRight,
  Globe
} from 'lucide-react'
import { fetchSchools, fetchGradeLevels, fetchAllAdmins, upsertStaffProfile, deleteStaffProfile, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { School, GradeLevel, AdminProfile, UserRole, TeacherCategory } from '@/types'
import { format } from 'date-fns'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'

export function FacultyStaffPage() {
  const { admin, updateAdminProfile } = useAuth()
  const { toast } = useToast()

  const [staffList, setStaffList] = useState<AdminProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  // Filter & Search & Org Chart Sidebar states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all')
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string | null>(null)
  const [expandedSchoolIds, setExpandedSchoolIds] = useState<Record<string, boolean>>({})
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

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
  const [aoScope, setAoScope] = useState<'district' | 'school' | 'both'>('school')
  const [isActive, setIsActive] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [sList, schList, gList] = await Promise.all([
        fetchAllAdmins(),
        fetchSchools(true),
        fetchGradeLevels(),
      ])
      setStaffList(sList)
      setSchools(schList)
      setGrades(gList)
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
    setAssignedGradeIds(prev =>
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    )
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

    if (role === 'teacher' && teacherCategory === 'kindergarten' && assignedSchoolIds.length === 0) {
      toast('Please select at least one school for the Kindergarten teacher.', 'warning')
      return
    }

    if (role === 'teacher' && teacherCategory === 'grade_1_6' && assignedGradeIds.length === 0) {
      toast('Please select at least one grade level for the Grade 1-6 teacher.', 'warning')
      return
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
        finalSchoolIds = []
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
        assigned_grade_ids: role === 'teacher' && teacherCategory === 'grade_1_6' ? assignedGradeIds : [],
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

  // Filtered staff list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())

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

    return matchesSearch && matchesRole && matchesSchool
  })

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
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {s.teacher_category === 'kindergarten' ? 'Teacher (Kindergarten)' : 'Teacher (Grade 1-6)'}
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
        return sorted.map(g => (g.grade_number ? `G${g.grade_number}` : g.name)).join(', ')
      }
    }
    if (t.teacher_category === 'kindergarten') return 'Kinder'
    return 'Grade 1-6'
  }

  return (
    <SchoolConnectLayout systemTitle="Faculty & Staff Governance Directory">
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Top Header Section Banner */}
        <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white rounded-[36px] p-6 sm:p-9 shadow-[0_20px_40px_rgba(139,114,244,0.28)] border-4 border-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold backdrop-blur-md shadow-xs">
                <Users size={14} className="text-amber-300" />
                Personnel & Staff Governance
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">Faculty & Staff Directory</h1>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed font-medium">
                Add, edit, update, or delete faculty & staff profiles across schools, configure school & grade assignments, and manage system access permissions.
              </p>
            </div>

            <button
              onClick={(e) => handleOpenAdd(e)}
              className="px-6 py-3.5 rounded-full bg-white text-[#795CEE] hover:bg-[#F6EFFF] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer active:animate-button-sparkle border border-white"
            >
              <Plus size={16} />
              Add Personnel
            </button>
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
                {schools.map(school => {
                  const schoolStaff = staffList.filter(s => s.assigned_school_ids?.includes(school.id))
                  const schoolHeads = schoolStaff.filter(s => s.role === 'school_head')
                  const ao2s = schoolStaff.filter(s => s.role === 'ao_2')
                  const teachers = schoolStaff.filter(s => s.role === 'teacher')
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
                            schoolHeads.map(sh => (
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
                            ao2s.map(ao => (
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
                                {teachers.map(t => (
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
            <div className="clay-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-full text-xs bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 focus:bg-white transition-all font-semibold"
                />
              </div>

              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All Roles' },
                  { id: 'teacher', label: 'Teachers' },
                  { id: 'school_head', label: 'School Heads' },
                  { id: 'psds', label: 'PSDS' },
                  { id: 'ao_2', label: 'AO II' },
                  { id: 'admin', label: 'System Admins' },
                ].map(rf => (
                  <button
                    key={rf.id}
                    onClick={() => setSelectedRoleFilter(rf.id)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      selectedRoleFilter === rf.id
                        ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                        : 'bg-white text-[#7A7289] hover:bg-[#F6EFFF] border border-white/90 shadow-2xs'
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
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
                          <th className="py-3.5 px-4">Designation / Role</th>
                          <th className="py-3.5 px-4">Assigned Schools</th>
                          <th className="py-3.5 px-4">Grade / Scope</th>
                          <th className="py-3.5 px-4">Login Password</th>
                          <th className="py-3.5 px-4">Access Status</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F2F7]">
                        {filteredStaff.map(s => {
                          const assignedSchoolNames = schools
                            .filter(sch => s.assigned_school_ids?.includes(sch.id))
                            .map(sch => sch.name)

                          const assignedGradeNames = grades
                            .filter(g => s.assigned_grade_ids?.includes(g.id))
                            .map(g => g.name)

                          const isCurrentSelf = s.id === admin?.id

                          return (
                            <tr key={s.id} className="hover:bg-[#FAFBFF] transition-colors">
                              <td className="py-4 px-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={s.avatar_url || '/images/clay/avatar_girl.jpg'}
                                    alt={s.full_name}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                                  />
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-[#1F2937] truncate">{s.full_name}</h4>
                                    <p className="text-[11px] text-[#64748B]">{s.email}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4">
                                {getRoleBadge(s)}
                              </td>

                              <td className="py-4 px-4">
                                {s.role === 'psds' ? (
                                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Concepcion District (All Schools)
                                  </span>
                                ) : assignedSchoolNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {assignedSchoolNames.map(name => (
                                      <span key={name} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EEF0FF] text-[#3B49B8] border border-[#BFD7FF]">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-[#94A3B8] italic">Unassigned</span>
                                )}
                              </td>

                              <td className="py-4 px-4">
                                {s.role === 'teacher' ? (
                                  s.teacher_category === 'kindergarten' ? (
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Kindergarten
                                    </span>
                                  ) : (
                                    <div className="text-xs text-[#1F2937]">
                                      <span className="font-semibold">Grade 1-6</span>
                                      {assignedGradeNames.length > 0 && (
                                        <p className="text-[11px] text-[#64748B]">
                                          {assignedGradeNames.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <span className="text-[11px] text-[#94A3B8]">Administrative</span>
                                )}
                              </td>

                              <td className="py-4 px-4">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-mono">
                                  <Key size={12} className="text-[#94A3B8]" />
                                  <span className="text-[#1F2937] font-semibold text-[11px]">
                                    {visiblePasswords[s.id] ? (s.password || 'password123') : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasswordVisibility(s.id)}
                                    className="text-[#94A3B8] hover:text-[#1F2937] ml-1 transition-colors cursor-pointer"
                                    title="Toggle password view"
                                  >
                                    {visiblePasswords[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                  </button>
                                </div>
                              </td>

                              <td className="py-4 px-4">
                                <button
                                  type="button"
                                  onClick={() => !isCurrentSelf && handleToggleAccessStatus(s)}
                                  disabled={isCurrentSelf}
                                  className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                                    s.is_active
                                      ? 'bg-[#F0FAF5] text-[#1E6B48] border-[#BFE8D5] hover:bg-[#E2F7ED]'
                                      : 'bg-[#FFF0F5] text-[#992B54] border-[#FFCCD8] hover:bg-[#FFE5EE]'
                                  }`}
                                  title={isCurrentSelf ? "Current logged in account" : "Click to toggle system access status"}
                                >
                                  <span className={`w-2 h-2 rounded-full ${s.is_active ? 'bg-[#1E6B48] animate-pulse' : 'bg-[#992B54]'}`} />
                                  {s.is_active ? 'Active' : 'Disabled'}
                                </button>
                              </td>

                              <td className="py-4 px-4 sm:px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEdit(s, e)}
                                    className="p-1.5 rounded-xl text-[#64748B] hover:text-[#6675E8] hover:bg-[#EEF0FF] border border-[#E2E8F0] transition-all cursor-pointer active:animate-button-sparkle"
                                    title="Edit Staff Profile"
                                  >
                                    <Edit2 size={14} />
                                  </button>

                                  {!isCurrentSelf && (
                                    <button
                                      type="button"
                                      onClick={(e) => { captureGenieOrigin(e); setStaffToDelete(s) }}
                                      className="p-1.5 rounded-xl text-[#64748B] hover:text-[#E11D48] hover:bg-[#FFF0F5] border border-[#E2E8F0] transition-all cursor-pointer active:animate-button-sparkle"
                                      title="Delete Personnel Profile"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile View Cards */}
                  <div className="grid grid-cols-1 md:hidden divide-y divide-[#F0F2F7]">
                    {filteredStaff.map(s => {
                      const isCurrentSelf = s.id === admin?.id

                      return (
                        <div key={s.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={s.avatar_url || '/images/clay/avatar_girl.jpg'}
                                alt={s.full_name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                              />
                              <div>
                                <h3 className="text-sm font-extrabold text-slate-900">{s.full_name}</h3>
                                <p className="text-xs text-slate-500">{s.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEdit(s)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit2 size={15} />
                              </button>
                              {!isCurrentSelf && (
                                <button
                                  onClick={() => setStaffToDelete(s)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div>{getRoleBadge(s)}</div>

                          <div className="flex items-center justify-between text-xs pt-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] font-mono text-[11px]">
                              <Key size={12} className="text-[#94A3B8]" />
                              <span>{visiblePasswords[s.id] ? (s.password || 'password123') : '••••••••'}</span>
                              <button type="button" onClick={() => togglePasswordVisibility(s.id)} className="text-[#94A3B8]">
                                {visiblePasswords[s.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => !isCurrentSelf && handleToggleAccessStatus(s)}
                              disabled={isCurrentSelf}
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                s.is_active ? 'bg-[#F0FAF5] text-[#1E6B48] border-[#BFE8D5]' : 'bg-[#FFF0F5] text-[#992B54] border-[#FFCCD8]'
                              }`}
                            >
                              {s.is_active ? 'Active' : 'Disabled'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Add / Edit Staff Modal */}
        {shouldRenderStaffModal && (
          <div className={`fixed inset-0 z-50 bg-[#2D2638]/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto ${staffModalBackdropClass}`}>
            <div className={`bg-[#FAF5F0] rounded-[36px] max-w-xl w-full shadow-[0_25px_60px_rgba(139,114,244,0.22)] overflow-hidden border-4 border-white ${staffModalContainerClass}`}>
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
              <form onSubmit={handleSaveStaff} className="p-7 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
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
                    <label className="block text-xs font-black text-[#2D2638] font-display">Teacher Grade Level Option</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setTeacherCategory('kindergarten')}
                        className={`p-3 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                          teacherCategory === 'kindergarten'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-white shadow-xs'
                            : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                        }`}
                      >
                        Kindergarten (Multi-School)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeacherCategory('grade_1_6')}
                        className={`p-3 rounded-2xl border-2 text-xs font-extrabold transition-all cursor-pointer ${
                          teacherCategory === 'grade_1_6'
                            ? 'bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white border-white shadow-xs'
                            : 'bg-[#FAF5F0] text-[#7A7289] border-white hover:bg-[#F6EFFF]'
                        }`}
                      >
                        Grade 1-6 (Multi-Grade)
                      </button>
                    </div>

                    {teacherCategory === 'kindergarten' && (
                      <div className="space-y-2.5 pt-3 border-t border-[#F0E6DD]">
                        <span className="text-xs font-black text-[#2D2638] block font-display">
                          Assign Schools for Kindergarten (Select Multiple):
                        </span>
                        <div className="max-h-44 overflow-y-auto space-y-1.5 p-3 bg-[#FAF5F0] rounded-2xl border-2 border-white custom-scrollbar">
                          {schools.map(sch => (
                            <label
                              key={sch.id}
                              className="flex items-center gap-2.5 p-2 hover:bg-white rounded-xl cursor-pointer text-xs transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={assignedSchoolIds.includes(sch.id)}
                                onChange={() => toggleSchoolSelection(sch.id)}
                                className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4"
                              />
                              <span className="font-bold text-[#2D2638]">{sch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {teacherCategory === 'grade_1_6' && (
                      <div className="space-y-3.5 pt-3 border-t border-[#F0E6DD]">
                        <div>
                          <label className="text-xs font-black text-[#2D2638] block mb-1.5 font-display">Select School:</label>
                          <select
                            value={assignedSchoolIds[0] || ''}
                            onChange={e => setAssignedSchoolIds([e.target.value])}
                            className="w-full px-4 py-2.5 text-xs rounded-2xl bg-[#FAF5F0] border-2 border-white text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
                          >
                            <option value="">-- Choose School --</option>
                            {schools.map(sch => (
                              <option key={sch.id} value={sch.id}>{sch.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-black text-[#2D2638] block mb-1.5 font-display">
                            Assign Grades (Select Multiple):
                          </label>
                          <div className="grid grid-cols-2 gap-2 p-3 bg-[#FAF5F0] rounded-2xl border-2 border-white max-h-40 overflow-y-auto custom-scrollbar">
                            {grades.filter(g => g.grade_number <= 6).map(g => (
                              <label
                                key={g.id}
                                className="flex items-center gap-2 p-2 hover:bg-white rounded-xl cursor-pointer text-xs transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignedGradeIds.includes(g.id)}
                                  onChange={() => toggleGradeSelection(g.id)}
                                  className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4"
                                />
                                <span className="font-bold text-[#2D2638]">{g.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
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
