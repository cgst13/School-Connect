import React from 'react'
import type { TermcatSubmission, FormType, KS1LearnerData, KS2to4LearnerData, CompetencySummary, SubmissionCompetency, InstructionalDifficulty } from '@/types'
import { Printer } from 'lucide-react'
import { groupAndDeduplicateCompetencies } from '@/lib/competencies/grouping'

interface TemplateProps {
  submission?: TermcatSubmission
  submissions?: TermcatSubmission[]
  formType?: FormType
  sdoName?: string
  epsName?: string
  learningAreaName?: string
  termName?: string
  schoolYearName?: string
  showPrintButton?: boolean
}

export function OfficialTermcatTemplate({
  submission,
  submissions,
  formType: explicitFormType,
  sdoName = 'Division of Romblon',
  epsName = 'Cristina F. Fallarme',
  learningAreaName,
  termName,
  schoolYearName,
  showPrintButton = true,
}: TemplateProps) {

  // Determine if single or batch submissions
  const allSubmissions = submissions || (submission ? [submission] : [])
  const primarySub = allSubmissions[0]

  const learningAreaIds = new Set(
    allSubmissions.map(s => s.learning_area_id || s.learning_area?.id || s.learning_area?.name).filter(Boolean)
  )
  const gradeLevelIds = new Set(
    allSubmissions.map(s => s.grade_level_id || s.grade_level?.id || s.grade_level?.grade_number).filter(Boolean)
  )

  // Only true when consolidating multiple subjects for a single grade level
  const isMultiSubjectSingleGradeConsolidation =
    allSubmissions.length > 1 &&
    gradeLevelIds.size === 1 &&
    learningAreaIds.size > 1

  const formType: FormType = explicitFormType || primarySub?.form_type || 'ks1'
  const isKS1 = formType === 'ks1'

  // Extract meta values
  const displaySdo = sdoName
  const displayEps = epsName || 'Cristina F. Fallarme'
  const displayLearningArea = learningAreaName || primarySub?.learning_area?.name || ''
  const displayTerm = termName || primarySub?.term?.name || ''
  const displaySchoolYear = schoolYearName || primarySub?.school_year?.name || ''

  // Helper to get aggregated row data for a set of matching submissions
  const getAggregatedRowData = (matchingSubs: TermcatSubmission[]) => {
    if (matchingSubs.length === 0) return null

    const total_learners = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.total_learners || s.ks2to4_learner_data?.total_learners || 0), 0)
    const advancing = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.advancing || 0), 0)
    const benchmarking = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.benchmarking || 0), 0)
    const connecting = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.connecting || 0), 0)
    const developing = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.developing || 0), 0)
    const emerging = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.emerging || 0), 0)

    const mpsVals = matchingSubs.map(s => s.ks2to4_learner_data?.mps).filter(m => m !== null && m !== undefined) as number[]
    const mps = mpsVals.length > 0 ? +(mpsVals.reduce((a, b) => a + b, 0) / mpsVals.length).toFixed(2) : null

    // FIXED competency counts (don't sum!)
    const firstCompSummary = matchingSubs.find(s => s.competency_summary && s.competency_summary.total_intended_competencies > 0)?.competency_summary
    const total_intended = firstCompSummary?.total_intended_competencies ?? (
      matchingSubs.length > 0 ? Math.round(matchingSubs.reduce((acc, s) => acc + (s.competency_summary?.total_intended_competencies || 0), 0) / matchingSubs.length) : 0
    )
    const competencies_taught = firstCompSummary?.competencies_taught ?? (
      matchingSubs.length > 0 ? Math.round(matchingSubs.reduce((acc, s) => acc + (s.competency_summary?.competencies_taught || 0), 0) / matchingSubs.length) : 0
    )
    const competencies_not_taught = Math.max(0, total_intended - competencies_taught)

    // Aggregate Top 5 Competencies with smart similarity grouping
    function getTop5(category: string) {
      const rawList: string[] = []
      for (const sub of matchingSubs) {
        for (const c of (sub.submission_competencies || [])) {
          if (c.category === category && c.competency_text.trim()) {
            rawList.push(c.competency_text.trim())
          }
        }
      }
      return groupAndDeduplicateCompetencies(rawList)
        .slice(0, 5)
        .map(g => g.competency_text)
    }

    const reasons = matchingSubs.map(s => s.competency_summary?.reasons_for_untaught).filter(Boolean)
    const reasons_untaught = Array.from(new Set(reasons)).join('; ')

    const factors = matchingSubs.map(s => s.instructional_difficulty?.factors_text).filter(Boolean)
    const factors_text = Array.from(new Set(factors)).join('; ')

    return {
      total_learners,
      advancing,
      benchmarking,
      connecting,
      developing,
      emerging,
      mps,
      total_intended,
      competencies_taught,
      competencies_not_taught,
      reasons_untaught,
      most_learned: getTop5('most_learned'),
      least_mastered: getTop5('least_mastered'),
      most_difficult: getTop5('most_difficult_to_teach'),
      factors_text
    }
  }

  const containerRef = React.useRef<HTMLDivElement>(null)

  const triggerSafePrint = () => {
    const el = containerRef.current
    if (el) {
      document.querySelectorAll('.active-print-target').forEach(e => e.classList.remove('active-print-target'))
      el.classList.add('active-print-target')
      document.body.classList.add('printing-single-target')
    }

    const scrollables = document.querySelectorAll('div, main, section, dialog')
    scrollables.forEach(s => {
      if (s.scrollTop > 0) s.scrollTop = 0
    })
    window.scrollTo(0, 0)

    const cleanup = () => {
      if (el) el.classList.remove('active-print-target')
      document.body.classList.remove('printing-single-target')
      window.removeEventListener('afterprint', cleanup)
    }

    window.addEventListener('afterprint', cleanup)

    requestAnimationFrame(() => {
      setTimeout(() => {
        window.print()
        setTimeout(cleanup, 1000)
      }, 50)
    })
  }

  return (
    <div className="bg-white text-black p-4 sm:p-6 rounded-xl border border-slate-300 shadow-md font-sans text-xs space-y-4 print:p-0 print:border-none print:shadow-none print:text-[10px]">
      {/* Print Controls (Screen Only) */}
      {showPrintButton && (
        <div className="flex items-center justify-between no-print mb-2 pb-2 border-b border-slate-200 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-[#2D2638]">Official DepEd TERMCAT Form</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#795CEE] text-[10px] font-bold border border-purple-200">
              8.5" × 13" Paper (Long/Folio)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerSafePrint}
              className="px-4 py-2 rounded-xl bg-[#8B72F4] hover:bg-[#795CEE] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={15} /> Print Official Form
            </button>
          </div>
        </div>
      )}

      {/* Outer Printable Container */}
      <div ref={containerRef} className="official-termcat-print-area space-y-4 print:space-y-1.5">
        {/* Title Header */}
        <div className="text-center font-bold text-sm sm:text-base tracking-tight uppercase border-b-2 border-black pb-2 print:text-xs print:pb-0.5 print:border-b">
          {isKS1
            ? 'Assessment Results and Competency Analysis Tool (KS 1)'
            : 'Term Examination Assessment Results and Competency Analysis Tool (TERMCAT) (KS 2-4)'}
        </div>

        {/* Instructions Box */}
        <div className="border border-black p-2 bg-slate-50 leading-relaxed text-[11px] print:text-[6.8pt] print:leading-tight print:p-1 print:bg-transparent">
          <strong>Instructions:</strong>{' '}
          {isKS1 ? (
            <>
              The assigned Schools Division Office (SDO) Learning Area Education Program Supervisor (EPS) shall accomplish this Competency Analysis Tool by providing the required information for each Key Stage 1 grade level (Grades 1–3) based on the official assessment results for the specified learning area, term, and school year. For each grade level, indicate the total number of learners and the number of learners in each performance level: Advancing (Namumukod-tangi), Benchmarking (Naipamalas), Connecting (Natutungo), Developing (Napauunlad), and Emerging (Nagsisimula). Likewise, provide the total number of intended competencies, the number of competencies taught, the number of competencies not taught, and the corresponding reasons for any untaught competencies. Identify the Top Five (5) Most Learned Competencies, Top Five (5) Least Mastered Competencies, and Top Five (5) Most Difficult Competencies to Teach using the appropriate competency codes and descriptions, and indicate the factors contributing to the instructional difficulty of the identified competencies. Ensure that all entries are complete, accurate, evidence-based, and supported by official assessment results, curriculum implementation records, classroom observations, and teacher feedback prior to submission.
            </>
          ) : (
            <>
              The assigned Schools Division Office (SDO) Learning Area Education Program Supervisor (EPS) shall accomplish this tool by providing the required information for each grade level based on the official assessment results for the specified learning area, term, and school year. Indicate the total number of learners, Mean Percentage Score (MPS), the top five (5) most learned competencies, the top five (5) least mastered competencies, and the top five (5) most difficult competencies to teach using the appropriate competency codes and descriptions. Ensure that all entries are accurate, evidence-based, and supported by official assessment data, classroom observations, and teacher feedback prior to submission.
            </>
          )}
        </div>

        {/* Header Metadata Block (Official DepEd 5-Row Vertical Light Blue Block) */}
        <table className="w-full border-collapse border border-black text-left text-xs print:text-[7.5pt]">
          <tbody>
            <tr className="bg-[#deebf7] print:bg-[#deebf7]">
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-bold w-36 bg-[#deebf7]">SDO Name</td>
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-semibold">{displaySdo}</td>
            </tr>
            <tr className="bg-[#deebf7] print:bg-[#deebf7]">
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-bold w-36 bg-[#deebf7]">EPS Name</td>
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-semibold">{displayEps}</td>
            </tr>
            <tr className="bg-[#deebf7] print:bg-[#deebf7]">
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-bold w-36 bg-[#deebf7]">Learning Area</td>
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-semibold">{displayLearningArea}</td>
            </tr>
            <tr className="bg-[#deebf7] print:bg-[#deebf7]">
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-bold w-36 bg-[#deebf7]">Term</td>
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-semibold">{displayTerm}</td>
            </tr>
            <tr className="bg-[#deebf7] print:bg-[#deebf7]">
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-bold w-36 bg-[#deebf7]">School Year</td>
              <td className="border border-black px-2 py-0.5 print:py-0 print:px-1 font-semibold">{displaySchoolYear}</td>
            </tr>
          </tbody>
        </table>

        {/* Main Data Table */}
        <div className="overflow-x-auto">
          {isKS1 ? (
            /* ============================================================ */
            /* KS 1 TABLE (Grades 1, 2, 3)                                 */
            /* ============================================================ */
            <table className="w-full border-collapse border border-black text-[10px] print:text-[7.5pt] text-center table-fixed">
              <thead>
                <tr className="bg-[#d9ead3] text-black font-bold">
                  <th rowSpan={2} className="border border-black px-1 py-1 w-[5.5%] bg-[#d9ead3]">
                    {isMultiSubjectSingleGradeConsolidation ? (
                      <>Key Stage 1<br />Learning Area</>
                    ) : (
                      <>Key Stage 1<br />Grade Level</>
                    )}
                  </th>
                  <th rowSpan={2} className="border border-black px-1 py-1 w-[5.5%] bg-[#d9ead3]">
                    Total Number<br />of Learners
                  </th>
                  <th colSpan={5} className="border border-black px-1 py-1 bg-[#d9ead3]">Performance Levels</th>
                  <th colSpan={4} className="border border-black px-1 py-1 bg-[#d9ead3]">Competency Summary</th>
                  <th rowSpan={2} className="border border-black px-1 py-1 bg-[#fff2cc] w-[11%]">Top 5 Most Learned Competencies</th>
                  <th rowSpan={2} className="border border-black px-1 py-1 bg-[#fff2cc] w-[11%]">Top 5 Least Mastered Competencies</th>
                  <th rowSpan={2} className="border border-black px-1 py-1 bg-[#fce5cd] w-[11%]">Top 5 Most Difficult Competencies to Teach</th>
                  <th rowSpan={2} className="border border-black px-1 py-1 bg-[#fce5cd] w-[11%]">Factors Contributing to Instructional Difficulty</th>
                </tr>
                <tr className="font-semibold text-[9px] print:text-[7pt] leading-tight">
                  {/* Performance Levels Colored Headers */}
                  <th className="border border-black px-0.5 py-1 bg-[#6aa84f] text-white w-[5%]">
                    Number of Learners Reached the "Advancing" (Namumukod-tangi) Level
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#ffd966] text-black w-[5%]">
                    Number of Learners Reached the "Benchmarking" (Naipamalas) Level
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#6fa8dc] text-black w-[5%]">
                    Number of Learners Reached the "Connecting" (Natutungo) Level
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#f6b26b] text-black w-[5%]">
                    Number of Learners Reached the "Developing" (Napauunlad) Level
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#cc0000] text-white w-[5%]">
                    Number of Learners Reached the "Emerging" (Nagsisimula) Level
                  </th>

                  {/* Competency Summary sub-headers */}
                  <th className="border border-black px-0.5 py-1 bg-[#d9ead3] w-[4.5%]">
                    Total Number of Intended Competencies
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#d9ead3] w-[4.5%]">
                    Number of Competencies Taught
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#d9ead3] w-[4.5%]">
                    Number of Competencies Not Taught
                  </th>
                  <th className="border border-black px-0.5 py-1 bg-[#d9ead3] w-[6.5%]">
                    Reasons for Untaught Competencies
                  </th>
                </tr>
              </thead>
              <tbody>
                  {/* Render grade rows or multi-subject rows */}
                  {(() => {
                    const gradeNumbers = [1, 2, 3]
                    const rowsToRender = isMultiSubjectSingleGradeConsolidation
                      ? allSubmissions.map((s, idx) => ({
                          matchingSubs: [s],
                          label: s.learning_area?.name || 'Subject',
                          key: s.id || `sub-${idx}`,
                        }))
                      : gradeNumbers.map(gradeNum => {
                          const matching = allSubmissions.filter(s => s.grade_level?.grade_number === gradeNum)
                          return {
                            matchingSubs: matching,
                            label: `Grade ${gradeNum}`,
                            key: `grade-${gradeNum}`,
                          }
                        }).filter(item => item.matchingSubs.length > 0)

                    return rowsToRender.map(({ matchingSubs, label, key }) => {
                      const data = getAggregatedRowData(matchingSubs)

                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="border border-black px-1.5 py-2 font-bold bg-slate-100 text-center align-middle">{label}</td>
                          <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.total_learners ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-emerald-50/50 text-center align-middle">{data?.advancing ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-amber-50/50 text-center align-middle">{data?.benchmarking ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-sky-50/50 text-center align-middle">{data?.connecting ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-orange-50/50 text-center align-middle">{data?.developing ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-rose-50/50 font-bold text-red-700 text-center align-middle">{data?.emerging ?? '—'}</td>

                          {/* FIXED COMPETENCY COUNTS */}
                          <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.total_intended ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.competencies_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.competencies_not_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-center align-middle max-w-xs">{data?.reasons_untaught || '—'}</td>

                          {/* Top Most Learned */}
                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.most_learned.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.most_learned.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Top Least Mastered */}
                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.least_mastered.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.least_mastered.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Top Most Difficult to Teach */}
                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.most_difficult.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.most_difficult.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Factors Contributing */}
                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs whitespace-pre-wrap">
                            {data?.factors_text || '—'}
                          </td>
                        </tr>
                      )
                    })
                  })()}
              </tbody>
            </table>
          ) : (
            /* ============================================================ */
            /* KS 2-4 TABLE (Grades 4 - 12)                                 */
            /* ============================================================ */
            <table className="w-full border-collapse border border-black text-[10.5px] print:text-[8pt] text-center table-fixed">
              <thead>
                <tr className="bg-sky-200 text-black font-bold">
                  <th className="border border-black px-1 py-1.5 w-[6%] bg-[#d9ead3]">
                    {isMultiSubjectSingleGradeConsolidation ? 'Learning Area' : 'Grade Level'}
                  </th>
                  <th className="border border-black px-1 py-1.5 w-[5%] bg-[#d9ead3]">Total Number of Learners</th>
                  <th className="border border-black px-1 py-1.5 w-[5%] bg-[#d9ead3]">MPS</th>
                  <th className="border border-black px-1 py-1.5 bg-[#d9ead3] w-[4.5%]">Total Number of Intended Competencies</th>
                  <th className="border border-black px-1 py-1.5 bg-[#d9ead3] w-[4%]">Number of Competencies Taught</th>
                  <th className="border border-black px-1 py-1.5 bg-[#d9ead3] w-[4%]">Number of Competencies Not Taught</th>
                  <th className="border border-black px-1 py-1.5 bg-[#d9ead3] w-[7.5%]">Reasons for Untaught Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-[#ffff00] w-[16.5%]">Top 5 Most Learned Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-[#ffff00] w-[16.5%]">Top 5 Least Mastered Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-[#ffff00] w-[16.5%]">Top 5 Most Difficult Competencies to Teach</th>
                  <th className="border border-black px-1.5 py-1.5 bg-[#fce5cd] w-[16.5%]">Factors Contributing to Instructional Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  if (isMultiSubjectSingleGradeConsolidation) {
                    return allSubmissions.map((sub, idx) => {
                      const gradeLabel = sub.learning_area?.name || 'Subject'
                      const data = getAggregatedRowData([sub])

                      return (
                        <tr key={sub.id || idx} className="hover:bg-slate-50">
                          <td className="border border-black px-1.5 py-2 font-bold bg-slate-100 text-center align-middle">{gradeLabel}</td>
                          <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.total_learners ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 font-bold bg-blue-50 text-blue-900 text-center align-middle">
                            {data?.mps !== null && data?.mps !== undefined ? `${data.mps}%` : '—'}
                          </td>
                          <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.total_intended ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.competencies_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.competencies_not_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-center align-middle max-w-xs">{data?.reasons_untaught || '—'}</td>

                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.most_learned.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.most_learned.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.least_mastered.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.least_mastered.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                            {data && data.most_difficult.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                {data.most_difficult.map((txt, i) => (
                                  <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs whitespace-pre-wrap">
                            {data?.factors_text || '—'}
                          </td>
                        </tr>
                      )
                    })
                  }

                  const keyStageGroups = [
                    { keyStage: 'Key Stage 2', grades: [4, 5, 6] },
                    { keyStage: 'Key Stage 3', grades: [7, 8, 9, 10] },
                    { keyStage: 'Key Stage 4', grades: [11, 12] },
                  ]

                  const groupsToRender = keyStageGroups
                    .map(group => ({
                      ...group,
                      validGrades: group.grades.filter(gradeNum => {
                        return allSubmissions.some(s => s.grade_level?.grade_number === gradeNum)
                      }),
                    }))
                    .filter(group => group.validGrades.length > 0)

                  return groupsToRender.map(({ keyStage, validGrades }) => (
                    <React.Fragment key={keyStage}>
                      <tr className="bg-sky-100 font-bold text-left">
                        <td colSpan={11} className="border border-black px-2 py-1 text-sky-900 bg-sky-200/80 uppercase tracking-wider">
                          {keyStage}
                        </td>
                      </tr>

                      {validGrades.map(gradeNum => {
                        const matching = allSubmissions.filter(s => s.grade_level?.grade_number === gradeNum)
                        const rowSubs = matching.length > 0 ? matching : (primarySub?.grade_level?.grade_number === gradeNum ? [primarySub] : [])
                        const data = getAggregatedRowData(rowSubs)

                        return (
                          <tr key={gradeNum} className="hover:bg-slate-50">
                            <td className="border border-black px-1.5 py-2 font-bold bg-slate-100 text-center align-middle">Grade {gradeNum}</td>
                            <td className="border border-black px-1.5 py-2 font-bold text-center align-middle">{data?.total_learners ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 font-bold bg-blue-50 text-blue-900 text-center align-middle">
                              {data?.mps !== null && data?.mps !== undefined ? `${data.mps}%` : '—'}
                            </td>
                            <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.total_intended ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.competencies_taught ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 text-center align-middle">{data?.competencies_not_taught ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 text-center align-middle max-w-xs">{data?.reasons_untaught || '—'}</td>

                            <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                              {data && data.most_learned.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                  {data.most_learned.map((txt, i) => (
                                    <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                              {data && data.least_mastered.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                  {data.least_mastered.map((txt, i) => (
                                    <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs">
                              {data && data.most_difficult.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5 print:space-y-0.5">
                                  {data.most_difficult.map((txt, i) => (
                                    <li key={i} className="whitespace-pre-wrap leading-normal mb-1 print:mb-0.5 print:leading-tight">{txt}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            <td className="border border-black px-1.5 py-2 text-left align-middle max-w-xs whitespace-pre-wrap">
                              {data?.factors_text || '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Signatures Section - Hardcoded Blank Signatories */}
        <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs print:text-[9px] print:pt-2 print:gap-4">
          <div>
            <p className="text-slate-600 mb-8 print:mb-3">Prepared by:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px] print:min-h-[14px]">{displayEps || <>&nbsp;</>}</div>
            <p className="text-[10px] print:text-[8px] text-slate-500 mt-1 uppercase">Education Program Supervisor</p>
          </div>

          <div>
            <p className="text-slate-600 mb-8 print:mb-3">Checked:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px] print:min-h-[14px]">&nbsp;</div>
            <p className="text-[10px] print:text-[8px] text-slate-500 mt-1 uppercase">Chief Education Supervisor</p>
          </div>

          <div>
            <p className="text-slate-600 mb-8 print:mb-3">Approved by:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px] print:min-h-[14px]">ROGER F. CAPA, CESO VI</div>
            <p className="text-[10px] print:text-[8px] text-slate-500 mt-1 uppercase">Schools Division Superintendent</p>
          </div>
        </div>
      </div>
    </div>
  )
}
