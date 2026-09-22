import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { DepEdPageLoader } from '@/components/ui/DepEdSpinner'
import { SchoolConnectLayout, type NavGroup } from '@/components/layouts/SchoolConnectLayout'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
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
  ShieldCheck,
  Users,
  Trash2,
  PlusCircle,
  Search,
  FolderOpen,
  UserCheck,
  Eye,
  Check,
  ChevronRight,
  X,
  UserPlus,
  PartyPopper,
  CalendarPlus,
  Tag,
  Plus,
  Database,
  Loader2,
  Cloud,
  History,
  LayoutDashboard,
  UserX,
  FileSpreadsheet,
  Settings as SettingsIcon,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  Lock
} from 'lucide-react'
import {
  fetchAllAdmins,
  fetchSchools,
  fetchDTRRecordsSupabase,
  saveDTRRecordSupabase,
  updateDTRRecordSupabase,
  deleteDTRRecordSupabase,
  fetchDTRCustomHolidaysSupabase,
  saveDTRCustomHolidaySupabase,
  deleteDTRCustomHolidaySupabase
} from '@/lib/supabase/queries'

export interface DTRDayEntry {
  dayNumber: number
  dateString: string
  dayOfWeek: string
  isWeekend: boolean
  isSaturday: boolean
  isSunday: boolean
  isHoliday: boolean
  holidayTitle?: string
  isHalfDay?: boolean
  halfDaySession?: 'am' | 'pm' | 'half_day'
  status: 'work' | 'saturday' | 'sunday' | 'holiday' | 'leave' | 'travel' | 'blank'
  amArrival: string
  amDeparture: string
  pmArrival: string
  pmDeparture: string
  undertimeHours: string
  undertimeMinutes: string
}

export interface SavedDTRRecord {
  id: string
  employeeName: string
  role: 'teacher' | 'ao_2' | 'school_head' | 'psds'
  month: number
  year: number
  officialHoursText: string
  schoolHeadName: string
  entries: DTRDayEntry[]
  createdByName?: string
  createdByUserId?: string
  createdAt: string
  updatedAt: string
}

export interface CustomHolidayItem {
  id: string
  dateStr: string // "MM-DD" for recurring or "YYYY-MM-DD" for specific date
  title: string
  isRecurring: boolean
  isHalfDay?: boolean
  halfDaySession?: 'am' | 'pm' | 'half_day'
}

export interface LeaveRecordItem {
  id: string
  employeeName: string
  leaveType: 'Vacation Leave' | 'Sick Leave' | 'Mandatory Leave' | 'Special Privilege Leave' | 'Maternity Leave' | 'Solo Parent Leave'
  startDate: string
  endDate: string
  status: 'Approved' | 'Pending' | 'Draft'
  remarks?: string
}

export interface AbsenceRecordItem {
  id: string
  employeeName: string
  date: string
  reason: string
  isExcused: boolean
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
]

// Standard Philippine National Holidays (Default Lookup)
const INITIAL_NATIONAL_HOLIDAYS: { key: string; name: string; dateStr: string; isActive: boolean }[] = [
  { key: '01-01', name: 'New Year\'s Day', dateStr: 'Jan 01', isActive: true },
  { key: '04-09', name: 'Araw ng Kagitingan', dateStr: 'Apr 09', isActive: true },
  { key: '05-01', name: 'Labor Day', dateStr: 'May 01', isActive: true },
  { key: '06-12', name: 'Philippine Independence Day', dateStr: 'Jun 12', isActive: true },
  { key: '08-21', name: 'Ninoy Aquino Day', dateStr: 'Aug 21', isActive: true },
  { key: '08-31', name: 'National Heroes Day', dateStr: 'Aug 31', isActive: true },
  { key: '11-01', name: 'All Saints\' Day', dateStr: 'Nov 01', isActive: true },
  { key: '11-02', name: 'All Souls\' Day', dateStr: 'Nov 02', isActive: true },
  { key: '11-30', name: 'Bonifacio Day', dateStr: 'Nov 30', isActive: true },
  { key: '12-08', name: 'Feast of Immaculate Conception', dateStr: 'Dec 08', isActive: true },
  { key: '12-25', name: 'Christmas Day', dateStr: 'Dec 25', isActive: true },
  { key: '12-30', name: 'Rizal Day', dateStr: 'Dec 30', isActive: true },
  { key: '12-31', name: 'Last Day of the Year', dateStr: 'Dec 31', isActive: true }
]

// SIDEBAR NAVIGATION SYSTEM (MATCHING REQUESTED MENU)
const dtrNavGroups: NavGroup[] = [
  {
    title: 'DTR Generator System',
    items: [
      { to: '/dtr?tab=dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { to: '/dtr?tab=my_dtrs', label: 'My DTRs', icon: <FolderOpen size={18} /> },
      { to: '/dtr?tab=generate', label: 'Generate DTR', icon: <Sparkles size={18} /> },
      { to: '/dtr?tab=holidays', label: 'Holidays', icon: <PartyPopper size={18} /> },
      { to: '/dtr?tab=absences', label: 'Absences', icon: <UserX size={18} /> },
      { to: '/dtr?tab=leave', label: 'Leave', icon: <FileSpreadsheet size={18} /> },
      { to: '/dtr?tab=settings', label: 'Settings', icon: <SettingsIcon size={18} /> }
    ]
  }
]

export function DTRGeneratorPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Active Tab View from URL query parameter (Default to 'dashboard' or 'generate')
  const currentTab = useMemo(() => {
    const t = searchParams.get('tab')
    if (t && ['dashboard', 'my_dtrs', 'generate', 'holidays', 'absences', 'leave', 'settings'].includes(t)) {
      return t
    }
    return 'dashboard' // Default main menu view
  }, [searchParams])

  const setTab = (tabName: string) => {
    setSearchParams({ tab: tabName })
  }

  // Supabase Loading & Saving States
  const [isLoadingSupabase, setIsLoadingSupabase] = useState<boolean>(true)
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false)

  // Form State
  const [employeeName, setEmployeeName] = useState<string>(() => {
    return admin?.full_name || 'MICHELLE S. MOSQUERA'
  })
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(6) // Default June (1-indexed: 6)

  const [officialHoursText, setOfficialHoursText] = useState<string>(
    'Regular days 7:00-11:30AM'
  )
  const [saturdaysText, setSaturdaysText] = useState<string>('Saturdays: 1:00-5:00PM')

  // DTR Target Personnel Role Selector
  const [dtrTargetRole, setDtrTargetRole] = useState<'teacher' | 'ao_2' | 'school_head' | 'psds'>(() => {
    if (admin?.role === 'school_head') return 'school_head'
    if (admin?.role === 'psds') return 'psds'
    if (admin?.role === 'ao_2') return 'ao_2'
    return 'teacher'
  })

  // School Head Signatory State (For Teacher & AO II DTRs)
  const [schoolHeadName, setSchoolHeadName] = useState<string>('')
  const [schoolHeadTitle, setSchoolHeadTitle] = useState<string>('In-charge')
  const [schoolHeadOptions, setSchoolHeadOptions] = useState<
    { id: string; name: string; schoolNames: string; assignedSchoolIds: string[] }[]
  >([])

  // All District Staff & Schools for Proxy & Multi-School Session Generation
  const [allSchools, setAllSchools] = useState<{ id: string; name: string }[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [dtrSessionMode, setDtrSessionMode] = useState<'full_day' | 'am' | 'pm'>('full_day')

  const [allStaffProfiles, setAllStaffProfiles] = useState<
    {
      id: string
      name: string
      role: 'teacher' | 'ao_2' | 'school_head' | 'psds'
      roleTitle: string
      schoolNames: string
      assignedSchoolIds: string[]
      schoolSessions?: Record<string, 'am' | 'pm' | 'full_day'> | null
      workingHoursPreset?: 'option_1' | 'option_2' | null
    }[]
  >([])
  const [selectedProxyStaffId, setSelectedProxyStaffId] = useState<string>('')

  // History Records State (Synced to Supabase)
  const [savedRecords, setSavedRecords] = useState<SavedDTRRecord[]>([])
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [isSavedRecordLoaded, setIsSavedRecordLoaded] = useState<boolean>(false)
  const [historySearch, setHistorySearch] = useState<string>('')

  // National Holidays State
  const [nationalHolidays, setNationalHolidays] = useState(INITIAL_NATIONAL_HOLIDAYS)

  // Custom Local Holidays State (Synced to Supabase)
  const [customHolidays, setCustomHolidays] = useState<CustomHolidayItem[]>([
    { id: 'hol_1', dateStr: '03-18', title: 'Romblon Liberation Day', isRecurring: true },
    { id: 'hol_2', dateStr: '01-16', title: 'Concepcion District Day', isRecurring: true }
  ])

  // Absences State
  const [absencesList, setAbsencesList] = useState<AbsenceRecordItem[]>([
    { id: 'abs_1', employeeName: 'MICHELLE S. MOSQUERA', date: '2026-06-15', reason: 'Personal Emergency', isExcused: true }
  ])
  const [newAbsenceDate, setNewAbsenceDate] = useState<string>('')
  const [newAbsenceReason, setNewAbsenceReason] = useState<string>('')
  const [newAbsenceExcused, setNewAbsenceExcused] = useState<boolean>(true)

  // Leave State (Form 6)
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecordItem[]>([
    { id: 'lev_1', employeeName: 'MICHELLE S. MOSQUERA', leaveType: 'Vacation Leave', startDate: '2026-06-22', endDate: '2026-06-24', status: 'Approved', remarks: 'Official District Leave' }
  ])
  const [newLeaveType, setNewLeaveType] = useState<LeaveRecordItem['leaveType']>('Vacation Leave')
  const [newLeaveStart, setNewLeaveStart] = useState<string>('')
  const [newLeaveEnd, setNewLeaveEnd] = useState<string>('')
  const [newLeaveRemarks, setNewLeaveRemarks] = useState<string>('')

  // New Custom Holiday Input Form State
  const [newHolidayMonth, setNewHolidayMonth] = useState<number>(new Date().getMonth() + 1)
  const [newHolidayStartDay, setNewHolidayStartDay] = useState<number>(1)
  const [newHolidayEndDay, setNewHolidayEndDay] = useState<number>(1)
  const [newHolidayYear, setNewHolidayYear] = useState<string>('') // Optional specific year
  const [newHolidayTitle, setNewHolidayTitle] = useState<string>('')
  const [newHolidayIsRecurring, setNewHolidayIsRecurring] = useState<boolean>(true)
  const [newHolidayIsHalfDay, setNewHolidayIsHalfDay] = useState<boolean>(false)
  const [newHolidayHalfDaySession, setNewHolidayHalfDaySession] = useState<'am' | 'pm'>('am')

  // Generator Time Range Configurations (Default: Non-late working ranges)
  const [workingHoursPreset, setWorkingHoursPreset] = useState<'option_1' | 'option_2'>('option_1')
  const [amArrivalRange, setAmArrivalRange] = useState({ start: 15, end: 58 }) // e.g. 6:15 - 6:58 AM or 7:15 - 7:58 AM
  const [amDepartureRange, setAmDepartureRange] = useState({ start: 30, end: 45 }) // e.g. 11:30 - 11:45 AM or 12:00 - 12:15 PM
  const [pmArrivalRange, setPmArrivalRange] = useState({ start: 22, end: 58 }) // 12:22 PM - 12:58 PM (Start at 1:00 PM)
  const [pmDepartureRange, setPmDepartureRange] = useState({ start: 0, end: 15 }) // 5:00 PM - 5:15 PM

  const [includeSaturdays, setIncludeSaturdays] = useState<boolean>(false)
  const [includeSundays, setIncludeSundays] = useState<boolean>(false)

  // Load Personal Settings for Logged-In User on Mount or User Switch
  useEffect(() => {
    const userId = admin?.id || 'default'
    const key = `termcat_dtr_user_settings_v1_${userId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.workingHoursPreset) setWorkingHoursPreset(parsed.workingHoursPreset)
        if (parsed.officialHoursText) setOfficialHoursText(parsed.officialHoursText)
        if (parsed.saturdaysText !== undefined) setSaturdaysText(parsed.saturdaysText)
        if (parsed.amArrivalRange) setAmArrivalRange(parsed.amArrivalRange)
        if (parsed.amDepartureRange) setAmDepartureRange(parsed.amDepartureRange)
        if (parsed.pmArrivalRange) setPmArrivalRange(parsed.pmArrivalRange)
        if (parsed.pmDepartureRange) setPmDepartureRange(parsed.pmDepartureRange)
      } catch (err) {
        console.error('Error loading personal DTR settings:', err)
      }
    }
  }, [admin?.id])

  const handleSavePersonalSettings = () => {
    const userId = admin?.id || 'default'
    const key = `termcat_dtr_user_settings_v1_${userId}`
    const dataToSave = {
      workingHoursPreset,
      officialHoursText,
      saturdaysText,
      amArrivalRange,
      amDepartureRange,
      pmArrivalRange,
      pmDepartureRange,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(key, JSON.stringify(dataToSave))
    toast(`Saved personal working hours & generator settings for ${admin?.full_name || 'yourself'}!`, 'success')
  }

  const handleApplyPreset = (preset: 'option_1' | 'option_2') => {
    setWorkingHoursPreset(preset)
    if (preset === 'option_1') {
      setOfficialHoursText('Regular days 7:00-11:30AM')
      setSaturdaysText('Saturdays: 1:00-5:00PM')
      setAmArrivalRange({ start: 15, end: 58 })
      setAmDepartureRange({ start: 30, end: 45 })
      setPmArrivalRange({ start: 22, end: 58 })
      setPmDepartureRange({ start: 0, end: 15 })
    } else {
      setOfficialHoursText('Regular days 8:00-12:00NN')
      setSaturdaysText('Saturdays: 8:00-12:00NN')
      setAmArrivalRange({ start: 15, end: 58 })
      setAmDepartureRange({ start: 0, end: 15 })
      setPmArrivalRange({ start: 22, end: 58 })
      setPmDepartureRange({ start: 0, end: 15 })
    }
    toast(`Applied ${preset === 'option_1' ? 'Option 1 (7:00AM-11:30AM & 1:00PM-5:00PM)' : 'Option 2 (8:00AM-12:00PM & 1:00PM-5:00PM)'} preset. Click Save System Settings to save for yourself.`, 'info')
  }

  // Sub-tab view inside Generate DTR view ('preview' or 'editor')
  const [generateSubTab, setGenerateSubTab] = useState<'preview' | 'editor'>('preview')

  // Load DTR Records & Custom Holidays directly from Supabase Database on mount
  useEffect(() => {
    let isMounted = true
    setIsLoadingSupabase(true)

    Promise.all([
      fetchDTRRecordsSupabase(),
      fetchDTRCustomHolidaysSupabase(),
      fetchAllAdmins(),
      fetchSchools()
    ]).then(([recordsData, holidaysData, admins, schools]) => {
      if (!isMounted) return

      // 1. Map Supabase DTR records
      if (recordsData && recordsData.length > 0) {
        const mapped: SavedDTRRecord[] = recordsData.map((r: any) => ({
          id: r.id,
          employeeName: r.employee_name,
          role: r.role,
          month: r.month,
          year: r.year,
          officialHoursText: r.official_hours_text || 'Regular days 7:00–11:30AM / 1:00–5:00PM',
          schoolHeadName: r.school_head_name || '',
          entries: r.entries || [],
          createdByName: r.created_by_name || '',
          createdByUserId: r.created_by_user_id || '',
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }))
        setSavedRecords(mapped)

        // Derive default following month based on previous most recent DTR generated
        let maxYear = 0
        let maxMonth = 0
        for (const rec of mapped) {
          if (rec.year > maxYear || (rec.year === maxYear && rec.month > maxMonth)) {
            maxYear = rec.year
            maxMonth = rec.month
          }
        }

        if (maxYear > 0 && maxMonth > 0) {
          let nextM = maxMonth + 1
          let nextY = maxYear
          if (nextM > 12) {
            nextM = 1
            nextY = maxYear + 1
          }
          setSelectedMonth(nextM)
          setSelectedYear(nextY)
        }
      }

      // 2. Map Supabase Custom Holidays
      if (holidaysData && holidaysData.length > 0) {
        const mappedHolidays: CustomHolidayItem[] = holidaysData.map((h: any) => ({
          id: h.id,
          dateStr: h.date_str,
          title: h.title,
          isRecurring: h.is_recurring,
          isHalfDay: !!h.is_half_day,
          halfDaySession: h.half_day_session || 'am'
        }))
        setCustomHolidays(mappedHolidays)
      }

      // 3. School Head options for signatory
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
            schoolNames: sNames ? `(${sNames})` : '',
            assignedSchoolIds: h.assigned_school_ids || []
          }
        })
      setSchoolHeadOptions(heads)

      // Auto-detect assigned school head for current user if teacher or AO II
      const userSchools = admin?.assigned_school_ids || []
      const matchedHead = heads.find(h => h.assignedSchoolIds.some(sId => userSchools.includes(sId)))
      if (matchedHead) {
        setSchoolHeadName(matchedHead.name)
      } else if (heads.length > 0) {
        setSchoolHeadName(prev => prev || heads[0].name)
      }

      // 4. Store All Schools & Staff Profiles for Proxy Generation
      setAllSchools(schools.map(s => ({ id: s.id, name: s.name })))

      const userAssignedSchools = admin?.assigned_school_ids || []
      const initialSchoolId = userAssignedSchools.length > 0 ? userAssignedSchools[0] : (schools.length > 0 ? schools[0].id : '')
      if (initialSchoolId) {
        setSelectedSchoolId(initialSchoolId)
        const userSessions = admin?.school_sessions || {}
        if (userSessions[initialSchoolId]) {
          setDtrSessionMode(userSessions[initialSchoolId])
        }
      }

      const staffList = admins.map(a => {
        const sNames = schools
          .filter(s => a.assigned_school_ids?.includes(s.id))
          .map(s => s.name)
          .join(', ')
        let parsedRole: 'teacher' | 'ao_2' | 'school_head' | 'psds' = 'teacher'
        let rTitle = 'Teacher'

        if (a.role === 'school_head') {
          parsedRole = 'school_head'
          rTitle = 'School Head / Principal'
        } else if (a.role === 'psds') {
          parsedRole = 'psds'
          rTitle = 'PSDS'
        } else if (a.role === 'ao_2') {
          parsedRole = 'ao_2'
          rTitle = 'Administrative Officer II (AO II)'
        }

        return {
          id: a.id,
          name: a.full_name,
          role: parsedRole,
          roleTitle: rTitle,
          schoolNames: sNames ? `(${sNames})` : '',
          assignedSchoolIds: a.assigned_school_ids || [],
          schoolSessions: a.school_sessions || {},
          workingHoursPreset: a.working_hours_preset || null
        }
      })
      setAllStaffProfiles(staffList)
    }).catch(err => {
      console.warn('Error fetching Supabase DTR data:', err)
    }).finally(() => {
      if (isMounted) setIsLoadingSupabase(false)
    })

    return () => { isMounted = false }
  }, [])

  // Computed Combined Holiday Lookup Map (National + Custom Local)
  const combinedHolidaysMap = useMemo(() => {
    const map: Record<string, { title: string; isHalfDay?: boolean; halfDaySession?: 'am' | 'pm' | 'half_day' }> = {}

    // Add active national holidays
    for (const nh of nationalHolidays) {
      if (nh.isActive) {
        map[nh.key] = { title: nh.name.toUpperCase() }
      }
    }

    // Add custom local holidays
    for (const h of customHolidays) {
      let cleanTitle = h.title.trim()
      if (cleanTitle.toUpperCase().startsWith('HOLIDAY (') && cleanTitle.endsWith(')')) {
        cleanTitle = cleanTitle.substring(9, cleanTitle.length - 1).trim()
      } else if (cleanTitle.toUpperCase().startsWith('HOLIDAY ')) {
        cleanTitle = cleanTitle.substring(8).trim()
      }

      map[h.dateStr] = {
        title: cleanTitle.toUpperCase(),
        isHalfDay: h.isHalfDay,
        halfDaySession: h.halfDaySession
      }
    }

    return map
  }, [nationalHolidays, customHolidays])

  // Auto-derive Signatory Name & Title based on official DepEd governance rules:
  // - Teacher & AO II -> Assigned School Head, Title: 'In-charge'
  // - School Head -> ROGER F. CAPA, CESO VI, Title: 'Schools Division Superintendent'
  // - PSDS -> MELCHOR M. FAMORCAN, PHD, Title: 'CID Chief'
  const isDivisionSignatory = dtrTargetRole === 'school_head' || dtrTargetRole === 'psds'

  const finalSupervisorName = dtrTargetRole === 'psds'
    ? 'MELCHOR M. FAMORCAN, PHD'
    : dtrTargetRole === 'school_head'
    ? 'ROGER F. CAPA, CESO VI'
    : (schoolHeadName.trim() || 'SCHOOL HEAD / PRINCIPAL')

  const finalSupervisorTitle = dtrTargetRole === 'psds'
    ? 'Public Schools District Supervisor'
    : dtrTargetRole === 'school_head'
    ? 'Schools Division Superintendent'
    : (schoolHeadTitle.trim() || 'In-charge')

  // Table Entries for active month
  const [entries, setEntries] = useState<DTRDayEntry[]>([])

  // Initialize or generate DTR table entries whenever Month, Year, or Custom Holidays change
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
      const fullDateKey = `${year}-${mm}-${dd}`

      // Check full date key (specific year) first, then recurring month-day key
      const holidayInfo = combinedHolidaysMap[fullDateKey] || combinedHolidaysMap[monthDayKey]
      const isHoliday = !!holidayInfo
      const holidayTitle = holidayInfo?.title
      const isHalfDay = holidayInfo?.isHalfDay
      const halfDaySession = holidayInfo?.halfDaySession

      let status: DTRDayEntry['status'] = 'work'
      if (isHoliday && !isHalfDay) status = 'holiday'
      else if (isSat) status = 'saturday'
      else if (isSun) status = 'sunday'

      list.push({
        dayNumber: day,
        dateString: fullDateKey,
        dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
        isWeekend,
        isSaturday: isSat,
        isSunday: isSun,
        isHoliday,
        holidayTitle,
        isHalfDay,
        halfDaySession,
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

  // Re-apply holiday evaluation when month, year, or custom holidays change
  useEffect(() => {
    if (!activeRecordId) {
      const initial = buildInitialDays(selectedYear, selectedMonth)
      setEntries(initial)
    }
  }, [selectedYear, selectedMonth, combinedHolidaysMap])

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
      const amArrHour = workingHoursPreset === 'option_2' ? 7 : 6
      const amDepHour = workingHoursPreset === 'option_2' ? 12 : 11
      const pmArrHour = 12
      const pmDepHour = 5

      if (entry.isHoliday) {
        if (entry.isHalfDay) {
          // Half day holiday generation:
          if (entry.halfDaySession === 'am') {
            // AM session is HOLIDAY, PM session gets normal punch times
            const pmArrMin = getRandomInt(pmArrivalRange.start, pmArrivalRange.end)
            const pmDepMin = getRandomInt(pmDepartureRange.start, pmDepartureRange.end)
            return {
              ...entry,
              status: 'work' as const,
              amArrival: 'HOLIDAY',
              amDeparture: 'HOLIDAY',
              pmArrival: `${pmArrHour}:${String(pmArrMin).padStart(2, '0')}`,
              pmDeparture: `${pmDepHour}:${String(pmDepMin).padStart(2, '0')}`,
              undertimeHours: '',
              undertimeMinutes: ''
            }
          } else {
            // PM session is HOLIDAY, AM session gets normal punch times
            const amArrMin = getRandomInt(amArrivalRange.start, amArrivalRange.end)
            const amDepMin = getRandomInt(amDepartureRange.start, amDepartureRange.end)
            return {
              ...entry,
              status: 'work' as const,
              amArrival: `${amArrHour}:${String(amArrMin).padStart(2, '0')}`,
              amDeparture: `${amDepHour}:${String(amDepMin).padStart(2, '0')}`,
              pmArrival: 'HOLIDAY',
              pmDeparture: 'HOLIDAY',
              undertimeHours: '',
              undertimeMinutes: ''
            }
          }
        } else {
          return { ...entry, status: 'holiday' as const, amArrival: '', amDeparture: '', pmArrival: '', pmDeparture: '' }
        }
      }

      // Generate punch times based on Session Duty Mode ('full_day' | 'am' | 'pm')
      let amArrival = ''
      let amDeparture = ''
      let pmArrival = ''
      let pmDeparture = ''

      if (dtrSessionMode === 'full_day' || dtrSessionMode === 'am') {
        const amArrMin = getRandomInt(amArrivalRange.start, amArrivalRange.end)
        amArrival = `${amArrHour}:${String(amArrMin).padStart(2, '0')}`
        const amDepMin = getRandomInt(amDepartureRange.start, amDepartureRange.end)
        amDeparture = `${amDepHour}:${String(amDepMin).padStart(2, '0')}`
      }

      if (dtrSessionMode === 'full_day' || dtrSessionMode === 'pm') {
        const pmArrMin = getRandomInt(pmArrivalRange.start, pmArrivalRange.end)
        pmArrival = `${pmArrHour}:${String(pmArrMin).padStart(2, '0')}`
        const pmDepMin = getRandomInt(pmDepartureRange.start, pmDepartureRange.end)
        pmDeparture = `${pmDepHour}:${String(pmDepMin).padStart(2, '0')}`
      }

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
    const modeLabel = dtrSessionMode === 'am' ? ' (Morning Session Only)' : dtrSessionMode === 'pm' ? ' (Afternoon Session Only)' : ''
    toast(`Generated non-late punch times${modeLabel} for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`, 'success')
  }

  // Handle single cell edit
  const handleCellChange = (index: number, field: keyof DTRDayEntry, value: any) => {
    setEntries(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  // Toggle National Holiday Active State
  const handleToggleNationalHoliday = (key: string) => {
    setNationalHolidays(prev =>
      prev.map(h => (h.key === key ? { ...h, isActive: !h.isActive } : h))
    )
    toast('Updated national holiday settings.', 'info')
  }

  // Add a new Custom Local Holiday directly to Supabase Database
  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHolidayTitle.trim()) {
      toast('Please enter a holiday title.', 'error')
      return
    }

    const mm = String(newHolidayMonth).padStart(2, '0')
    const startD = Math.min(newHolidayStartDay || 1, newHolidayEndDay || newHolidayStartDay || 1)
    const endD = Math.max(newHolidayStartDay || 1, newHolidayEndDay || newHolidayStartDay || 1)

    try {
      const itemsToAdd: CustomHolidayItem[] = []

      for (let day = startD; day <= endD; day++) {
        const dd = String(day).padStart(2, '0')
        let dateStr = `${mm}-${dd}`
        if (!newHolidayIsRecurring && newHolidayYear) {
          dateStr = `${newHolidayYear}-${mm}-${dd}`
        }

        const saved = await saveDTRCustomHolidaySupabase({
          created_by_user_id: admin?.id,
          date_str: dateStr,
          title: newHolidayTitle.trim(),
          is_recurring: newHolidayIsRecurring,
          is_half_day: newHolidayIsHalfDay,
          half_day_session: newHolidayIsHalfDay ? newHolidayHalfDaySession : 'am'
        })

        itemsToAdd.push({
          id: saved?.id || `hol_${Date.now()}_${day}`,
          dateStr,
          title: newHolidayTitle.trim(),
          isRecurring: newHolidayIsRecurring,
          isHalfDay: newHolidayIsHalfDay,
          halfDaySession: newHolidayIsHalfDay ? newHolidayHalfDaySession : undefined
        })
      }

      setCustomHolidays(prev => [...prev, ...itemsToAdd])
      setNewHolidayTitle('')
      setNewHolidayIsHalfDay(false)

      const dayText = startD === endD ? `Day ${startD}` : `Days ${startD}-${endD}`
      toast(`Added local holiday "${newHolidayTitle.trim()}" (${MONTH_NAMES[newHolidayMonth - 1]} ${dayText}) to database.`, 'success')
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to save custom holiday to Supabase', table: 'sc_dtr_custom_holidays' }), 'error')
    }
  }

  // Delete Custom Holiday from Supabase
  const handleDeleteCustomHoliday = async (id: string, title: string) => {
    try {
      await deleteDTRCustomHolidaySupabase(id)
      setCustomHolidays(prev => prev.filter(h => h.id !== id))
      toast(`Removed local holiday "${title}" from Supabase database.`, 'info')
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to delete holiday from Supabase', table: 'sc_dtr_custom_holidays' }), 'error')
    }
  }

  // Add Absence Item
  const handleAddAbsence = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAbsenceDate || !newAbsenceReason.trim()) {
      toast('Please specify date and reason for absence.', 'error')
      return
    }

    const currentUserName = (admin?.full_name || employeeName).toUpperCase()

    const item: AbsenceRecordItem = {
      id: `abs_${Date.now()}`,
      employeeName: currentUserName,
      date: newAbsenceDate,
      reason: newAbsenceReason.trim(),
      isExcused: newAbsenceExcused
    }

    setAbsencesList(prev => [item, ...prev])
    setNewAbsenceDate('')
    setNewAbsenceReason('')
    toast(`Logged absence for ${currentUserName} on ${newAbsenceDate}`, 'success')
  }

  const handleDeleteAbsence = (id: string) => {
    setAbsencesList(prev => prev.filter(a => a.id !== id))
    toast('Deleted absence log.', 'info')
  }

  // Add Leave Item (Form 6)
  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLeaveStart || !newLeaveEnd) {
      toast('Please specify start and end dates for leave.', 'error')
      return
    }

    const currentUserName = (admin?.full_name || employeeName).toUpperCase()

    const item: LeaveRecordItem = {
      id: `lev_${Date.now()}`,
      employeeName: currentUserName,
      leaveType: newLeaveType,
      startDate: newLeaveStart,
      endDate: newLeaveEnd,
      status: 'Approved',
      remarks: newLeaveRemarks.trim() || 'Approved Form 6 Leave'
    }

    setLeaveRecords(prev => [item, ...prev])
    setNewLeaveStart('')
    setNewLeaveEnd('')
    setNewLeaveRemarks('')
    toast(`Filed ${newLeaveType} for ${currentUserName}`, 'success')
  }

  const handleDeleteLeave = (id: string) => {
    setLeaveRecords(prev => prev.filter(l => l.id !== id))
    toast('Deleted leave record.', 'info')
  }

  // Reset times for current month
  const handleResetTimes = () => {
    const reset = buildInitialDays(selectedYear, selectedMonth)
    setEntries(reset)
    setActiveRecordId(null)
    toast('DTR table reset to blank template.', 'info')
  }  // Save Current DTR directly to Supabase Database & redirect to My DTRs tab
  const handleSaveToHistory = async () => {
    if (!employeeName.trim()) {
      toast('Please provide employee name before saving.', 'error')
      return
    }

    setIsSavingDb(true)
    const nowIso = new Date().toISOString()
    const targetEmployeeName = employeeName.trim().toUpperCase()
    const currentGeneratorName = (admin?.full_name || 'Admin').toUpperCase()

    // Find existing record for this staff + month + year
    const existing = savedRecords.find(
      r => r.employeeName.trim().toUpperCase() === targetEmployeeName &&
           r.month === selectedMonth &&
           r.year === selectedYear
    )

    const targetId = activeRecordId || existing?.id

    try {
      if (targetId && !targetId.startsWith('dtr_local_')) {
        // Update existing record in Supabase with new generated entries
        await updateDTRRecordSupabase(targetId, {
          created_by_name: currentGeneratorName,
          employee_name: targetEmployeeName,
          role: dtrTargetRole,
          month: selectedMonth,
          year: selectedYear,
          official_hours_text: officialHoursText,
          school_head_name: schoolHeadName,
          entries
        })

        setSavedRecords(prev =>
          prev.map(r => {
            if (r.id === targetId) {
              return {
                ...r,
                employeeName: targetEmployeeName,
                createdByName: currentGeneratorName,
                role: dtrTargetRole,
                month: selectedMonth,
                year: selectedYear,
                officialHoursText,
                schoolHeadName,
                entries,
                updatedAt: nowIso
              }
            }
            return r
          })
        )
        setActiveRecordId(targetId)
        setIsSavedRecordLoaded(false)
        toast(`Saved new DTR for ${targetEmployeeName} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}), updating record. Redirecting to My DTRs...`, 'success')
      } else {
        // Create single record in Supabase
        const savedDb = await saveDTRRecordSupabase({
          created_by_user_id: admin?.id,
          created_by_name: currentGeneratorName,
          employee_name: targetEmployeeName,
          role: dtrTargetRole,
          month: selectedMonth,
          year: selectedYear,
          official_hours_text: officialHoursText,
          school_head_name: schoolHeadName,
          entries
        })

        const newRecord: SavedDTRRecord = {
          id: savedDb?.id || `dtr_${Date.now()}`,
          employeeName: targetEmployeeName,
          createdByName: currentGeneratorName,
          createdByUserId: admin?.id,
          role: dtrTargetRole,
          month: selectedMonth,
          year: selectedYear,
          officialHoursText,
          schoolHeadName,
          entries,
          createdAt: savedDb?.created_at || nowIso,
          updatedAt: savedDb?.updated_at || nowIso
        }

        setSavedRecords(prev => [newRecord, ...prev])
        setActiveRecordId(newRecord.id)
        setIsSavedRecordLoaded(false)
        toast(`Saved official DTR for ${targetEmployeeName} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear})! Redirecting to My DTRs...`, 'success')
      }

      // Automatically redirect to My DTRs tab after saving
      setTab('my_dtrs')
    } catch (err: any) {
      toast(formatDetailedError(err, { action: 'Failed to save DTR record to Supabase', table: 'sc_dtr_records' }), 'error')
    } finally {
      setIsSavingDb(false)
    }
  }

  // View Saved DTR in Read-Only 2-in-1 Preview Mode
  const handleViewRecord = (record: SavedDTRRecord) => {
    setEmployeeName(record.employeeName)
    setDtrTargetRole(record.role)
    setSelectedMonth(record.month)
    setSelectedYear(record.year)
    setOfficialHoursText(record.officialHoursText || 'Regular days 7:00–11:30AM / 1:00–5:00PM')
    if (record.schoolHeadName) setSchoolHeadName(record.schoolHeadName)
    setEntries(record.entries)
    setActiveRecordId(record.id)
    setIsSavedRecordLoaded(true)
    setGenerateSubTab('preview')
    setTab('generate')
    toast(`Viewing saved official DTR for ${record.employeeName} (${MONTH_NAMES[record.month - 1]} ${record.year}).`, 'info')
  }

  const handlePrintRecord = (record: SavedDTRRecord) => {
    handleViewRecord(record)
    setTimeout(() => {
      window.print()
    }, 350)
  }

  // Delete Record from Supabase Database
  const handleDeleteRecord = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete DTR record for "${name}" from Supabase database?`)) {
      try {
        await deleteDTRRecordSupabase(id)
        setSavedRecords(prev => prev.filter(r => r.id !== id))
        if (activeRecordId === id) {
          setActiveRecordId(null)
          setIsSavedRecordLoaded(false)
        }
        toast(`Deleted DTR record for ${name} from Supabase.`, 'info')
      } catch (err: any) {
        toast(formatDetailedError(err, { action: 'Failed to delete DTR record from Supabase', table: 'sc_dtr_records' }), 'error')
      }
    }
  }

  // Create New Blank DTR Session
  const handleNewDTR = () => {
    setActiveRecordId(null)
    setIsSavedRecordLoaded(false)
    setEmployeeName(admin?.full_name || 'MICHELLE S. MOSQUERA')
    setSelectedProxyStaffId('')
    if (admin?.role === 'school_head') setDtrTargetRole('school_head')
    else if (admin?.role === 'psds') setDtrTargetRole('psds')
    else if (admin?.role === 'ao_2') setDtrTargetRole('ao_2')
    else setDtrTargetRole('teacher')

    const initial = buildInitialDays(selectedYear, selectedMonth)
    setEntries(initial)
    setGenerateSubTab('editor')
    setTab('generate')
    toast('Started new DTR generation session.', 'info')
  }

  // Handler for manual personnel role category change
  const handleRoleChange = (newRole: 'teacher' | 'ao_2' | 'school_head' | 'psds') => {
    setDtrTargetRole(newRole)
    if (newRole === 'teacher' || newRole === 'ao_2') {
      let targetSchools: string[] = admin?.assigned_school_ids || []
      if (selectedProxyStaffId) {
        const staff = allStaffProfiles.find(s => s.id === selectedProxyStaffId)
        if (staff && staff.assignedSchoolIds.length > 0) targetSchools = staff.assignedSchoolIds
      }
      const matchedHead = schoolHeadOptions.find(h =>
        h.assignedSchoolIds.some(sId => targetSchools.includes(sId))
      )
      if (matchedHead) {
        setSchoolHeadName(matchedHead.name)
      } else if (schoolHeadOptions.length > 0 && !schoolHeadName) {
        setSchoolHeadName(schoolHeadOptions[0].name)
      }
    }
  }

  // Helper: Select School & auto-detect Session Mode (Morning AM vs Afternoon PM vs Full Day)
  const handleSelectSchool = (schId: string, customStaff?: typeof allStaffProfiles[0]) => {
    setSelectedSchoolId(schId)
    const staff = customStaff || allStaffProfiles.find(s => s.id === selectedProxyStaffId)
    const sessMap = staff?.schoolSessions || admin?.school_sessions || {}
    const mode = sessMap[schId] || 'full_day'
    setDtrSessionMode(mode)

    // Auto-update school head signatory for the newly selected target school
    if (schId) {
      const matchedHead = schoolHeadOptions.find(h => h.assignedSchoolIds.includes(schId))
      if (matchedHead) {
        setSchoolHeadName(matchedHead.name)
      }
    }

    if (mode === 'am') {
      setOfficialHoursText(workingHoursPreset === 'option_2' ? 'Regular days 8:00-12:00NN (Morning A.M. Session)' : 'Regular days 7:00-11:30AM (Morning A.M. Session)')
    } else if (mode === 'pm') {
      setOfficialHoursText('Regular days 1:00-5:00PM (Afternoon P.M. Session)')
    } else {
      setOfficialHoursText(workingHoursPreset === 'option_2' ? 'Regular days 8:00-12:00NN / 1:00-5:00PM' : 'Regular days 7:00-11:30AM / 1:00-5:00PM')
    }
  }

  // Proxy Generation: "Generate DTR for Someone"
  const handleGenerateForProxyStaff = (staffId: string) => {
    const staff = allStaffProfiles.find(s => s.id === staffId)
    if (!staff) return

    const staffName = staff.name.toUpperCase()
    setEmployeeName(staffName)
    setDtrTargetRole(staff.role)

    // Requirement 3: Schedule option defaults to option set on their account, else Option 1 default
    let targetPreset: 'option_1' | 'option_2' = 'option_1'
    if (staff.workingHoursPreset === 'option_1' || staff.workingHoursPreset === 'option_2') {
      targetPreset = staff.workingHoursPreset
    } else {
      const savedKey = `termcat_dtr_user_settings_v1_${staff.id}`
      const saved = localStorage.getItem(savedKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.workingHoursPreset === 'option_1' || parsed.workingHoursPreset === 'option_2') {
            targetPreset = parsed.workingHoursPreset
          }
        } catch {}
      }
    }

    // Apply active schedule preset & ranges for this staff
    setWorkingHoursPreset(targetPreset)
    if (targetPreset === 'option_1') {
      setOfficialHoursText('Regular days 7:00-11:30AM / 1:00-5:00PM')
      setSaturdaysText('Saturdays: 1:00-5:00PM')
      setAmArrivalRange({ start: 15, end: 58 })
      setAmDepartureRange({ start: 30, end: 45 })
      setPmArrivalRange({ start: 22, end: 58 })
      setPmDepartureRange({ start: 0, end: 15 })
    } else {
      setOfficialHoursText('Regular days 8:00-12:00NN / 1:00-5:00PM')
      setSaturdaysText('Saturdays: 8:00-12:00NN')
      setAmArrivalRange({ start: 15, end: 58 })
      setAmDepartureRange({ start: 0, end: 15 })
      setPmArrivalRange({ start: 22, end: 58 })
      setPmDepartureRange({ start: 0, end: 15 })
    }

    // Check if staff already has an official DTR for the active month/year
    const existing = savedRecords.find(
      r => r.employeeName.trim().toUpperCase() === staffName &&
           r.month === selectedMonth &&
           r.year === selectedYear
    )

    if (existing) {
      setActiveRecordId(existing.id)
      setEntries(existing.entries)
      if (existing.officialHoursText) setOfficialHoursText(existing.officialHoursText)
      if (existing.schoolHeadName) setSchoolHeadName(existing.schoolHeadName)
      toast(`Loaded existing DTR record for ${staffName} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}).`, 'info')
    } else {
      setActiveRecordId(null)

      // Requirement 2: Multi-school (e.g. Kindergarten) staff - select 1st assigned school first (One school at a time)
      const firstSchool = staff.assignedSchoolIds.length > 0 ? staff.assignedSchoolIds[0] : (allSchools.length > 0 ? allSchools[0].id : '')
      if (firstSchool) {
        setSelectedSchoolId(firstSchool)
        const matchedHead = schoolHeadOptions.find(h => h.assignedSchoolIds.includes(firstSchool))
        if (matchedHead) {
          setSchoolHeadName(matchedHead.name)
        } else if (schoolHeadOptions.length > 0) {
          setSchoolHeadName(schoolHeadOptions[0].name)
        }

        const staffSessions = staff.schoolSessions || {}
        const activeMode = staffSessions[firstSchool] || 'full_day'
        setDtrSessionMode(activeMode)

        if (activeMode === 'am') {
          setOfficialHoursText(targetPreset === 'option_2' ? 'Regular days 8:00-12:00NN (Morning A.M. Session)' : 'Regular days 7:00-11:30AM (Morning A.M. Session)')
        } else if (activeMode === 'pm') {
          setOfficialHoursText('Regular days 1:00-5:00PM (Afternoon P.M. Session)')
        } else {
          setOfficialHoursText(targetPreset === 'option_2' ? 'Regular days 8:00-12:00NN / 1:00-5:00PM' : 'Regular days 7:00-11:30AM / 1:00-5:00PM')
        }

        // Generate fresh times for the active month based on session duty mode & schedule preset
        const updated: DTRDayEntry[] = buildInitialDays(selectedYear, selectedMonth).map(entry => {
          if (entry.status === 'blank' || entry.isSaturday || entry.isSunday || entry.isHoliday) {
            return entry
          }

          const amArrMin = getRandomInt(15, 58)
          const amDepMin = getRandomInt(targetPreset === 'option_1' ? 30 : 0, targetPreset === 'option_1' ? 45 : 15)
          const pmArrMin = getRandomInt(22, 58)
          const pmDepMin = getRandomInt(0, 15)

          const amArrHour = targetPreset === 'option_2' ? 7 : 6
          const amDepHour = targetPreset === 'option_2' ? 12 : 11

          return {
            ...entry,
            status: 'work' as const,
            amArrival: (activeMode === 'full_day' || activeMode === 'am') ? `${amArrHour}:${String(amArrMin).padStart(2, '0')}` : '',
            amDeparture: (activeMode === 'full_day' || activeMode === 'am') ? `${amDepHour}:${String(amDepMin).padStart(2, '0')}` : '',
            pmArrival: (activeMode === 'full_day' || activeMode === 'pm') ? `12:${String(pmArrMin).padStart(2, '0')}` : '',
            pmDeparture: (activeMode === 'full_day' || activeMode === 'pm') ? `5:${String(pmDepMin).padStart(2, '0')}` : '',
            undertimeHours: '',
            undertimeMinutes: ''
          }
        })
        setEntries(updated)
        const modeLabel = activeMode === 'am' ? ' (Morning A.M. Only)' : activeMode === 'pm' ? ' (Afternoon P.M. Only)' : ''
        toast(`Generated DTR template${modeLabel} for ${staffName} (${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}).`, 'success')
      }
    }
  }

  // Print DTR Handler (2-in-1 Side-by-Side Dual Copy)
  const handlePrintDTR = () => {
    window.print()
  }

  const monthYearLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`

  // Filtered History for Logged-In User (Includes self-generated & proxy-generated DTRs)
  const userSavedRecords = useMemo(() => {
    if (!admin?.full_name) return savedRecords
    const currentName = admin.full_name.trim().toLowerCase()
    const currentUserId = admin.id
    return savedRecords.filter(r => {
      const isEmployee = r.employeeName.trim().toLowerCase() === currentName
      const isCreator = (currentUserId && r.createdByUserId === currentUserId) ||
                        (Boolean(r.createdByName) && r.createdByName!.trim().toLowerCase() === currentName)
      return isEmployee || isCreator
    })
  }, [savedRecords, admin])

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return userSavedRecords
    const q = historySearch.toLowerCase()
    return userSavedRecords.filter(r => {
      const monthName = MONTH_NAMES[r.month - 1]?.toLowerCase() || ''
      return (
        r.employeeName.toLowerCase().includes(q) ||
        monthName.includes(q) ||
        String(r.year).includes(q) ||
        r.role.toLowerCase().includes(q)
      )
    })
  }, [userSavedRecords, historySearch])

  // Filtered Absences for Logged-In User Only
  const userAbsencesList = useMemo(() => {
    if (!admin?.full_name) return absencesList
    const name = admin.full_name.trim().toLowerCase()
    return absencesList.filter(a => a.employeeName.trim().toLowerCase() === name)
  }, [absencesList, admin])

  // Filtered Leave Records for Logged-In User Only
  const userLeaveRecords = useMemo(() => {
    if (!admin?.full_name) return leaveRecords
    const name = admin.full_name.trim().toLowerCase()
    return leaveRecords.filter(l => l.employeeName.trim().toLowerCase() === name)
  }, [leaveRecords, admin])

  return (
    <>
      <div className="no-print">
        <SchoolConnectLayout
          activeAppId="dtr"
          systemTitle="Civil Service Form No. 48 DTR Generator"
          systemSubtitle="Concepcion District Non-Late DTR & Official Signatory System"
          navGroups={dtrNavGroups}
        >
          {isLoadingSupabase ? (
            <DepEdPageLoader
              label="Loading Civil Service Form No. 48 DTR System..."
              subtitle="Syncing DTR records, custom local holidays, and official signatories from database"
            />
          ) : (
            <div className="space-y-6 w-full pb-16 animate-fade-in no-print">
        {/* Top Header Card */}
        <PageHeader
          badge="Civil Service Form No. 48 DTR System"
          title={
            currentTab === 'dashboard' ? 'DTR System Dashboard' :
            currentTab === 'my_dtrs' ? 'My Saved DTRs & History' :
            currentTab === 'generate' ? 'Daily Time Record Generator' :
            currentTab === 'holidays' ? 'National & Local Holidays Manager' :
            currentTab === 'absences' ? 'Personnel Absences Tracking' :
            currentTab === 'leave' ? 'Form 6 Official Leave Records' :
            'Working Hours & Range Settings'
          }
          description="Official Concepcion District Daily Time Record management system synced with Supabase Database."
          actions={
            <>
              <button
                type="button"
                onClick={() => setTab('generate')}
                className="px-4 py-2 rounded-full bg-white border border-white text-[#2D2638] font-bold text-xs shadow-2xs hover:bg-[#F6EFFF] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles size={14} className="text-[#8B72F4]" />
                <span>Generate DTR</span>
              </button>

              <button
                type="button"
                onClick={() => setTab('my_dtrs')}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer active:animate-button-sparkle"
              >
                <FolderOpen size={14} />
                <span>My DTRs ({userSavedRecords.length})</span>
              </button>
            </>
          }
        />

        {/* VIEW 1: DASHBOARD OVERVIEW */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="clay-card p-5 space-y-2 border-l-4 border-l-[#8B72F4]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A7289] uppercase tracking-wider">Saved DTRs</span>
                  <FolderOpen size={20} className="text-[#8B72F4]" />
                </div>
                <p className="text-2xl font-black text-[#2D2638] font-display">{userSavedRecords.length}</p>
                <p className="text-[11px] text-[#7A7289]">Synced in Supabase DB</p>
              </div>

              <div className="clay-card p-5 space-y-2 border-l-4 border-l-amber-400">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A7289] uppercase tracking-wider">Local Holidays</span>
                  <PartyPopper size={20} className="text-amber-500" />
                </div>
                <p className="text-2xl font-black text-[#2D2638] font-display">{customHolidays.length}</p>
                <p className="text-[11px] text-[#7A7289]">District & Town Fiestas</p>
              </div>

              <div className="clay-card p-5 space-y-2 border-l-4 border-l-emerald-400">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A7289] uppercase tracking-wider">Active Staff</span>
                  <Users size={20} className="text-emerald-500" />
                </div>
                <p className="text-2xl font-black text-[#2D2638] font-display">{allStaffProfiles.length || 1}</p>
                <p className="text-[11px] text-[#7A7289]">Registered Personnel</p>
              </div>

              <div className="clay-card p-5 space-y-2 border-l-4 border-l-purple-400">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#7A7289] uppercase tracking-wider">Active Period</span>
                  <Calendar size={20} className="text-purple-500" />
                </div>
                <p className="text-lg font-black text-[#2D2638] font-display uppercase">{monthYearLabel}</p>
                <p className="text-[11px] text-[#7A7289]">Target DTR Month</p>
              </div>
            </div>

            {/* Quick Action Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div
                onClick={() => setTab('generate')}
                className="clay-card p-6 cursor-pointer hover:border-[#8B72F4] transition-all group space-y-3 bg-gradient-to-br from-white to-[#F6EFFF]/40"
              >
                <div className="p-3 rounded-2xl bg-[#8B72F4] text-white w-fit group-hover:scale-110 transition-transform">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-base font-black text-[#2D2638] font-display">Generate New DTR</h3>
                <p className="text-xs text-[#7A7289]">
                  Generate non-late punch times for teachers, AO II, School Head, or PSDS with 2-in-1 print preview.
                </p>
                <span className="text-xs font-extrabold text-[#8B72F4] inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Open Generator <ChevronRight size={14} />
                </span>
              </div>

              <div
                onClick={() => setTab('my_dtrs')}
                className="clay-card p-6 cursor-pointer hover:border-[#8B72F4] transition-all group space-y-3 bg-gradient-to-br from-white to-[#EEF0FF]/40"
              >
                <div className="p-3 rounded-2xl bg-[#3B49B8] text-white w-fit group-hover:scale-110 transition-transform">
                  <FolderOpen size={24} />
                </div>
                <h3 className="text-base font-black text-[#2D2638] font-display">My Saved DTRs</h3>
                <p className="text-xs text-[#7A7289]">
                  View, edit, update, delete, or print your archived Civil Service Form 48 DTRs.
                </p>
                <span className="text-xs font-extrabold text-[#3B49B8] inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Saved DTRs <ChevronRight size={14} />
                </span>
              </div>

              <div
                onClick={() => setTab('holidays')}
                className="clay-card p-6 cursor-pointer hover:border-amber-400 transition-all group space-y-3 bg-gradient-to-br from-white to-amber-50/40"
              >
                <div className="p-3 rounded-2xl bg-amber-500 text-white w-fit group-hover:scale-110 transition-transform">
                  <PartyPopper size={24} />
                </div>
                <h3 className="text-base font-black text-[#2D2638] font-display">Holidays Manager</h3>
                <p className="text-xs text-[#7A7289]">
                  Manage national holidays and add custom local district holidays/town fiestas.
                </p>
                <span className="text-xs font-extrabold text-amber-600 inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Manage Holidays <ChevronRight size={14} />
                </span>
              </div>
            </div>

            {/* Recent DTR Records Preview Table */}
            {/* Quick Actions & Recent DTRs */}
            <div className="clay-card p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                  <History className="text-[#8B72F4]" size={18} />
                  Recently Generated DTR Records
                </h3>
                <button
                  type="button"
                  onClick={() => setTab('my_dtrs')}
                  className="text-xs font-bold text-[#8B72F4] hover:underline cursor-pointer"
                >
                  View All History ({userSavedRecords.length}) &rarr;
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Month & Year</th>
                      <th className="py-3 px-4">Generated By</th>
                      <th className="py-3 px-4">Work Days</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {userSavedRecords.slice(0, 5).map(record => {
                      const isSelf = record.employeeName.trim().toUpperCase() === (admin?.full_name || '').trim().toUpperCase()
                      const generatorName = record.createdByName || 'Admin'
                      return (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-800">{record.employeeName}</td>
                          <td className="py-3 px-4 font-semibold uppercase text-[#8B72F4]">{record.role}</td>
                          <td className="py-3 px-4 font-semibold">
                            {MONTH_NAMES[record.month - 1]} {record.year}
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {isSelf ? (
                              generatorName.toUpperCase() !== record.employeeName.trim().toUpperCase() ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200 inline-flex items-center gap-1">
                                  <UserCheck size={12} className="text-[#8B72F4]" />
                                  By {generatorName}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                  Self-Generated
                                </span>
                              )
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-200 inline-flex items-center gap-1">
                                <UserCheck size={12} className="text-amber-700" />
                                For {record.employeeName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-700">
                            {record.entries.filter(e => e.status === 'work').length} Days
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleViewRecord(record)}
                              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1"
                              title="View saved 2-in-1 preview"
                            >
                              <Eye size={12} />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintRecord(record)}
                              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-bold text-[11px] inline-flex items-center gap-1"
                              title="Print DTR"
                            >
                              <Printer size={12} />
                              Print
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(record.id, record.employeeName)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {userSavedRecords.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No DTR records saved yet. Click "Generate DTR" to create your first record!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MY DTRS & HISTORY VIEW */}
        {currentTab === 'my_dtrs' && (
          <div className="clay-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E6DD]">
              <div>
                <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                  <FolderOpen className="text-[#8B72F4]" size={20} />
                  Saved District DTRs & History
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    1 DTR per Staff / Month Enforced
                  </span>
                </h3>
                <p className="text-xs text-[#7A7289]">View, print, or delete final archived DTRs. (To make changes, click 'New Session')</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search by name or month..."
                    className="pl-8 pr-3 py-2 rounded-xl text-xs font-medium bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNewDTR}
                  className="px-4 py-2 rounded-xl bg-[#8B72F4] text-white font-extrabold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle size={16} />
                  New Session
                </button>
              </div>
            </div>

            {/* DTR History Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Role Category</th>
                    <th className="py-3 px-4">Month & Year</th>
                    <th className="py-3 px-4">Generated By</th>
                    <th className="py-3 px-4">Work Days</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredHistory.map(record => {
                    const isActive = record.id === activeRecordId
                    const workDays = record.entries.filter(e => e.status === 'work').length
                    const isSelf = record.employeeName.trim().toUpperCase() === (admin?.full_name || '').trim().toUpperCase()
                    const generatorName = record.createdByName || 'Admin'

                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isActive ? 'bg-[#F6EFFF]' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-extrabold text-slate-800">{record.employeeName}</td>
                        <td className="py-3.5 px-4 font-bold uppercase text-[#8B72F4]">{record.role}</td>
                        <td className="py-3.5 px-4 font-bold">
                          {MONTH_NAMES[record.month - 1]} {record.year}
                        </td>
                        <td className="py-3.5 px-4 font-semibold">
                          {isSelf ? (
                            generatorName.toUpperCase() !== record.employeeName.trim().toUpperCase() ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200 inline-flex items-center gap-1">
                                <UserCheck size={12} className="text-[#8B72F4]" />
                                By {generatorName}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                Self-Generated
                              </span>
                            )
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-200 inline-flex items-center gap-1">
                              <UserCheck size={12} className="text-amber-700" />
                              For {record.employeeName}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">{workDays} Days</td>
                        <td className="py-3.5 px-4 text-slate-400 font-medium">
                          {new Date(record.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleViewRecord(record)}
                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xs inline-flex items-center gap-1"
                            title="View saved 2-in-1 preview"
                          >
                            <Eye size={13} />
                            <span>View Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintRecord(record)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-extrabold text-xs shadow-xs hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer"
                            title="Print Form 48 for this record"
                          >
                            <Printer size={13} />
                            <span>Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(record.id, record.employeeName)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
                            title="Delete Record"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No saved DTR records found in database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: GENERATE DTR VIEW (DEFAULT / PREVIEW & EDITOR) */}
        {currentTab === 'generate' && (
          <div className="space-y-6">
            {isSavedRecordLoaded && (
              <div className="p-4 rounded-2xl bg-[#F6EFFF] border-2 border-[#8B72F4]/30 text-[#2D2638] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#8B72F4]/15 flex items-center justify-center shrink-0">
                    <Lock size={18} className="text-[#8B72F4]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black font-display text-[#2D2638]">Viewing Saved Official DTR for {employeeName} ({monthYearLabel})</h4>
                    <p className="text-[11px] text-[#7A7289] font-medium">Saved DTRs are final and read-only. To make changes or regenerate times, click <b>Generate New DTR</b>.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNewDTR}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-extrabold text-xs shadow-md hover:opacity-95 shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle size={14} />
                  <span>Generate New DTR</span>
                </button>
              </div>
            )}

            {/* CONTROLS & CONFIGURATION PANEL */}
            <div className="clay-card p-6 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#F0E6DD]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#A88BEB] to-[#8B72F4] text-white shadow-xs">
                    <Sliders size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#2D2638] font-display">
                      DTR Configuration & Parameters
                      {activeRecordId && (
                        <span className="ml-2 px-2.5 py-0.5 rounded-full bg-[#8B72F4] text-white text-[10px] font-bold uppercase tracking-wider">
                          Editing Supabase Record
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#7A7289] font-medium">Set employee details, month/year, working hours, and non-late ranges</p>
                  </div>
                </div>

                {/* Sub-tab Navigation Controls */}
                <div className="flex items-center gap-2 p-1 bg-[#FAF5F0] rounded-full border border-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setGenerateSubTab('preview')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      generateSubTab === 'preview'
                        ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                        : 'text-[#7A7289] hover:text-[#2D2638]'
                    }`}
                  >
                    <Eye size={14} className="inline mr-1.5" />
                    2-in-1 Side-by-Side Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setGenerateSubTab('editor')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      generateSubTab === 'editor'
                        ? 'bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white shadow-md'
                        : 'text-[#7A7289] hover:text-[#2D2638]'
                    }`}
                  >
                    <Edit3 size={14} className="inline mr-1.5" />
                    Table Editor & Controls
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                {/* Target School & Daily Session Duty Selector (Supports Multi-School Kindergarten) */}
                <div className="lg:col-span-6 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/70 to-blue-50/70 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#2D2638]">Target School & Daily Session Duty</span>
                        {dtrSessionMode !== 'full_day' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
                            <Sun size={10} className="text-amber-600" />
                            {dtrSessionMode === 'am' ? 'Morning Session (A.M. Only)' : 'Afternoon Session (P.M. Only)'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase flex items-center gap-1">
                            Full Day Duty (A.M. & P.M.)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#7A7289] font-medium">
                        Multi-school personnel (e.g. Kindergarten Morning School 1 & Afternoon School 2) generate two distinct DTRs per month.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Target School Selector */}
                    {allSchools.length > 0 && (
                      <select
                        value={selectedSchoolId}
                        onChange={e => handleSelectSchool(e.target.value)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-purple-200 text-[#2D2638] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                        title="Select school for this DTR"
                      >
                        <option value="">-- Select Target School --</option>
                        {allSchools.map(sch => {
                          const activeStaff = allStaffProfiles.find(s => s.id === selectedProxyStaffId)
                          const sessMap = activeStaff?.schoolSessions || admin?.school_sessions || {}
                          const sess = sessMap[sch.id]
                          const tag = sess === 'am' ? ' (A.M. Session)' : sess === 'pm' ? ' (P.M. Session)' : ''
                          return (
                            <option key={sch.id} value={sch.id}>
                              {sch.name}{tag}
                            </option>
                          )
                        })}
                      </select>
                    )}

                    {/* Session Mode Toggle Buttons */}
                    <div className="flex items-center p-1 bg-white rounded-xl border border-purple-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDtrSessionMode('full_day')
                          setOfficialHoursText(workingHoursPreset === 'option_2' ? 'Regular days 8:00-12:00NN / 1:00-5:00PM' : 'Regular days 7:00-11:30AM / 1:00-5:00PM')
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          dtrSessionMode === 'full_day'
                            ? 'bg-[#8B72F4] text-white shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                        title="Full Day (Both Morning and Afternoon)"
                      >
                        Full Day
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDtrSessionMode('am')
                          setOfficialHoursText(workingHoursPreset === 'option_2' ? 'Regular days 8:00-12:00NN (Morning A.M. Session)' : 'Regular days 7:00-11:30AM (Morning A.M. Session)')
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          dtrSessionMode === 'am'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                        title="Morning A.M. Session Only"
                      >
                        🌅 A.M. Only
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDtrSessionMode('pm')
                          setOfficialHoursText('Regular days 1:00-5:00PM (Afternoon P.M. Session)')
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                          dtrSessionMode === 'pm'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-[#7A7289] hover:text-[#2D2638]'
                        }`}
                        title="Afternoon P.M. Session Only"
                      >
                        🌆 P.M. Only
                      </button>
                    </div>
                  </div>
                </div>
                {/* Employee Name & Proxy Personnel Picker */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label text-xs font-bold text-[#2D2638] block">Employee Full Name</label>
                    {allStaffProfiles.length > 0 && (
                      <span className="text-[10px] text-[#8B72F4] font-bold">Generate for Someone:</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
                      <input
                        type="text"
                        value={employeeName}
                        onChange={e => setEmployeeName(e.target.value.toUpperCase())}
                        placeholder="e.g. MICHELLE S. MOSQUERA"
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 uppercase"
                      />
                    </div>

                    {allStaffProfiles.length > 0 && (
                      <select
                        value={selectedProxyStaffId}
                        onChange={e => {
                          setSelectedProxyStaffId(e.target.value)
                          if (e.target.value) {
                            handleGenerateForProxyStaff(e.target.value)
                          }
                        }}
                        className="w-44 px-2 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                        title="Select District Personnel to Generate DTR for Someone"
                      >
                        <option value="">-- Choose Staff --</option>
                        {allStaffProfiles.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.roleTitle})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Personnel Role Category */}
                <div className="lg:col-span-2">
                  <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block">Personnel Category / Role</label>
                  <select
                    value={dtrTargetRole}
                    onChange={e => handleRoleChange(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30"
                  >
                    <option value="teacher">Teacher (Signatory: Assigned School Head - In-charge)</option>
                    <option value="ao_2">Administrative Officer II (AO II) (Signatory: Assigned School Head - In-charge)</option>
                    <option value="school_head">School Head / Principal (Signatory: SDS Roger Capa)</option>
                    <option value="psds">PSDS / District Supervisor (Signatory: PSDS Melchor Famorcan)</option>
                  </select>
                </div>

                {/* Official Signatory Display & Selector */}
                <div className="lg:col-span-2">
                  <label className="form-label text-xs font-bold text-[#2D2638] mb-1 block flex items-center justify-between">
                    <span>Official DTR Signatory</span>
                    <span className="text-[10px] text-[#8B72F4] font-extrabold">
                      {isDivisionSignatory ? 'Division Official' : 'School Head'}
                    </span>
                  </label>

                  {isDivisionSignatory ? (
                    <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#8B72F4] shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-extrabold truncate">{finalSupervisorName}</p>
                        <p className="text-[10px] text-purple-700 font-semibold truncate">{finalSupervisorTitle}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
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
                        {!schoolHeadOptions.some(h => h.name === schoolHeadName) && schoolHeadName && (
                          <option value={schoolHeadName}>{schoolHeadName}</option>
                        )}
                      </select>
                    </div>
                  )}
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

                {/* Action Buttons */}
                <div className="lg:col-span-4 flex items-center gap-2">
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
                    onClick={handleSaveToHistory}
                    disabled={isSavingDb}
                    className="py-2.5 px-3.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Save current DTR to Supabase Database"
                  >
                    {isSavingDb ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{activeRecordId ? 'Update Supabase' : 'Save'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetTimes}
                    className="p-2.5 rounded-xl bg-white text-[#7A7289] hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all cursor-pointer"
                    title="Reset table to blank"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* SUB-VIEW 1: LIVE 2-IN-1 DUAL COPY PREVIEW */}
            {generateSubTab === 'preview' && (
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
                    onClick={handleSaveToHistory}
                    disabled={isSavingDb}
                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-extrabold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDb ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{activeRecordId ? 'Update DTR & View in My DTRs' : 'Save DTR & View in My DTRs'}</span>
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

            {/* SUB-VIEW 2: TABLE EDITOR & MANUAL TIME INPUT */}
            {generateSubTab === 'editor' && (
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

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#EEF0FF] text-[#3B49B8] text-xs font-bold border border-[#BFD7FF]">
                      {entries.filter(e => e.status === 'work').length} Regular Work Days
                    </span>
                  </div>
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
                                    className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-[#FAF5F0] border border-white"
                                  />
                                </td>

                                {/* Undertime Minutes */}
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={entry.undertimeMinutes}
                                    onChange={e => handleCellChange(idx, 'undertimeMinutes', e.target.value)}
                                    placeholder=""
                                    className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-[#FAF5F0] border border-white"
                                  />
                                </td>
                              </>
                            ) : (
                              <>
                                <td colSpan={4} className="py-2 px-3 text-center font-black tracking-wide uppercase text-slate-700 bg-slate-50/60 border-r border-slate-200">
                                  {entry.status === 'saturday' && 'SATURDAY'}
                                  {entry.status === 'sunday' && 'SUNDAY'}
                                  {entry.status === 'holiday' && (entry.holidayTitle || 'HOLIDAY')}
                                  {entry.status === 'leave' && 'ON OFFICIAL LEAVE'}
                                  {entry.status === 'travel' && 'OFFICIAL BUSINESS (O.B.)'}
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={entry.undertimeHours}
                                    onChange={e => handleCellChange(idx, 'undertimeHours', e.target.value)}
                                    placeholder=""
                                    className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-[#FAF5F0] border border-white"
                                  />
                                </td>
                                <td className="py-1.5 px-2">
                                  <input
                                    type="text"
                                    value={entry.undertimeMinutes}
                                    onChange={e => handleCellChange(idx, 'undertimeMinutes', e.target.value)}
                                    placeholder=""
                                    className="w-full text-center px-1.5 py-1 rounded font-semibold text-slate-700 bg-[#FAF5F0] border border-white"
                                  />
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: HOLIDAYS MANAGER VIEW */}
        {currentTab === 'holidays' && (
          <div className="space-y-6">
            {/* Local Holidays Section */}
            <div className="clay-card p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-400 text-amber-950 font-black shadow-xs">
                    <PartyPopper size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                      Local & District Custom Holidays
                      <span className="text-[9px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
                        Supabase Synced
                      </span>
                    </h3>
                    <p className="text-xs text-[#7A7289]">Add district/town fiestas or local non-working days for Concepcion District</p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
                  {customHolidays.length} Active Local Holidays
                </span>
              </div>

              {/* Add Holiday Form */}
              <form onSubmit={handleAddCustomHoliday} className="p-4 rounded-2xl bg-[#FAF5F0] border border-slate-200 space-y-3">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wide flex items-center gap-1.5">
                  <CalendarPlus size={14} className="text-[#8B72F4]" />
                  Add New Local Holiday
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Month</label>
                    <select
                      value={newHolidayMonth}
                      onChange={e => setNewHolidayMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#2D2638]"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Start Day</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={newHolidayStartDay}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setNewHolidayStartDay(val)
                        if (newHolidayEndDay < val) setNewHolidayEndDay(val)
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#2D2638]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      End Day <span className="text-slate-400 font-normal">(Range)</span>
                    </label>
                    <input
                      type="number"
                      min={newHolidayStartDay || 1}
                      max={31}
                      value={newHolidayEndDay}
                      onChange={e => setNewHolidayEndDay(Number(e.target.value))}
                      placeholder="Same as start for 1 day"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#2D2638]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Holiday Title / Name</label>
                    <input
                      type="text"
                      value={newHolidayTitle}
                      onChange={e => setNewHolidayTitle(e.target.value)}
                      placeholder="e.g. Concepcion Town Fiesta"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-[#2D2638] focus:ring-2 focus:ring-[#8B72F4]/30"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60 mt-2">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={newHolidayIsRecurring}
                        onChange={e => setNewHolidayIsRecurring(e.target.checked)}
                        className="rounded text-[#8B72F4] focus:ring-[#8B72F4]"
                      />
                      <span>Repeats every year (Annual)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                      <input
                        type="checkbox"
                        checked={newHolidayIsHalfDay}
                        onChange={e => setNewHolidayIsHalfDay(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>Half Day Only</span>
                    </label>

                    {newHolidayIsHalfDay && (
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs animate-fade-in">
                        <span className="text-[11px] text-slate-500 font-extrabold uppercase">Session:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="halfDaySession"
                            value="am"
                            checked={newHolidayHalfDaySession === 'am'}
                            onChange={() => setNewHolidayHalfDaySession('am')}
                            className="text-[#8B72F4]"
                          />
                          <span>Morning (A.M. Off)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <input
                            type="radio"
                            name="halfDaySession"
                            value="pm"
                            checked={newHolidayHalfDaySession === 'pm'}
                            onChange={() => setNewHolidayHalfDaySession('pm')}
                            className="text-[#8B72F4]"
                          />
                          <span>Afternoon (P.M. Off)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B72F4] to-[#795CEE] text-white font-extrabold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Plus size={16} />
                    Save Local Holiday
                  </button>
                </div>
              </form>

              {/* Local Holidays List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {customHolidays.map(item => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Tag size={16} className="text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-extrabold text-[#2D2638]">{item.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-[#8B72F4] font-black">{item.dateStr}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] text-slate-500 font-bold">{item.isRecurring ? 'Annual' : 'Specific Year'}</span>
                          {item.isHalfDay && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60 text-[9px] font-black uppercase">
                              Half Day ({item.halfDaySession === 'pm' ? 'P.M.' : 'A.M.'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCustomHoliday(item.id, item.title)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      title="Delete Local Holiday"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* National Holidays Section */}
            <div className="clay-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0E6DD]">
                <div>
                  <h3 className="text-base font-black text-[#2D2638] font-display">Official National Holidays</h3>
                  <p className="text-xs text-[#7A7289]">Standard Philippine Regular & Special Non-Working Holidays</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                  {nationalHolidays.filter(h => h.isActive).length} Active National Holidays
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {nationalHolidays.map(nh => (
                  <div
                    key={nh.key}
                    onClick={() => handleToggleNationalHoliday(nh.key)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      nh.isActive
                        ? 'bg-white border-[#8B72F4]/60 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-[#2D2638]">{nh.name}</p>
                      <p className="text-[10px] text-[#8B72F4] font-extrabold">{nh.dateStr}</p>
                    </div>

                    <button type="button" className="text-[#8B72F4]">
                      {nh.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-slate-400" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: ABSENCES VIEW */}
        {currentTab === 'absences' && (
          <div className="clay-card p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0E6DD]">
              <div>
                <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                  <UserX className="text-rose-500" size={20} />
                  Personnel Absences Tracking
                </h3>
                <p className="text-xs text-[#7A7289]">Log and record absence days for personnel</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                {userAbsencesList.length} Logged Absences
              </span>
            </div>

            {/* Log Absence Form */}
            <form onSubmit={handleAddAbsence} className="p-4 rounded-2xl bg-[#FAF5F0] border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wide">Log New Absence</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Absence Date</label>
                  <input
                    type="date"
                    value={newAbsenceDate}
                    onChange={e => setNewAbsenceDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Reason / Explanation</label>
                  <input
                    type="text"
                    value={newAbsenceReason}
                    onChange={e => setNewAbsenceReason(e.target.value)}
                    placeholder="e.g. Family Emergency / Medical Absence"
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200"
                  />
                </div>

                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAbsenceExcused}
                      onChange={e => setNewAbsenceExcused(e.target.checked)}
                      className="rounded text-[#8B72F4]"
                    />
                    <span>Excused Absence</span>
                  </label>

                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 rounded-xl bg-[#8B72F4] text-white font-extrabold text-xs shadow-md cursor-pointer"
                  >
                    Log Absence
                  </button>
                </div>
              </div>
            </form>

            {/* Absences Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Absence Date</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {userAbsencesList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{item.employeeName}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#8B72F4]">{item.date}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{item.reason}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          item.isExcused ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.isExcused ? 'Excused' : 'Unexcused'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteAbsence(item.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {userAbsencesList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">No absence logs recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 6: LEAVE (FORM 6) VIEW */}
        {currentTab === 'leave' && (
          <div className="clay-card p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0E6DD]">
              <div>
                <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                  <FileSpreadsheet className="text-blue-500" size={20} />
                  Form 6 Official Leave Records
                </h3>
                <p className="text-xs text-[#7A7289]">Track official Form 6 Application for Leave entries</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                {userLeaveRecords.length} Approved Leaves
              </span>
            </div>

            {/* File Leave Form */}
            <form onSubmit={handleAddLeave} className="p-4 rounded-2xl bg-[#FAF5F0] border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wide">File Form 6 Leave Record</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Leave Category</label>
                  <select
                    value={newLeaveType}
                    onChange={e => setNewLeaveType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200"
                  >
                    <option value="Vacation Leave">Vacation Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Mandatory Leave">Mandatory Leave</option>
                    <option value="Special Privilege Leave">Special Privilege Leave</option>
                    <option value="Maternity Leave">Maternity Leave</option>
                    <option value="Solo Parent Leave">Solo Parent Leave</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newLeaveStart}
                    onChange={e => setNewLeaveStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={newLeaveEnd}
                    onChange={e => setNewLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl bg-[#8B72F4] text-white font-extrabold text-xs shadow-md cursor-pointer"
                  >
                    File Leave Record
                  </button>
                </div>
              </div>
            </form>

            {/* Leave Records Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4">Inclusive Dates</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {userLeaveRecords.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{item.employeeName}</td>
                      <td className="py-3.5 px-4 font-extrabold text-[#8B72F4]">{item.leaveType}</td>
                      <td className="py-3.5 px-4 font-bold">
                        {item.startDate} to {item.endDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteLeave(item.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {userLeaveRecords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">No leave records filed.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 7: SETTINGS VIEW */}
        {currentTab === 'settings' && (
          <div className="clay-card p-6 space-y-6">
            <div className="pb-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-black text-[#2D2638] font-display flex items-center gap-2">
                  <SettingsIcon className="text-[#FA6B6B]" size={20} />
                  Working Hours & DTR System Settings
                </h3>
                <p className="text-xs text-[#7A7289]">
                  Customize your prescribed working hours, Saturday header text, and non-late generator minute ranges. Saved for yourself only.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-[#FFEBEB] text-[#FA6B6B] border border-[#FFCCD4]">
                <User size={14} />
                Saved for {admin?.full_name || 'You'} Only
              </span>
            </div>

            {/* Prescribed Working Hours Schedule Selection */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={16} className="text-[#FA6B6B]" />
                Prescribed Working Hours Schedule Option
              </h4>
              <p className="text-xs text-slate-500">
                Select between the two official DepEd working hour schedules:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Option 1 Card */}
                <div
                  onClick={() => handleApplyPreset('option_1')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    workingHoursPreset === 'option_1'
                      ? 'border-[#FA6B6B] bg-[#FFEBEB]/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">Option 1 (7:00AM – 11:30AM & 1:00PM – 5:00PM)</span>
                    {workingHoursPreset === 'option_1' && (
                      <CheckCircle2 size={18} className="text-[#FA6B6B]" />
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-[#FA6B6B] mt-1">7:00 AM – 11:30 AM & 1:00 PM – 5:00 PM</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Morning Arrival: 6:xx AM • Morning Departure: 11:xx AM
                  </p>
                </div>

                {/* Option 2 Card */}
                <div
                  onClick={() => handleApplyPreset('option_2')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    workingHoursPreset === 'option_2'
                      ? 'border-[#FA6B6B] bg-[#FFEBEB]/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">Option 2 (8:00AM – 12:00PM & 1:00PM – 5:00PM)</span>
                    {workingHoursPreset === 'option_2' && (
                      <CheckCircle2 size={18} className="text-[#FA6B6B]" />
                    )}
                  </div>
                  <p className="text-xs font-extrabold text-[#FA6B6B] mt-1">8:00 AM – 12:00 PM & 1:00 PM – 5:00 PM</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Morning Arrival: 7:xx AM • Morning Departure: 12:xx PM
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Working Hours Text Configurations */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wide">Prescribed Working Hours Header Strings</h4>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Regular Days Working Hours Text</label>
                  <input
                    type="text"
                    value={officialHoursText}
                    onChange={e => setOfficialHoursText(e.target.value)}
                    placeholder="Regular days 7:00–11:30AM / 1:00–5:00PM"
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Printed on Civil Service Form No. 48 header</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Saturdays Schedule Text</label>
                  <input
                    type="text"
                    value={saturdaysText}
                    onChange={e => setSaturdaysText(e.target.value)}
                    placeholder="e.g. Saturdays: 1:00-5:00PM or 8:00-12:00NN"
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                  />
                </div>
              </div>

              {/* Random Generator Minute Range Parameters */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black text-[#2D2638] uppercase tracking-wide">
                  Non-Late Random Generator Minute Ranges
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      A.M. Arrival ({workingHoursPreset === 'option_2' ? '7:xx AM' : '6:xx AM'})
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={amArrivalRange.start}
                        onChange={e => setAmArrivalRange({ ...amArrivalRange, start: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={amArrivalRange.end}
                        onChange={e => setAmArrivalRange({ ...amArrivalRange, end: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      A.M. Departure ({workingHoursPreset === 'option_2' ? '12:xx PM' : '11:xx AM'})
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={amDepartureRange.start}
                        onChange={e => setAmDepartureRange({ ...amDepartureRange, start: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={amDepartureRange.end}
                        onChange={e => setAmDepartureRange({ ...amDepartureRange, end: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">P.M. Arrival (12:xx PM)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={pmArrivalRange.start}
                        onChange={e => setPmArrivalRange({ ...pmArrivalRange, start: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={pmArrivalRange.end}
                        onChange={e => setPmArrivalRange({ ...pmArrivalRange, end: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">P.M. Departure (5:xx PM)</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={pmDepartureRange.start}
                        onChange={e => setPmDepartureRange({ ...pmDepartureRange, start: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={pmDepartureRange.end}
                        onChange={e => setPmDepartureRange({ ...pmDepartureRange, end: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#FA6B6B]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSavePersonalSettings}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7A70] to-[#FA6B6B] text-white font-extrabold text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Save size={16} />
                Save System Settings
              </button>
            </div>
          </div>
        )}
          </div>
          )}

        </SchoolConnectLayout>
      </div>

      {/* STANDALONE PRINT AREA OUTSIDE SchoolConnectLayout */}
      <div className="dtr-print-only-root official-termcat-print-area">
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
    </>
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
    <div
      className="dtr-dual-container flex flex-row justify-between items-start gap-4 w-full mx-auto bg-white text-black p-2"
      style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
    >
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
    <div className="dtr-card-cut-wrapper flex-1 relative border border-dashed border-black p-[0.1in] bg-white box-sizing-border font-sans">
      {/* Scissor icon indicator */}
      <span className="dtr-scissor-tag absolute -top-2.5 left-3 bg-white px-1 text-[8pt] text-black font-mono flex items-center gap-1 z-10 select-none">
        ✂
      </span>
      <div
        className="dtr-card-single border-2 border-black p-3 bg-white text-black text-[8.5pt] leading-tight select-none w-full"
        style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
      >
      {/* Form Title */}
      <div className="text-center font-bold">
        <p className="text-[7.5pt] tracking-tight">CIVIL SERVICE FORM No. 48</p>
        <p className="text-[10pt] font-extrabold uppercase mt-0.5">DAILY TIME RECORD</p>
        <div className="w-3/4 border-b border-black mx-auto my-1"></div>

        {/* Employee Name Underline */}
        <p className="text-[11pt] font-extrabold uppercase tracking-wide border-b border-black pb-0.5 mt-2">
          {employeeName || 'MICHELLE S. MOSQUERA'}
        </p>
        <p className="text-[7pt] italic">(Name)</p>
      </div>

      {/* Month & Official Hours Header Info */}
      <div className="mt-2 space-y-0.5 text-[7.5pt] leading-snug">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">For the month of:</span>
          <span className="font-extrabold uppercase border-b border-black px-2 text-[8.5pt]">
            {monthYearLabel}
          </span>
        </div>

        <div className="flex items-start justify-between">
          <div className="font-semibold">
            <div>Office hours of arrival</div>
            <div>and departure</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{officialHoursText || 'Regular days 7:00-11:30AM'}</div>
            <div className="font-bold">
              {saturdaysText
                ? (saturdaysText.toLowerCase().startsWith('saturdays') ? saturdaysText : `Saturdays: ${saturdaysText}`)
                : 'Saturdays: 1:00-5:00PM'}
            </div>
          </div>
        </div>
      </div>

      {/* Main DTR Data Table */}
      <table className="dtr-table w-full border-collapse border border-black text-center mt-2 text-[7.5pt]">
        <thead>
          <tr className="border-b border-black font-bold">
            <th className="border-r border-black py-1 w-[8%]" rowSpan={2}>
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
          <tr className="border-b border-black font-bold text-[6.5pt] tracking-tight">
            <th className="border-r border-black w-[17%]">Arrival</th>
            <th className="border-r border-black w-[17%]">Departure</th>
            <th className="border-r border-black w-[17%]">Arrival</th>
            <th className="border-r border-black w-[17%]">Departure</th>
            <th className="border-r border-black w-[12%]">Hours</th>
            <th className="w-[12%]">Minutes</th>
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
              else if (e.status === 'holiday') {
                label = (e.holidayTitle || '')
                  .replace(/^HOLIDAY\s*(\(|\s*)/i, '')
                  .replace(/\)$/, '')
                  .trim()
                  .toUpperCase()
                if (!label) label = 'HOLIDAY'
              }
              else if (e.status === 'leave') label = 'ON LEAVE'
              else if (e.status === 'travel') label = 'OFFICIAL BUSINESS'

              const currentIdx = entries.indexOf(e)
              const prevEntry = currentIdx > 0 ? entries[currentIdx - 1] : null
              let prevLabel = ''
              if (prevEntry && prevEntry.status !== 'work' && prevEntry.status !== 'blank') {
                if (prevEntry.status === 'saturday') prevLabel = 'SATURDAY'
                else if (prevEntry.status === 'sunday') prevLabel = 'SUNDAY'
                else if (prevEntry.status === 'holiday') {
                  prevLabel = (prevEntry.holidayTitle || '')
                    .replace(/^HOLIDAY\s*(\(|\s*)/i, '')
                    .replace(/\)$/, '')
                    .trim()
                    .toUpperCase()
                  if (!prevLabel) prevLabel = 'HOLIDAY'
                }
                else if (prevEntry.status === 'leave') prevLabel = 'ON LEAVE'
                else if (prevEntry.status === 'travel') prevLabel = 'OFFICIAL BUSINESS'
              }

              const isContinuation = prevEntry && prevEntry.status === e.status && prevLabel === label

              let spanCount = 1
              if (!isContinuation) {
                for (let j = currentIdx + 1; j < entries.length; j++) {
                  const nextEntry = entries[j]
                  if (!nextEntry || nextEntry.status !== e.status) break

                  let nextLabel = ''
                  if (nextEntry.status === 'saturday') nextLabel = 'SATURDAY'
                  else if (nextEntry.status === 'sunday') nextLabel = 'SUNDAY'
                  else if (nextEntry.status === 'holiday') {
                    nextLabel = (nextEntry.holidayTitle || '')
                      .replace(/^HOLIDAY\s*(\(|\s*)/i, '')
                      .replace(/\)$/, '')
                      .trim()
                      .toUpperCase()
                    if (!nextLabel) nextLabel = 'HOLIDAY'
                  }
                  else if (nextEntry.status === 'leave') nextLabel = 'ON LEAVE'
                  else if (nextEntry.status === 'travel') nextLabel = 'OFFICIAL BUSINESS'

                  if (nextLabel === label) {
                    spanCount++
                  } else {
                    break
                  }
                }
              }

              return (
                <tr key={e.dayNumber} className="border-b border-black">
                  <td className="border-r border-black font-bold py-0.5">{e.dayNumber}</td>
                  {!isContinuation && (
                    <td
                      colSpan={4}
                      rowSpan={spanCount}
                      className="border-r border-black font-extrabold text-[7pt] tracking-wider py-0.5 uppercase align-middle text-center px-1"
                    >
                      {label}
                    </td>
                  )}
                  <td className="border-r border-black"></td>
                  <td></td>
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
          <p className="text-[6.5pt] italic mt-0.5">(Signature of Employee)</p>
        </div>

        <div className="pt-1 text-[7.5pt]">
          <p className="font-semibold italic">Verified as to the prescribed office hours.</p>
          <div className="pt-5 text-center">
            <p className="font-extrabold uppercase border-b border-black inline-block px-4 text-[8.5pt]">
              {supervisorName || 'ROGER F. CAPA, CESO VI'}
            </p>
            <p className="text-[7.5pt] font-semibold text-slate-800">{supervisorTitle || 'In-charge'}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
)
}
