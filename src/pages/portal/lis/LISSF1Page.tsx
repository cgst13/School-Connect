import { useState, useEffect, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { lisNavGroups } from './lisNavConfig'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import {
  FileSpreadsheet,
  Printer,
  Download,
  CheckCircle2,
  Filter,
  School as SchoolIcon,
  Sparkles,
  Info,
  Search,
  Building2,
  Users
} from 'lucide-react'
import {
  fetchLearners,
  fetchGradeLevels,
  fetchSections,
  fetchSchools
} from '@/lib/supabase/queries'
import { exportOfficialSF1Excel, calculateAge } from '@/utils/sf1Parser'
import { isGradeMatch } from '@/utils/gradeUtils'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { useLISRealtimeSync } from '@/hooks/useLISRealtimeSync'
import type { Learner, GradeLevel, Section, School } from '@/types'

export function LISSF1Page() {
  const { admin, getPermittedSchools } = useAuth()
  const { toast } = useToast()

  const [learners, setLearners] = useState<Learner[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  // Permitted Schools for current user role scope
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('all')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2026 - 2027')
  const [searchTerm, setSearchTerm] = useState('')

  // Dynamic selected school object
  const selectedSchoolObj = useMemo(
    () => schools.find(s => s.id === selectedSchoolId),
    [schools, selectedSchoolId]
  )

  // Auto-select school if user only has 1 assigned school
  useEffect(() => {
    if (permittedSchools.length === 1 && selectedSchoolId === 'all') {
      const sch = permittedSchools[0]
      setSelectedSchoolId(sch.id)
      setSchoolMeta(prev => ({
        ...prev,
        name: sch.name,
        id: (sch as any).school_id || (sch as any).code || prev.id
      }))
    }
  }, [permittedSchools, selectedSchoolId])

  // Meta Info populated directly from selected school
  const [schoolMeta, setSchoolMeta] = useState({
    id: '',
    name: '',
    region: 'MIMAROPA',
    division: 'Romblon',
    district: 'Concepcion',
    schoolYear: '2026 - 2027',
    gradeLevel: '',
    section: '',
    preparedBy: '',
    certifiedCorrect: ''
  })

  // Sync schoolMeta with selected school filter
  useEffect(() => {
    if (selectedSchoolObj) {
      const schId = selectedSchoolObj.code || (selectedSchoolObj as any).code || (selectedSchoolObj as any).school_id || selectedSchoolObj.id
      setSchoolMeta(prev => ({
        ...prev,
        name: selectedSchoolObj.name,
        id: schId || prev.id,
        region: selectedSchoolObj.region || prev.region,
        division: selectedSchoolObj.division || prev.division,
        district: selectedSchoolObj.district || prev.district
      }))
    }
  }, [selectedSchoolObj])

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const [lList, gList, sList, schList] = await Promise.all([
        fetchLearners(),
        fetchGradeLevels(undefined, true),
        fetchSections(),
        fetchSchools(true, true)
      ])
      setLearners(lList)
      setGradeLevels(gList)
      setSections(sList)
      setSchools(schList)
    } catch (err) {
      console.error('Failed to fetch SF1 data:', err)
      if (showSpinner) toast('Failed to load SF1 records.', 'error')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  const { isLive } = useLISRealtimeSync({ onUpdate: () => loadData(false) })

  useEffect(() => {
    loadData()
  }, [])

  // Filtered Learners according to School, Grade Level & Section
  const filteredLearners = useMemo(() => {
    const activeGradeObj = gradeLevels.find(g => g.id === selectedGradeId)
    const activeSectionObj = sections.find(s => s.id === selectedSectionId)

    return learners.filter(l => {
      const matchesSearch =
        !searchTerm.trim() ||
        l.lrn.includes(searchTerm) ||
        l.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.last_name.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSchool = selectedSchoolId === 'all' || l.school_id === selectedSchoolId

      const matchesGrade = isGradeMatch(l, selectedGradeId, gradeLevels)

      const matchesSection =
        selectedSectionId === 'all' ||
        l.section_id === selectedSectionId ||
        (activeSectionObj && l.section_name === activeSectionObj.name)

      return matchesSearch && matchesSchool && matchesGrade && matchesSection
    })
  }, [learners, selectedSchoolId, selectedGradeId, selectedSectionId, gradeLevels, sections, searchTerm])

  // Dynamic School Meta for Header Display
  const currentSchoolId = useMemo(() => {
    const schId = selectedSchoolObj?.code || (selectedSchoolObj as any)?.code || (selectedSchoolObj as any)?.school_id
    if (schId) return schId
    const sample = filteredLearners[0]
    if (sample && sample.school_id && !sample.school_id.includes('-')) return sample.school_id
    return schoolMeta.id || ''
  }, [selectedSchoolObj, filteredLearners, schoolMeta])

  const currentSchoolName = useMemo(() => {
    if (selectedSchoolObj?.name) return selectedSchoolObj.name
    const sampleName = filteredLearners.find(l => l.school_name)?.school_name
    return sampleName || schoolMeta.name || ''
  }, [selectedSchoolObj, filteredLearners, schoolMeta])

  const currentSchoolYearLabel = useMemo(() => {
    const sampleSY = filteredLearners.find(l => l.school_year)?.school_year
    return sampleSY || selectedSchoolYear || schoolMeta.schoolYear || '2026 - 2027'
  }, [filteredLearners, selectedSchoolYear, schoolMeta])

  const currentGradeLabel = useMemo(() => {
    if (selectedGradeId !== 'all') {
      const found = gradeLevels.find(g => g.id === selectedGradeId)
      if (found) return found.name
    }
    const sampleGrade = filteredLearners.find(l => l.grade_level_name)?.grade_level_name
    return sampleGrade || schoolMeta.gradeLevel || ''
  }, [selectedGradeId, gradeLevels, filteredLearners, schoolMeta])

  const currentSectionLabel = useMemo(() => {
    if (selectedSectionId !== 'all') {
      const found = sections.find(s => s.id === selectedSectionId)
      if (found) return found.name
    }
    // If the selected grade level has no data or learners, section is strictly blank
    if (filteredLearners.length === 0) return ''
    const sampleSection = filteredLearners.find(l => l.section_name)?.section_name
    return sampleSection || ''
  }, [selectedSectionId, sections, filteredLearners])


  // Dynamic Filtered Learner Counts
  const filteredMaleCount = useMemo(() => filteredLearners.filter(l => l.sex === 'Male').length, [filteredLearners])
  const filteredFemaleCount = useMemo(() => filteredLearners.filter(l => l.sex === 'Female').length, [filteredLearners])
  const filteredTotalCount = useMemo(() => filteredLearners.length, [filteredLearners])

  // Helper to determine non-parent guardian info for display
  const getNonParentGInfo = (l: Learner) => {
    const fName = (l.father_name || '').trim().toUpperCase()
    const mName = (l.mother_maiden_name || '').trim().toUpperCase()
    const gName = (l.guardian_name || '').trim().toUpperCase()
    const gRel = (l.guardian_relationship || '').trim().toUpperCase()

    if (!gName || gName === fName || gName === mName || ['FATHER', 'MOTHER', 'PARENT'].includes(gRel)) {
      return { name: '', relationship: '' }
    }
    return { name: l.guardian_name || '', relationship: l.guardian_relationship || '' }
  }

  // Male & Female Filtered Lists
  const maleLearners = useMemo(() => filteredLearners.filter(l => l.sex === 'Male'), [filteredLearners])
  const femaleLearners = useMemo(() => filteredLearners.filter(l => l.sex === 'Female'), [filteredLearners])

  return (
    <SchoolConnectLayout
      activeAppId="lis"
      systemTitle="School Form 1 (SF1) Register"
      systemSubtitle="Official DepEd Form 1 Register Template, Filtering & Printing"
      navGroups={lisNavGroups}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <DepEdSpinner size="lg" label="Loading Official SF1 Register..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Filter & Toolbar Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4 no-print">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Official DepEd School Form 1 (SF1)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Filter by Grade Level and Section, print official register, or export Excel format
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">

                <button
                  onClick={() => {
                    if (selectedSchoolId === 'all') {
                      toast('Please select a specific school from the School Filter first.', 'warning')
                      return
                    }
                    if (selectedGradeId === 'all') {
                      toast('Please select a specific Grade Level from the Grade Level Filter first.', 'warning')
                      return
                    }
                    exportOfficialSF1Excel(filteredLearners, {
                      ...schoolMeta,
                      id: currentSchoolId,
                      name: currentSchoolName,
                      grade: currentGradeLabel,
                      section: currentSectionLabel,
                      year: currentSchoolYearLabel
                    })
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#FAF5F0] hover:bg-[#F6EFFF] text-[#8B72F4] text-xs font-black border border-[#8B72F4]/30 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download size={16} />
                  Export SF1 (.xlsx)
                </button>

                <button
                  onClick={() => {
                    if (selectedSchoolId === 'all') {
                      toast('Please select a specific school from the School Filter first.', 'warning')
                      return
                    }
                    if (selectedGradeId === 'all') {
                      toast('Please select a specific Grade Level from the Grade Level Filter first.', 'warning')
                      return
                    }
                    window.print()
                  }}
                  className="px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={16} />
                  Print Official SF1
                </button>
              </div>
            </div>

            {/* Filter Controls Row: School, Grade Level & Section Filters */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${permittedSchools.length > 1 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200`}>
              {/* School Filter Select for District & Multi-School Users */}
              {permittedSchools.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    School Filter <span className="text-red-500 font-black">*</span>
                  </label>
                  <select
                    value={selectedSchoolId}
                    onChange={e => {
                      const schId = e.target.value
                      setSelectedSchoolId(schId)
                      if (schId !== 'all') {
                        const targetSch = schools.find(s => s.id === schId)
                        if (targetSch) {
                          setSchoolMeta(prev => ({
                            ...prev,
                            name: targetSch.name,
                            id: (targetSch as any).school_id || (targetSch as any).code || prev.id
                          }))
                        }
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-white border ${selectedSchoolId === 'all' ? 'border-amber-400 ring-2 ring-amber-400/20 text-slate-700' : 'border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`}
                  >
                    <option value="all">-- Select School (Required) --</option>
                    {permittedSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Grade Level Filter Select */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Grade Level Filter <span className="text-red-500 font-black">*</span>
                </label>
                <select
                  value={selectedGradeId}
                  onChange={e => {
                    setSelectedGradeId(e.target.value)
                    setSelectedSectionId('all')
                  }}
                  className={`w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-white border ${selectedGradeId === 'all' ? 'border-amber-400 ring-2 ring-amber-400/20 text-slate-700' : 'border-slate-200 text-slate-900'} focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500`}
                >
                  <option value="all">-- Select Grade Level (Required) --</option>
                  {gradeLevels.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Section Filter (Optional)
                </label>
                <select
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Sections</option>
                  {sections
                    .filter(s => selectedGradeId === 'all' || !s.grade_level_id || s.grade_level_id === selectedGradeId)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>

              {/* School Year Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  School Year
                </label>
                <select
                  value={selectedSchoolYear}
                  onChange={e => setSelectedSchoolYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="2026 - 2027">SY 2026 - 2027</option>
                  <option value="2025 - 2026">SY 2025 - 2026</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Search Learner
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search LRN, Name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Learner Counter & Filter Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-[#F6EFFF] via-[#EEF0FF] to-[#FAF5F0] rounded-[24px] border border-purple-100 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#8B72F4] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  <Users size={16} />
                </div>
                <div>
                  <span className="text-[11px] font-black text-[#2D2638] uppercase tracking-wider font-display block">
                    Filtered Learner Register Count
                  </span>
                  <span className="text-[11px] font-semibold text-[#7A7289]">
                    {selectedSchoolId === 'all' && selectedGradeId === 'all'
                      ? 'Select both School and Grade Level from the filters above to generate SF1'
                      : selectedSchoolId === 'all'
                      ? 'Select a School from the filter above to generate SF1'
                      : selectedGradeId === 'all'
                      ? `Selected school: ${schoolMeta.name} — Please select a Grade Level to generate SF1`
                      : `Showing records for ${schoolMeta.name} — ${currentGradeLabel} ${selectedSectionId !== 'all' ? `(${currentSectionLabel})` : ''}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <div className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold flex items-center gap-1.5">
                  <span>👦 Male:</span>
                  <span className="font-mono font-black text-blue-900">{filteredMaleCount}</span>
                </div>

                <div className="px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-pink-800 font-bold flex items-center gap-1.5">
                  <span>👧 Female:</span>
                  <span className="font-mono font-black text-pink-900">{filteredFemaleCount}</span>
                </div>

                <div className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black flex items-center gap-1.5 shadow-xs">
                  <span>📊 Total Filtered:</span>
                  <span className="font-mono font-black">{filteredTotalCount} Learners</span>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional View: Display SF1 Paper Container ONLY IF BOTH School and Grade Level are selected */}
          {selectedSchoolId === 'all' || selectedGradeId === 'all' ? (
            <div className="bg-white rounded-[32px] border-2 border-white shadow-[0_16px_36px_rgba(139,114,244,0.08)] p-12 text-center flex flex-col items-center justify-center space-y-4 font-sans">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#A88BEB] to-[#8B72F4] text-white flex items-center justify-center shadow-lg">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-lg font-black text-[#2D2638] font-display tracking-tight">
                  {selectedSchoolId === 'all' && selectedGradeId === 'all'
                    ? 'Select School and Grade Level to Generate SF1'
                    : selectedSchoolId === 'all'
                    ? 'Select a School to Generate SF1'
                    : 'Select a Grade Level to Generate SF1'}
                </h3>
                <p className="text-xs text-[#7A7289] font-medium leading-relaxed">
                  {selectedSchoolId === 'all' && selectedGradeId === 'all'
                    ? 'Please select both a School and a Grade Level from the required filters above to generate, view, export, or print the official DepEd School Form 1 (SF1) School Register.'
                    : selectedSchoolId === 'all'
                    ? 'Please select a specific School from the School Filter dropdown above to generate the SF1 register.'
                    : `School selected: "${schoolMeta.name}". Please select a specific Grade Level from the Grade Level Filter dropdown above to generate its official SF1 register.`}
                </p>
              </div>
            </div>
          ) : (
            /* Official DepEd SF1 Document Paper Container */
            <div className="bg-white rounded-[16px] border-2 border-slate-900 shadow-2xl p-6 text-slate-900 overflow-x-auto print:shadow-none print:border-none print:p-0 font-sans printable-area official-sf1-print-area" id="sf1-official-template">
              {/* Main Header Title */}
              <div className="text-center pb-2">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 font-display">
                  School Form 1 (SF 1) School Register
                </h1>
                <p className="text-xs italic font-semibold text-slate-700">
                  (This replaces Form 1, Master List & STS Form 2-Family Background and Profile)
                </p>
              </div>

            {/* Official Metadata Box Grid (Matching DepEd Header Layout) */}
            <div className="my-3 text-xs font-bold text-slate-900 overflow-x-auto">
              <table className="w-full border-collapse border border-slate-900 text-center">
                <tbody>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right w-24">School ID</td>
                    <td className="border border-slate-900 px-3 py-1 font-mono font-bold w-28 text-slate-900">{currentSchoolId}</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold w-36 text-slate-900">{schoolMeta.region}</td>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right w-24">Division</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold w-36 text-slate-900">{schoolMeta.division}</td>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right w-24">District</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold text-slate-900">{schoolMeta.district}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right">School Name</td>
                    <td colSpan={2} className="border border-slate-900 px-3 py-1 font-bold text-slate-900 text-left">{currentSchoolName}</td>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right">School Year</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold text-slate-900">{currentSchoolYearLabel}</td>
                    <td className="border border-slate-900 bg-slate-50 px-2 py-1 font-semibold text-slate-600 text-right">Grade Level</td>
                    <td className="border border-slate-900 px-3 py-1 font-bold text-slate-900 text-left">
                      <span className="mr-6">{currentGradeLabel}</span>
                      <span className="font-semibold text-slate-600">Section: </span>
                      <span className="uppercase">{currentSectionLabel}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official SF1 Data Table (2 Header Rows + Strict Column Structure) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse border-2 border-slate-900">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-900 font-bold text-center align-middle text-slate-900">
                    <th rowSpan={2} className="border border-slate-900 p-1 w-24">LRN</th>
                    <th rowSpan={2} className="border border-slate-900 p-1.5 min-w-[180px]">
                      NAME<br/>
                      <span className="font-normal text-[8.5px] text-slate-600">(Last Name, First Name, Middle Name)</span>
                    </th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-8">Sex<br/><span className="font-normal text-[8.5px]">(M/F)</span></th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-20">BIRTH DATE<br/><span className="font-normal text-[8px]">(mm/dd/yyyy)</span></th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-12">
                      AGE<br/><span className="font-normal text-[7.5px] text-slate-600">as of 1st Friday June</span>
                    </th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-16">
                      MOTHER TONGUE<br/><span className="font-normal text-[7.5px] text-slate-600">(Grade 1 to 3 Only)</span>
                    </th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-14">IP<br/><span className="font-normal text-[7.5px] text-slate-600">(Ethnic Group)</span></th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-16">RELIGION</th>
                    <th colSpan={4} className="border border-slate-900 p-1">ADDRESS</th>
                    <th colSpan={2} className="border border-slate-900 p-1">PARENTS</th>
                    <th colSpan={2} className="border border-slate-900 p-1">GUARDIAN<br/><span className="font-normal text-[7.5px]">(if Not Parent)</span></th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-20">
                      Contact Number of Parent or Guardian
                    </th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-16">Learning Modality</th>
                    <th rowSpan={2} className="border border-slate-900 p-1 w-28">
                      REMARKS<br/>
                      <span className="font-normal text-[7.5px] text-slate-600">[Please refer to legend below]</span>
                    </th>
                  </tr>

                  <tr className="bg-slate-50 border-b-2 border-slate-900 font-bold text-center align-middle text-[8.5px] text-slate-900">
                    <th className="border border-slate-900 p-1">House #/ Street/ Sitio/ Purok</th>
                    <th className="border border-slate-900 p-1">Barangay</th>
                    <th className="border border-slate-900 p-1">Municipality/ City</th>
                    <th className="border border-slate-900 p-1">Province</th>
                    <th className="border border-slate-900 p-1">Father's Name<br/><span className="font-normal text-[7.5px]">(Last Name, First Name, Middle Name)</span></th>
                    <th className="border border-slate-900 p-1">Mother's Maiden Name<br/><span className="font-normal text-[7.5px]">(Last Name, First Name, Middle Name)</span></th>
                    <th className="border border-slate-900 p-1">Name</th>
                    <th className="border border-slate-900 p-1">Relationship</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-400 font-medium">
                  {/* Male Learners Rows */}
                  {maleLearners.map((l) => {
                    const gInfo = getNonParentGInfo(l)
                    return (
                      <tr key={l.id} className="hover:bg-slate-50 border-b border-slate-900 text-slate-900">
                        <td className="border border-slate-900 p-1 text-center font-mono font-bold">{l.lrn}</td>
                        <td className="border border-slate-900 p-1 font-black uppercase">
                          {l.last_name}, {l.first_name}, {l.middle_name || ''} {l.extension_name || ''}
                        </td>
                        <td className="border border-slate-900 p-1 text-center font-bold">M</td>
                        <td className="border border-slate-900 p-1 text-center font-mono">{l.birthdate}</td>
                        <td className="border border-slate-900 p-1 text-center font-bold">{calculateAge(l.birthdate) || l.age || 0}</td>
                        <td className="border border-slate-900 p-1">{l.mother_tongue || 'Tagalog'}</td>
                        <td className="border border-slate-900 p-1">{l.ip_group || 'N/A'}</td>
                        <td className="border border-slate-900 p-1">{l.religion || 'Roman Catholic'}</td>
                        <td className="border border-slate-900 p-1">{l.address_house_no || l.address_street || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_barangay || 'SAN VICENTE'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_city_municipality || 'CONCEPCION'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_province || 'ROMBLON'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.father_name || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.mother_maiden_name || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{gInfo.name}</td>
                        <td className="border border-slate-900 p-1">{gInfo.relationship}</td>
                        <td className="border border-slate-900 p-1 text-center font-mono">{l.guardian_contact_no || ''}</td>
                        <td className="border border-slate-900 p-1 text-center font-semibold">Face to Face</td>
                        <td className="border border-slate-900 p-1 font-bold text-amber-900">
                          {l.is_4ps_cct ? 'CCT' : l.remarks || ''}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total Male Summary Row */}
                  <tr className="bg-slate-50 font-black border-b-2 border-slate-900 text-slate-900">
                    <td className="border border-slate-900 p-1 text-center font-mono">{maleLearners.length}</td>
                    <td colSpan={18} className="border border-slate-900 p-1.5 text-left">&lt;=== TOTAL MALE</td>
                  </tr>

                  {/* Female Learners Rows */}
                  {femaleLearners.map((l) => {
                    const gInfo = getNonParentGInfo(l)
                    return (
                      <tr key={l.id} className="hover:bg-slate-50 border-b border-slate-900 text-slate-900">
                        <td className="border border-slate-900 p-1 text-center font-mono font-bold">{l.lrn}</td>
                        <td className="border border-slate-900 p-1 font-black uppercase">
                          {l.last_name}, {l.first_name}, {l.middle_name || ''} {l.extension_name || ''}
                        </td>
                        <td className="border border-slate-900 p-1 text-center font-bold">F</td>
                        <td className="border border-slate-900 p-1 text-center font-mono">{l.birthdate}</td>
                        <td className="border border-slate-900 p-1 text-center font-bold">{calculateAge(l.birthdate) || l.age || 0}</td>
                        <td className="border border-slate-900 p-1">{l.mother_tongue || 'Tagalog'}</td>
                        <td className="border border-slate-900 p-1">{l.ip_group || 'N/A'}</td>
                        <td className="border border-slate-900 p-1">{l.religion || 'Roman Catholic'}</td>
                        <td className="border border-slate-900 p-1">{l.address_house_no || l.address_street || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_barangay || 'SAN VICENTE'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_city_municipality || 'CONCEPCION'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.address_province || 'ROMBLON'}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.father_name || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{l.mother_maiden_name || ''}</td>
                        <td className="border border-slate-900 p-1 uppercase">{gInfo.name}</td>
                        <td className="border border-slate-900 p-1">{gInfo.relationship}</td>
                        <td className="border border-slate-900 p-1 text-center font-mono">{l.guardian_contact_no || ''}</td>
                        <td className="border border-slate-900 p-1 text-center font-semibold">Face to Face</td>
                        <td className="border border-slate-900 p-1 font-bold text-amber-900">
                          {l.is_4ps_cct ? 'CCT' : l.remarks || ''}
                        </td>
                      </tr>
                    )
                  })}
                  {/* Total Female & Combined Summary Rows */}
                  <tr className="bg-slate-50 font-black border-b-2 border-slate-900 text-slate-900">
                    <td className="border border-slate-900 p-1 text-center font-mono">{femaleLearners.length}</td>
                    <td colSpan={18} className="border border-slate-900 p-1.5 text-left">&lt;=== TOTAL FEMALE</td>
                  </tr>
                  <tr className="bg-slate-100 font-black border-b-2 border-slate-900 text-slate-900">
                    <td className="border border-slate-900 p-1 text-center font-mono">{filteredLearners.length}</td>
                    <td colSpan={18} className="border border-slate-900 p-1.5 text-left">&lt;=== COMBINED</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Section: Indicators Legend, Registered Table & Signature Blocks */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3 text-[9px] font-sans border-t-2 border-slate-900 pt-3">
              {/* Left Column: List and Code of Indicators */}
              <div className="lg:col-span-6 border border-slate-900 p-2 rounded-sm space-y-1">
                <div className="font-bold text-center border-b border-slate-900 pb-1 text-[10px] uppercase tracking-tight">
                  List and Code of Indicators under REMARKS column
                </div>
                <div className="grid grid-cols-2 gap-2 text-[8px] pt-1">
                  {/* Indicators Left Side */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="font-bold border-b border-slate-900 text-left">
                        <th className="p-0.5">Indicator</th>
                        <th className="p-0.5">Code</th>
                        <th className="p-0.5">Required Information</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      <tr>
                        <td className="p-0.5 font-bold">Transferred Out</td>
                        <td className="p-0.5 font-bold">T/O</td>
                        <td className="p-0.5">Name of Public (P) Private (PR) School & Effectivity Date</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Transferred In</td>
                        <td className="p-0.5 font-bold">T/I</td>
                        <td className="p-0.5">Name of Public (P) Private (PR) School & Effectivity Date</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Dropped</td>
                        <td className="p-0.5 font-bold">DRP</td>
                        <td className="p-0.5">Reason and Effectivity Date</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Late Enrollment</td>
                        <td className="p-0.5 font-bold">LE</td>
                        <td className="p-0.5">Reason (Enrollment beyond 1st Friday of June)</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Indicators Right Side */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="font-bold border-b border-slate-900 text-left">
                        <th className="p-0.5">Indicator</th>
                        <th className="p-0.5">Code</th>
                        <th className="p-0.5">Required Information</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      <tr>
                        <td className="p-0.5 font-bold">CCT Recipient</td>
                        <td className="p-0.5 font-bold">CCT</td>
                        <td className="p-0.5">CCT Control/Reference number & Effectivity Date</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Balik Aral</td>
                        <td className="p-0.5 font-bold">B/A</td>
                        <td className="p-0.5">Name of school last attended & Year</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Special Needs Education</td>
                        <td className="p-0.5 font-bold">SNED</td>
                        <td className="p-0.5">Specify</td>
                      </tr>
                      <tr>
                        <td className="p-0.5 font-bold">Accelerated</td>
                        <td className="p-0.5 font-bold">ACL</td>
                        <td className="p-0.5">Specify Level & Effectivity Data</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Middle Column: REGISTERED Summary Table */}
              <div className="lg:col-span-2">
                <table className="w-full text-[9px] border-collapse border border-slate-900 text-center font-sans">
                  <thead>
                    <tr className="font-bold bg-slate-50 border-b border-slate-900">
                      <th className="border border-slate-900 p-1">REGISTERED</th>
                      <th className="border border-slate-900 p-1">BoSY</th>
                      <th className="border border-slate-900 p-1">EoSY</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-900 p-1 font-bold">MALE</td>
                      <td className="border border-slate-900 p-1 font-mono font-bold">{maleLearners.length}</td>
                      <td className="border border-slate-900 p-1 font-mono"></td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 p-1 font-bold">FEMALE</td>
                      <td className="border border-slate-900 p-1 font-mono font-bold">{femaleLearners.length}</td>
                      <td className="border border-slate-900 p-1 font-mono"></td>
                    </tr>
                    <tr className="font-black bg-slate-100">
                      <td className="border border-slate-900 p-1">TOTAL</td>
                      <td className="border border-slate-900 p-1 font-mono font-black">{filteredLearners.length}</td>
                      <td className="border border-slate-900 p-1 font-mono"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Right Column: Signature Blocks */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-3 text-slate-900">
                {/* Prepared by Signature */}
                <div className="text-center space-y-4">
                  <div className="text-left font-bold text-[8.5px]">Prepared by:</div>
                  <div className="border-b-2 border-slate-900 font-black uppercase text-[9px] pt-4 px-1 min-h-[32px] flex items-end justify-center">
                    {schoolMeta.preparedBy || admin?.full_name || 'CLASS ADVISER'}
                  </div>
                  <div className="text-[7.5px] text-slate-700 italic font-semibold">
                    (Signature of Adviser over Printed Name)
                  </div>
                  <div className="flex justify-between text-[7.5px] font-semibold pt-1">
                    <span>BoSY Date: ________</span>
                    <span>EoSY Date: ________</span>
                  </div>
                </div>

                {/* Certified Correct Signature */}
                <div className="text-center space-y-4">
                  <div className="text-left font-bold text-[8.5px]">Certified Correct:</div>
                  <div className="border-b-2 border-slate-900 font-black uppercase text-[9px] pt-4 px-1 min-h-[32px] flex items-end justify-center">
                    {schoolMeta.certifiedCorrect || 'SCHOOL HEAD'}
                  </div>
                  <div className="text-[7.5px] text-slate-700 italic font-semibold">
                    (Signature of School Head over Printed Name)
                  </div>
                  <div className="flex justify-between text-[7.5px] font-semibold pt-1">
                    <span>BoSY Date: ________</span>
                    <span>EoSY Date: ________</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Footer Info Bar */}
            <div className="mt-3 flex items-center justify-between text-[8px] font-mono text-slate-600 border-t border-slate-300 pt-1">
              <div>
                Generated on: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="font-bold uppercase tracking-wider text-slate-900">
                Generated thru LIS
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </SchoolConnectLayout>
  )
}
