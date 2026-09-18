import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { fetchAllAdmins, fetchSchools, upsertStaffProfile, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
import type { AdminProfile, School, UserRole } from '@/types'
import { format } from 'date-fns'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'
import {
  ShieldCheck,
  Shield,
  Plus,
  Search,
  Building2,
  Users,
  Key,
  Eye,
  EyeOff,
  Edit2,
  ShieldOff,
  Check,
  CheckCircle2,
  X,
  Sparkles,
  Lock,
  UserPlus
} from 'lucide-react'

export function AdministratorsPage() {
  const { admin } = useAuth()
  const { toast } = useToast()

  const [allProfiles, setAllProfiles] = useState<AdminProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all')
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  // Grant / Edit Access Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const {
    shouldRender: shouldRenderAdminModal,
    triggerClose: closeAdminModal,
    containerClass: adminModalContainerClass,
    backdropClass: adminModalBackdropClass
  } = useGenieModal(isModalOpen, () => setIsModalOpen(false))

  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [isCustomPersonnel, setIsCustomPersonnel] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminProfile | null>(null)

  // Form Fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('password123')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [accessRole, setAccessRole] = useState<UserRole>('admin')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Revoke Access Confirmation Dialog State
  const [subToRevoke, setSubToRevoke] = useState<AdminProfile | null>(null)
  const [revoking, setRevoking] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [profiles, schoolList] = await Promise.all([
        fetchAllAdmins(),
        fetchSchools(true),
      ])
      setAllProfiles(profiles)
      setSchools(schoolList)
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to load system administrators from Supabase', table: 'sc_admin_profiles' }), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Administrators & Access Control | School Connect'
    loadData()
  }, [])

  // Filter administrator list (profiles with admin access level: superadmin, admin, psds, or district-assigned AO II)
  const adminProfiles = allProfiles.filter(p => p.role === 'superadmin' || p.role === 'admin' || p.role === 'psds' || (p.role === 'ao_2' && !!p.district_name))

  // Filter staff list eligible to be granted access (faculty & staff without current admin access or for picking)
  const availableFacultyStaff = allProfiles.filter(p => p.role !== 'superadmin')

  const filteredAdmins = adminProfiles.filter(a => {
    const matchesSearch =
      a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole =
      selectedRoleFilter === 'all' ||
      (selectedRoleFilter === 'ao_2' &&
        (a.role === 'ao_2' || (a.role === 'admin' && a.assigned_school_ids && a.assigned_school_ids.length > 0))) ||
      (selectedRoleFilter === 'admin' &&
        (a.role === 'admin' || a.role === 'superadmin' || (a.role === 'ao_2' && !!a.district_name))) ||
      a.role === selectedRoleFilter
    return matchesSearch && matchesRole
  })

  // Open modal to Grant Access
  const handleOpenGrantAccess = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingAdmin(null)
    setSelectedStaffId('')
    setIsCustomPersonnel(false)
    setFullName('')
    setEmail('')
    setPassword('password123')
    setAccessRole('admin')
    setIsActive(true)
    setIsModalOpen(true)
  }

  // Open modal to Edit Access for an existing Admin
  const handleOpenEditAccess = (targetAdmin: AdminProfile, e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    setEditingAdmin(targetAdmin)
    setSelectedStaffId(targetAdmin.id)
    setIsCustomPersonnel(false)
    setFullName(targetAdmin.full_name)
    setEmail(targetAdmin.email)
    setPassword(targetAdmin.password || 'password123')
    setAccessRole(targetAdmin.role)
    setIsActive(targetAdmin.is_active)
    setIsModalOpen(true)
  }

  // Handle staff dropdown selection change
  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId)
    if (staffId === '__NEW__') {
      setIsCustomPersonnel(true)
      setFullName('')
      setEmail('')
      setPassword('password123')
    } else {
      setIsCustomPersonnel(false)
      const target = allProfiles.find(p => p.id === staffId)
      if (target) {
        setFullName(target.full_name)
        setEmail(target.email)
        setPassword(target.password || 'password123')
        setAccessRole(target.role === 'superadmin' ? 'superadmin' : 'admin')
      }
    }
  }

  // Toggle login password visibility on table/card
  const togglePasswordVisibility = (adminId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [adminId]: !prev[adminId]
    }))
  }

  // Save / Grant System Access
  const handleSaveSystemAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      toast('Please enter both name and email.', 'warning')
      return
    }

    setSaving(true)
    try {
      const existingProfile = allProfiles.find(p => p.id === selectedStaffId)

      const payload: Partial<AdminProfile> = {
        id: editingAdmin?.id || (existingProfile ? existingProfile.id : undefined),
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim() || 'password123',
        role: accessRole,
        is_active: isActive,
        assigned_school_ids: existingProfile?.assigned_school_ids || [],
        assigned_grade_ids: existingProfile?.assigned_grade_ids || [],
        teacher_category: existingProfile?.teacher_category,
      }

      const saved = await upsertStaffProfile(payload)

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: editingAdmin ? 'update_admin_access' : 'grant_admin_access',
        entity_type: 'administrator',
        entity_id: saved.id,
        entity_label: saved.full_name,
        details: { grantedRole: saved.role, email: saved.email },
      })

      toast(editingAdmin ? 'Administrator settings updated.' : `Granted ${accessRole} access to ${fullName}.`, 'success')
      closeAdminModal()
      loadData()
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to save admin profile to Supabase', table: 'sc_admin_profiles' }), 'error')
    } finally {
      setSaving(false)
    }
  }

  // Toggle active system access status directly
  const handleToggleActiveStatus = async (targetAdmin: AdminProfile) => {
    try {
      await upsertStaffProfile({
        ...targetAdmin,
        is_active: !targetAdmin.is_active,
      })

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: targetAdmin.is_active ? 'deactivate_admin' : 'activate_admin',
        entity_type: 'administrator',
        entity_id: targetAdmin.id,
        entity_label: targetAdmin.full_name,
      })

      toast(
        targetAdmin.is_active
          ? `System access deactivated for ${targetAdmin.full_name}.`
          : `System access activated for ${targetAdmin.full_name}.`,
        'success'
      )
      loadData()
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to update admin status in Supabase', table: 'sc_admin_profiles' }), 'error')
    }
  }

  // Revoke Admin Access (reverts role to standard 'teacher' or 'staff')
  const handleRevokeAccess = async () => {
    if (!subToRevoke) return
    setRevoking(true)
    try {
      await upsertStaffProfile({
        ...subToRevoke,
        role: 'teacher',
      })

      await insertAuditLog({
        admin_id: admin?.id || null,
        admin_name: admin?.full_name || 'System Administrator',
        action: 'revoke_admin_access',
        entity_type: 'administrator',
        entity_id: subToRevoke.id,
        entity_label: subToRevoke.full_name,
      })

      toast(`Revoked administrator access for ${subToRevoke.full_name}. Reverted to Faculty & Staff directory.`, 'success')
      setSubToRevoke(null)
      loadData()
    } catch {
      toast('Failed to revoke admin access.', 'error')
    } finally {
      setRevoking(false)
    }
  }

  // Helper for rendering school name badges
  const renderSchoolBadges = (schoolIds?: string[]) => {
    if (!schoolIds || schoolIds.length === 0) {
      return <span className="text-[11px] text-[#94A3B8] italic">Global System Access</span>
    }
    const matched = schools.filter(s => schoolIds.includes(s.id))
    if (matched.length === 0) return <span className="text-[11px] text-[#94A3B8]">No school assigned</span>

    return (
      <div className="flex flex-wrap gap-1">
        {matched.map(s => (
          <span key={s.id} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EEF0FF] text-[#3B49B8] border border-[#BFD7FF]">
            {s.name}
          </span>
        ))}
      </div>
    )
  }

  const superAdminCount = adminProfiles.filter(a => a.role === 'superadmin').length
  const sysAdminCount = adminProfiles.filter(a => a.role === 'admin').length
  const activeCount = adminProfiles.filter(a => a.is_active).length

  return (
    <SchoolConnectLayout systemTitle="Administrators & System Access Governance">
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Header Banner */}
        <PageHeader
          badge="Platform Access Control"
          title="System Administrators & Access Governance"
          description="Grant system evaluation & administrative privileges to Faculty & Staff members, manage access roles, set credentials, and monitor accounts."
          actions={
            <button
              onClick={(e) => handleOpenGrantAccess(e)}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:animate-button-sparkle"
            >
              <UserPlus size={16} />
              <span>Grant System Access</span>
            </button>
          }
        />

        {/* Neumorphic 3D Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-[24px] bg-[#EFF3F9] shadow-neu-out border border-white/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#BFDBFE] to-[#93C5FD] text-[#1D4ED8] flex items-center justify-center shrink-0 shadow-md border border-white">
              <Shield size={22} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase text-[#64748B]">Total Admins</p>
              <p className="text-2xl font-black text-[#2D3748]">{adminProfiles.length}</p>
            </div>
          </div>

          <div className="p-5 rounded-[24px] bg-[#EFF3F9] shadow-neu-out border border-white/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DDD6FE] to-[#C4B5FD] text-[#6D28D9] flex items-center justify-center shrink-0 shadow-md border border-white">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase text-[#64748B]">Super Admins</p>
              <p className="text-2xl font-black text-[#2D3748]">{superAdminCount}</p>
            </div>
          </div>

          <div className="p-5 rounded-[24px] bg-[#EFF3F9] shadow-neu-out border border-white/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FDE68A] to-[#FCD34D] text-[#B45309] flex items-center justify-center shrink-0 shadow-md border border-white">
              <Users size={22} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase text-[#64748B]">Evaluators</p>
              <p className="text-2xl font-black text-[#2D3748]">{sysAdminCount}</p>
            </div>
          </div>

          <div className="p-5 rounded-[24px] bg-[#EFF3F9] shadow-neu-out border border-white/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#A7F3D0] to-[#6EE7B7] text-[#047857] flex items-center justify-center shrink-0 shadow-md border border-white">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase text-[#64748B]">Active Logins</p>
              <p className="text-2xl font-black text-[#047857]">{activeCount}</p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-5 rounded-[28px] bg-[#EFF3F9] shadow-neu-out border border-white/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search admin by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-[#EFF3F9] shadow-neu-in border border-transparent text-[#2D3748] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#6675E8] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedRoleFilter('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'all'
                  ? 'bg-white shadow-neu-out-sm text-[#1D4ED8] border border-white'
                  : 'bg-[#EFF3F9] text-[#64748B] hover:bg-white/60'
              }`}
            >
              All Admins ({adminProfiles.length})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('superadmin')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'superadmin'
                  ? 'bg-white shadow-neu-out-sm text-[#6D28D9] border border-white'
                  : 'bg-[#EFF3F9] text-[#64748B] hover:bg-white/60'
              }`}
            >
              Super Administrators ({superAdminCount})
            </button>
            <button
              onClick={() => setSelectedRoleFilter('admin')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'admin'
                  ? 'bg-white shadow-neu-out-sm text-[#6675E8] border border-white'
                  : 'bg-[#EFF3F9] text-[#64748B] hover:bg-white/60'
              }`}
            >
              System Evaluators ({sysAdminCount})
            </button>
          </div>
        </div>

        {/* Administrator Directory: Table on Desktop, Cards on Mobile */}
        <div className="bg-[#EFF3F9] rounded-[28px] shadow-neu-out border border-white/80 overflow-hidden">
          {loading ? (
            <div className="p-12">
              <DepEdSpinner size="lg" label="Loading Administrators..." subtitle="Fetching system access permissions from database" />
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No administrators found" icon={<Shield size={32} />} description="No accounts match your current search filter." />
            </div>
          ) : (
            <>
              {/* Desktop Data Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFBFF] border-b border-[#E8EAF0] text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3.5 px-4 sm:px-6">Administrator / Personnel</th>
                      <th className="py-3.5 px-4">System Access Level</th>
                      <th className="py-3.5 px-4">Assigned Schools</th>
                      <th className="py-3.5 px-4">Login Password</th>
                      <th className="py-3.5 px-4">Access Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F2F7]">
                    {filteredAdmins.map(ap => {
                      const isCurrentSelf = ap.id === admin?.id
                      const isSuper = ap.role === 'superadmin'

                      return (
                        <tr key={ap.id} className="hover:bg-[#FAFBFF] transition-colors">
                          <td className="py-4 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 border ${
                                isSuper ? 'bg-gradient-to-br from-[#7C3AED] to-[#5B3B9B] text-white border-[#D9C8FF]' : 'bg-gradient-to-br from-[#6675E8] to-[#3B49B8] text-white border-[#BFD7FF]'
                              }`}>
                                {ap.full_name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-[#1F2937] truncate">{ap.full_name}</span>
                                  {isCurrentSelf && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#EEF0FF] text-[#3B49B8] border border-[#BFD7FF]">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#64748B]">{ap.email}</p>
                                <p className="text-[10px] text-[#94A3B8]">Joined {format(new Date(ap.created_at), 'MMM d, yyyy')}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                              isSuper ? 'bg-[#F6F2FF] text-[#5B3B9B] border-[#D9C8FF]' : 'bg-[#EEF0FF] text-[#3B49B8] border-[#BFD7FF]'
                            }`}>
                              {isSuper ? 'Super Administrator' : 'System Evaluator'}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            {renderSchoolBadges(ap.assigned_school_ids)}
                          </td>

                          <td className="py-4 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs font-mono">
                              <Key size={12} className="text-[#94A3B8]" />
                              <span className="text-[#1F2937] font-semibold text-[11px]">
                                {visiblePasswords[ap.id] ? (ap.password || 'password123') : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(ap.id)}
                                className="text-[#94A3B8] hover:text-[#1F2937] ml-1 transition-colors cursor-pointer"
                                title="Toggle password view"
                              >
                                {visiblePasswords[ap.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <button
                              type="button"
                              onClick={() => !isCurrentSelf && handleToggleActiveStatus(ap)}
                              disabled={isCurrentSelf}
                              className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                                ap.is_active
                                  ? 'bg-[#F0FAF5] text-[#1E6B48] border-[#BFE8D5] hover:bg-[#E2F7ED]'
                                  : 'bg-[#FFF0F5] text-[#992B54] border-[#FFCCD8] hover:bg-[#FFE5EE]'
                              }`}
                              title={isCurrentSelf ? "Cannot deactivate active self session" : "Click to toggle active system access status"}
                            >
                              <span className={`w-2 h-2 rounded-full ${ap.is_active ? 'bg-[#1E6B48] animate-pulse' : 'bg-[#992B54]'}`} />
                              {ap.is_active ? 'Active' : 'Suspended'}
                            </button>
                          </td>

                          <td className="py-4 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditAccess(ap, e)}
                                className="p-1.5 rounded-xl text-[#64748B] hover:text-[#6675E8] hover:bg-[#EEF0FF] border border-[#E2E8F0] transition-all cursor-pointer active:animate-button-sparkle"
                                title="Edit System Access Level & Password"
                              >
                                <Edit2 size={14} />
                              </button>

                              {!isCurrentSelf && (
                                <button
                                  type="button"
                                  onClick={(e) => { captureGenieOrigin(e); setSubToRevoke(ap) }}
                                  className="p-1.5 rounded-xl text-[#64748B] hover:text-[#E11D48] hover:bg-[#FFF0F5] border border-[#E2E8F0] transition-all cursor-pointer active:animate-button-sparkle"
                                  title="Revoke Admin Access (Revert to regular Faculty profile)"
                                >
                                  <ShieldOff size={14} />
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
              <div className="block md:hidden divide-y divide-[#F0F2F7]">
                {filteredAdmins.map(ap => {
                  const isCurrentSelf = ap.id === admin?.id
                  const isSuper = ap.role === 'superadmin'

                  return (
                    <div key={ap.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 border ${
                            isSuper ? 'bg-gradient-to-br from-[#7C3AED] to-[#5B3B9B] text-white border-[#D9C8FF]' : 'bg-gradient-to-br from-[#6675E8] to-[#3B49B8] text-white border-[#BFD7FF]'
                          }`}>
                            {ap.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-[#1F2937]">{ap.full_name}</h3>
                            <p className="text-[11px] text-[#64748B]">{ap.email}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isSuper ? 'bg-[#F6F2FF] text-[#5B3B9B] border-[#D9C8FF]' : 'bg-[#EEF0FF] text-[#3B49B8] border-[#BFD7FF]'
                        }`}>
                          {isSuper ? 'Super Admin' : 'Evaluator'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] font-mono text-[11px]">
                          <Key size={12} className="text-[#94A3B8]" />
                          <span>{visiblePasswords[ap.id] ? (ap.password || 'password123') : '••••••••'}</span>
                          <button type="button" onClick={() => togglePasswordVisibility(ap.id)} className="text-[#94A3B8]">
                            {visiblePasswords[ap.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAccess(ap)}
                            className="p-1.5 rounded-xl text-[#64748B] hover:bg-[#EEF0FF] border border-[#E2E8F0]"
                          >
                            <Edit2 size={14} />
                          </button>
                          {!isCurrentSelf && (
                            <button
                              type="button"
                              onClick={() => setSubToRevoke(ap)}
                              className="p-1.5 rounded-xl text-[#E11D48] hover:bg-[#FFF0F5] border border-[#FFCCD8]"
                            >
                              <ShieldOff size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Grant / Edit System Access Modal */}
        {shouldRenderAdminModal && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm ${adminModalBackdropClass}`}>
            <div className="absolute inset-0" onClick={closeAdminModal} />

            <div className={`relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-[#E8EAF0] shadow-2xl space-y-5 z-10 max-h-[90vh] overflow-y-auto ${adminModalContainerClass}`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0F2F7]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-[#EEF0FF] text-[#6675E8] border border-[#BFD7FF]">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#1F2937] tracking-tight">
                      {editingAdmin ? 'Edit System Administrator Access' : 'Grant System Access to Faculty & Staff'}
                    </h2>
                    <p className="text-xs text-[#64748B]">Assign administrative privileges and credentials</p>
                  </div>
                </div>
                <button
                  onClick={closeAdminModal}
                  className="p-2 rounded-xl text-[#94A3B8] hover:text-[#1F2937] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveSystemAccess} className="space-y-4">
                {!editingAdmin && (
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-[#1F2937]">
                      Select Faculty & Staff Member *
                    </label>
                    <select
                      value={selectedStaffId}
                      onChange={e => handleSelectStaff(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-[#FAFBFF] border border-[#E8EAF0] text-[#1F2937] font-semibold focus:outline-none focus:border-[#6675E8] focus:ring-2 focus:ring-[#EEF0FF]"
                      required
                    >
                      <option value="">-- Choose Personnel from Faculty & Staff Directory --</option>
                      {availableFacultyStaff.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.email}) — Role: {s.role.toUpperCase()}
                        </option>
                      ))}
                      <option value="__NEW__">+ Create New Personnel & Grant System Access</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g., Juan Dela Cruz"
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FAFBFF] border border-[#E8EAF0] text-[#1F2937] focus:outline-none focus:border-[#6675E8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1F2937] mb-1">Official Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g., juan.delacruz@deped.gov.ph"
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-[#FAFBFF] border border-[#E8EAF0] text-[#1F2937] focus:outline-none focus:border-[#6675E8]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#1F2937]">
                    Granted System Access Level *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAccessRole('admin')}
                      className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 cursor-pointer ${
                        accessRole === 'admin'
                          ? 'bg-[#EEF0FF] border-[#BFD7FF] text-[#3B49B8] shadow-xs'
                          : 'bg-[#FAFBFF] border-[#E8EAF0] text-[#64748B] hover:bg-[#EEF0FF]/50'
                      }`}
                    >
                      <Shield size={18} className="mt-0.5 shrink-0 text-[#6675E8]" />
                      <div>
                        <p className="text-xs font-extrabold text-[#1F2937]">System Evaluator / Admin</p>
                        <p className="text-[10px] text-[#64748B] mt-0.5">Manage evaluation submissions, data consolidation & analytics reports</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessRole('superadmin')}
                      className={`p-3 rounded-2xl border transition-all text-left flex items-start gap-2.5 cursor-pointer ${
                        accessRole === 'superadmin'
                          ? 'bg-[#F6F2FF] border-[#D9C8FF] text-[#5B3B9B] shadow-xs'
                          : 'bg-[#FAFBFF] border-[#E8EAF0] text-[#64748B] hover:bg-[#F6F2FF]/50'
                      }`}
                    >
                      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#7C3AED]" />
                      <div>
                        <p className="text-xs font-extrabold text-[#1F2937]">Super Administrator</p>
                        <p className="text-[10px] text-[#64748B] mt-0.5">Full control over master data, school setups, audit logs & system settings</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1F2937] mb-1">
                    System Password Credentials *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordInput ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="e.g., password123"
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl text-xs bg-[#FAFBFF] border border-[#E8EAF0] text-[#1F2937] font-mono focus:outline-none focus:border-[#6675E8]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1F2937]"
                    >
                      {showPasswordInput ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    This password allows the user to log into TERMCAT System & School Connect SSO Portal.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="admin-active"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#6675E8] border-[#E8EAF0] focus:ring-[#EEF0FF]"
                  />
                  <label htmlFor="admin-active" className="text-xs font-bold text-[#1F2937] cursor-pointer">
                    Enable Active System Login Access
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0F2F7]">
                  <button
                    type="button"
                    onClick={closeAdminModal}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#6675E8] hover:bg-[#5463DA] shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? 'Processing...' : (editingAdmin ? 'Update Access Level' : 'Grant System Access')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Revoke Admin Access Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={!!subToRevoke}
          title="Revoke Administrator Access"
          message={`Are you sure you want to revoke system administrator privileges for ${subToRevoke?.full_name}? They will retain their profile in the Faculty & Staff directory as a standard personnel profile.`}
          confirmLabel="Revoke Admin Access"
          cancelLabel="Cancel"
          variant="danger"
          isLoading={revoking}
          onConfirm={handleRevokeAccess}
          onCancel={() => setSubToRevoke(null)}
        />
      </div>
    </SchoolConnectLayout>
  )
}
