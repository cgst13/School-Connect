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
    <div className="h-dvh max-h-dvh relative bg-gradient-to-br from-[#F4EFFC] via-[#EBF3FE] to-[#FFF1F6] text-[#2D2638] flex flex-col w-full overflow-hidden font-sans">
      {/* Responsive Fixed Non-Scrollable Background Wallpaper */}
      <picture className="fixed inset-0 w-screen h-[100dvh] min-h-[100dvh] overflow-hidden pointer-events-none z-0">
        <source media="(max-width: 768px)" srcSet="/images/bg-mobile.png" />
        <img
          src="/images/bg-desktop.png"
          alt="Background Wallpaper"
          className="w-screen h-[100dvh] min-h-[100dvh] object-cover object-center opacity-40 mix-blend-multiply transition-opacity duration-700 pointer-events-none"
        />
      </picture>

      {/* Dynamic Pastel Ambient Glow Orbs */}
      <div className="fixed top-[-12%] left-[-8%] w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-[#DDD6FE]/40 to-[#C4B5FD]/20 blur-3xl pointer-events-none animate-float-slow z-0" />
      <div className="fixed top-[15%] right-[-8%] w-[580px] h-[580px] rounded-full bg-gradient-to-br from-[#BAE6FD]/40 to-[#93C5FD]/20 blur-3xl pointer-events-none animate-float-reverse z-0" />
      <div className="fixed bottom-[-10%] left-[10%] w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-[#A7F3D0]/30 to-[#6EE7B7]/20 blur-3xl pointer-events-none z-0" />

      {/* Subtle Micro-Grid Texture Overlay */}
      <div 
        className="fixed inset-0 w-screen h-[100dvh] opacity-[0.035] pointer-events-none z-0" 
        style={{ backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`, backgroundSize: '28px 28px' }} 
      />

      {/* 3D Claymorphic Top Header Navbar */}
      <header className="relative z-40 shrink-0 bg-transparent px-4 sm:px-8 py-3.5 flex items-center justify-between no-print">
        <div className="flex items-center gap-3 sm:gap-4">
          {hasSidebar && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2.5 rounded-2xl bg-white shadow-sm text-[#7A7289] hover:text-[#8B72F4] lg:hidden transition-all cursor-pointer border border-white"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Top Header Branding with Official Logo & Greeting */}
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/portal" className="flex items-center group shrink-0" title="School Connect Portal">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-14 sm:h-18 lg:h-22 w-auto object-contain group-hover:scale-105 transition-transform duration-300"
              />
            </Link>

            <div className="hidden xs:block min-w-0 border-l border-slate-200/80 pl-4">
              <h1 className="text-base sm:text-xl font-black text-[#2D2638] tracking-tight flex items-center gap-1.5 font-display truncate">
                <span>Good day, {admin?.full_name?.split(' ')[0] || 'Administrator'}!</span>
                <span className="text-lg">👋</span>
              </h1>
              <p className="text-xs text-[#7A7289] font-medium hidden sm:block truncate">
                {systemSubtitle || `Welcome to ${systemTitle}`}
              </p>
            </div>
          </div>
        </div>

        {/* Header Right: Search Pill & Notification Bell */}
        <div className="flex items-center gap-3">
          {/* Search Pill */}
          <div className="relative hidden md:flex items-center">
            <Search size={15} className="absolute left-3.5 text-[#A39BAF]" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-2 text-xs rounded-full bg-white border border-white/90 shadow-xs text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 w-56 sm:w-64 transition-all font-medium"
            />
          </div>

          {/* Notification Bell */}
          <button className="relative p-2.5 rounded-full bg-white shadow-xs border border-white text-[#7A7289] hover:text-[#8B72F4] transition-all cursor-pointer">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FFD6E0] text-[#E11D48] text-[10px] font-black flex items-center justify-center border border-white shadow-xs">
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
                className="flex items-center gap-2.5 bg-white p-1.5 pr-3.5 rounded-full shadow-xs border border-white hover:bg-[#F6EFFF] hover:shadow-md transition-all cursor-pointer"
                title="Account Settings & User Profile"
              >
                <img
                  src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                  alt="User Avatar"
                  className="w-8 h-8 rounded-full object-cover border border-white shadow-xs shrink-0 bg-[#F6EFFF]"
                />
                <div className="text-left hidden xs:block sm:block min-w-0">
                  <span className="text-xs font-black text-[#2D2638] truncate block leading-tight">
                    {admin.full_name}
                  </span>
                  <span className="text-[10px] font-bold text-[#8B72F4] uppercase tracking-wider block">
                    {admin.role === 'ao_2'
                      ? admin.district_name && admin.assigned_school_ids && admin.assigned_school_ids.length > 0
                        ? 'AO II (District & School Admin)'
                        : admin.district_name
                        ? 'AO II (District Admin)'
                        : 'AO II'
                      : admin.role === 'school_head'
                      ? 'School Head'
                      : admin.role === 'psds'
                      ? 'PSDS'
                      : admin.role === 'teacher'
                      ? 'Teacher'
                      : 'System Admin'}
                  </span>
                </div>
                <ChevronDown size={14} className={`text-[#7A7289] transition-transform duration-200 ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Account Quick Dropdown Menu */}
              {isAccountMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAccountMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-[28px] border-2 border-white shadow-[0_16px_36px_rgba(139,114,244,0.22)] z-50 p-3 space-y-2 animate-fade-in font-sans">
                    {/* Menu Header Card */}
                    <div className="p-3 rounded-2xl bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#FAF5F0] border border-[#8B72F4]/20 flex items-center gap-3">
                      <img
                        src={admin.avatar_url || "/images/clay/avatar_girl.jpg"}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-[#2D2638] truncate font-display">{admin.full_name}</h4>
                        <p className="text-[10px] font-semibold text-[#7A7289] truncate">{admin.email}</p>
                        <span className="inline-block px-2 py-0.5 mt-1 rounded-full text-[9px] font-extrabold bg-[#8B72F4] text-white shadow-2xs">
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          handleOpenSettings(e)
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-[#2D2638] hover:bg-[#F6EFFF] hover:text-[#8B72F4] transition-all cursor-pointer text-left"
                      >
                        <div className="p-2 rounded-xl bg-[#FAF5F0] text-[#8B72F4] shadow-2xs">
                          <Settings size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block leading-tight font-black">Account Settings</span>
                          <span className="text-[10px] text-[#7A7289] font-medium block">Update Name, Email & Password</span>
                        </div>
                      </button>

                      <button
                        onClick={(e) => {
                          setIsAccountMenuOpen(false)
                          captureGenieOrigin(e)
                          setShowLogoutConfirm(true)
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-[#E11D48] hover:bg-rose-50 transition-all cursor-pointer text-left"
                      >
                        <div className="p-2 rounded-xl bg-rose-50 text-[#E11D48] shadow-2xs">
                          <LogOut size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="block leading-tight font-black">Sign Out</span>
                          <span className="text-[10px] text-rose-400 font-medium block">End current session</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/"
              className="px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] shadow-md transition-all flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Body Shell */}
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden px-4 sm:px-6 pb-4 gap-5">
        {/* 3D Claymorphic Left Sidebar Navigation */}
        {hasSidebar && (
          <>
            {/* Desktop Sidebar */}
            <aside
              className={`hidden lg:flex flex-col flex-shrink-0 bg-[#EFE6FA] rounded-[32px] border border-white/80 h-full transition-all duration-300 z-30 shadow-[0_14px_30px_rgba(185,170,210,0.18)] ${
                isCollapsed ? 'w-20 p-3' : 'w-64 p-5'
              }`}
            >
              {/* 3D Profile Frame */}
              {!isCollapsed ? (
                <div className="text-center pb-4 mb-2 border-b border-purple-200/50">
                  <div className="relative inline-block mb-2">
                    <img
                      src={admin?.avatar_url || "/images/clay/avatar_girl.jpg"}
                      alt="User Avatar"
                      className="w-20 h-20 rounded-full object-cover mx-auto shadow-md border-4 border-white"
                    />
                  </div>
                  <h3 className="text-sm font-black text-[#2D2638] tracking-tight flex items-center justify-center gap-1">
                    <span>{admin?.full_name || 'Emily'}</span>
                    <span className="text-xs text-[#8B72F4]">💜</span>
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#795CEE] px-2.5 py-0.5 rounded-full bg-white/70 border border-white/90 mt-1 shadow-2xs">
                    <span>{admin?.role.replace('_', ' ') || 'Productivity Explorer'}</span>
                    <span>✨</span>
                  </span>
                </div>
              ) : (
                <div className="text-center pb-3 mb-2 border-b border-purple-200/50">
                  <img
                    src={admin?.avatar_url || "/images/clay/avatar_girl.jpg"}
                    alt="User Avatar"
                    className="w-10 h-10 rounded-full object-cover mx-auto shadow-sm border-2 border-white"
                  />
                </div>
              )}

              {/* Navigation Items */}
              <nav className="flex-1 my-2 space-y-3 overflow-y-auto min-h-0 pr-1">
                {navGroups.map(group => (
                  <div key={group.title} className="space-y-1">
                    {!isCollapsed && (
                      <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#A39BAF] mb-1">
                        {group.title}
                      </div>
                    )}
                    {group.items.map(item => {
                      const isActive = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 py-2.5 px-3.5 rounded-2xl text-xs font-extrabold transition-all ${
                            isCollapsed ? 'justify-center px-2' : ''
                          } ${
                            isActive
                              ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md shadow-indigo-500/20'
                              : 'text-[#7A7289] hover:bg-white/60 hover:text-[#2D2638]'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[#7A7289]'}`}>{item.icon}</span>
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                          {!isCollapsed && item.badge && (
                            <span className="ml-auto text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/80 text-[#8B72F4] shadow-xs">
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
            <div className="pt-2 border-t border-purple-200/40 mt-auto shrink-0">
              <Link
                to="/portal"
                title={isCollapsed ? "Back to Portal" : undefined}
                className={`flex items-center gap-3 py-3 px-4 rounded-[22px] text-xs font-extrabold text-[#795CEE] bg-white border border-white shadow-xs hover:bg-[#F6EFFF] hover:shadow-md transition-all ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
              >
                <ArrowLeft size={16} className="shrink-0 text-[#795CEE]" />
                {!isCollapsed && <span>Back to Portal</span>}
              </Link>
            </div>
          </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex animate-fade-in">
                <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
                <div className="relative w-64 max-w-[80vw] h-full bg-[#EFF3F9] border-r border-white/80 flex flex-col z-10 p-4 space-y-4 shadow-neu-out-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-black/5">
                    <span className="text-sm font-black text-[#2D3748]">{systemTitle}</span>
                    <button onClick={() => setMobileOpen(false)} className="p-2 rounded-2xl bg-[#EFF3F9] shadow-neu-out-sm text-[#64748B]">
                      <X size={18} />
                    </button>
                  </div>
                  <nav className="flex-1 space-y-4 overflow-y-auto">
                    {navGroups.map(group => (
                      <div key={group.title} className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                          {group.title}
                        </div>
                        {group.items.map(item => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 py-3 px-3.5 rounded-2xl text-xs font-bold text-[#64748B] hover:bg-white hover:text-[#6675E8]"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </nav>

                  <div className="pt-3 border-t border-black/5 mt-auto shrink-0">
                    <Link
                      to="/portal"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 py-3 px-3.5 rounded-2xl text-xs font-bold text-[#1D4ED8] bg-white shadow-neu-out-sm"
                    >
                      <ArrowLeft size={16} />
                      <span>Back to Portal</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Neumorphic Content & Footer Scroll Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto rounded-[28px]">
          <main className="flex-1 min-w-0 p-2 sm:p-4 md:p-6 space-y-6">
            {children}
          </main>

          {/* Global School Connect Footer */}
          <footer className="border-t border-black/5 bg-[#EFF3F9] py-4 px-6 text-center text-xs text-[#64748B] no-print mt-auto rounded-b-[28px]">
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-semibold">School Connect &copy; {new Date().getFullYear()} &bull; Concepcion District, Concepcion, Romblon</span>
              <span className="text-[11px] text-[#94A3B8] font-bold">Department of Education &bull; Division of Romblon</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Account Settings Modal */}
      {shouldRenderSettingsModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${settingsModalBackdropClass}`}>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs" onClick={closeSettingsModal} />

          <div className={`relative w-full max-w-lg bg-[#FAF5F0] rounded-[36px] border-4 border-white shadow-[0_24px_50px_rgba(139,114,244,0.3)] z-10 overflow-hidden ${settingsModalContainerClass} font-sans`}>
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] p-6 text-white flex items-center justify-between border-b-4 border-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md shadow-xs">
                  <Settings size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight font-display">Account Settings</h3>
                  <p className="text-xs text-purple-100 font-medium">Manage your personal profile credentials</p>
                </div>
              </div>
              <button
                onClick={closeSettingsModal}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveAccountSettings} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Profile Photo Selector */}
              <div className="p-4 rounded-[24px] bg-white border-2 border-white shadow-xs flex items-center gap-4">
                <img
                  src={settingsAvatarUrl || '/images/clay/avatar_girl.jpg'}
                  alt="Profile Avatar"
                  className="w-16 h-16 rounded-full object-cover border-4 border-[#FAF5F0] shadow-md bg-[#F6EFFF] shrink-0"
                />
                <div className="flex-1 space-y-2">
                  <label className="block text-xs font-black text-[#2D2638] font-display">Profile Avatar Photo</label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-extrabold text-[#8B72F4] bg-[#FAF5F0] hover:bg-[#F6EFFF] border border-[#8B72F4]/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all shadow-2xs">
                      <Upload size={13} />
                      Upload Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <input
                      type="text"
                      placeholder="Or image URL..."
                      value={settingsAvatarUrl}
                      onChange={e => setSettingsAvatarUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-[11px] rounded-full bg-[#FAF5F0] border border-white text-[#2D2638] font-medium focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Christian S. Tolentino"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 transition-all"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. c.tolentino@deped.gov.ph"
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">
                  Login Password <span className="text-[#7A7289] font-normal">(Leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <input
                    type={settingsShowPassword ? 'text' : 'password'}
                    placeholder="Enter new password..."
                    value={settingsPassword}
                    onChange={e => setSettingsPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] text-[#2D2638] font-mono focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setSettingsShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A39BAF] hover:text-[#2D2638] p-1 transition-colors"
                  >
                    {settingsShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-[#F0E6DD]">
                <button
                  type="button"
                  onClick={closeSettingsModal}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#7A7289] hover:bg-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
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
