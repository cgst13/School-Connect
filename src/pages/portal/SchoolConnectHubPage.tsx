import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Grid,
  FileCheck,
  GraduationCap,
  Users,
  ClipboardList,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  LogOut,
  Bell,
  Search,
  CheckCircle2,
  Lock,
  Layers,
  Award,
  Activity,
  ChevronRight,
  UserCheck,
  BookOpen,
  Calendar,
  Clock,
  ScrollText,
  Settings
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { REGISTERED_SYSTEMS, SystemConfig } from '@/config/systems'

export function SchoolConnectHubPage() {
  const { admin, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')

  const filteredSystems = REGISTERED_SYSTEMS.filter(
    (sys) =>
      sys.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sys.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sys.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleLaunchSystem = (sys: SystemConfig) => {
    if (sys.enabled) {
      navigate(sys.route)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header Navbar */}
      <header className="relative z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 shadow-xs">
        <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-0.5 shadow-md shadow-blue-500/10">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Grid className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-slate-900 font-display">
                  SCHOOL CONNECT
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Unified Platform
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Integrated Educational Systems Portal</p>
            </div>
          </div>

          {/* User Profile / Auth Status */}
          <div className="flex items-center gap-3">
            {admin ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900">{admin.full_name}</span>
                  <span className="text-[10px] text-slate-500 capitalize">{admin.role.replace('_', ' ')}</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs flex items-center justify-center">
                  {admin.full_name.charAt(0)}
                </div>
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/15 transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                Portal Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 w-full px-4 sm:px-6 md:px-8 py-8 space-y-8">
        {/* Hero Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-6 sm:p-8 shadow-xl">
          <div className="relative z-10 max-w-5xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              School Connect Ecosystem Hub
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Welcome to School Connect Portal
            </h1>
            <p className="text-sm sm:text-base text-blue-100 leading-relaxed">
              Access all school administrative systems, teacher evaluation tools, learner records, and compliance engines from one single unified dashboard.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-blue-100">
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-md border border-white/15">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Single Sign-On (SSO) Active
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-md border border-white/15">
                <Building2 className="w-3.5 h-3.5 text-blue-200" /> Multi-School Scope
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-md border border-white/15">
                <Layers className="w-3.5 h-3.5 text-purple-200" /> Modular Architecture
              </span>
            </div>
          </div>
        </div>



        {/* Systems & Applications Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Grid className="w-5 h-5 text-blue-600" />
                School Systems & Applications
              </h2>
              <p className="text-xs text-slate-500">
                Select an application below to launch or view system details
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search systems..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-white border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-xs"
              />
            </div>
          </div>

          {/* Systems Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSystems.map((sys) => {
              const Icon = sys.icon
              const isActive = sys.enabled

              return (
                <div
                  key={sys.id}
                  className={`group relative rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between ${
                    isActive
                      ? 'bg-white border-slate-200 hover:border-[#0B1F3A] hover:shadow-md cursor-pointer'
                      : 'bg-slate-100/60 border-slate-200 opacity-75'
                  }`}
                  onClick={() => handleLaunchSystem(sys)}
                >
                  <div className="space-y-4">
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between">
                      <div className="p-3 rounded-xl bg-[#0B1F3A] text-white shadow-xs">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {sys.badgeText || (isActive ? 'Operational' : 'Coming Soon')}
                      </span>
                    </div>

                    {/* App Title & Description */}
                    <div>
                      <div className="text-[10px] font-bold text-[#64748B] tracking-wider uppercase mb-1">
                        {sys.category}
                      </div>
                      <h3 className="text-base font-extrabold text-[#111827] group-hover:text-[#0B1F3A] transition-colors">
                        {sys.name}
                      </h3>
                      <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                        {sys.description}
                      </p>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                    {isActive ? (
                      <span className="text-[#0B1F3A] font-bold flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                        Launch Application <ArrowRight className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="text-[#64748B] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> System under preparation
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Global Governance & Master Data Section */}
        <div className="space-y-6 pt-6 border-t border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Global Platform Governance & Master Data
            </h2>
            <p className="text-xs text-slate-500">
              Platform-wide administration, academic structure configurations, personnel records, and security controls
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Academic Structure & Master Data */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Academic Structure & Master Data</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/admin/schools"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Schools Directory</h4>
                    <p className="text-[11px] text-slate-500">School list & type setup</p>
                  </div>
                </Link>

                <Link
                  to="/admin/learning-areas"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Learning Areas</h4>
                    <p className="text-[11px] text-slate-500">Subjects & grade mapping</p>
                  </div>
                </Link>

                <Link
                  to="/admin/school-years"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700">School Years</h4>
                    <p className="text-[11px] text-slate-500">Academic calendar years</p>
                  </div>
                </Link>

                <Link
                  to="/admin/terms"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700">Terms & Quarters</h4>
                    <p className="text-[11px] text-slate-500">Active evaluation terms</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* 2. Platform Administration & Security */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-extrabold text-slate-900">Platform Administration & Staff</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/portal/staff"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">Faculty & Staff</h4>
                    <p className="text-[11px] text-slate-500">Personnel & assignments</p>
                  </div>
                </Link>

                <Link
                  to="/admin/administrators"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">Administrators</h4>
                    <p className="text-[11px] text-slate-500">Superadmin accounts</p>
                  </div>
                </Link>

                <Link
                  to="/admin/audit-log"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-700">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">Audit Logs</h4>
                    <p className="text-[11px] text-slate-500">Platform activity log</p>
                  </div>
                </Link>

                <Link
                  to="/admin/settings"
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition-all flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">System Settings</h4>
                    <p className="text-[11px] text-slate-500">Configuration & backups</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="w-full px-4 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">School Connect System Platform</span>
            <span>&bull;</span>
            <span>All Educational Modules Integrated</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Designed for Department of Education & Partner Institutions
          </div>
        </div>
      </footer>
    </div>
  )
}
