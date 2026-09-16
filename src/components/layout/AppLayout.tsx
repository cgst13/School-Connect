import { useState, ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Grid,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { insertAuditLog } from '@/lib/supabase/queries'
import { AppLauncher } from '@/components/ui/AppLauncher'
import { REGISTERED_SYSTEMS } from '@/config/systems'

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

interface AppLayoutProps {
  children: ReactNode
  activeSystemId?: string
  systemTitle?: string
  navGroups?: NavGroup[]
}

export function AppLayout({
  children,
  activeSystemId = 'termcat',
  systemTitle,
  navGroups = []
}: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('school_connect_sidebar_collapsed') === 'true'
  })

  const { admin, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const currentSystem = REGISTERED_SYSTEMS.find(s => s.id === activeSystemId)
  const displayTitle = systemTitle || currentSystem?.name || 'School Connect'

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
          details: { system: displayTitle },
        })
      }
      await signOut()
      navigate('/')
    } catch {
      toast('Failed to sign out', 'error')
    }
  }

  const initials = admin?.full_name
    ? admin.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'SC'

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#111827] flex flex-col w-full overflow-x-hidden font-sans selection:bg-[#0B1F3A] selection:text-white">
      {/* Universal School Connect Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2.5 flex items-center justify-between no-print shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#111827] hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {navGroups.length > 0 && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center p-1.5 rounded-md text-[#64748B] hover:text-[#111827] hover:bg-slate-100 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          {/* App Switcher + Branding */}
          <div className="flex items-center gap-3">
            <AppLauncher currentAppId={activeSystemId} />

            <div className="h-4 w-[1px] bg-[#E2E8F0] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-[#0B1F3A] tracking-tight hidden sm:inline-block">
                {displayTitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-[#0B1F3A] border border-[#E2E8F0]">
                Module
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions & User Info */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-[#64748B] border border-[#E2E8F0]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Active
          </div>

          <div className="h-4 w-[1px] bg-[#E2E8F0] hidden sm:block" />

          {admin ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0B1F3A] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {initials}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-[#111827] leading-tight truncate max-w-[120px]">{admin.full_name}</span>
                <span className="text-[10px] text-[#64748B] capitalize leading-tight">{admin.role.replace('_', ' ')}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign Out of School Connect"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#0B1F3A] hover:bg-[#07152A] transition-colors flex items-center gap-1"
            >
              <ShieldCheck size={14} />
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Shell Container */}
      <div className="flex-1 flex min-w-0">
        {/* Desktop Sidebar */}
        {navGroups.length > 0 && (
          <aside
            className={`hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-[#E2E8F0] transition-all duration-200 ${
              isCollapsed ? 'w-16' : 'w-60'
            }`}
          >
            {/* System Nav Groups */}
            <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
              {navGroups.map((group, groupIdx) => (
                <div key={group.title} className={`space-y-1 ${groupIdx > 0 ? 'pt-2 border-t border-[#E2E8F0]' : ''}`}>
                  {!isCollapsed ? (
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                      {group.title}
                    </div>
                  ) : (
                    <div className="my-2 border-t border-[#E2E8F0]" />
                  )}
                  {group.items.map(item => {
                    const isActive = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-md text-xs font-medium transition-all ${
                          isCollapsed ? 'justify-center px-2' : ''
                        } ${
                          isActive
                            ? 'bg-[#0B1F3A] text-white font-bold shadow-xs'
                            : 'text-[#64748B] hover:bg-slate-100 hover:text-[#111827]'
                        }`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>
          </aside>
        )}

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
            <div className="relative w-64 max-w-[85vw] h-full bg-white border-r border-[#E2E8F0] flex flex-col z-10 p-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <span className="text-sm font-bold text-[#0B1F3A]">{displayTitle} Navigation</span>
                <button onClick={() => setMobileOpen(false)} className="text-[#64748B] hover:text-[#111827]">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-4 overflow-y-auto">
                {navGroups.map((group, groupIdx) => (
                  <div key={group.title} className={`space-y-1 ${groupIdx > 0 ? 'pt-2 border-t border-[#E2E8F0]' : ''}`}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-1">
                      {group.title}
                    </div>
                    {group.items.map(item => {
                      const isActive = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2.5 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-[#0B1F3A] text-white font-bold shadow-xs'
                              : 'text-[#111827] hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 space-y-6">
          {children}
        </main>
      </div>

      {/* Global Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-3 px-6 text-center text-xs text-[#64748B] no-print">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>School Connect Unified Platform &copy; {new Date().getFullYear()}</span>
          <span className="text-[11px] text-[#64748B]">Department of Education & Partner Institutions</span>
        </div>
      </footer>
    </div>
  )
}
