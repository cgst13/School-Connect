import React, { useState, useEffect, useMemo, useRef } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  Clock,
  Printer,
  Sparkles,
  RefreshCw,
  Calendar,
  User,
  Building2,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Edit3,
  Download,
  RotateCcw,
  Save,
  Coffee,
  Sun,
  Moon,
  Award,
  ShieldCheck
} from 'lucide-react'
import { fetchAllAdmins, fetchSchools } from '@/lib/supabase/queries'

export interface DTRDayEntry {
  dayNumber: number
  dateString: string
  dayOfWeek: string
  isWeekend: boolean
  isSaturday: boolean
  isSunday: boolean
  isHoliday: boolean
  holidayTitle?: string
  status: 'work' | 'saturday' | 'sunday' | 'holiday' | 'leave' | 'travel' | 'blank'
  amArrival: string
  amDeparture: string
  pmArrival: string
  pmDeparture: string
  undertimeHours: string
  undertimeMinutes: string
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
]

// Standard Philippine National Holidays (Default Lookup)
const STANDARD_PH_HOLIDAYS: Record<string, string> = {
  '01-01': 'HOLIDAY (New Year\'s Day)',
  '04-09': 'HOLIDAY (Araw ng Kagitingan)',
  '05-01': 'HOLIDAY (Labor Day)',
  '06-12': 'HOLIDAY (Philippine Independence Day)',
  '08-21': 'HOLIDAY (Ninoy Aquino Day)',
  '08-31': 'HOLIDAY (National Heroes Day)',
  '11-01': 'HOLIDAY (All Saints\' Day)',
  '11-02': 'HOLIDAY (All Souls\' Day)',
  '11-30': 'HOLIDAY (Bonifacio Day)',
  '12-08': 'HOLIDAY (Feast of Immaculate Conception)',
  '12-25': 'HOLIDAY (Christmas Day)',
  '12-30': 'HOLIDAY (Rizal Day)',
  '12-31': 'HOLIDAY (Last Day of the Year)'
}

const DTR_STORAGE_KEY = 'schoolconnect_dtr_config_v1'

export function DTRGeneratorPage() {
  const { admin } = useAuth()
  const { toast } = useToast()

  // Form State
  const [employeeName, setEmployeeName] = useState<string>(() => {
    return admin?.full_name || 'MICHELLE S. MOSQUERA'
  })
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(6) // Default June (1-indexed: 6)

  const [officialHoursText, setOfficialHoursText] = useState<string>(
    'Regular days 7:00–11:30AM / 1:00–5:00PM'
  )
  const [saturdaysText, setSaturdaysText] = useState<string>('')

  // DTR Target Personnel Role Selector
  const [dtrTargetRole, setDtrTargetRole] = useState<'teacher' | 'ao_2' | 'school_head' | 'psds'>(() => {
    if (admin?.role === 'school_head') return 'school_head'
    if (admin?.role === 'psds') return 'psds'
    if (admin?.role === 'ao_2') return 'ao_2'
    return 'teacher'
  })

  // School Head Signatory State (For Teacher & AO II DTRs)
  const [schoolHeadName, setSchoolHeadName] = useState<string>('')
  const [schoolHeadTitle, setSchoolHeadTitle] = useState<string>('School Head / Principal')
  const [schoolHeadOptions, setSchoolHeadOptions] = useState<{ id: string; name: string; schoolNames: string }[]>([])

  // Load School Heads from Supabase database
  useEffect(() => {
    Promise.all([fetchAllAdmins(), fetchSchools()]).then(([admins, schools]) => {
      const heads = admins
        .filter(a => a.role === 'school_head' || (a.role === 'admin' && a.assigned_school_ids && a.assigned_school_ids.length > 0))
        .map(h => {
          const sNames = schools
            .filter(s => h.assigned_school_ids?.includes(s.id))
            .map(s => s.name)
            .join(', ')
          return {
            id: h.id,
            name: h.full_name,
            schoolNames: sNames ? `(${sNames})` : ''
          }
        })
      setSchoolHeadOptions(heads)
      if (heads.length > 0) {
        setSchoolHeadName(prev => prev || heads[0].name)
      }
    }).catch(() => {})
  }, [])

  // Auto-derive Signatory Name & Title based on official DepEd governance rules:
  // - Teacher & AO II -> Signatory is the School Head / Principal
  // - School Head & PSDS -> Signatory is Schools Division Superintendent ROGER F. CAPA, CESO VI
  const isDivisionSignatory = dtrTargetRole === 'school_head' || dtrTargetRole === 'psds'

  const finalSupervisorName = isDivisionSignatory
    ? 'ROGER F. CAPA, CESO VI'
    : (schoolHeadName.trim() || 'SCHOOL HEAD / PRINCIPAL')

  const finalSupervisorTitle = isDivisionSignatory
    ? 'Schools Division Superintendent'
    : (schoolHeadTitle.trim() || 'School Head')

  // Generator Time Range Configurations (Default: Non-late working ranges)
  const [amArrivalRange, setAmArrivalRange] = useState({ start: 15, end: 58 }) // 6:15 AM - 6:58 AM (Start at 7:00 AM)
  const [amDepartureRange, setAmDepartureRange] = useState({ start: 30, end: 42 }) // 11:30 AM - 11:42 AM
  const [pmArrivalRange, setPmArrivalRange] = useState({ start: 22, end: 58 }) // 12:22 PM - 12:58 PM (Start at 1:00 PM)
  const [pmDepartureRange, setPmDepartureRange] = useState({ start: 0, end: 12 }) // 5:00 PM - 5:12 PM

  const [includeSaturdays, setIncludeSaturdays] = useState<boolean>(false)
  const [includeSundays, setIncludeSundays] = useState<boolean>(false)

  // Table Entries for active month
  const [entries, setEntries] = useState<DTRDayEntry[]>([])
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')

  // Load / Save persistent config
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DTR_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.employeeName) setEmployeeName(parsed.employeeName)
        if (parsed.dtrTargetRole) setDtrTargetRole(parsed.dtrTargetRole)
        if (parsed.schoolHeadName) setSchoolHeadName(parsed.schoolHeadName)
        if (parsed.officialHoursText) setOfficialHoursText(parsed.officialHoursText)
      }
    } catch {}
  }, [])

  // Initialize or generate DTR table entries whenever Month or Year changes
  const buildInitialDays = (year: number, month: number): DTRDayEntry[] => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const list: DTRDayEntry[] = []

    for (let day = 1; day <= 31; day++) {
      if (day > daysInMonth) {
        list.push({
          dayNumber: day,
          dateString: '',
          dayOfWeek: '',
          isWeekend: false,
          isSaturday: false,
          isSunday: false,
          isHoliday: false,
          status: 'blank',
          amArrival: '',
          amDeparture: '',
          pmArrival: '',
          pmDeparture: '',
          undertimeHours: '',
          undertimeMinutes: ''
        })
        continue
      }

      const dateObj = new Date(year, month - 1, day)
      const dayIndex = dateObj.getDay() // 0 = Sun, 6 = Sat
      const isSat = dayIndex === 6
      const isSun = dayIndex === 0
      const isWeekend = isSat || isSun

      const mm = String(month).padStart(2, '0')
      const dd = String(day).padStart(2, '0')
      const monthDayKey = `${mm}-${dd}`

      const holidayTitle = STANDARD_PH_HOLIDAYS[monthDayKey]
      const isHoliday = !!holidayTitle

      let status: DTRDayEntry['status'] = 'work'
      if (isHoliday) status = 'holiday'
      else if (isSat) status = 'saturday'
      else if (isSun) status = 'sunday'

      list.push({
        dayNumber: day,
        dateString: `${year}-${mm}-${dd}`,
        dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        isWeekend,
        isSaturday: isSat,
        isSunday: isSun,
        isHoliday,
        holidayTitle,
        status,
        amArrival: '',
        amDeparture: '',
        pmArrival: '',
        pmDeparture: '',
        undertimeHours: '',
        undertimeMinutes: ''
      })
    }
    return list
  }

  // Populate table when year or month changes if empty
  useEffect(() => {
    const initial = buildInitialDays(selectedYear, selectedMonth)
    setEntries(initial)
  }, [selectedYear, selectedMonth])

  // Helper: Generate random integer inclusive
  const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  // Main Generator Function: Generate Random Punch Times (Non-Late Guarantee)
  const handleGenerateRandomTimes = () => {
    const updated: DTRDayEntry[] = entries.map(entry => {
      if (entry.status === 'blank') return entry

      // If weekend and not included in duty
      if (entry.isSaturday && !includeSaturdays) {
        return { ...entry, status: 'saturday' as const, amArrival: '', amDeparture: '', pmArrival: '', pmDeparture: '' }
      }
      if (entry.isSunday && !includeSundays) {
        return { ...entry, status: 'sunday' as const, amArrival: '', amDeparture: '', pmArrival: '', pmDeparture: '' }
      }
      if (entry.isHoliday) {
        return { ...entry, status: 'holiday' as const, amArrival: '', amDeparture: '', pmArrival: '', pmDeparture: '' }
      }

      // Generate realistic non-late morning arrival (e.g. 6:15 - 6:58 AM)
      const amArrMin = getRandomInt(amArrivalRange.start, amArrivalRange.end)
      const amArrival = `6:${String(amArrMin).padStart(2, '0')}`

      // Generate morning departure (e.g. 11:30 - 11:42 AM)
      const amDepMin = getRandomInt(amDepartureRange.start, amDepartureRange.end)
      const amDeparture = `11:${String(amDepMin).padStart(2, '0')}`

      // Generate afternoon arrival (e.g. 12:22 - 12:58 PM)
      const pmArrMin = getRandomInt(pmArrivalRange.start, pmArrivalRange.end)
      const pmArrival = `12:${String(pmArrMin).padStart(2, '0')}`

      // Generate afternoon departure (e.g. 5:00 - 5:12 PM)
      const pmDepMin = getRandomInt(pmDepartureRange.start, pmDepartureRange.end)
      const pmDeparture = `5:${String(pmDepMin).padStart(2, '0')}`

      return {
        ...entry,
        status: 'work' as const,
        amArrival,
        amDeparture,
        pmArrival,
        pmDeparture,
        undertimeHours: '',
        undertimeMinutes: ''
      }
    })

    setEntries(updated)
    toast(`Generated non-late punch times for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`, 'success')
  }

  // Handle single cell edit
  const handleCellChange = (index: number, field: keyof DTRDayEntry, value: any) => {
    setEntries(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  // Reset times for current month
  const handleResetTimes = () => {
    const reset = buildInitialDays(selectedYear, selectedMonth)
    setEntries(reset)
    toast('DTR table reset to blank template.', 'info')
  }

  // Save Config
  const handleSaveConfig = () => {
    try {
      localStorage.setItem(
        DTR_STORAGE_KEY,
        JSON.stringify({
          employeeName,
          dtrTargetRole,
          schoolHeadName,
          officialHoursText
        })
      )
      toast('DTR Employee configuration saved successfully.', 'success')
    } catch {
      toast('Failed to save config.', 'error')
    }
  }

  // Print DTR Handler (2-in-1 Side-by-Side Dual Copy)
  const handlePrintDTR = () => {
    window.print()
  }

  const monthYearLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`

  return (
    <SchoolConnectLayout systemTitle="Civil Service Form No. 48 DTR Generator">
      {/* PRINT-ONLY TWO-IN-ONE CS FORM 48 STYLES */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-family: "Times New Roman", Times, serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide Web UI chrome */
          nav, header, footer, .no-print, .clay-card, button, input, select {
            display: none !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .dtr-dual-container {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .dtr-card-single {
            width: 48.5% !important;
            border: 1.5px solid black !important;
            padding: 8px 10px !important;
            box-sizing: border-box !important;
            font-size: 8.5pt !important;
            line-height: 1.15 !important;
          }
          .dtr-cut-divider {
            border-right: 1.5px dashed #666 !important;
            height: 100% !important;
          }
          .dtr-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 4px !important;
            margin-bottom: 6px !important;
          }
          .dtr-table th, .dtr-table td {
            border: 1px solid black !important;
            text-align: center !important;
            padding: 1.5px 2px !important;
            font-size: 8pt !important;
          }
          .dtr-table th {
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
          .bg-black-fill {
            background-color: black !important;
            color: black !important;
          }
        }
      `}</style>

      <div className="space-y-6 w-full pb-16 animate-fade-in no-print">
        {/* Top Pastel Header Banner */}
        <div className="bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white rounded-[36px] p-6 sm:p-9 shadow-[0_20px_40px_rgba(139,114,244,0.28)] border-4 border-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold backdrop-blur-md shadow-xs">
                <Clock size={14} className="text-amber-300" />
                Civil Service Form No. 48 System
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
                Daily Time Record (DTR) Generator
              </h1>
              <p className="text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed font-medium">
                Generate official non-late Civil Service Form No. 48 Daily Time Records with automated random punch time generator, interactive manual editing, and 2-in-1 printable side-by-side layout.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                onClick={handlePrintDTR}
                className="px-5 py-3 rounded-full bg-white text-[#795CEE] hover:bg-[#F6EFFF] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border border-white active:animate-button-sparkle"
              >
                <Printer size={16} />
                Print DTR (2-in-1 Layout)
              </button>
            </div>
          </div>
        </div>

        {/* CONTROLS & CONFIGURATION PANEL */}
        <div className="clay-card p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F0E6DD]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#A88BEB] to-[#8B72F4] text-white shadow-xs">
                <Sliders size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#2D2638] font-display">DTR Configuration & Parameters</h3>
                <p className="text-xs text-[#7A7289] font-medium">Set employee details, month/year, working hours, and non-late ranges</p>
              </div>
            </div>

            {/* Tab Navigation Controls */}
            <div className="flex items-center gap-2 p-1 bg-[#FAF5F0] rounded-full border border-white shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <Edit3 size={14} className="inline mr-1.5" />
                Table Editor & Controls
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                    : 'text-[#7A7289] hover:text-[#2D2638]'
                }`}
              >
                <Printer size={14} className="inline mr-1.5" />
                2-in-1 Side-by-Side Preview
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Employee Name */}
            <div>
              <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Employee Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                <input
                  type="text"
                  value={employeeName}
                  onChange={e => setEmployeeName(e.target.value.toUpperCase())}
                  placeholder="e.g. MICHELLE S. MOSQUERA"
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 uppercase"
                />
              </div>
            </div>

            {/* Target Month */}
            <div>
              <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Target Month</label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Year */}
            <div>
              <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Target Year</label>
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
              />
            </div>

            {/* Official Hours Banner String */}
            <div>
              <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Official Hours Header Text</label>
              <input
                type="text"
                value={officialHoursText}
                onChange={e => setOfficialHoursText(e.target.value)}
                placeholder="Regular days 7:00–11:30AM / 1:00–5:00PM"
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
              />
            </div>
          </div>

          {/* Signatory Governance & Role Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#F0E6DD]/60">
            {/* DTR Personnel Role Selector */}
            <div>
              <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">DTR Personnel Category</label>
              <select
                value={dtrTargetRole}
                onChange={e => setDtrTargetRole(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
              >
                <option value="teacher">Teacher (School Head Signatory)</option>
                <option value="ao_2">Administrative Officer (AO II) (School Head Signatory)</option>
                <option value="school_head">School Head (Division Superintendent Signatory)</option>
                <option value="psds">PSDS (Division Superintendent Signatory)</option>
              </select>
            </div>

            {/* Official Signatory Display / Selection */}
            <div>
              {isDivisionSignatory ? (
                <div>
                  <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Official Signatory (Fixed)</label>
                  <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs font-bold">
                    <span>ROGER F. CAPA, CESO VI</span>
                    <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-md text-amber-950 font-black">SDS</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">School Head / Principal Name</label>
                  {schoolHeadOptions.length > 0 ? (
                    <select
                      value={schoolHeadName}
                      onChange={e => setSchoolHeadName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                    >
                      {schoolHeadOptions.map(h => (
                        <option key={h.id} value={h.name}>
                          {h.name} {h.schoolNames}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={schoolHeadName}
                      onChange={e => setSchoolHeadName(e.target.value)}
                      placeholder="e.g. MARIA L. SANTOS"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleGenerateRandomTimes}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white hover:opacity-95 font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:animate-button-sparkle"
              >
                <Sparkles size={16} className="text-amber-300" />
                Generate Non-Late Times
              </button>

              <button
                type="button"
                onClick={handleResetTimes}
                className="p-2.5 rounded-xl bg-white text-[#7A7289] hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all cursor-pointer"
                title="Reset table to blank"
              >
                <RotateCcw size={16} />
              </button>

              <button
                type="button"
                onClick={handleSaveConfig}
                className="p-2.5 rounded-xl bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#8B72F4] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all cursor-pointer"
                title="Save Employee Config"
              >
                <Save size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: TABLE EDITOR & MANUAL TIME INPUT */}
        {activeTab === 'editor' && (
          <div className="clay-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#2D2638] font-display">
                  CS Form No. 48 Data Sheet ({monthYearLabel})
                </h3>
                <p className="text-xs text-[#7A7289] font-medium">
                  Directly edit arrival/departure times, undertime, or day statuses (Work, Saturday, Sunday, Holiday, Leave)
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-[#EEF0FF] text-[#3B49B8] text-xs font-bold border border-[#BFD7FF]">
                {entries.filter(e => e.status === 'work').length} Regular Work Days
              </span>
            </div>

            {/* Interactive Data Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Day</th>
                    <th className="py-2.5 px-3 w-28">Weekday</th>
                    <th className="py-2.5 px-3 w-36">Day Status</th>
                    <th className="py-2.5 px-3 text-center bg-blue-50/70 border-l border-r border-blue-200/60" colSpan={2}>
                      A.M. (Morning)
                    </th>
                    <th className="py-2.5 px-3 text-center bg-purple-50/70 border-r border-purple-200/60" colSpan={2}>
                      P.M. (Afternoon)
                    </th>
                    <th className="py-2.5 px-3 text-center" colSpan={2}>
                      Undertime
                    </th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500">
                    <th></th>
                    <th></th>
                    <th></th>
                    <th className="py-1 px-2 text-center bg-blue-50/50">Arrival</th>
                    <th className="py-1 px-2 text-center bg-blue-50/50 border-r border-blue-200/60">Departure</th>
                    <th className="py-1 px-2 text-center bg-purple-50/50">Arrival</th>
                    <th className="py-1 px-2 text-center bg-purple-50/50 border-r border-purple-200/60">Departure</th>
                    <th className="py-1 px-2 text-center">Hours</th>
                    <th className="py-1 px-2 text-center">Mins</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {entries.map((entry, idx) => {
                    if (entry.status === 'blank') {
                      return (
                        <tr key={idx} className="bg-slate-900 text-slate-900">
                          <td className="py-2 px-3 text-center font-bold text-slate-400">{entry.dayNumber}</td>
                          <td colSpan={8} className="py-2 px-3 text-center italic text-slate-500 text-[11px]">
                            [ No Date in Month ]
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 transition-colors ${
                          entry.isWeekend ? 'bg-amber-50/40' : entry.isHoliday ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Day Number */}
                        <td className="py-2 px-3 text-center font-extrabold text-slate-800">
                          {entry.dayNumber}
                        </td>

                        {/* Weekday Name */}
                        <td className="py-2 px-3 font-semibold text-slate-600">
                          {entry.dayOfWeek}
                        </td>

                        {/* Status Selector */}
                        <td className="py-2 px-3">
                          <select
                            value={entry.status}
                            onChange={e => handleCellChange(idx, 'status', e.target.value)}
                            className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                          >
                            <option value="work">Regular Work Day</option>
                            <option value="saturday">SATURDAY</option>
                            <option value="sunday">SUNDAY</option>
                            <option value="holiday">HOLIDAY</option>
                            <option value="leave">ON LEAVE</option>
                            <option value="travel">OFFICIAL BUSINESS</option>
                          </select>
                        </td>

                        {/* If Work day, show 4 time inputs. Otherwise show status banner spanning across */}
                        {entry.status === 'work' ? (
                          <>
                            {/* AM Arrival */}
                            <td className="py-1.5 px-2 bg-blue-50/30">
                              <input
                                type="text"
                                value={entry.amArrival}
                                onChange={e => handleCellChange(idx, 'amArrival', e.target.value)}
                                placeholder="6:35"
                                className="w-full text-center px-1.5 py-1 rounded font-bold text-slate-800 bg-white border border-slate-200 focus:ring-2 focus:ring-blue-400"
                              />
                            </td>

                            {/* AM Departure */}
                            <td className="py-1.5 px-2 bg-blue-50/30 border-r border-blue-200/60">
                              <input
                                type="text"
                                value={entry.amDeparture}
                                onChange={e => handleCellChange(idx, 'amDeparture', e.target.value)}
                                placeholder="11:35"
                                className="w-full text-center px-1.5 py-1 rounded font-bold text-slate-800 bg-white border border-slate-200 focus:ring-2 focus:ring-blue-400"
                              />
                            </td>

                            {/* PM Arrival */}
                            <td className="py-1.5 px-2 bg-purple-50/30">
                              <input
                                type="text"
                                value={entry.pmArrival}
                                onChange={e => handleCellChange(idx, 'pmArrival', e.target.value)}
                                placeholder="12:32"
                                className="w-full text-center px-1.5 py-1 rounded font-bold text-slate-800 bg-white border border-slate-200 focus:ring-2 focus:ring-purple-400"
                              />
                            </td>

                            {/* PM Departure */}
                            <td className="py-1.5 px-2 bg-purple-50/30 border-r border-purple-200/60">
                              <input
                                type="text"
                                value={entry.pmDeparture}
                                onChange={e => handleCellChange(idx, 'pmDeparture', e.target.value)}
                                placeholder="5:02"
                                className="w-full text-center px-1.5 py-1 rounded font-bold text-slate-800 bg-white border border-slate-200 focus:ring-2 focus:ring-purple-400"
                              />
                            </td>

                            {/* Undertime Hours */}
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={entry.undertimeHours}
                                onChange={e => handleCellChange(idx, 'undertimeHours', e.target.value)}
                                placeholder=""
                                className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-white border border-slate-200"
                              />
                            </td>

                            {/* Undertime Minutes */}
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={entry.undertimeMinutes}
                                onChange={e => handleCellChange(idx, 'undertimeMinutes', e.target.value)}
                                placeholder=""
                                className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-white border border-slate-200"
                              />
                            </td>
                          </>
                        ) : (
                          <td colSpan={6} className="py-2 px-3 text-center font-black tracking-wide uppercase text-slate-700">
                            {entry.status === 'saturday' && 'SATURDAY'}
                            {entry.status === 'sunday' && 'SUNDAY'}
                            {entry.status === 'holiday' && (entry.holidayTitle || 'HOLIDAY')}
                            {entry.status === 'leave' && 'ON OFFICIAL LEAVE'}
                            {entry.status === 'travel' && 'OFFICIAL BUSINESS (O.B.)'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE 2-IN-1 DUAL COPY PREVIEW */}
        {activeTab === 'preview' && (
          <div className="clay-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#2D2638] font-display">
                  Civil Service Form No. 48 — 2-in-1 Side-by-Side Preview
                </h3>
                <p className="text-xs text-[#7A7289] font-medium">
                  Standard Philippine Civil Service DTR layout formatted dual-copy on one sheet of paper
                </p>
              </div>

              <button
                onClick={handlePrintDTR}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-extrabold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Printer size={16} />
                Print Form No. 48
              </button>
            </div>

            {/* Screen Preview Render */}
            <div className="p-4 rounded-3xl bg-slate-100 border border-slate-200 overflow-x-auto">
              <CSForm48DualRender
                employeeName={employeeName}
                monthYearLabel={monthYearLabel}
                officialHoursText={officialHoursText}
                saturdaysText={saturdaysText}
                entries={entries}
                supervisorName={finalSupervisorName}
                supervisorTitle={finalSupervisorTitle}
              />
            </div>
          </div>
        )}
      </div>

      {/* PRINT AREA ONLY (Triggered on window.print()) */}
      <div className="print-area hidden">
        <CSForm48DualRender
          employeeName={employeeName}
          monthYearLabel={monthYearLabel}
          officialHoursText={officialHoursText}
          saturdaysText={saturdaysText}
          entries={entries}
          supervisorName={finalSupervisorName}
          supervisorTitle={finalSupervisorTitle}
        />
      </div>
    </SchoolConnectLayout>
  )
}

// ============================================================
// CS FORM 48 DUAL SIDE-BY-SIDE COPY RENDERER COMPONENT
// ============================================================
interface CSForm48Props {
  employeeName: string
  monthYearLabel: string
  officialHoursText: string
  saturdaysText: string
  entries: DTRDayEntry[]
  supervisorName: string
  supervisorTitle: string
}

function CSForm48DualRender({
  employeeName,
  monthYearLabel,
  officialHoursText,
  saturdaysText,
  entries,
  supervisorName,
  supervisorTitle
}: CSForm48Props) {
  return (
    <div className="dtr-dual-container flex flex-row justify-between items-start gap-4 max-w-[960px] mx-auto bg-white text-black font-serif p-2">
      {/* COPY 1 */}
      <CSForm48SingleCard
        employeeName={employeeName}
        monthYearLabel={monthYearLabel}
        officialHoursText={officialHoursText}
        saturdaysText={saturdaysText}
        entries={entries}
        supervisorName={supervisorName}
        supervisorTitle={supervisorTitle}
      />

      {/* CUT LINE DASHED DIVIDER */}
      <div className="dtr-cut-divider hidden sm:block border-r-2 border-dashed border-slate-400 self-stretch my-2"></div>

      {/* COPY 2 */}
      <CSForm48SingleCard
        employeeName={employeeName}
        monthYearLabel={monthYearLabel}
        officialHoursText={officialHoursText}
        saturdaysText={saturdaysText}
        entries={entries}
        supervisorName={supervisorName}
        supervisorTitle={supervisorTitle}
      />
    </div>
  )
}

function CSForm48SingleCard({
  employeeName,
  monthYearLabel,
  officialHoursText,
  saturdaysText,
  entries,
  supervisorName,
  supervisorTitle
}: CSForm48Props) {
  return (
    <div className="dtr-card-single flex-1 border-2 border-black p-3 bg-white text-black font-serif text-[8.5pt] leading-tight select-none">
      {/* Form Title */}
      <div className="text-center font-bold">
        <p className="text-[7.5pt] font-sans tracking-tight">CIVIL SERVICE FORM No. 48</p>
        <p className="text-[10pt] font-extrabold uppercase mt-0.5">DAILY TIME RECORD</p>
        <div className="w-3/4 border-b border-black mx-auto my-1"></div>

        {/* Employee Name Underline */}
        <p className="text-[11pt] font-extrabold uppercase tracking-wide border-b border-black pb-0.5 mt-2">
          {employeeName || 'MICHELLE S. MOSQUERA'}
        </p>
        <p className="text-[7pt] italic font-sans">(Name)</p>
      </div>

      {/* Month & Official Hours Header Info */}
      <div className="mt-2 space-y-0.5 text-[8pt]">
        <div className="flex items-baseline justify-between">
          <span>For the month of</span>
          <span className="font-extrabold uppercase border-b border-black px-2 text-[9pt]">
            {monthYearLabel}
          </span>
        </div>

        <div className="text-[7.5pt]">
          <span className="font-semibold">Official hours for arrival and departure</span>
        </div>
        <div className="text-[7.5pt] flex justify-between">
          <span>Regular days:</span>
          <span className="font-bold">{officialHoursText || '7:00–11:30AM / 1:00–5:00PM'}</span>
        </div>
        <div className="text-[7.5pt] flex justify-between">
          <span>Saturdays:</span>
          <span className="font-semibold">{saturdaysText || '—'}</span>
        </div>
      </div>

      {/* Main DTR Data Table */}
      <table className="dtr-table w-full border-collapse border border-black text-center mt-2 text-[7.5pt]">
        <thead>
          <tr className="border-b border-black font-bold">
            <th className="border-r border-black w-6 py-1" rowSpan={2}>
              DAY
            </th>
            <th className="border-r border-black py-0.5" colSpan={2}>
              A.M.
            </th>
            <th className="border-r border-black py-0.5" colSpan={2}>
              P.M.
            </th>
            <th colSpan={2}>UNDERTIME</th>
          </tr>
          <tr className="border-b border-black font-bold text-[7pt]">
            <th className="border-r border-black w-10">Arrival</th>
            <th className="border-r border-black w-10">Departure</th>
            <th className="border-r border-black w-10">Arrival</th>
            <th className="border-r border-black w-10">Departure</th>
            <th className="border-r border-black w-7">Hours</th>
            <th className="w-7">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => {
            if (e.status === 'blank') {
              return (
                <tr key={e.dayNumber} className="border-b border-black bg-black text-black">
                  <td className="border-r border-black bg-white text-black font-bold text-[7.5pt]">{e.dayNumber}</td>
                  <td colSpan={6} className="bg-black text-black select-none">
                    .
                  </td>
                </tr>
              )
            }

            if (e.status !== 'work') {
              let label = ''
              if (e.status === 'saturday') label = 'SATURDAY'
              else if (e.status === 'sunday') label = 'SUNDAY'
              else if (e.status === 'holiday') label = e.holidayTitle || 'HOLIDAY'
              else if (e.status === 'leave') label = 'ON LEAVE'
              else if (e.status === 'travel') label = 'OFFICIAL BUSINESS'

              return (
                <tr key={e.dayNumber} className="border-b border-black">
                  <td className="border-r border-black font-bold py-0.5">{e.dayNumber}</td>
                  <td colSpan={6} className="font-extrabold text-[7pt] tracking-wider py-0.5 uppercase">
                    {label}
                  </td>
                </tr>
              )
            }

            return (
              <tr key={e.dayNumber} className="border-b border-black">
                <td className="border-r border-black font-bold py-0.5">{e.dayNumber}</td>
                <td className="border-r border-black font-semibold">{e.amArrival || ''}</td>
                <td className="border-r border-black font-semibold">{e.amDeparture || ''}</td>
                <td className="border-r border-black font-semibold">{e.pmArrival || ''}</td>
                <td className="border-r border-black font-semibold">{e.pmDeparture || ''}</td>
                <td className="border-r border-black font-semibold">{e.undertimeHours || ''}</td>
                <td className="font-semibold">{e.undertimeMinutes || ''}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold border-t-2 border-black">
            <td colSpan={5} className="border-r border-black text-right pr-2 py-1 font-extrabold text-[8pt]">
              TOTAL
            </td>
            <td className="border-r border-black"></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Certification & Verification Section */}
      <div className="mt-2 space-y-3 text-[7.5pt]">
        <p className="text-justify leading-snug">
          I CERTIFY on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure.
        </p>

        <div className="pt-3 text-center">
          <div className="w-4/5 border-b border-black mx-auto"></div>
          <p className="text-[6.5pt] italic font-sans mt-0.5">(Signature of Employee)</p>
        </div>

        <div className="pt-1 text-[7.5pt]">
          <p className="font-semibold italic">Verified as to the prescribed office hours.</p>
          <div className="pt-5 text-center">
            <p className="font-extrabold uppercase border-b border-black inline-block px-4 text-[8.5pt]">
              {supervisorName || 'ROGER F. CAPA, CESO VI'}
            </p>
            <p className="text-[7.5pt] font-semibold text-slate-800">{supervisorTitle || 'Schools Division Superintendent'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
