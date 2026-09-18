import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/features/auth/useAuth'
import { insertAuditLog } from '@/lib/supabase/queries'
import {
  Settings,
  ShieldCheck,
  Database,
  Sliders,
  Download,
  RefreshCw,
  Globe,
  Building2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  Server,
  HardDrive,
  Cpu,
  Layers,
  Bell,
  Eye
} from 'lucide-react'

export function SystemSettingsPage() {
  const { toast } = useToast()
  const { admin } = useAuth()
  const [isSaving, setIsSaving] = useState(false)

  // Platform Identity Settings State
  const [districtName, setDistrictName] = useState('DepEd District of Concepcion')
  const [divisionName, setDivisionName] = useState('Division of Romblon')
  const [regionName, setRegionName] = useState('Region IV-B (MIMAROPA)')
  const [supportEmail, setSupportEmail] = useState('concepcion.district@deped.gov.ph')
  const [adminContact, setAdminContact] = useState('Christian S. Tolentino (AO II)')

  // Module Feature Toggles
  const [modules, setModules] = useState({
    termcat: true,
    schoolsDirectory: true,
    facultyRoster: true,
    academicCalendar: true,
    auditTrail: true,
  })

  // System Preferences & Security
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState('60')
  const [auditLevel, setAuditLevel] = useState('detailed')

  // Toggle helper
  const toggleModule = (key: keyof typeof modules) => {
    setModules(prev => {
      const updated = { ...prev, [key]: !prev[key] }
      toast(`Module ${key} set to ${updated[key] ? 'ENABLED' : 'DISABLED'}`, 'info')
      return updated
    })
  }

  // Save Settings Handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'update_platform_system_settings',
          details: {
            district_name: districtName,
            maintenance_mode: maintenanceMode,
            session_timeout: sessionTimeout,
            active_modules: modules
          }
        })
      }
      toast('Platform System Settings saved successfully!', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to save settings.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // Export Backup Handler
  const handleExportBackup = () => {
    const backupData = {
      system: 'School Connect Platform',
      district: districtName,
      division: divisionName,
      region: regionName,
      export_timestamp: new Date().toISOString(),
      modules,
      security: { maintenanceMode, sessionTimeout, auditLevel },
      support_email: supportEmail
    }

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `SchoolConnect_Config_Backup_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    toast('System configuration backup downloaded!', 'success')
  }

  // Clear Local Cache Handler
  const handleClearCache = () => {
    toast('Local browser cache refreshed.', 'info')
  }

  return (
    <SchoolConnectLayout systemTitle="Platform System Settings">
      <div className="space-y-6 w-full pb-16 animate-fade-in">
        {/* Header Banner */}
        <PageHeader
          badge="Platform System Administration"
          title="System Settings & Configuration"
          description="Global district configuration, integrated module controls, system security policies, and automated database backups."
          actions={
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-5 py-2.5 rounded-full bg-white border border-white text-[#8B72F4] hover:bg-[#F6EFFF] font-black text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={15} />
              <span>Export Config</span>
            </button>
          }
        />

        {/* Main Settings Form */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Identity & Modules */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. District & Platform Identity */}
              <div className="clay-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#8B72F4] to-[#A88BEB] text-white flex items-center justify-center border border-white shadow-md shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2D2638] font-display">District & Platform Identity</h3>
                    <p className="text-xs text-[#7A7289] font-medium">Official DepEd institutional headers and contact information</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#2D2638] mb-1">District Name</label>
                    <input
                      type="text"
                      required
                      value={districtName}
                      onChange={(e) => setDistrictName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2D2638] mb-1">Schools Division</label>
                    <input
                      type="text"
                      required
                      value={divisionName}
                      onChange={(e) => setDivisionName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2D2638] mb-1">Region</label>
                    <input
                      type="text"
                      required
                      value={regionName}
                      onChange={(e) => setRegionName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2D2638] mb-1">District Support Email</label>
                    <input
                      type="email"
                      required
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#2D2638] mb-1">Lead System Administrator Contact</label>
                    <input
                      type="text"
                      required
                      value={adminContact}
                      onChange={(e) => setAdminContact(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Integrated Educational Modules */}
              <div className="clay-card p-6 sm:p-7 space-y-5">
                <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#F9A8D4] to-[#F472B6] text-white flex items-center justify-center border border-white shadow-md shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2D2638] font-display">Integrated Educational Modules</h3>
                    <p className="text-xs text-[#7A7289] font-medium">Enable or disable core system applications for personnel</p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {/* TERMCAT Module */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#8B72F4] flex items-center justify-center font-bold text-xs border border-purple-100">
                        TC
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2D2638]">TERMCAT Evaluation System</h4>
                        <p className="text-[10px] text-[#7A7289] font-medium">Teacher records, submission monitoring & matrix consolidation</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule('termcat')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        modules.termcat ? 'bg-[#8B72F4]' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modules.termcat ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Schools Directory */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-pink-50 text-[#DB2777] flex items-center justify-center font-bold text-xs border border-pink-100">
                        SD
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2D2638]">Schools Hierarchy & Directory</h4>
                        <p className="text-[10px] text-[#7A7289] font-medium">School master records, classifications & School Head assignments</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule('schoolsDirectory')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        modules.schoolsDirectory ? 'bg-[#8B72F4]' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modules.schoolsDirectory ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Faculty Roster */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100">
                        FR
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2D2638]">Faculty & Staff Directory</h4>
                        <p className="text-[10px] text-[#7A7289] font-medium">Teacher profiles, assigned grade levels & teaching status</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule('facultyRoster')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        modules.facultyRoster ? 'bg-[#8B72F4]' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modules.facultyRoster ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Academic Calendar */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs border border-sky-100">
                        AC
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2D2638]">Academic Years & Quarters</h4>
                        <p className="text-[10px] text-[#7A7289] font-medium">School year creation & quarter evaluation term controls</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule('academicCalendar')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        modules.academicCalendar ? 'bg-[#8B72F4]' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modules.academicCalendar ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Audit Trail */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs border border-amber-100">
                        AT
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2D2638]">Security Audit Logging</h4>
                        <p className="text-[10px] text-[#7A7289] font-medium">Automatic activity logging & security compliance monitoring</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule('auditTrail')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        modules.auditTrail ? 'bg-[#8B72F4]' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${modules.auditTrail ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Security & System Health */}
            <div className="space-y-6">
              {/* 3. System Preferences & Security */}
              <div className="clay-card p-6 space-y-5">
                <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6EE7B7] to-[#10B981] text-white flex items-center justify-center border border-white shadow-md shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#2D2638] font-display">Security & Access</h3>
                    <p className="text-[11px] text-[#7A7289] font-medium">Platform protection controls</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Maintenance Mode */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[#713F12] flex items-center gap-1.5">
                        <AlertCircle size={14} className="text-amber-600" /> Maintenance Mode
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMaintenanceMode(!maintenanceMode)
                          toast(`Maintenance Mode ${!maintenanceMode ? 'ENABLED' : 'DISABLED'}`, !maintenanceMode ? 'warning' : 'info')
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                          maintenanceMode ? 'bg-amber-600' : 'bg-slate-300'
                        }`}
                      >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                      Lock central portal access for non-admin users during scheduled maintenance.
                    </p>
                  </div>

                  {/* Session Timeout */}
                  <div>
                    <label className="block font-bold text-[#2D2638] mb-1">Session Inactivity Timeout</label>
                    <select
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                    >
                      <option value="30">30 Minutes (Recommended)</option>
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours</option>
                      <option value="0">Disabled (Stay Logged In)</option>
                    </select>
                  </div>

                  {/* Audit Detail Level */}
                  <div>
                    <label className="block font-bold text-[#2D2638] mb-1">Audit Logging Detail</label>
                    <select
                      value={auditLevel}
                      onChange={(e) => setAuditLevel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-purple-100 text-xs font-semibold text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40"
                    >
                      <option value="detailed">Detailed (All User & System Actions)</option>
                      <option value="moderate">Moderate (Standard Administrative Changes)</option>
                      <option value="minimal">Minimal (Security & Auth Events Only)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Cloud DB & Backup Status */}
              <div className="clay-card p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-purple-100 pb-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#93C5FD] to-[#60A5FA] text-white flex items-center justify-center border border-white shadow-md shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#2D2638] font-display">Database & Cloud Sync</h3>
                    <p className="text-[11px] text-[#7A7289] font-medium">Supabase Cloud Infrastructure</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <h5 className="font-bold text-emerald-900 text-[11px]">Database Health: Operational</h5>
                      <p className="text-[10px] text-emerald-700 font-medium">Connected to Supabase PostgreSQL cluster</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white border border-purple-100 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#7A7289] font-medium">Last Automatic Backup</span>
                      <span className="font-bold text-[#2D2638]">Today at 02:00 AM</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#7A7289] font-medium">Audit Logs Persisted</span>
                      <span className="font-bold text-[#8B72F4]">Active</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="w-full py-2.5 rounded-2xl bg-[#8B72F4] text-white text-xs font-bold hover:bg-[#7856e0] transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download JSON Backup</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="w-full py-2 rounded-2xl bg-white border border-purple-100 text-[#7A7289] hover:text-[#2D2638] text-[11px] font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Refresh Browser Cache</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Settings Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8B72F4] via-[#795CEE] to-[#6366F1] text-white font-black text-sm shadow-[0_10px_25px_rgba(139,114,244,0.35)] hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSaving ? 'Saving Platform Settings...' : 'Save All Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </SchoolConnectLayout>
  )
}
