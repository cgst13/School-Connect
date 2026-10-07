import { useState, useEffect, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { gradingNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import {
  fetchSchools,
  fetchGradeLevels,
  fetchSections,
  fetchLearningAreas,
  fetchLearners,
  fetchLearnerGradesByFilters
} from '@/lib/supabase/queries'
import { getDepEdProficiencyLevel } from '@/utils/gradingCalculator'
import type { School, GradeLevel, Section, LearningArea, Learner, LearnerGrade } from '@/types'
import {
  Printer,
  FileCheck,
  Award,
  Users,
  Building2,
  CheckCircle2
} from 'lucide-react'

export function GradingSF5Page() {
  const { admin, getPermittedSchools, getPermittedGradeLevels } = useAuth()
  const { toast } = useToast()

  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [dbGrades, setDbGrades] = useState<LearnerGrade[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026')

  // Scoped / Permitted Options based on logged-in user assignments
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])
  const permittedGradeLevels = useMemo(() => getPermittedGradeLevels(gradeLevels), [gradeLevels, getPermittedGradeLevels])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const [sch, gr, sec, la, ln] = await Promise.all([
          fetchSchools(true, true),
          fetchGradeLevels(undefined, true),
          fetchSections(),
          fetchLearningAreas(),
          fetchLearners()
        ])
        setSchools(sch)
        setGradeLevels(gr)
        setSections(sec)
        setLearningAreas(la)
        setLearners(ln)

        const pSch = getPermittedSchools(sch)
        const pGr = getPermittedGradeLevels(gr)
        if (pSch.length > 0) setSelectedSchoolId(pSch[0].id)
        if (pGr.length > 0) setSelectedGradeId(pGr[0].id)
      } catch (err) {
        console.error('Failed to load SF5 data:', err)
        toast('Failed to load SF5 reference data.', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Auto-sync selected school if current selection is invalid
  useEffect(() => {
    if (permittedSchools.length > 0 && (!selectedSchoolId || !permittedSchools.some(s => s.id === selectedSchoolId))) {
      setSelectedSchoolId(permittedSchools[0].id)
    }
  }, [permittedSchools, selectedSchoolId])

  // Auto-sync selected grade level if current selection is invalid
  useEffect(() => {
    if (permittedGradeLevels.length > 0 && (!selectedGradeId || !permittedGradeLevels.some(g => g.id === selectedGradeId))) {
      setSelectedGradeId(permittedGradeLevels[0].id)
    }
  }, [permittedGradeLevels, selectedGradeId])

  // Load section grades from Supabase
  useEffect(() => {
    if (!selectedSchoolId || !selectedGradeId || !selectedSectionId) return
    async function loadSectionGrades() {
      try {
        const grades = await fetchLearnerGradesByFilters(selectedSchoolId, selectedGradeId, selectedSectionId, undefined, undefined, selectedSchoolYear)
        setDbGrades(grades)
      } catch (err) {
        console.warn('Failed to load section grades from Supabase:', err)
      }
    }
    loadSectionGrades()
  }, [selectedSchoolId, selectedGradeId, selectedSectionId, selectedSchoolYear])

  const filteredSections = useMemo(() => {
    const permittedGradeIds = permittedGradeLevels.map(g => g.id)
    return sections.filter(s => {
      const matchSchool = !selectedSchoolId || s.school_id === selectedSchoolId
      const matchGrade = !selectedGradeId ? permittedGradeIds.includes(s.grade_level_id) : s.grade_level_id === selectedGradeId
      return matchSchool && matchGrade
    })
  }, [sections, selectedSchoolId, selectedGradeId, permittedGradeLevels])

  useEffect(() => {
    if (filteredSections.length > 0 && (!selectedSectionId || !filteredSections.some(s => s.id === selectedSectionId))) {
      setSelectedSectionId(filteredSections[0].id)
    }
  }, [filteredSections, selectedSectionId])

  const sectionLearners = useMemo(() => {
    return learners.filter(l => {
      const matchSchool = !selectedSchoolId || l.school_id === selectedSchoolId
      const matchGrade = !selectedGradeId || l.grade_level_id === selectedGradeId
      const matchSec = !selectedSectionId || l.section_id === selectedSectionId
      return matchSchool && matchGrade && matchSec
    }).sort((a, b) => {
      if (a.sex !== b.sex) return a.sex === 'Male' ? -1 : 1
      return (a.last_name || '').localeCompare(b.last_name || '')
    })
  }, [learners, selectedSchoolId, selectedGradeId, selectedSectionId])

  const selectedSchoolObj = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId) || schools[0]
  }, [schools, selectedSchoolId])

  const selectedGradeObj = useMemo(() => {
    return gradeLevels.find(g => g.id === selectedGradeId) || gradeLevels[0]
  }, [gradeLevels, selectedGradeId])

  const selectedSectionObj = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || sections[0]
  }, [sections, selectedSectionId])

  // Process Promotion & Level of Proficiency Data from real Supabase / local grades
  const processedPromotionList = useMemo(() => {
    return sectionLearners.map((learner) => {
      const storageKey = `sc_learner_grades_${learner.id}`
      const saved = localStorage.getItem(storageKey)
      let subjectGrades: any[] = []
      if (saved) {
        try {
          subjectGrades = JSON.parse(saved)
        } catch {}
      }

      let sum = 0
      let count = 0
      learningAreas.forEach((la) => {
        const matchedDB = dbGrades.filter(g => g.learner_id === learner.id && g.learning_area_id === la.id && g.quarterly_grade !== null && g.quarterly_grade !== undefined)
        let rating: number | null = null

        if (matchedDB.length > 0) {
          const quarters = matchedDB.map(m => m.quarterly_grade as number)
          rating = Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length)
        } else {
          const found = subjectGrades.find(g => g.subjectName?.toLowerCase() === la.name.toLowerCase() || g.learning_area_id === la.id)
          if (found && found.finalRating !== null && found.finalRating !== undefined) {
            rating = found.finalRating
          } else if (found && found.q1 !== null && found.q1 !== undefined) {
            rating = found.q1
          }
        }

        if (rating !== null) {
          sum += rating
          count++
        }
      })

      const genAvg = count > 0 ? Math.round((sum / count) * 100) / 100 : null
      const { descriptor } = genAvg !== null ? getDepEdProficiencyLevel(genAvg) : { descriptor: 'Pending Evaluation' }
      const actionTaken = genAvg !== null ? (genAvg >= 75 ? 'PROMOTED' : 'RETAINED') : 'PENDING'

      return {
        learner,
        generalAverage: genAvg,
        actionTaken,
        descriptor
      }
    })
  }, [sectionLearners, learningAreas, dbGrades])

  // Split Male & Female
  const maleList = processedPromotionList.filter(p => p.learner.sex === 'Male')
  const femaleList = processedPromotionList.filter(p => p.learner.sex === 'Female')

  // Proficiency Summary Counts
  const proficiencySummary = useMemo(() => {
    const summary = {
      outstanding: { male: 0, female: 0, total: 0 },
      verySatisfactory: { male: 0, female: 0, total: 0 },
      satisfactory: { male: 0, female: 0, total: 0 },
      fairlySatisfactory: { male: 0, female: 0, total: 0 },
      didNotMeet: { male: 0, female: 0, total: 0 },
      promoted: { male: 0, female: 0, total: 0 },
      retained: { male: 0, female: 0, total: 0 },
    }

    processedPromotionList.forEach(item => {
      const isMale = item.learner.sex === 'Male'
      const genderKey = isMale ? 'male' : 'female'

      if (item.actionTaken === 'PROMOTED') {
        summary.promoted[genderKey]++
        summary.promoted.total++
      } else if (item.actionTaken === 'RETAINED') {
        summary.retained[genderKey]++
        summary.retained.total++
      }

      if (item.generalAverage !== null && item.generalAverage !== undefined) {
        if (item.generalAverage >= 90) {
          summary.outstanding[genderKey]++
          summary.outstanding.total++
        } else if (item.generalAverage >= 85) {
          summary.verySatisfactory[genderKey]++
          summary.verySatisfactory.total++
        } else if (item.generalAverage >= 80) {
          summary.satisfactory[genderKey]++
          summary.satisfactory.total++
        } else if (item.generalAverage >= 75) {
          summary.fairlySatisfactory[genderKey]++
          summary.fairlySatisfactory.total++
        } else {
          summary.didNotMeet[genderKey]++
          summary.didNotMeet.total++
        }
      }
    })

    return summary
  }, [processedPromotionList])

  return (
    <SchoolConnectLayout systemTitle="e-Class Record & Grading Portal" navGroups={gradingNavGroups}>
      <div className="space-y-6 max-w-[1500px] mx-auto pb-16">
        
        {/* Page Header */}
        <PageHeader
          title="DepEd School Form 5 (SF5 - Report on Promotion & Level of Proficiency)"
          description="Official DepEd Form 5 end-of-year promotion status, general average, and proficiency distribution"
          badge="Official DepEd Form 5"
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              Print Official SF5
            </button>
          }
        />

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select School
            </label>
            <select
              value={selectedSchoolId}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {permittedSchools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Grade Level
            </label>
            <select
              value={selectedGradeId}
              onChange={e => setSelectedGradeId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {permittedGradeLevels.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Section
            </label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              {filteredSections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              School Year
            </label>
            <select
              value={selectedSchoolYear}
              onChange={e => setSelectedSchoolYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="2025-2026">2025 - 2026</option>
              <option value="2026-2027">2026 - 2027</option>
            </select>
          </div>
        </div>

        {/* PRINTABLE SF5 CANVAS */}
        <div className="bg-white rounded-3xl border-2 border-slate-800 p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:p-0 mx-auto text-slate-900 select-none">
          
          {/* Form Header */}
          <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
            <p className="text-xs font-serif italic text-slate-600">Republic of the Philippines</p>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-serif">
              Department of Education
            </h2>
            <h1 className="text-base font-black uppercase tracking-wide text-blue-950 pt-1">
              SCHOOL FORM 5 (SF5) REPORT ON PROMOTION & LEVEL OF PROFICIENCY
            </h1>
            <p className="text-xs font-medium text-slate-700">
              School Name: <strong className="text-slate-900">{selectedSchoolObj?.name}</strong> • Grade & Section: <strong className="text-slate-900">{selectedGradeObj?.name} — {selectedSectionObj?.name}</strong> • SY: <strong className="text-slate-900">{selectedSchoolYear}</strong>
            </p>
          </div>

          {/* Grid of Tables: Main List + Summary Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-6">
            
            {/* Left 3 cols: Learner Promotion Table */}
            <div className="lg:col-span-3">
              <table className="w-full text-xs text-left border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold border-b border-slate-800">
                    <th className="py-2 px-2 w-10 border-r border-slate-800">#</th>
                    <th className="py-2 px-3 text-left w-28 border-r border-slate-800">LRN</th>
                    <th className="py-2 px-3 text-left min-w-[220px] border-r border-slate-800">Learner Name (Last Name, First Name)</th>
                    <th className="py-2 px-2 w-24 text-center border-r border-slate-800">General Average</th>
                    <th className="py-2 px-2 w-28 text-center border-r border-slate-800">Action Taken</th>
                    <th className="py-2 px-3 text-left">Level of Proficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Male Section */}
                  <tr className="bg-blue-900/10 font-bold text-blue-950 text-xs border-y border-blue-200">
                    <td colSpan={6} className="py-1 px-3 uppercase tracking-wider">
                      MALE LEARNERS ({maleList.length})
                    </td>
                  </tr>
                  {maleList.map((item, idx) => (
                    <tr key={item.learner.id} className="border-b border-slate-300">
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500 border-r border-slate-300">{idx + 1}</td>
                      <td className="py-1.5 px-3 font-mono font-bold border-r border-slate-300">{item.learner.lrn}</td>
                      <td className="py-1.5 px-3 font-bold border-r border-slate-300">
                        {item.learner.last_name?.toUpperCase()}, {item.learner.first_name}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold border-r border-slate-300">
                        {item.generalAverage !== null ? item.generalAverage.toFixed(2) : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-black border-r border-slate-300 ${item.actionTaken === 'PROMOTED' ? 'text-emerald-800' : item.actionTaken === 'RETAINED' ? 'text-rose-800' : 'text-slate-500'}`}>
                        {item.actionTaken}
                      </td>
                      <td className="py-1.5 px-3 text-slate-700">{item.descriptor}</td>
                    </tr>
                  ))}

                  {/* Female Section */}
                  <tr className="bg-rose-900/10 font-bold text-rose-950 text-xs border-y border-rose-200">
                    <td colSpan={6} className="py-1 px-3 uppercase tracking-wider">
                      FEMALE LEARNERS ({femaleList.length})
                    </td>
                  </tr>
                  {femaleList.map((item, idx) => (
                    <tr key={item.learner.id} className="border-b border-slate-300">
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500 border-r border-slate-300">{idx + 1}</td>
                      <td className="py-1.5 px-3 font-mono font-bold border-r border-slate-300">{item.learner.lrn}</td>
                      <td className="py-1.5 px-3 font-bold border-r border-slate-300">
                        {item.learner.last_name?.toUpperCase()}, {item.learner.first_name}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold border-r border-slate-300">
                        {item.generalAverage !== null ? item.generalAverage.toFixed(2) : '—'}
                      </td>
                      <td className={`py-1.5 px-2 text-center font-black border-r border-slate-300 ${item.actionTaken === 'PROMOTED' ? 'text-emerald-800' : item.actionTaken === 'RETAINED' ? 'text-rose-800' : 'text-slate-500'}`}>
                        {item.actionTaken}
                      </td>
                      <td className="py-1.5 px-3 text-slate-700">{item.descriptor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right 1 col: Official DepEd SF5 Summary Tables */}
            <div className="space-y-4">
              {/* Summary Table 1: Promotion Status */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  SUMMARY TABLE A (PROMOTION)
                </h4>
                <table className="w-full text-xs text-left border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 text-center font-bold border-b border-slate-800 text-[11px]">
                      <th className="py-1.5 px-2 text-left border-r border-slate-800">STATUS</th>
                      <th className="py-1.5 px-1.5 w-10 border-r border-slate-800">M</th>
                      <th className="py-1.5 px-1.5 w-10 border-r border-slate-800">F</th>
                      <th className="py-1.5 px-1.5 w-12 bg-slate-200">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold border-r border-slate-300">PROMOTED</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.promoted.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.promoted.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.promoted.total}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-semibold border-r border-slate-300">RETAINED</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.retained.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.retained.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.retained.total}</td>
                    </tr>
                    <tr className="bg-slate-100 font-bold">
                      <td className="py-1.5 px-2 border-r border-slate-800">TOTAL</td>
                      <td className="py-1.5 px-1.5 text-center font-mono border-r border-slate-800">{maleList.length}</td>
                      <td className="py-1.5 px-1.5 text-center font-mono border-r border-slate-800">{femaleList.length}</td>
                      <td className="py-1.5 px-1.5 text-center font-mono font-black">{sectionLearners.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Table 2: Level of Proficiency */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1.5">
                  SUMMARY TABLE B (PROFICIENCY)
                </h4>
                <table className="w-full text-xs text-left border-collapse border border-slate-800">
                  <thead>
                    <tr className="bg-slate-100 text-center font-bold border-b border-slate-800 text-[11px]">
                      <th className="py-1.5 px-2 text-left border-r border-slate-800">LEVEL</th>
                      <th className="py-1.5 px-1.5 w-10 border-r border-slate-800">M</th>
                      <th className="py-1.5 px-1.5 w-10 border-r border-slate-800">F</th>
                      <th className="py-1.5 px-1.5 w-12 bg-slate-200">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-medium border-r border-slate-300">Outstanding (90-100)</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.outstanding.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.outstanding.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.outstanding.total}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-medium border-r border-slate-300">Very Satisfactory (85-89)</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.verySatisfactory.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.verySatisfactory.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.verySatisfactory.total}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-medium border-r border-slate-300">Satisfactory (80-84)</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.satisfactory.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.satisfactory.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.satisfactory.total}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-medium border-r border-slate-300">Fairly Satisfactory (75-79)</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.fairlySatisfactory.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.fairlySatisfactory.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.fairlySatisfactory.total}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="py-1 px-2 font-medium border-r border-slate-300">Did Not Meet (&lt;75)</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.didNotMeet.male}</td>
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-300">{proficiencySummary.didNotMeet.female}</td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold bg-slate-50">{proficiencySummary.didNotMeet.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 pt-12 text-center text-xs">
            <div>
              <div className="border-b border-slate-900 pb-1 font-bold uppercase">
                Prepared by: Class Adviser
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Class Adviser</span>
            </div>
            <div>
              <div className="border-b border-slate-900 pb-1 font-bold uppercase">
                Certified Correct: School Head
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">School Principal</span>
            </div>
            <div>
              <div className="border-b border-slate-900 pb-1 font-bold uppercase">
                Reviewed: Division Representative
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Public Schools District Supervisor</span>
            </div>
          </div>

        </div>

      </div>
    </SchoolConnectLayout>
  )
}
