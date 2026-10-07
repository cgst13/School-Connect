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
  fetchLearnerGradesByLearner,
} from '@/lib/supabase/queries'
import { getDepEdProficiencyLevel } from '@/utils/gradingCalculator'
import { getLearnerQRValue } from '@/utils/qrCodeGenerator'
import { isGradeMatch } from '@/utils/gradeUtils'
import { QRCodeSVG } from 'qrcode.react'
import type { School, GradeLevel, Section, LearningArea, Learner, LearnerGrade } from '@/types'
import {
  Printer,
  FileSpreadsheet,
  Users,
  Search,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Download
} from 'lucide-react'

export function GradingSF9Page() {
  const { admin, getPermittedSchools, getPermittedGradeLevels } = useAuth()
  const { toast } = useToast()

  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [learners, setLearners] = useState<Learner[]>([])
  const [dbGrades, setDbGrades] = useState<LearnerGrade[]>([])
  const [loading, setLoading] = useState(true)

  // Filter Selection
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('')
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>('2025-2026')

  // Permitted schools and grade levels based on assignments
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
        console.error('Failed to load SF9 report card data:', err)
        toast('Failed to load report card reference data.', 'error')
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

  const sectionLearners = useMemo(() => {
    return learners.filter(l => {
      const matchSchool = !selectedSchoolId || l.school_id === selectedSchoolId
      const matchGrade = isGradeMatch(l, selectedGradeId, gradeLevels)
      const matchSec = !selectedSectionId || l.section_id === selectedSectionId
      return matchSchool && matchGrade && matchSec
    }).sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
  }, [learners, selectedSchoolId, selectedGradeId, selectedSectionId, gradeLevels])

  useEffect(() => {
    if (sectionLearners.length > 0 && (!selectedLearnerId || !sectionLearners.some(l => l.id === selectedLearnerId))) {
      setSelectedLearnerId(sectionLearners[0].id)
    }
  }, [sectionLearners, selectedLearnerId])

  const selectedLearner = useMemo(() => {
    return learners.find(l => l.id === selectedLearnerId) || sectionLearners[0]
  }, [learners, selectedLearnerId, sectionLearners])

  // Load learner grades from Supabase
  useEffect(() => {
    if (!selectedLearner?.id) return
    async function loadLearnerDBGrades() {
      try {
        const grades = await fetchLearnerGradesByLearner(selectedLearner.id, selectedSchoolYear)
        setDbGrades(grades)
      } catch (err) {
        console.warn('Failed to load learner grades from Supabase:', err)
      }
    }
    loadLearnerDBGrades()
  }, [selectedLearner?.id, selectedSchoolYear])

  const selectedSchoolObj = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId) || schools[0]
  }, [schools, selectedSchoolId])

  const selectedGradeObj = useMemo(() => {
    return gradeLevels.find(g => g.id === selectedGradeId) || gradeLevels[0]
  }, [gradeLevels, selectedGradeId])

  const selectedSectionObj = useMemo(() => {
    return sections.find(s => s.id === selectedSectionId) || sections[0]
  }, [sections, selectedSectionId])

  // Retrieve actual quarterly ratings for selected learner from Supabase / localStorage (NO fake starter ratings!)
  const learnerReportGrades = useMemo(() => {
    if (!selectedLearner) return []
    const storageKey = `sc_learner_grades_${selectedLearner.id}`
    const saved = localStorage.getItem(storageKey)
    let savedGrades: any[] = []
    if (saved) {
      try {
        savedGrades = JSON.parse(saved)
      } catch {}
    }

    return learningAreas.map((la) => {
      const dbQ1 = dbGrades.find(g => (g.learning_area_id === la.id || g.learning_area_id === la.name) && g.quarter === 1)?.quarterly_grade
      const dbQ2 = dbGrades.find(g => (g.learning_area_id === la.id || g.learning_area_id === la.name) && g.quarter === 2)?.quarterly_grade
      const dbQ3 = dbGrades.find(g => (g.learning_area_id === la.id || g.learning_area_id === la.name) && g.quarter === 3)?.quarterly_grade
      const dbQ4 = dbGrades.find(g => (g.learning_area_id === la.id || g.learning_area_id === la.name) && g.quarter === 4)?.quarterly_grade

      const localFound = savedGrades.find(g => g.subjectName?.toLowerCase() === la.name.toLowerCase() || g.learning_area_id === la.id)

      const q1 = dbQ1 !== undefined ? dbQ1 : (localFound?.q1 ?? null)
      const q2 = dbQ2 !== undefined ? dbQ2 : (localFound?.q2 ?? null)
      const q3 = dbQ3 !== undefined ? dbQ3 : (localFound?.q3 ?? null)
      const q4 = dbQ4 !== undefined ? dbQ4 : (localFound?.q4 ?? null)

      const quarters = [q1, q2, q3, q4].filter((q): q is number => q !== null && q !== undefined && !isNaN(q))
      const finalRating = quarters.length > 0 ? Math.round(quarters.reduce((a, b) => a + b, 0) / quarters.length) : null
      const remarks = finalRating !== null ? (finalRating >= 75 ? 'Passed' : 'Failed') : 'Pending'

      return {
        subject: la.name,
        q1,
        q2,
        q3,
        q4,
        finalRating,
        remarks
      }
    })
  }, [selectedLearner, learningAreas, dbGrades])

  // Compute General Average
  const generalAverage = useMemo(() => {
    const validRatings = learnerReportGrades.map(r => r.finalRating).filter((r): r is number => r !== null && r !== undefined && !isNaN(r))
    if (validRatings.length === 0) return null
    const sum = validRatings.reduce((acc, curr) => acc + curr, 0)
    return Math.round((sum / validRatings.length) * 100) / 100
  }, [learnerReportGrades])

  const { descriptor, remarks: finalRemarks } = generalAverage !== null ? getDepEdProficiencyLevel(generalAverage) : { descriptor: 'In Progress', remarks: 'Pending' }

  return (
    <SchoolConnectLayout systemTitle="e-Class Record & Grading Portal" navGroups={gradingNavGroups}>
      <div className="space-y-6 w-full pb-16">
        
        {/* Header */}
        <PageHeader
          title="DepEd School Form 9 (SF9 - Learner Progress Report Card)"
          description="Official DepEd Form 9 with Quarterly Academic Ratings, Attendance Record & Core Values Assessment"
          badge="DepEd Official Form 9"
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              Print Official SF9
            </button>
          }
        />

        {/* Filter Selection */}
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
              Grade & Section
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

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Learner
            </label>
            <select
              value={selectedLearnerId}
              onChange={e => setSelectedLearnerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-900 focus:outline-none focus:border-blue-500"
            >
              {sectionLearners.map(l => (
                <option key={l.id} value={l.id}>
                  {l.last_name?.toUpperCase()}, {l.first_name} {l.middle_name || ''} ({l.lrn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PRINTABLE SF9 REPORT CARD CANVAS */}
        {selectedLearner && (
          <div className="bg-white rounded-3xl border-2 border-slate-800 p-8 sm:p-12 shadow-xl print:shadow-none print:border-none print:p-0 max-w-[900px] mx-auto text-slate-900 select-none">
            
            {/* DepEd Header */}
            <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900 relative">
              <div className="absolute right-0 top-0 hidden sm:block p-1 bg-white border border-slate-200 rounded-xl">
                <QRCodeSVG
                  value={getLearnerQRValue(selectedLearner)}
                  size={68}
                  level="L"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs font-serif italic text-slate-600">Republic of the Philippines</p>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-serif">
                Department of Education
              </h2>
              <p className="text-xs font-medium text-slate-700">Region IV-B (MIMAROPA) • Division of Romblon</p>
              <h1 className="text-base font-black uppercase tracking-wide text-blue-950 pt-1">
                LEARNER'S PROGRESS REPORT CARD (SF9)
              </h1>
              <p className="text-xs font-bold text-slate-800">School Year {selectedSchoolYear}</p>
            </div>

            {/* Learner Info Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 text-xs border-b border-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Learner Name:</span>
                <span className="font-bold text-slate-900 block text-sm">
                  {selectedLearner.last_name?.toUpperCase()}, {selectedLearner.first_name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">LRN:</span>
                <span className="font-mono font-bold text-slate-900 block text-sm">{selectedLearner.lrn}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Grade & Section:</span>
                <span className="font-bold text-slate-900 block">{selectedGradeObj?.name} — {selectedSectionObj?.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">School:</span>
                <span className="font-bold text-slate-900 block truncate">{selectedSchoolObj?.name}</span>
              </div>
            </div>

            {/* Academic Ratings Table */}
            <div className="pt-6 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                REPORT ON LEARNING PROGRESS AND ACHIEVEMENT
              </h3>

              <table className="w-full text-xs text-left border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-center font-bold border-b border-slate-800">
                    <th className="py-2 px-3 text-left border-r border-slate-800 min-w-[220px]">
                      Learning Areas
                    </th>
                    <th className="py-2 px-2 w-14 border-r border-slate-800">1</th>
                    <th className="py-2 px-2 w-14 border-r border-slate-800">2</th>
                    <th className="py-2 px-2 w-14 border-r border-slate-800">3</th>
                    <th className="py-2 px-2 w-14 border-r border-slate-800">4</th>
                    <th className="py-2 px-2 w-20 bg-slate-200 border-r border-slate-800 font-black">Final Rating</th>
                    <th className="py-2 px-2 w-24 bg-slate-200">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {learnerReportGrades.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-300">
                        {row.subject}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{row.q1 ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{row.q2 ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{row.q3 ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center font-mono border-r border-slate-300">{row.q4 ?? '—'}</td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold bg-slate-50 border-r border-slate-300">{row.finalRating ?? '—'}</td>
                      <td className={`py-1.5 px-2 text-center font-bold text-[11px] ${row.remarks === 'Passed' ? 'text-emerald-700' : row.remarks === 'Failed' ? 'text-rose-700' : 'text-slate-500'}`}>
                        {row.remarks}
                      </td>
                    </tr>
                  ))}
                  
                  {/* General Average Row */}
                  <tr className="bg-slate-100 font-black text-center border-t-2 border-slate-800">
                    <td className="py-2 px-3 text-right uppercase tracking-wider border-r border-slate-800">
                      General Average
                    </td>
                    <td colSpan={4} className="border-r border-slate-800"></td>
                    <td className="py-2 px-2 font-mono text-sm bg-blue-100 text-blue-950 border-r border-slate-800">
                      {generalAverage !== null ? generalAverage.toFixed(2) : '—'}
                    </td>
                    <td className={`py-2 px-2 uppercase text-xs ${finalRemarks === 'Passed' ? 'text-emerald-800' : 'text-slate-600'}`}>
                      {finalRemarks}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Grading Scale Legend */}
              <div className="grid grid-cols-2 gap-4 text-[10px] pt-3 text-slate-600">
                <div>
                  <strong className="block text-slate-800 mb-1">Descriptors & Grading Scale:</strong>
                  <ul className="space-y-0.5">
                    <li>Outstanding (90 - 100) — Passed</li>
                    <li>Very Satisfactory (85 - 89) — Passed</li>
                    <li>Satisfactory (80 - 84) — Passed</li>
                    <li>Fairly Satisfactory (75 - 79) — Passed</li>
                    <li>Did Not Meet Expectations (Below 75) — Failed</li>
                  </ul>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <p className="font-bold text-slate-800">Learner General Level of Proficiency:</p>
                  <p className="text-xs font-black text-blue-900 uppercase mt-0.5">{descriptor}</p>
                </div>
              </div>
            </div>

            {/* Signatures Strip */}
            <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs">
              <div>
                <div className="border-b border-slate-900 pb-1 font-bold uppercase">
                  Class Adviser Signature
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">Class Adviser</span>
              </div>
              <div>
                <div className="border-b border-slate-900 pb-1 font-bold uppercase">
                  School Head / Principal Signature
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">School Principal</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </SchoolConnectLayout>
  )
}
