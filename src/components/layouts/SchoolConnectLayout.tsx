import { useState, ReactNode } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Grid,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Sparkles,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  ArrowLeft
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { insertAuditLog } from '@/lib/supabase/queries'
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
  activeAppId = 'termcat',
  systemTitle = 'TERMCAT System',
  systemSubtitle = 'Teacher Evaluation & Record Monitoring',
  navGroups = []
}: SchoolConnectLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('school_connect_sidebar_collapsed') === 'true'
  })

  const { admin, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

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
      navigate('/')
    } catch {
      toast('Failed to sign out', 'error')
    }
  }

  const initials = admin?.full_name
    ? admin.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'SC'

  const hasSidebar = navGroups.length > 0

  return (
    <div className="min-h-dvh bg-slate-50/80 text-slate-800 flex flex-col w-full overflow-x-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Universal Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between no-print shadow-xs">
        <div className="flex items-center gap-3">
          {hasSidebar && (
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
          )}

          {hasSidebar && (
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          {/* School Connect Brand & Switcher */}
          <div className="flex items-center gap-3">
            <AppLauncher currentAppId={activeAppId} />

            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />

            {/* Current App Title Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900 tracking-tight hidden sm:inline-block">
                {systemTitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                School Connect Suite
              </span>
            </div>
          </div>
        </div>

        {/* Header Right: Status & User Info */}
        <div className="flex items-center gap-3">
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all shadow-2xs"
            title="Go back to School Connect Portal Hub"
          >
            <ArrowLeft size={14} />
            <span>Back to Portal</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            System Operational
          </div>

          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

          {admin ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {initials}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">{admin.full_name}</span>
                <span className="text-[10px] text-slate-500 capitalize leading-tight">{admin.role.replace('_', ' ')}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign Out of School Connect"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <ShieldCheck size={14} />
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Body Shell */}
      <div className="flex-1 flex min-w-0">
        {/* Sidebar Navigation if present */}
        {hasSidebar && (
          <>
            {/* Desktop Sidebar */}
            <aside
              className={`hidden lg:flex flex-col flex-shrink-0 bg-white border-r border-slate-200/80 transition-all duration-300 ${
                isCollapsed ? 'w-20' : 'w-64'
              }`}
            >
              <div className="p-3 border-b border-slate-200/80 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
                  <Grid size={16} />
                </div>
                {!isCollapsed && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 truncate">{systemTitle}</h3>
                    <p className="text-[10px] text-slate-500 truncate">{systemSubtitle}</p>
                  </div>
                )}
              </div>

              <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
                {navGroups.map(group => (
                  <div key={group.title} className="space-y-1">
                    {!isCollapsed ? (
                      <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        {group.title}
                      </div>
                    ) : (
                      <div className="my-2 border-t border-slate-200" />
                    )}
                    {group.items.map(item => {
                      const isActive = location.pathname === item.to || (item.to !== '/admin' && location.pathname.startsWith(item.to))
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            isCollapsed ? 'justify-center px-2' : ''
                          } ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                          {!isCollapsed && item.badge && (
                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
                <div className="relative w-64 max-w-[80vw] h-full bg-white border-r border-slate-200 flex flex-col z-10 p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <span className="text-sm font-bold text-slate-900">{systemTitle}</span>
                    <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <nav className="flex-1 space-y-4 overflow-y-auto">
                    {navGroups.map(group => (
                      <div key={group.title} className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          {group.title}
                        </div>
                        {group.items.map(item => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </nav>
                </div>
              </div>
            )}
          </>
        )}

        {/* Content Container */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 space-y-6">
          {children}
        </main>
      </div>

      {/* Global School Connect Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>School Connect Unified Platform &copy; {new Date().getFullYear()}</span>
          <span className="text-[11px] text-slate-500">Integrated Educational Management Suite</span>
        </div>
      </footer>
    </div>
  )
}
