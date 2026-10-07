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
  fetchLearnerGradesByFilters,
} from '@/lib/supabase/queries'
import { getDepEdProficiencyLevel } from '@/utils/gradingCalculator'
import { isGradeMatch } from '@/utils/gradeUtils'
import type { School, GradeLevel, Section, LearningArea, Learner, LearnerGrade } from '@/types'
import {
  BarChart3,
  Award,
  Printer,
  Download,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react'

export function GradingSummaryPage() {
  const { admin, getPermittedSchools, getPermittedGradeLevels, getPermittedLearningAreas } = useAuth()
  const { toast } = useToast()

  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [dbGrades, setDbGrades] = useState<LearnerGrade[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026')

  // Scoped / Permitted Options based on logged-in user assignments
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])
  const permittedGradeLevels = useMemo(() => getPermittedGradeLevels(gradeLevels), [gradeLevels, getPermittedGradeLevels])
  const permittedLearningAreas = useMemo(() => getPermittedLearningAreas(learningAreas, selectedGradeId), [learningAreas, selectedGradeId, getPermittedLearningAreas])

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
        console.error('Failed to load summary data:', err)
        toast('Failed to load consolidated summary data.', 'error')
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

  // Load actual grades from Supabase when filters change
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
    return sections.filter(s => {
      const matchSchool = !selectedSchoolId || s.school_id === selectedSchoolId
      const matchGrade = isGradeMatch(s, selectedGradeId, gradeLevels)
      return matchSchool && matchGrade
    })
  }, [sections, selectedSchoolId, selectedGradeId, gradeLevels])

  useEffect(() => {
    if (filteredSections.length > 0 && (!selectedSectionId || !filteredSections.some(s => s.id === selectedSectionId))) {
      setSelectedSectionId(filteredSections[0].id)
    }
  }, [filteredSections, selectedSectionId])

  // Section learners
  const sectionLearners = useMemo(() => {
    return learners.filter(l => {
      const matchSchool = !selectedSchoolId || l.school_id === selectedSchoolId
      const matchGrade = isGradeMatch(l, selectedGradeId, gradeLevels)
      const matchSec = !selectedSectionId || l.section_id === selectedSectionId
      return matchSchool && matchGrade && matchSec
    }).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
  }, [learners, selectedSchoolId, selectedGradeId, selectedSectionId, gradeLevels])

  // Compute student subject ratings from Supabase / localStorage (NO fake default ratings!)
  const studentMasterRatings = useMemo(() => {
    return sectionLearners.map((learner) => {
      const storageKey = `sc_learner_grades_${learner.id}`
      const saved = localStorage.getItem(storageKey)
      let subjectGrades: any[] = []
      if (saved) {
        try {
          subjectGrades = JSON.parse(saved)
        } catch {}
      }

      // Map real grades per permitted learning area
      const gradesBySubject: Record<string, number | null> = {}
      let totalSum = 0
      let count = 0

      permittedLearningAreas.forEach((la) => {
        // Look in database grades first, then local storage
        const matchedDB = dbGrades.filter(g => g.learner_id === learner.id && g.learning_area_id === la.id && g.quarterly_grade !== null && g.quarterly_grade !== undefined)
        let rating: number | null = null

        if (matchedDB.length > 0) {
          const quarters = matchedDB.map(m => m.quarterly_grade as number)
          rating = Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length)
        } else {
          const found = subjectGrades.find(g => g.subjectName?.toLowerCase() === la.name.toLowerCase() || g.learning_area_id === la.id)
          if (found && (found.finalRating !== null && found.finalRating !== undefined)) {
            rating = found.finalRating
          } else if (found && (found.q1 !== null && found.q1 !== undefined)) {
            rating = found.q1
          }
        }

        gradesBySubject[la.id] = rating
        if (rating !== null) {
          totalSum += rating
          count++
        }
      })

      const generalAverage = count > 0 ? Math.round((totalSum / count) * 100) / 100 : null
      const { descriptor, remarks } = generalAverage !== null ? getDepEdProficiencyLevel(generalAverage) : { descriptor: 'Pending', remarks: 'No grades' }

      let honorAward = ''
      if (generalAverage !== null) {
        if (generalAverage >= 98) honorAward = 'With Highest Honors'
        else if (generalAverage >= 95) honorAward = 'With High Honors'
        else if (generalAverage >= 90) honorAward = 'With Honors'
      }

      return {
        learner,
        gradesBySubject,
        generalAverage,
        descriptor,
        remarks,
        honorAward
      }
    }).sort((a, b) => (b.generalAverage || 0) - (a.generalAverage || 0))
  }, [sectionLearners, learningAreas, dbGrades])

  // Calculate Subject MPS (Mean Percentage Score)
  const subjectMPS = useMemo(() => {
    const result: Record<string, number> = {}
    learningAreas.forEach(la => {
      let sum = 0
      let total = 0
      studentMasterRatings.forEach(r => {
        const g = r.gradesBySubject[la.id]
        if (g) {
          sum += g
          total++
        }
      })
      result[la.id] = total > 0 ? Math.round((sum / total) * 10) / 10 : 0
    })
    return result
  }, [learningAreas, studentMasterRatings])

  // Overall Section MPS
  const overallSectionAverage = useMemo(() => {
    const validRatings = studentMasterRatings.map(r => r.generalAverage).filter((avg): avg is number => avg !== null && avg !== undefined && !isNaN(avg))
    if (validRatings.length === 0) return 0
    const sum = validRatings.reduce((acc, curr) => acc + curr, 0)
    return Math.round((sum / validRatings.length) * 100) / 100
  }, [studentMasterRatings])

  return (
    <SchoolConnectLayout systemTitle="e-Class Record & Grading Portal" navGroups={gradingNavGroups}>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
        
        {/* Page Header */}
        <PageHeader
          title="Section Master Sheet & Ranking"
          description="Consolidated quarterly ratings, general average, honor roll, and subject Mean Percentage Scores (MPS)"
          badge="Consolidated Master Sheet"
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              Print Master Sheet
            </button>
          }
        />

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              School
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

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Learners</span>
            <span className="text-2xl font-black text-slate-900 block mt-1">{sectionLearners.length}</span>
            <span className="text-xs text-slate-500 mt-0.5 block">Official Enrollees</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Section Overall MPS</span>
            <span className="text-2xl font-black text-blue-700 block mt-1">{overallSectionAverage}%</span>
            <span className="text-xs text-emerald-600 font-semibold mt-0.5 block">Level of Proficiency: Very Satisfactory</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Academic Honors Roll</span>
            <span className="text-2xl font-black text-purple-700 block mt-1">
              {studentMasterRatings.filter(r => r.honorAward).length}
            </span>
            <span className="text-xs text-purple-600 font-semibold mt-0.5 block">Learners With Honors (≥ 90%)</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Passing Rate</span>
            <span className="text-2xl font-black text-emerald-700 block mt-1">
              {studentMasterRatings.length > 0 ? Math.round((studentMasterRatings.filter(r => r.remarks === 'Passed').length / studentMasterRatings.length) * 100) : 100}%
            </span>
            <span className="text-xs text-slate-500 mt-0.5 block">Above 75.0 Threshold</span>
          </div>
        </div>

        {/* Master Sheet Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-center border-b border-slate-800">
                  <th className="py-2.5 px-2 w-10 text-center border-r border-slate-800">Rank</th>
                  <th className="py-2.5 px-3 text-left w-28 border-r border-slate-800">LRN</th>
                  <th className="py-2.5 px-3 text-left min-w-[200px] border-r border-slate-800">Learner Full Name</th>
                  {permittedLearningAreas.map(la => (
                    <th key={la.id} className="py-2.5 px-2 min-w-[80px] border-r border-slate-800 font-semibold text-[11px]">
                      {la.name}
                    </th>
                  ))}
                  <th className="py-2.5 px-2 w-20 bg-purple-900 text-white font-black border-r border-slate-800">Gen. Avg</th>
                  <th className="py-2.5 px-2 w-28 bg-purple-900 text-white font-bold border-r border-slate-800">Proficiency</th>
                  <th className="py-2.5 px-2 min-w-[140px] bg-amber-900 text-white font-bold">Academic Honors</th>
                </tr>
              </thead>
              <tbody>
                {studentMasterRatings.map((row, idx) => (
                  <tr key={row.learner.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-500 border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-700 border-r border-slate-100 text-[11px]">
                      {row.learner.lrn}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {row.learner.last_name?.toUpperCase()}, {row.learner.first_name} {row.learner.middle_name ? `${row.learner.middle_name[0]}.` : ''}
                    </td>

                    {/* Subject Ratings */}
                    {permittedLearningAreas.map(la => {
                      const grade = row.gradesBySubject[la.id]
                      return (
                        <td key={la.id} className="py-2 px-2 text-center font-mono font-semibold text-slate-800 border-r border-slate-100">
                          {grade || '—'}
                        </td>
                      )
                    })}

                    <td className="py-2 px-2 text-center font-mono font-black text-sm text-purple-900 bg-purple-50/70 border-r border-slate-100">
                      {row.generalAverage !== null ? row.generalAverage.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 px-2 text-center text-[11px] font-semibold text-slate-700 border-r border-slate-100">
                      {row.descriptor}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-xs">
                      {row.honorAward ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] inline-flex items-center gap-1">
                          <Award size={10} className="text-amber-700" />
                          {row.honorAward}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {/* Subject MPS Row */}
                <tr className="bg-slate-900 text-white font-bold text-center border-t-2 border-slate-800">
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-xs border-r border-slate-800">
                    Subject Mean Percentage Score (MPS)
                  </td>
                  {learningAreas.map(la => (
                    <td key={`mps-${la.id}`} className="py-2.5 px-2 text-center font-mono font-black text-amber-300 border-r border-slate-800">
                      {subjectMPS[la.id] ? `${subjectMPS[la.id]}%` : '—'}
                    </td>
                  ))}
                  <td className="py-2.5 px-2 font-mono font-black text-amber-300 bg-purple-950 border-r border-slate-800">
                    {overallSectionAverage}%
                  </td>
                  <td colSpan={2} className="py-2.5 px-2 text-slate-300 text-xs text-left pl-3">
                    Section Overall MPS
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </SchoolConnectLayout>
  )
}
