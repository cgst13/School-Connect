import { useState, useEffect, ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Grid,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  Sparkles,
  Star,
  Search,
  Bell,
  Settings,
  ChevronDown,
  Upload,
  Eye,
  EyeOff,
  User,
  Image as ImageIcon
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { insertAuditLog, upsertStaffProfile } from '@/lib/supabase/queries'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'
import type { AdminProfile } from '@/types'

import { AppLauncher } from '@/components/ui/AppLauncher'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  badge?: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

interface SchoolConnectLayoutProps {
  children: ReactNode
  activeAppId?: string
  systemTitle?: string
  systemSubtitle?: string
  navGroups?: NavGroup[]
}

export function SchoolConnectLayout({
  children,
  activeAppId = 'notes',
  systemTitle = 'Personal Notes & Credentials Vault',
  systemSubtitle = 'Secure Personal Notes, Reminders & Password Storage',
  navGroups = []
}: SchoolConnectLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('school_connect_sidebar_collapsed') === 'true'
  })

  const { admin, signOut, updateAdminProfile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Account Settings Dropdown & Modal State
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const {
    shouldRender: shouldRenderSettingsModal,
    triggerClose: closeSettingsModal,
    containerClass: settingsModalContainerClass,
    backdropClass: settingsModalBackdropClass
  } = useGenieModal(isSettingsModalOpen, () => setIsSettingsModalOpen(false))

  const [settingsName, setSettingsName] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsShowPassword, setSettingsShowPassword] = useState(false)
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  const handleOpenSettings = (e?: React.MouseEvent) => {
    if (e) captureGenieOrigin(e)
    if (admin) {
      setSettingsName(admin.full_name || '')
      setSettingsEmail(admin.email || '')
      setSettingsPassword(admin.password || '')
      setSettingsAvatarUrl(admin.avatar_url || '')
    }
    setIsSettingsModalOpen(true)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast('Photo must be under 2MB', 'error')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setSettingsAvatarUrl(reader.result as string)
        toast('Photo selected!', 'info')
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveAccountSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!admin) return
    setSavingAccount(true)
    try {
      const updatedFields: Partial<AdminProfile> = {
        id: admin.id,
        full_name: settingsName.trim(),
        email: settingsEmail.trim(),
        role: admin.role,
        is_active: admin.is_active,
        avatar_url: settingsAvatarUrl,
        assigned_school_ids: admin.assigned_school_ids,
        assigned_grade_ids: admin.assigned_grade_ids,
        teacher_category: admin.teacher_category,
        district_name: admin.district_name,
        updated_at: new Date().toISOString()
      }

      if (settingsPassword.trim()) {
        updatedFields.password = settingsPassword.trim()
      }

      await upsertStaffProfile(updatedFields)
      updateAdminProfile(updatedFields)

      await insertAuditLog({
        admin_id: admin.id,
        admin_name: settingsName.trim(),
        action: 'update_account_settings',
        details: { updated_fields: ['full_name', 'email', 'avatar_url', ...(settingsPassword ? ['password'] : [])] }
      })

      toast('Account settings updated successfully!', 'success')
      closeSettingsModal()
    } catch (err) {
      console.error('Failed to update account settings:', err)
      toast('Failed to update account settings.', 'error')
    } finally {
      setSavingAccount(false)
    }
  }

  useEffect(() => {
    if (systemTitle) {
      document.title = `${systemTitle} | School Connect`
    } else {
      document.title = 'School Connect - Unified Educational Systems Portal'
    }
  }, [systemTitle])

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('school_connect_sidebar_collapsed', String(next))
      return next
    })
  }

  const handleSignOut = async () => {
    try {
      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'logout',
          details: { system: systemTitle },
        })
      }
      await signOut()
      toast('Signed out successfully.', 'info')
      navigate('/')
    } catch {
      toast('Failed to sign out', 'error')
    } finally {
      setShowLogoutConfirm(false)
    }
  }

  const initials = admin?.full_name
    ? admin.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'SC'

  const hasSidebar = navGroups.length > 0

  return (
    <div className="h-dvh max-h-dvh relative bg-[#F4F6F9] text-slate-900 flex flex-col w-full overflow-hidden font-sans">
      {/* Top Header Navbar */}
      <header className="relative z-40 shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between no-print shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4">
          {hasSidebar && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-[#2563EB] hover:bg-slate-50 lg:hidden transition-all cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
          )}

          {/* Top Header Branding */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/portal" className="flex items-center gap-2 group shrink-0" title="School Connect Portal">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Logo"
                className="h-9 sm:h-10 w-auto object-contain"
              />
              <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight hidden xs:inline-block font-sans">
                School<span className="text-[#2563EB]">Connect</span>
              </span>
            </Link>

            <div className="hidden sm:block min-w-0 border-l border-slate-200 pl-3">
              <h1 className="text-xs sm:text-sm font-semibold text-slate-800 tracking-tight truncate">
                {systemTitle}
              </h1>
              <p className="text-[11px] text-slate-500 font-normal truncate">
                {systemSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Header Right: Search Input, Bell, & User Profile Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Input (Matching CRM reference "Search anything...") */}
          <div className="relative hidden md:flex items-center">
            <Search size={14} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search anything..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] w-48 sm:w-60 transition-all"
            />
          </div>

          {/* Notification Bell */}
          <button className="relative p-2 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-[#2563EB] hover:bg-slate-50 transition-all cursor-pointer">
            <Bell size={16} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border border-white">
              3
            </span>
          </button>

          {/* User Profile Pill Avatar & Menu Button */}
          {admin ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  captureGenieOrigin(e)
                  setIsAccountMenuOpen(prev => !prev)
                }}
                className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                title="Account Settings & User Profile"
              >
                <img
                  src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                  alt="User Avatar"
                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100"
                />
                <div className="text-left hidden xs:block sm:block min-w-0">
                  <span className="text-xs font-semibold text-slate-900 truncate block leading-tight">
                    {admin.full_name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate block">
                    {admin.role === 'ao_2'
                      ? 'AO II Admin'
                      : admin.role === 'school_head'
                      ? 'School Head'
                      : admin.role === 'psds'
                      ? 'PSDS'
                      : admin.role === 'teacher'
                      ? 'Teacher'
                      : 'System Admin'}
                  </span>
                </div>
                <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Quick Dropdown Menu */}
              {isAccountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAccountMenuOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-lg border border-slate-200 shadow-lg z-50 p-2 space-y-1 animate-fade-in font-sans">
                    {/* Menu Header Card */}
                    <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                      <img
                        src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                        alt="User Avatar"
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{admin.full_name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{admin.email}</p>
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-semibold bg-blue-50 text-[#2563EB] border border-blue-100">
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5 pt-1">
                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          handleOpenSettings(e)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-[#2563EB] transition-all cursor-pointer text-left"
                      >
                        <Settings size={14} className="text-slate-400" />
                        <span>Account Settings</span>
                      </button>

                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          captureGenieOrigin(e)
                          setShowLogoutConfirm(true)
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-left"
                      >
                        <LogOut size={14} className="text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Body Shell */}
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        {/* Minimal Left Sidebar Navigation */}
        {hasSidebar && (
          <>
            {/* Desktop Sidebar */}
            <aside
              className={`hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-slate-200 h-full transition-all duration-200 z-30 no-print ${
                isCollapsed ? 'w-16 p-2' : 'w-60 p-3'
              }`}
            >
              {/* Profile Frame */}
              {!isCollapsed ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-slate-50 border border-slate-200 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <img
                      src={admin?.avatar_url || "/images/clay/avatar_girl.jpg"}
                      alt="User Avatar"
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-bold text-slate-900 truncate">
                        {admin?.full_name || 'Administrator'}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {admin?.role.replace('_', ' ') || 'User'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleCollapse}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
                    title="Collapse sidebar"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
              ) : (
                <div className="text-center pb-2 mb-2 border-b border-slate-100 flex flex-col items-center gap-1.5">
                  <button
                    onClick={toggleCollapse}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                    title="Expand sidebar"
                  >
                    <PanelLeftOpen size={14} />
                  </button>
                  <img
                    src={admin?.avatar_url || "/images/clay/avatar_girl.jpg"}
                    alt="User Avatar"
                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                  />
                </div>
              )}

              {/* Navigation Items */}
              <nav className="flex-1 my-1 space-y-3 overflow-y-auto min-h-0 pr-0.5">
                {navGroups.map(group => (
                  <div key={group.title} className="space-y-1">
                    {!isCollapsed && (
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                        {group.title}
                      </div>
                    )}
                    {group.items.map(item => {
                      const isActive = item.to.includes('?')
                        ? (location.pathname + location.search === item.to || (!location.search && item.to.endsWith('tab=dashboard') && location.pathname === item.to.split('?')[0]))
                        : (location.search && (item.to === '/notes' || item.to === '/dtr') ? false : (item.to === '/admin' || item.to === '/portal' ? location.pathname === item.to : (location.pathname === item.to || location.pathname.startsWith(item.to + '/'))))

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-xs transition-all duration-150 ${
                            isCollapsed ? 'justify-center px-2' : ''
                          } ${
                            isActive
                              ? 'bg-[#2563EB] text-white font-semibold shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                          {!isCollapsed && item.badge && (
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-[#2563EB] border border-blue-100'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </nav>

              {/* Bottom Back to Portal Button */}
              <div className="pt-2 border-t border-slate-200 mt-auto shrink-0">
                <Link
                  to="/portal"
                  title={isCollapsed ? "Back to Portal" : undefined}
                  className={`flex items-center gap-2 py-1.5 px-2.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all ${
                    isCollapsed ? 'justify-center px-1.5' : ''
                  }`}
                >
                  <ArrowLeft size={15} className="shrink-0 text-slate-500" />
                  {!isCollapsed && <span>Back to Hub</span>}
                </Link>
              </div>
            </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex animate-fade-in">
                <div className="fixed inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
                <div className="relative w-64 max-w-[80vw] h-full bg-white border-r border-slate-200 flex flex-col z-10 p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-900">{systemTitle}</span>
                    <button onClick={() => setMobileOpen(false)} className="p-1 rounded-md text-slate-500 hover:bg-slate-100">
                      <X size={16} />
                    </button>
                  </div>
                  <nav className="flex-1 space-y-3 overflow-y-auto">
                    {navGroups.map(group => (
                      <div key={group.title} className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          {group.title}
                        </div>
                        {group.items.map(item => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-2.5 py-2 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-[#2563EB]"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </nav>

                  <div className="pt-2 border-t border-slate-200 mt-auto shrink-0">
                    <Link
                      to="/portal"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 py-2 px-2.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <ArrowLeft size={15} />
                      <span>Back to Hub</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Minimal Canvas Scroll Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 min-w-0 p-3 sm:p-5 space-y-5">
            {children}
          </main>

          {/* Global School Connect Footer */}
          <footer className="border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500 no-print mt-auto">
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-1">
              <span className="font-normal text-[11px]">School Connect &copy; {new Date().getFullYear()} &bull; Concepcion District, Concepcion, Romblon</span>
              <span className="text-[11px] text-slate-400">Department of Education &bull; Division of Romblon</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Account Settings Modal */}
      {shouldRenderSettingsModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${settingsModalBackdropClass}`}>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={closeSettingsModal} />

          <div className={`relative w-full max-w-lg bg-white rounded-lg border border-slate-200 shadow-xl z-10 overflow-hidden ${settingsModalContainerClass} font-sans`}>
            {/* Modal Header */}
            <div className="bg-[#2563EB] px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-white/10 text-white">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Account Settings</h3>
                  <p className="text-[11px] text-blue-100">Manage your personal profile credentials</p>
                </div>
              </div>
              <button
                onClick={closeSettingsModal}
                className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveAccountSettings} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Profile Photo Selector */}
              <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 flex items-center gap-4">
                <img
                  src={settingsAvatarUrl || '/images/clay/avatar_girl.jpg'}
                  alt="Profile Avatar"
                  className="w-14 h-14 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                />
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-900">Profile Avatar Photo</label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-semibold text-[#2563EB] bg-white hover:bg-slate-100 border border-slate-200 px-3 py-1 rounded-md flex items-center gap-1.5 transition-all shadow-2xs">
                      <Upload size={13} />
                      Upload Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <input
                      type="text"
                      placeholder="Or image URL..."
                      value={settingsAvatarUrl}
                      onChange={e => setSettingsAvatarUrl(e.target.value)}
                      className="flex-1 form-input text-[11px] py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Christian S. Tolentino"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. c.tolentino@deped.gov.ph"
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Login Password <span className="text-slate-400 font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <input
                    type={settingsShowPassword ? 'text' : 'password'}
                    placeholder="Enter new password..."
                    value={settingsPassword}
                    onChange={e => setSettingsPassword(e.target.value)}
                    className="form-input pr-9 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setSettingsShowPassword(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 transition-colors"
                  >
                    {settingsShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeSettingsModal}
                  className="btn btn-secondary text-xs px-4 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  {savingAccount ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Save Account Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out of School Connect? You will need to sign in again to access system features."
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}
