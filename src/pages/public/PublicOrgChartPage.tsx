import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Network,
  Search,
  Building2,
  Crown,
  Printer,
  ChevronDown,
  Globe,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Move,
  Hand
} from 'lucide-react'
import { fetchAllAdmins, fetchSchools, fetchGradeLevels } from '@/lib/supabase/queries'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import type { AdminProfile, School, GradeLevel } from '@/types'

interface TreeNodeCardProps {
  avatarUrl?: string
  name: string
  position: string
  subText?: string
  badgeNumber?: string
  levelTag?: string
  colorTheme: {
    bannerBg: string
    border: string
    textAccent: string
    badgeBg: string
  }
  isTopRoot?: boolean
}

function TreeNodeCard({
  avatarUrl,
  name,
  position,
  subText,
  badgeNumber,
  levelTag,
  colorTheme,
  isTopRoot = false
}: TreeNodeCardProps) {
  return (
    <div className="flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-105 select-none">
      {/* Avatar Circle Header with Badge */}
      <div className="relative mb-[-14px] z-10">
        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full p-1 bg-white shadow-lg border-2 ${colorTheme.border} flex items-center justify-center transition-transform group-hover:rotate-3`}>
          <img
            src={avatarUrl || '/images/clay/avatar_girl.jpg'}
            alt={name}
            className="w-full h-full rounded-full object-cover bg-slate-100"
          />
        </div>

        {badgeNumber && (
          <span className={`absolute -top-1 -right-1 w-5.5 h-5.5 rounded-full ${colorTheme.badgeBg} text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-sm`}>
            {badgeNumber}
          </span>
        )}

        {isTopRoot && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-black border border-white shadow-xs whitespace-nowrap flex items-center gap-1">
            <Crown size={10} className="text-amber-900" />
            <span>LEVEL 1 &bull; PSDS</span>
          </div>
        )}
      </div>

      {/* Ribbon Banner & White Position Box */}
      <div className={`w-44 sm:w-52 rounded-2xl overflow-hidden border-2 ${colorTheme.border} bg-white shadow-md transition-all group-hover:shadow-xl`}>
        {/* Upper Banner with Name */}
        <div className={`${colorTheme.bannerBg} px-3 py-2 text-center text-white shadow-xs`}>
          <h4 className="text-xs sm:text-sm font-black tracking-tight truncate font-display uppercase">
            {name}
          </h4>
        </div>

        {/* Lower White Box with Position */}
        <div className="px-2.5 py-2 text-center bg-white space-y-0.5">
          <p className={`text-[11px] font-extrabold ${colorTheme.textAccent} truncate leading-tight`}>
            {position}
          </p>
          {subText && (
            <p className="text-[9px] font-bold text-[#7A7289] truncate">
              {subText}
            </p>
          )}
          {levelTag && (
            <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full text-[8px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
              {levelTag}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function PublicOrgChartPage() {
  const [staffList, setStaffList] = useState<AdminProfile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  // Search, Filter & Zoom/Pan State
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)

  // Refs for auto-fit screen calculation and panning
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const treeContentRef = useRef<HTMLDivElement>(null)
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const initialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const loadData = async () => {
    setLoading(true)
    try {
      const [sList, schList, gList] = await Promise.all([
        fetchAllAdmins(true),
        fetchSchools(true),
        fetchGradeLevels()
      ])
      setStaffList(sList)
      setSchools(schList)
      setGrades(gList)
    } catch (err) {
      console.error('Failed to load org chart data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    document.title = 'Strict Hierarchy Org Chart (PSDS > School Heads > AO IIs > Teachers)'
    loadData()
  }, [])

  // Auto-fit org chart to view boundaries
  const handleAutoFit = useCallback(() => {
    if (!canvasViewportRef.current || !treeContentRef.current) return
    const vpWidth = canvasViewportRef.current.clientWidth - 48
    const vpHeight = canvasViewportRef.current.clientHeight - 48
    const contentWidth = treeContentRef.current.scrollWidth
    const contentHeight = treeContentRef.current.scrollHeight

    if (contentWidth > 0 && contentHeight > 0) {
      const scaleX = vpWidth / contentWidth
      const scaleY = vpHeight / contentHeight
      const fitScale = Math.min(scaleX, scaleY, 1)
      const fitPct = Math.max(25, Math.min(100, Math.floor(fitScale * 100)))
      setZoomLevel(fitPct)
      setPan({ x: 0, y: 0 })
    }
  }, [])

  // Auto-fit whenever school filter, search query, or data finishes loading
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        handleAutoFit()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [selectedSchoolId, searchQuery, loading, handleAutoFit])

  // Handle window resize auto-fit
  useEffect(() => {
    const onResize = () => handleAutoFit()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [handleAutoFit])

  // Drag / Pan interaction handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    setIsPanning(true)
    panStartRef.current = { x: e.clientX, y: e.clientY }
    initialPanRef.current = { ...pan }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setPan({
      x: initialPanRef.current.x + dx,
      y: initialPanRef.current.y + dy
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false)
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch (_) {}
    }
  }

  // Mouse wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 5 : -5
      setZoomLevel(z => Math.max(30, Math.min(160, z + delta)))
    }
  }

  // Helper: School Name to Abbreviation
  const getSchoolAbbreviation = (schoolName: string, session?: string) => {
    const knownMap: Record<string, string> = {
      'San Pedro (Agbatang) Elementary School': 'SPAES',
      'Calabasahan Elementary School': 'CES',
      'Sampong Elementary School': 'SES',
      'Concepcion National High School': 'CNHS',
      'Macalacad Elementary School': 'MES',
    }

    let baseAbbrev = knownMap[schoolName]
    if (!baseAbbrev) {
      baseAbbrev = schoolName
        .replace(/\(.*\)/g, '')
        .split(' ')
        .filter(w => w.length > 0 && !['of', 'the', 'and', 'in'].includes(w.toLowerCase()))
        .map(w => w[0].toUpperCase())
        .join('')
    }

    if (session === 'am') return `${baseAbbrev} (A.M.)`
    if (session === 'pm') return `${baseAbbrev} (P.M.)`
    return baseAbbrev
  }

  // Helper: Format Designation Title
  const getStaffDesignation = (s: AdminProfile) => {
    if (s.role === 'admin' || s.role === 'superadmin') {
      return 'System Administrator'
    }
    if (s.role === 'psds') {
      return 'District Supervisor (PSDS)'
    }
    if (s.role === 'school_head') {
      return 'School Head / Principal'
    }
    if (s.role === 'ao_2') {
      return 'Administrative Officer II'
    }
    if (s.role === 'teacher') {
      switch (s.teacher_category) {
        case 'kindergarten':
          return 'Kindergarten Teacher'
        case 'jhs':
          return 'Junior HS Teacher'
        case 'shs':
          return 'Senior HS Teacher'
        case 'subject_teacher':
          return 'Subject Teacher'
        default:
          return 'Elementary Teacher'
      }
    }
    return 'Staff Member'
  }

  // Teacher grade level badge formatter
  const formatTeacherGradeBadge = (t: AdminProfile) => {
    if (t.assigned_grade_ids && t.assigned_grade_ids.length > 0) {
      const matched = grades.filter(g => t.assigned_grade_ids?.includes(g.id))
      if (matched.length > 0) {
        const sorted = [...matched].sort((a, b) => a.grade_number - b.grade_number)
        if (sorted.length === 1) {
          return sorted[0].name.startsWith('Grade') ? `Grade ${sorted[0].grade_number}` : sorted[0].name
        }
        if (sorted.length === 6 && sorted[0].grade_number === 1 && sorted[5].grade_number === 6) {
          return 'Grade 1-6'
        }
        if (sorted.length === 4 && sorted[0].grade_number === 7 && sorted[3].grade_number === 10) {
          return 'JHS (G7-10)'
        }
        if (sorted.length === 2 && sorted[0].grade_number === 11 && sorted[1].grade_number === 12) {
          return 'SHS (G11-12)'
        }
        return sorted.map(g => (g.grade_number ? `G${g.grade_number}` : g.name)).join(', ')
      }
    }
    if (t.teacher_category === 'kindergarten') return 'Kindergarten'
    if (t.teacher_category === 'jhs') return 'JHS (G7-10)'
    if (t.teacher_category === 'shs') return 'SHS (G11-12)'
    if (t.teacher_category === 'subject_teacher') return 'Grade 1-12'
    return 'Grade 1-6'
  }

  // Filtered staff list by search query
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return staffList
    return staffList.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      getStaffDesignation(s).toLowerCase().includes(q)
    )
  }, [staffList, searchQuery])

  // LEVEL 1 ROOT NODE: PSDS
  const districtSupervisor = useMemo(() => {
    return filteredStaff.find(s => s.role === 'psds') || staffList.find(s => s.role === 'psds')
  }, [filteredStaff, staffList])

  // SCHOOL HIERARCHY TREE (LEVEL 2: School Heads -> LEVEL 3: AO IIs -> LEVEL 4: Teachers)
  const schoolTree = useMemo(() => {
    const list = selectedSchoolId === 'all'
      ? schools
      : schools.filter(s => s.id === selectedSchoolId)

    return list.map(school => {
      const schoolStaff = filteredStaff.filter(s => s.assigned_school_ids?.includes(school.id))
      const schoolHeads = schoolStaff.filter(s => s.role === 'school_head')
      const ao2s = schoolStaff.filter(s => s.role === 'ao_2' || (s.role === 'admin' && (s.assigned_school_ids || []).includes(school.id)))
      const teachers = schoolStaff.filter(s => s.role === 'teacher')

      return {
        school,
        schoolStaff,
        schoolHeads,
        ao2s,
        teachers
      }
    })
  }, [schools, filteredStaff, selectedSchoolId])

  // Theme palettes per branch
  const themeList = [
    {
      bannerBg: 'bg-gradient-to-r from-[#0284C7] to-[#0EA5E9]',
      border: 'border-[#0284C7]',
      textAccent: 'text-[#0369A1]',
      badgeBg: 'bg-[#0284C7]',
      lineColor: 'bg-[#0284C7]',
    },
    {
      bannerBg: 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6]',
      border: 'border-[#7C3AED]',
      textAccent: 'text-[#6D28D9]',
      badgeBg: 'bg-[#7C3AED]',
      lineColor: 'bg-[#7C3AED]',
    },
    {
      bannerBg: 'bg-gradient-to-r from-[#E11D48] to-[#F43F5E]',
      border: 'border-[#E11D48]',
      textAccent: 'text-[#BE123C]',
      badgeBg: 'bg-[#E11D48]',
      lineColor: 'bg-[#E11D48]',
    },
    {
      bannerBg: 'bg-gradient-to-r from-[#059669] to-[#10B981]',
      border: 'border-[#059669]',
      textAccent: 'text-[#047857]',
      badgeBg: 'bg-[#059669]',
      lineColor: 'bg-[#059669]',
    },
    {
      bannerBg: 'bg-gradient-to-r from-[#D97706] to-[#F59E0B]',
      border: 'border-[#D97706]',
      textAccent: 'text-[#B45309]',
      badgeBg: 'bg-[#D97706]',
      lineColor: 'bg-[#D97706]',
    },
    {
      bannerBg: 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6]',
      border: 'border-[#2563EB]',
      textAccent: 'text-[#1D4ED8]',
      badgeBg: 'bg-[#2563EB]',
      lineColor: 'bg-[#2563EB]',
    }
  ]

  const rootTheme = {
    bannerBg: 'bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#7C3AED]',
    border: 'border-[#2563EB]',
    textAccent: 'text-[#1E1B4B]',
    badgeBg: 'bg-[#2563EB]',
    lineColor: 'bg-[#2563EB]',
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#FAF9FE] text-[#2D2638] font-sans pb-16">
      {/* Printable CSS Rules */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { border: 1px solid #ccc !important; box-shadow: none !important; background: white !important; }
        }
      `}</style>

      {/* PUBLIC HEADER BAR WITH INTEGRATED SEARCH & SCHOOL FILTER */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-purple-100 px-4 sm:px-8 py-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/portal"
              className="p-2 rounded-2xl bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#8B72F4] transition-all cursor-pointer border border-white shrink-0"
              title="Back to School Connect Portal"
            >
              <ArrowLeft size={18} />
            </Link>

            <img
              src="/images/school_connect_logo.png"
              alt="School Connect Official Logo"
              className="h-10 sm:h-11 w-auto object-contain shrink-0"
            />

            <div className="border-l border-slate-200 pl-3 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black text-[#2D2638] tracking-tight font-display truncate">
                  Org Chart Directory
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 shrink-0 flex items-center gap-1">
                  <Globe size={10} /> Public
                </span>
              </div>
              <p className="text-[11px] text-[#7A7289] font-medium hidden lg:block truncate">
                PSDS &rarr; School Heads &rarr; AO IIs &rarr; Teachers
              </p>
            </div>
          </div>
        </div>

        {/* INTEGRATED SEARCH & SCHOOL FILTER CONTROLS */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* Inset Search Input Pill */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A39BAF]" />
            <input
              type="text"
              placeholder="Search personnel by name or position..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full text-xs bg-[#FAF5F0] border border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/30 focus:bg-white transition-all font-semibold"
            />
          </div>

          {/* School Dropdown Filter Pill */}
          <div className="relative w-full sm:w-72">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B72F4]">
              <Building2 size={15} />
            </div>
            <select
              value={selectedSchoolId}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-full text-xs font-extrabold bg-[#FAF5F0] border-2 border-[#8B72F4]/30 text-[#2D2638] focus:outline-none focus:ring-2 focus:ring-[#8B72F4]/40 focus:bg-white transition-all shadow-xs appearance-none cursor-pointer"
            >
              <option value="all">All District Schools ({schools.length})</option>
              {schools.map(sch => (
                <option key={sch.id} value={sch.id}>
                  {sch.name} ({getSchoolAbbreviation(sch.name)})
                </option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B72F4]">
              <ChevronDown size={14} />
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 p-1 bg-[#FAF5F0] rounded-full border border-white shadow-2xs shrink-0">
            <button
              onClick={() => setZoomLevel(z => Math.max(25, z - 10))}
              className="p-1.5 rounded-full bg-white text-[#7A7289] hover:text-[#2D2638] transition-all cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>

            <span className="text-[10px] font-extrabold text-[#2D2638] px-1.5 min-w-[34px] text-center">
              {zoomLevel}%
            </span>

            <button
              onClick={() => setZoomLevel(z => Math.min(160, z + 10))}
              className="p-1.5 rounded-full bg-white text-[#7A7289] hover:text-[#2D2638] transition-all cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>

            <button
              onClick={handleAutoFit}
              className="px-2 py-1 rounded-full bg-purple-100 text-[#8B72F4] hover:bg-purple-200 text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1"
              title="Auto Fit All Staff to Screen"
            >
              <Maximize2 size={11} />
              <span>Auto Fit</span>
            </button>

            <button
              onClick={() => {
                setZoomLevel(100)
                setPan({ x: 0, y: 0 })
              }}
              className="p-1.5 rounded-full bg-white text-[#7A7289] hover:text-[#8B72F4] transition-all cursor-pointer"
              title="Reset Zoom to 100%"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Print / PDF Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white text-xs font-black shadow-md hover:brightness-105 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Print or export PDF"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full px-4 sm:px-8 pt-6 sm:pt-8 space-y-6">

        {/* HIERARCHY LEGEND BAR */}
        <div className="no-print clay-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto border-2 border-purple-200/80 bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#E5E8FF]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#8B72F4] text-[#FAF5F0]">
              <Network size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#2D2638] uppercase tracking-wider font-display">
                Official Governance Hierarchy Levels
              </h3>
              <p className="text-[11px] text-[#7A7289] font-medium">Strict ranking order top-to-bottom</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs font-extrabold">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white shadow-2xs">
              1. PSDS (District Head)
            </span>
            <span className="text-[#8B72F4]">&rarr;</span>
            <span className="px-3 py-1 rounded-full bg-purple-600 text-white shadow-2xs">
              2. School Heads / Principals
            </span>
            <span className="text-[#8B72F4]">&rarr;</span>
            <span className="px-3 py-1 rounded-full bg-indigo-600 text-white shadow-2xs">
              3. AO IIs (Admin Officers)
            </span>
            <span className="text-[#8B72F4]">&rarr;</span>
            <span className="px-3 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
              4. Teaching Faculty
            </span>
          </div>
        </div>

        {/* CANVAS & INTERACTIVE DRAG/ZOOM VIEWPORT */}
        {loading ? (
          <div className="p-16">
            <DepEdSpinner size="lg" label="Rendering 4-Tier Organizational Hierarchy Tree..." subtitle="PSDS -> School Heads -> AO IIs -> Teachers" />
          </div>
        ) : (
          <div className="relative w-full max-w-7xl mx-auto">
            {/* Navigation Tip Pill */}
            <div className="no-print absolute top-3 left-4 z-20 pointer-events-none flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-xs border border-purple-100 text-[11px] font-bold text-[#7A7289] shadow-xs">
              <Hand size={13} className="text-[#8B72F4]" />
              <span>Click & drag canvas to move &bull; Zoom in/out to explore</span>
            </div>

            {/* DRAGGABLE & AUTO-FITTING VIEWPORT CONTAINER */}
            <div
              ref={canvasViewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              className={`w-full overflow-hidden min-h-[75vh] max-h-[82vh] border-2 border-dashed border-purple-200/80 rounded-3xl bg-slate-50/60 shadow-inner select-none p-6 sm:p-10 relative flex justify-center items-start transition-cursor ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                ref={treeContentRef}
                className="min-w-max mx-auto origin-top flex flex-col items-center transition-transform duration-75 ease-out"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel / 100})`
                }}
              >
                {/* LEVEL 1 (TOP ROOT): PUBLIC SCHOOLS DISTRICT SUPERVISOR (PSDS) */}
                <div className="flex flex-col items-center">
                  <TreeNodeCard
                    avatarUrl={districtSupervisor?.avatar_url}
                    name={districtSupervisor?.full_name || 'Public Schools District Supervisor'}
                    position="Public Schools District Supervisor (PSDS)"
                    subText="Concepcion District Governance Head"
                    levelTag="Level 1 • PSDS"
                    isTopRoot
                    colorTheme={rootTheme}
                  />

                  {/* Vertical Stem Connector Down from PSDS */}
                  <div className="w-0.5 h-10 bg-indigo-500" />

                  {/* LEVEL 2, 3, 4: SCHOOL BRANCHES */}
                  {schoolTree.length > 0 && (
                    <div className="flex flex-col items-center w-full">
                      {/* Horizontal Bar Connector spanning across schools */}
                      <div className="relative w-full flex justify-center">
                        <div className="h-0.5 bg-indigo-500 w-full max-w-[92%]" />
                      </div>

                      {/* SCHOOL BRANCHES CONTAINER */}
                      <div className="flex items-start justify-center gap-10 sm:gap-14 pt-0">
                        {schoolTree.map(({ school, schoolHeads, ao2s, teachers }, idx) => {
                          const theme = themeList[idx % themeList.length]
                          const schoolHead = schoolHeads[0]
                          const ao2 = ao2s[0]

                          return (
                            <div key={school.id} className="flex flex-col items-center shrink-0">
                              {/* Vertical Line Connector from PSDS Horizontal Bar */}
                              <div className="w-0.5 h-8 bg-indigo-500" />

                              {/* LEVEL 2 NODE: SCHOOL HEAD / PRINCIPAL */}
                              <TreeNodeCard
                                avatarUrl={schoolHead?.avatar_url}
                                name={schoolHead?.full_name || `School Head (${getSchoolAbbreviation(school.name)})`}
                                position="School Head / Principal"
                                subText={school.name}
                                badgeNumber={String(idx + 1).padStart(2, '0')}
                                levelTag="Level 2 • School Head"
                                colorTheme={theme}
                              />

                              {/* LEVEL 3 NODE: ADMINISTRATIVE OFFICER II (AO II) */}
                              <div className="flex flex-col items-center w-full">
                                {/* Connector from School Head to AO II */}
                                <div className={`w-0.5 h-8 ${theme.lineColor}`} />

                                <TreeNodeCard
                                  avatarUrl={ao2?.avatar_url}
                                  name={ao2?.full_name || `AO II (${getSchoolAbbreviation(school.name)})`}
                                  position="Administrative Officer II (AO II)"
                                  subText={school.name}
                                  levelTag="Level 3 • AO II"
                                  colorTheme={theme}
                                />

                                {/* LEVEL 4 BRANCH: TEACHERS & FACULTY */}
                                {teachers.length > 0 && (
                                  <div className="flex flex-col items-center w-full">
                                    {/* Connector from AO II down to Teachers */}
                                    <div className={`w-0.5 h-8 ${theme.lineColor}`} />

                                    {/* Horizontal Branch Bar for Teachers */}
                                    {teachers.length > 1 && (
                                      <div className="w-full flex justify-center">
                                        <div className={`h-0.5 ${theme.lineColor} w-full max-w-[85%]`} />
                                      </div>
                                    )}

                                    {/* Teachers Nodes Grid */}
                                    <div className="flex items-start justify-center gap-4 pt-0 flex-wrap max-w-sm sm:max-w-md">
                                      {teachers.map(t => (
                                        <div key={t.id} className="flex flex-col items-center">
                                          {teachers.length > 1 && <div className={`w-0.5 h-6 ${theme.lineColor}`} />}
                                          <TreeNodeCard
                                            avatarUrl={t.avatar_url}
                                            name={t.full_name}
                                            position={getStaffDesignation(t)}
                                            subText={formatTeacherGradeBadge(t)}
                                            levelTag="Level 4 • Teacher"
                                            colorTheme={theme}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="no-print mt-12 text-center text-xs font-medium text-[#7A7289] space-y-1">
        <p>&copy; {new Date().getFullYear()} School Connect &bull; 4-Tier Public Organizational Chart (PSDS &rarr; School Heads &rarr; AO IIs &rarr; Teachers)</p>
        <p className="text-[10px] text-[#A39BAF]">Department of Education &bull; Region IV-B MIMAROPA &bull; Division of Romblon</p>
      </footer>
    </div>
  )
}
