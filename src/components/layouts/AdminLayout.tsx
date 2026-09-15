import { useState, ReactNode } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileText, BarChart3, Building2, BookOpen,
  Calendar, Clock, Users, LogOut, Menu, X,
  ClipboardList, ScrollText, Shield, ChevronRight,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { insertAuditLog } from '@/lib/supabase/queries'

interface NavGroup {
  title: string
  items: {
    to: string
    label: string
    icon: ReactNode
  }[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/admin/submissions', label: 'Submissions', icon: <FileText size={18} /> },
      { to: '/admin/consolidation', label: 'Consolidation', icon: <ClipboardList size={18} /> },
      { to: '/admin/reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'Academic Structure',
    items: [
      { to: '/admin/schools', label: 'Schools', icon: <Building2 size={18} /> },
      { to: '/admin/learning-areas', label: 'Learning Areas', icon: <BookOpen size={18} /> },
      { to: '/admin/school-years', label: 'School Years', icon: <Calendar size={18} /> },
      { to: '/admin/terms', label: 'Terms & Quarters', icon: <Clock size={18} /> },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/administrators', label: 'Administrators', icon: <Shield size={18} /> },
      { to: '/admin/audit-log', label: 'Audit Logs', icon: <ScrollText size={18} /> },
    ],
  },
]

function NavItemLink({
  item,
  isCollapsed,
  onClick,
}: {
  item: NavGroup['items'][0]
  isCollapsed?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/admin'}
      onClick={onClick}
      title={isCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
          isCollapsed ? 'justify-center px-2' : 'px-3'
        } ${
          isActive
            ? 'bg-blue-600/20 text-white font-semibold shadow-sm border border-blue-500/30'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <span className="transition-colors flex-shrink-0">{item.icon}</span>
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

function Sidebar({
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: {
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}) {
  const { admin, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'logout',
        })
      }
      await signOut()
      navigate('/admin/login')
    } catch {
      toast('Failed to sign out', 'error')
    }
  }

  const initials = admin?.full_name
    ? admin.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'TC'

  return (
    <aside
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } flex-shrink-0 bg-[#0f1f3e] text-white flex flex-col h-full no-print border-r border-white/10 select-none transition-all duration-300 ease-in-out`}
    >
      {/* Brand Header */}
      <div className={`p-4 border-b border-white/10 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <Link to="/admin" className="flex items-center gap-3" title="TERMCAT Admin">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-black shadow-md border border-white/20 flex-shrink-0">
            TC
          </div>
          {!isCollapsed && (
            <div>
              <div className="font-extrabold text-white text-sm tracking-tight leading-tight flex items-center gap-1.5">
                TERMCAT
                <span className="text-[9px] font-semibold bg-blue-500/30 text-blue-300 border border-blue-400/30 px-1.5 py-0.2 rounded-full">
                  v2.0
                </span>
              </div>
              <div className="text-slate-400 text-[11px] font-medium leading-tight">DepEd Concepcion</div>
            </div>
          )}
        </Link>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5 sidebar-scroll" aria-label="Admin Navigation">
        {navGroups.map(group => (
          <div key={group.title} className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {group.title}
              </div>
            ) : (
              <div className="my-2 border-t border-white/10" />
            )}
            {group.items.map(item => (
              <NavItemLink key={item.to} item={item} isCollapsed={isCollapsed} onClick={onClose} />
            ))}
          </div>
        ))}
      </nav>

      {/* User profile + Logout footer */}
      <div className={`p-3 border-t border-white/10 bg-black/20 ${isCollapsed ? 'flex flex-col items-center space-y-3' : 'space-y-2'}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center border border-white/20 flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{admin?.full_name || 'Administrator'}</div>
                <div className="text-[11px] text-slate-400 truncate">{admin?.email}</div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-red-500/20 hover:text-red-300 border border-transparent hover:border-red-500/30 transition-all duration-150"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </>
        ) : (
          <>
            <div
              className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center border border-white/20 flex-shrink-0"
              title={`Logged in as ${admin?.full_name || 'Administrator'}`}
            >
              {initials}
            </div>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-300 transition-all"
            >
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}

function Breadcrumb() {
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)

  if (pathParts.length <= 1) {
    return <span className="text-xs text-slate-400 font-medium">Dashboard Overview</span>
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
      <Link to="/admin" className="hover:text-blue-600 transition-colors">Admin</Link>
      {pathParts.slice(1).map((part, index) => (
        <span key={part} className="flex items-center gap-1.5 capitalize">
          <ChevronRight size={12} className="text-slate-400" />
          <span className={index === pathParts.length - 2 ? 'text-slate-900 font-semibold' : 'hover:text-blue-600'}>
            {part.replace('-', ' ')}
          </span>
        </span>
      ))}
    </nav>
  )
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('termcat_sidebar_collapsed') === 'true'
  })
  const { admin } = useAuth()

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('termcat_sidebar_collapsed', String(next))
      return next
    })
  }

  const initials = admin?.full_name
    ? admin.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'TC'

  return (
    <div className="min-h-dvh bg-slate-50/70 flex w-full overflow-x-hidden">
      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <Sidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {/* Mobile Drawer Backdrop + Content */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] h-full flex flex-col z-10 animate-slide-in-right">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-dvh min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between no-print shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <Breadcrumb />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-600 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              DepEd Romblon System Online
            </div>
            
            <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-deped-blue text-white font-bold text-xs flex items-center justify-center shadow-xs ring-2 ring-blue-500/20">
                {initials}
              </div>
              <span className="text-xs font-semibold text-slate-700 hidden md:block">
                {admin?.full_name}
              </span>
            </div>
          </div>
        </header>

        {/* Page Container - Maximizes screen space */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full space-y-6">
          {children}
        </main>
      </div>
    </div>
  )
}

