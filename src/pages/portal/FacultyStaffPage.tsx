import { useState, useEffect } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
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
  Key
} from 'lucide-react'
import { fetchSchools, fetchGradeLevels, fetchAllAdmins, upsertStaffProfile, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { School, GradeLevel, AdminProfile, UserRole, TeacherCategory } from '@/types'
import { format } from 'date-fns'

export function FacultyStaffPage() {
  const { admin } = useAuth()
  const { toast } = useToast()

  const [staffList, setStaffList] = useState<AdminProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all')
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<AdminProfile | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showFormPassword, setShowFormPassword] = useState(false)
  const [role, setRole] = useState<UserRole>('teacher')
  const [teacherCategory, setTeacherCategory] = useState<TeacherCategory>('grade_1_6')
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<string[]>([])
  const [assignedGradeIds, setAssignedGradeIds] = useState<string[]>([])
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
    loadData()
  }, [])

  // Open modal for new staff
  const handleOpenAdd = () => {
    setEditingStaff(null)
    setFullName('')
    setEmail('')
    setPassword('password123')
    setRole('teacher')
    setTeacherCategory('grade_1_6')
    setAssignedSchoolIds([])
    setAssignedGradeIds([])
    setIsActive(true)
    setIsModalOpen(true)
  }

  // Open modal for editing
  const handleOpenEdit = (staff: AdminProfile) => {
    setEditingStaff(staff)
    setFullName(staff.full_name)
    setEmail(staff.email)
    setPassword(staff.password || 'password123')
    setRole(staff.role)
    setTeacherCategory(staff.teacher_category || 'grade_1_6')
    setAssignedSchoolIds(staff.assigned_school_ids || [])
    setAssignedGradeIds(staff.assigned_grade_ids || [])
    setIsActive(staff.is_active)
    setIsModalOpen(true)
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

  // Toggle password visibility for card
  const togglePasswordVisibility = (staffId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }))
  }

  // Save handler
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      toast('Please enter both name and email.', 'warning')
      return
    }

    // Role-specific validation
    if (role === 'teacher' && teacherCategory === 'kindergarten' && assignedSchoolIds.length === 0) {
      toast('Please select at least one school for the Kindergarten teacher.', 'warning')
      return
    }

    if (role === 'teacher' && teacherCategory === 'grade_1_6' && assignedGradeIds.length === 0) {
      toast('Please select at least one grade level for the Grade 1-6 teacher.', 'warning')
      return
    }

    if (role === 'ao_2' && assignedSchoolIds.length === 0) {
      toast('Please assign at least one school to the Administrative Officer II.', 'warning')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<AdminProfile> = {
        id: editingStaff?.id,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || 'password123',
        role,
        is_active: isActive,
        teacher_category: role === 'teacher' ? teacherCategory : undefined,
        assigned_school_ids: role === 'psds' ? schools.map(s => s.id) : (role === 'admin' || role === 'superadmin' ? [] : assignedSchoolIds),
        assigned_grade_ids: role === 'teacher' && teacherCategory === 'grade_1_6' ? assignedGradeIds : [],
        district_name: role === 'psds' ? 'Concepcion District' : undefined,
      }


      const saved = await upsertStaffProfile(payload)
      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System',
        action: editingStaff ? 'update_staff_profile' : 'create_staff_profile',
        entity_type: 'staff',
        entity_id: saved.id,
        entity_label: saved.full_name,
        details: { role: saved.role, assignedSchoolsCount: saved.assigned_school_ids?.length || 0 },
      })

      toast(editingStaff ? 'Staff profile updated successfully.' : 'New staff member added successfully.', 'success')
      setIsModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Failed to save staff:', err)
      toast('Error saving staff profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Filtered staff list
  const filteredStaff = staffList.filter(s => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = selectedRoleFilter === 'all' || s.role === selectedRoleFilter
    return matchesSearch && matchesRole
  })

  // Role pill formatter
  const getRoleBadge = (r: UserRole, cat?: TeacherCategory) => {
    switch (r) {
      case 'admin':
      case 'superadmin':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">System Admin</span>
      case 'psds':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">PSDS (District Supervisor)</span>
      case 'ao_2':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Administrative Officer II</span>
      case 'school_head':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">School Head / Principal</span>
      case 'teacher':
        return cat === 'kindergarten'
          ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Kindergarten Teacher</span>
          : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">Grade 1-6 Teacher</span>
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{r}</span>
    }
  }

  return (
    <SchoolConnectLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2 border border-blue-200">
              <Sparkles size={14} /> School Connect Governance
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Faculty & Staff Management</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage teachers, school heads, PSDS supervisors, and Administrative Officers II with customized school and grade assignments.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/15 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Faculty / Staff</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
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
              { id: 'admin', label: 'Admins' },
            ].map(rf => (
              <button
                key={rf.id}
                onClick={() => setSelectedRoleFilter(rf.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedRoleFilter === rf.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Cards / Directory */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading faculty & staff directory...</div>
        ) : filteredStaff.length === 0 ? (
          <div className="card p-12 text-center bg-white border border-slate-200 rounded-2xl">
            <Users size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No staff members match your criteria</h3>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or role filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map(s => {
              const assignedSchoolNames = schools
                .filter(sch => s.assigned_school_ids?.includes(sch.id))
                .map(sch => sch.name)

              const assignedGradeNames = grades
                .filter(g => s.assigned_grade_ids?.includes(g.id))
                .map(g => g.name)

              return (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900">{s.full_name}</h3>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Staff Profile"
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>

                    <div>{getRoleBadge(s.role, s.teacher_category)}</div>

                    {/* Password Display Box */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]">
                        <Key size={13} className="text-slate-400 shrink-0" />
                        <span className="font-bold text-slate-800">
                          {visiblePasswords[s.id] ? (s.password || 'password123') : '••••••••'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(s.id)}
                        className="text-slate-400 hover:text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {visiblePasswords[s.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{visiblePasswords[s.id] ? 'Hide' : 'Show Password'}</span>
                      </button>
                    </div>

                    {/* Assignment Scope Summary */}
                    <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5">
                      {s.role === 'psds' ? (
                        <div className="flex items-center gap-1.5 text-indigo-700 font-semibold bg-indigo-50/70 p-2 rounded-lg border border-indigo-100">
                          <MapPin size={14} className="shrink-0" />
                          <span>Scope: Concepcion District (All Schools)</span>
                        </div>
                      ) : s.role === 'admin' || s.role === 'superadmin' ? (
                        <div className="flex items-center gap-1.5 text-purple-700 font-semibold bg-purple-50/70 p-2 rounded-lg border border-purple-100">
                          <ShieldCheck size={14} className="shrink-0" />
                          <span>Scope: System-Wide Unrestricted Access</span>
                        </div>
                      ) : (
                        <>
                          {/* Schools Scope */}
                          {assignedSchoolNames.length > 0 ? (
                            <div className="text-slate-700">
                              <span className="font-bold text-slate-900">Assigned Schools ({assignedSchoolNames.length}):</span>
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                                {assignedSchoolNames.join(', ')}
                              </p>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-[11px]">No specific schools assigned</div>
                          )}

                          {/* Grades Scope (Grade 1-6 Teachers) */}
                          {s.role === 'teacher' && s.teacher_category === 'grade_1_6' && (
                            <div className="text-slate-700 pt-1">
                              <span className="font-bold text-slate-900">Assigned Grades ({assignedGradeNames.length}):</span>
                              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                {assignedGradeNames.length > 0 ? assignedGradeNames.join(', ') : 'None'}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Joined {format(new Date(s.created_at), 'MMM d, yyyy')}</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add / Edit Staff Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase size={18} className="text-blue-400" />
                  <h2 className="text-base font-extrabold">{editingStaff ? 'Edit Staff Profile' : 'Add New Faculty / Staff'}</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveStaff} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. m.santos@deped.gov.ph"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">User Password (Stored Plain)</label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter user password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showFormPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>


                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Assign Designation / Role</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'teacher', label: 'Teacher', icon: GraduationCap },
                      { id: 'school_head', label: 'School Head', icon: Building2 },
                      { id: 'psds', label: 'PSDS Supervisor', icon: Award },
                      { id: 'ao_2', label: 'Admin Officer II', icon: Briefcase },
                      { id: 'admin', label: 'System Admin', icon: ShieldCheck },
                    ].map(rOption => {
                      const IconComp = rOption.icon
                      const isSelected = role === rOption.id
                      return (
                        <div
                          key={rOption.id}
                          onClick={() => setRole(rOption.id as UserRole)}
                          className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex flex-col items-center justify-center text-center gap-1 ${
                            isSelected
                              ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-2xs font-extrabold'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <IconComp size={18} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                          <span className="text-xs">{rOption.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ROLE SPECIFIC ASSIGNMENT RULES */}

                {/* 1. TEACHER CATEGORY SPECIFIC OPTIONS */}
                {role === 'teacher' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <label className="block text-xs font-extrabold text-slate-800">Teacher Grade Level Option</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTeacherCategory('kindergarten')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          teacherCategory === 'kindergarten'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Kindergarten (Multi-School)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeacherCategory('grade_1_6')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          teacherCategory === 'grade_1_6'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Grade 1-6 (Multi-Grade)
                      </button>
                    </div>

                    {/* Kindergarten: Select Multiple Schools */}
                    {teacherCategory === 'kindergarten' && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <span className="text-xs font-bold text-slate-700 block">
                          Assign Schools for Kindergarten (Select Multiple):
                        </span>
                        <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-slate-200">
                          {schools.map(sch => (
                            <label
                              key={sch.id}
                              className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={assignedSchoolIds.includes(sch.id)}
                                onChange={() => toggleSchoolSelection(sch.id)}
                                className="rounded text-blue-600"
                              />
                              <span className="font-semibold text-slate-800">{sch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Grade 1-6: Select Primary School + Multiple Grades */}
                    {teacherCategory === 'grade_1_6' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Select School:</label>
                          <select
                            value={assignedSchoolIds[0] || ''}
                            onChange={e => setAssignedSchoolIds([e.target.value])}
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                          >
                            <option value="">-- Choose School --</option>
                            {schools.map(sch => (
                              <option key={sch.id} value={sch.id}>{sch.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Assign Grades (Select Multiple):
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 p-2 bg-white rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                            {grades.filter(g => g.grade_number <= 6).map(g => (
                              <label
                                key={g.id}
                                className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignedGradeIds.includes(g.id)}
                                  onChange={() => toggleGradeSelection(g.id)}
                                  className="rounded text-blue-600"
                                />
                                <span className="font-semibold text-slate-800">{g.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. SCHOOL HEAD / PRINCIPAL ASSIGNMENT */}
                {role === 'school_head' && (
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                    <label className="block text-xs font-bold text-amber-900">Assign School for Principal / School Head</label>
                    <select
                      value={assignedSchoolIds[0] || ''}
                      onChange={e => setAssignedSchoolIds([e.target.value])}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 bg-white"
                    >
                      <option value="">-- Choose Assigned School --</option>
                      {schools.map(sch => (
                        <option key={sch.id} value={sch.id}>{sch.name} ({sch.school_type.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. PSDS AUTOMATIC DISTRICT ASSIGNMENT */}
                {role === 'psds' && (
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 flex items-center gap-3">
                    <MapPin className="text-indigo-600 shrink-0" size={24} />
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-900">District Supervisor Scope</h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        PSDS is automatically assigned to <strong>Concepcion District</strong> with full monitoring access across all schools in the district.
                      </p>
                    </div>
                  </div>
                )}

                {/* 4. ADMINISTRATIVE OFFICER II (AO II) MULTI-SCHOOL ASSIGNMENT */}
                {role === 'ao_2' && (
                  <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-200 space-y-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                        <Briefcase size={14} className="text-blue-600" />
                        Assign Multiple Schools for Administrative Officer II (AO II)
                      </h4>
                      <p className="text-[11px] text-blue-700 mt-0.5">
                        AO II users can only view, monitor, and process data for their explicitly assigned schools.
                      </p>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white rounded-xl border border-blue-200">
                      {schools.map(sch => (
                        <label
                          key={sch.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-blue-50/50 rounded-lg cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={assignedSchoolIds.includes(sch.id)}
                            onChange={() => toggleSchoolSelection(sch.id)}
                            className="rounded text-blue-600"
                          />
                          <span className="font-semibold text-slate-800">{sch.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase">({sch.school_type})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/15"
                  >
                    {saving ? 'Saving Profile...' : editingStaff ? 'Update Staff Profile' : 'Save Faculty / Staff'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SchoolConnectLayout>
  )
}
