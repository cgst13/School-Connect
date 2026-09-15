import React from 'react'
import type { TermcatSubmission, FormType, KS1LearnerData, KS2to4LearnerData, CompetencySummary, SubmissionCompetency, InstructionalDifficulty } from '@/types'
import { Printer } from 'lucide-react'

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
  epsName,
  learningAreaName,
  termName,
  schoolYearName,
  showPrintButton = true,
}: TemplateProps) {
  // Determine if single or batch submissions
  const allSubmissions = submissions || (submission ? [submission] : [])
  const primarySub = allSubmissions[0]

  const formType: FormType = explicitFormType || primarySub?.form_type || 'ks1'
  const isKS1 = formType === 'ks1'

  // Extract meta values
  const displaySdo = sdoName
  const displayEps = epsName || primarySub?.teacher_name || ''
  const displayLearningArea = learningAreaName || primarySub?.learning_area?.name || ''
  const displayTerm = termName || primarySub?.term?.name || ''
  const displaySchoolYear = schoolYearName || primarySub?.school_year?.name || ''

  // Group submissions by grade number
  const getSubForGrade = (gradeNumber: number) => {
    return allSubmissions.find(s => s.grade_level?.grade_number === gradeNumber)
  }

  return (
    <div className="bg-white text-black p-4 sm:p-6 rounded-xl border border-slate-300 shadow-md font-sans text-xs space-y-4 print:p-0 print:border-none print:shadow-none print:text-[10px]">
      {/* Print Controls (Screen Only) */}
      {showPrintButton && (
        <div className="flex justify-end no-print mb-2">
          <button
            onClick={() => window.print()}
            className="btn-md btn-primary flex items-center gap-2 font-bold shadow-md"
          >
            <Printer size={16} /> Print Official Form
          </button>
        </div>
      )}

      {/* Outer Printable Container */}
      <div className="official-termcat-print-area space-y-4">
        {/* Title Header */}
        <div className="text-center font-bold text-sm sm:text-base tracking-tight uppercase border-b-2 border-black pb-2">
          {isKS1
            ? 'Assessment Results and Competency Analysis Tool (KS 1)'
            : 'Term Examination Assessment Results and Competency Analysis Tool (TERMCAT) (KS 2-4)'}
        </div>

        {/* Instructions Box */}
        <div className="border border-black p-2 bg-slate-50 leading-relaxed text-[11px] print:text-[9px] print:bg-transparent">
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

        {/* Header Metadata Block (Light Blue Table Block) */}
        <table className="w-full border-collapse border border-black text-left text-xs print:text-[10px]">
          <tbody>
            <tr className="bg-sky-100 print:bg-sky-100">
              <td className="border border-black px-2 py-1 font-bold w-32 bg-sky-200">SDO Name</td>
              <td className="border border-black px-2 py-1 font-semibold">{displaySdo}</td>
            </tr>
            <tr className="bg-sky-100 print:bg-sky-100">
              <td className="border border-black px-2 py-1 font-bold bg-sky-200">EPS Name</td>
              <td className="border border-black px-2 py-1 font-semibold">{displayEps}</td>
            </tr>
            <tr className="bg-sky-100 print:bg-sky-100">
              <td className="border border-black px-2 py-1 font-bold bg-sky-200">Learning Area</td>
              <td className="border border-black px-2 py-1 font-semibold">{displayLearningArea}</td>
            </tr>
            <tr className="bg-sky-100 print:bg-sky-100">
              <td className="border border-black px-2 py-1 font-bold bg-sky-200">Term</td>
              <td className="border border-black px-2 py-1 font-semibold">{displayTerm}</td>
            </tr>
            <tr className="bg-sky-100 print:bg-sky-100">
              <td className="border border-black px-2 py-1 font-bold bg-sky-200">School Year</td>
              <td className="border border-black px-2 py-1 font-semibold">{displaySchoolYear}</td>
            </tr>
          </tbody>
        </table>

        {/* Main Data Table */}
        <div className="overflow-x-auto">
          {isKS1 ? (
            /* ============================================================ */
            /* KS 1 TABLE (Grades 1, 2, 3)                                 */
            /* ============================================================ */
            <table className="w-full border-collapse border border-black text-[11px] print:text-[9px] text-center">
              <thead>
                <tr className="bg-slate-200 text-black font-bold">
                  <th rowSpan={2} className="border border-black px-1.5 py-1 w-20">Key Stage 1<br />Grade Level</th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 w-16">Total Number of Learners</th>
                  <th colSpan={5} className="border border-black px-1.5 py-1">Performance Levels</th>
                  <th colSpan={4} className="border border-black px-1.5 py-1 bg-teal-100">Competency Summary</th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 bg-yellow-100 w-44">Top 5 Most Learned Competencies</th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 bg-amber-100 w-44">Top 5 Least Mastered Competencies</th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 bg-rose-100 w-44">Top 5 Most Difficult Competencies to Teach</th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1 bg-slate-100 w-44">Factors Contributing to Instructional Difficulty</th>
                </tr>
                <tr className="font-semibold text-[10px] print:text-[8px]">
                  {/* Performance Levels Colored Headers */}
                  <th className="border border-black px-1 py-1 bg-[#81C784] text-black">
                    Number of Learners Reached the "Advancing" (Namumukod-tangi) Level
                  </th>
                  <th className="border border-black px-1 py-1 bg-[#FFF176] text-black">
                    Number of Learners Reached the "Benchmarking" (Naipamalas) Level
                  </th>
                  <th className="border border-black px-1 py-1 bg-[#4FC3F7] text-black">
                    Number of Learners Reached the "Connecting" (Natutungo) Level
                  </th>
                  <th className="border border-black px-1 py-1 bg-[#FFAB91] text-black">
                    Number of Learners Reached the "Developing" (Napauunlad) Level
                  </th>
                  <th className="border border-black px-1 py-1 bg-[#E57373] text-white">
                    Number of Learners Reached the "Emerging" (Nagsisimula) Level
                  </th>

                  {/* Competency Summary sub-headers */}
                  <th className="border border-black px-1 py-1 bg-teal-50">Total Number of Intended Competencies</th>
                  <th className="border border-black px-1 py-1 bg-teal-50">Number of Competencies Taught</th>
                  <th className="border border-black px-1 py-1 bg-teal-50">Number of Competencies Not Taught</th>
                  <th className="border border-black px-1 py-1 bg-teal-50">Reasons for Untaught Competencies</th>
                </tr>
              </thead>
              <tbody>
                  {/* Render grade rows or multi-subject rows */}
                  {(() => {
                    const isMultipleSubsForSameGrade = allSubmissions.length > 1 && new Set(allSubmissions.map(s => s.grade_level_id || s.grade_level?.id)).size === 1

                    const rowsToRender: { sub: TermcatSubmission | null; label: string; key: string }[] = isMultipleSubsForSameGrade
                      ? allSubmissions.map((s, idx) => ({
                          sub: s,
                          label: `${s.grade_level?.name || 'Grade ' + (s.grade_level?.grade_number || '')} - ${s.learning_area?.name || 'Subject'}`,
                          key: s.id || `sub-${idx}`,
                        }))
                      : [1, 2, 3].map(gradeNum => {
                          const s = getSubForGrade(gradeNum) || (primarySub?.grade_level?.grade_number === gradeNum ? primarySub : null)
                          return {
                            sub: s,
                            label: `Grade ${gradeNum}`,
                            key: `grade-${gradeNum}`,
                          }
                        }).filter(item => !!item.sub || allSubmissions.length === 0)

                    return rowsToRender.map(({ sub, label, key }) => {
                      const ks1Data = sub?.ks1_learner_data
                      const compSum = sub?.competency_summary
                      const comps = sub?.submission_competencies || []
                      const diff = sub?.instructional_difficulty?.factors_text || ''

                      const ml = comps.filter(c => c.category === 'most_learned').sort((a, b) => a.rank - b.rank)
                      const lm = comps.filter(c => c.category === 'least_mastered').sort((a, b) => a.rank - b.rank)
                      const md = comps.filter(c => c.category === 'most_difficult_to_teach').sort((a, b) => a.rank - b.rank)

                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="border border-black px-1.5 py-2 font-bold bg-slate-100">{label}</td>
                          <td className="border border-black px-1.5 py-2 font-bold">{ks1Data?.total_learners ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-emerald-50/50">{ks1Data?.advancing ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-amber-50/50">{ks1Data?.benchmarking ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-sky-50/50">{ks1Data?.connecting ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-orange-50/50">{ks1Data?.developing ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 bg-rose-50/50 font-bold text-red-700">{ks1Data?.emerging ?? '—'}</td>

                          <td className="border border-black px-1.5 py-2">{compSum?.total_intended_competencies ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2">{compSum?.competencies_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2">{compSum?.competencies_not_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-left max-w-xs">{compSum?.reasons_for_untaught || '—'}</td>

                          {/* Top Most Learned */}
                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {ml.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {ml.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Top Least Mastered */}
                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {lm.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {lm.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Top Most Difficult to Teach */}
                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {md.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {md.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          {/* Factors Contributing */}
                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs whitespace-pre-wrap">
                            {diff || '—'}
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
            <table className="w-full border-collapse border border-black text-[11px] print:text-[9px] text-center">
              <thead>
                <tr className="bg-sky-200 text-black font-bold">
                  <th className="border border-black px-1.5 py-1.5 w-20">Grade Level</th>
                  <th className="border border-black px-1.5 py-1.5 w-16">Total Number of Learners</th>
                  <th className="border border-black px-1.5 py-1.5 w-16 bg-blue-300">MPS</th>
                  <th className="border border-black px-1.5 py-1.5 bg-emerald-100">Total Number of Intended Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-emerald-100">Number of Competencies Taught</th>
                  <th className="border border-black px-1.5 py-1.5 bg-emerald-100">Number of Competencies Not Taught</th>
                  <th className="border border-black px-1.5 py-1.5 bg-emerald-100">Reasons for Untaught Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-amber-200 w-44">Top 5 Most Learned Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-yellow-200 w-44">Top 5 Least Mastered Competencies</th>
                  <th className="border border-black px-1.5 py-1.5 bg-orange-200 w-44">Top 5 Most Difficult Competencies to Teach</th>
                  <th className="border border-black px-1.5 py-1.5 bg-slate-200 w-44">Factors Contributing to Instructional Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const isMultipleSubsForSameGrade = allSubmissions.length > 1 && new Set(allSubmissions.map(s => s.grade_level_id || s.grade_level?.id)).size === 1

                  if (isMultipleSubsForSameGrade) {
                    return allSubmissions.map((sub, idx) => {
                      const gradeNum = sub.grade_level?.grade_number || idx + 1
                      const gradeLabel = `${sub.grade_level?.name || 'Grade ' + gradeNum} - ${sub.learning_area?.name || 'Subject'}`
                      const ks2to4Data = sub.ks2to4_learner_data
                      const compSum = sub.competency_summary
                      const comps = sub.submission_competencies || []
                      const diff = sub.instructional_difficulty?.factors_text || ''

                      const ml = comps.filter(c => c.category === 'most_learned').sort((a, b) => a.rank - b.rank)
                      const lm = comps.filter(c => c.category === 'least_mastered').sort((a, b) => a.rank - b.rank)
                      const md = comps.filter(c => c.category === 'most_difficult_to_teach').sort((a, b) => a.rank - b.rank)

                      return (
                        <tr key={sub.id || idx} className="hover:bg-slate-50">
                          <td className="border border-black px-1.5 py-2 font-bold bg-slate-100">{gradeLabel}</td>
                          <td className="border border-black px-1.5 py-2 font-bold">{ks2to4Data?.total_learners ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 font-bold bg-blue-50 text-blue-900">
                            {ks2to4Data?.mps !== null && ks2to4Data?.mps !== undefined ? `${ks2to4Data.mps}%` : '—'}
                          </td>
                          <td className="border border-black px-1.5 py-2">{compSum?.total_intended_competencies ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2">{compSum?.competencies_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2">{compSum?.competencies_not_taught ?? '—'}</td>
                          <td className="border border-black px-1.5 py-2 text-left max-w-xs">{compSum?.reasons_for_untaught || '—'}</td>

                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {ml.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {ml.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {lm.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {lm.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                            {md.length > 0 ? (
                              <ol className="list-decimal list-inside space-y-0.5">
                                {md.map(c => (
                                  <li key={c.id || c.rank}>{c.competency_text}</li>
                                ))}
                              </ol>
                            ) : '—'}
                          </td>

                          <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs whitespace-pre-wrap">
                            {diff || '—'}
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

                  const activeKsGroups = keyStageGroups
                    .map(group => ({
                      ...group,
                      validGrades: group.grades.filter(gradeNum => {
                        const sub = getSubForGrade(gradeNum) || (primarySub?.grade_level?.grade_number === gradeNum ? primarySub : null)
                        return !!sub
                      }),
                    }))
                    .filter(group => group.validGrades.length > 0)

                  const groupsToRender = activeKsGroups.length > 0
                    ? activeKsGroups
                    : keyStageGroups
                        .map(group => ({
                          ...group,
                          validGrades: group.grades.filter(gradeNum => primarySub ? primarySub.grade_level?.grade_number === gradeNum : true),
                        }))
                        .filter(group => group.validGrades.length > 0)

                  return groupsToRender.map(({ keyStage, validGrades }) => (
                    <React.Fragment key={keyStage}>
                      {/* Key Stage Header Group */}
                      <tr className="bg-sky-100 font-bold text-left">
                        <td colSpan={11} className="border border-black px-2 py-1 text-sky-900 bg-sky-200/80 uppercase tracking-wider">
                          {keyStage}
                        </td>
                      </tr>

                      {validGrades.map(gradeNum => {
                        const sub = getSubForGrade(gradeNum) || (primarySub?.grade_level?.grade_number === gradeNum ? primarySub : null)
                        const ks2to4Data = sub?.ks2to4_learner_data
                        const compSum = sub?.competency_summary
                        const comps = sub?.submission_competencies || []
                        const diff = sub?.instructional_difficulty?.factors_text || ''

                        const ml = comps.filter(c => c.category === 'most_learned').sort((a, b) => a.rank - b.rank)
                        const lm = comps.filter(c => c.category === 'least_mastered').sort((a, b) => a.rank - b.rank)
                        const md = comps.filter(c => c.category === 'most_difficult_to_teach').sort((a, b) => a.rank - b.rank)

                        return (
                          <tr key={gradeNum} className="hover:bg-slate-50">
                            <td className="border border-black px-1.5 py-2 font-bold bg-slate-100">Grade {gradeNum}</td>
                            <td className="border border-black px-1.5 py-2 font-bold">{ks2to4Data?.total_learners ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 font-bold bg-blue-50 text-blue-900">
                              {ks2to4Data?.mps !== null && ks2to4Data?.mps !== undefined ? `${ks2to4Data.mps}%` : '—'}
                            </td>
                            <td className="border border-black px-1.5 py-2">{compSum?.total_intended_competencies ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2">{compSum?.competencies_taught ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2">{compSum?.competencies_not_taught ?? '—'}</td>
                            <td className="border border-black px-1.5 py-2 text-left max-w-xs">{compSum?.reasons_for_untaught || '—'}</td>

                            {/* Top Most Learned */}
                            <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                              {ml.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5">
                                  {ml.map(c => (
                                    <li key={c.id || c.rank}>{c.competency_text}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            {/* Top Least Mastered */}
                            <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                              {lm.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5">
                                  {lm.map(c => (
                                    <li key={c.id || c.rank}>{c.competency_text}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            {/* Top Most Difficult */}
                            <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs">
                              {md.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-0.5">
                                  {md.map(c => (
                                    <li key={c.id || c.rank}>{c.competency_text}</li>
                                  ))}
                                </ol>
                              ) : '—'}
                            </td>

                            {/* Factors Contributing */}
                            <td className="border border-black px-1.5 py-2 text-left align-top max-w-xs whitespace-pre-wrap">
                              {diff || '—'}
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
        <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs print:text-[9px] print:pt-4">
          <div>
            <p className="text-slate-600 mb-8 print:mb-6">Prepared by:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px]">&nbsp;</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Education Program Supervisor</p>
          </div>

          <div>
            <p className="text-slate-600 mb-8 print:mb-6">Checked:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px]">&nbsp;</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Chief Education Supervisor</p>
          </div>

          <div>
            <p className="text-slate-600 mb-8 print:mb-6">Approved by:</p>
            <div className="border-b border-black font-bold uppercase pb-0.5 min-h-[20px]">&nbsp;</div>
            <p className="text-[10px] text-slate-500 mt-1 uppercase">Schools Division Superintendent</p>
          </div>
        </div>
      </div>
    </div>
  )
}
