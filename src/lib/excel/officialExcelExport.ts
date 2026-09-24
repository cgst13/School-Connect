import type { TermcatSubmission, FormType } from '@/types'
import { groupAndDeduplicateCompetencies } from '@/lib/competencies/grouping'
import { format } from 'date-fns'

async function getExcelJS() {
  const ExcelJS = await import('exceljs')
  return ExcelJS.default || ExcelJS
}

export interface OfficialExportOptions {
  submission?: TermcatSubmission
  submissions?: TermcatSubmission[]
  formType?: FormType
  sdoName?: string
  epsName?: string
  learningAreaName?: string
  termName?: string
  schoolYearName?: string
  filename?: string
  gradeNumber?: number
  keyStage?: string
}

export function determineKsPrefix(
  submissions: TermcatSubmission[] = [],
  formType?: FormType,
  gradeNumber?: number,
  keyStage?: string
): string {
  if (typeof gradeNumber === 'number' && gradeNumber > 0) {
    if (gradeNumber >= 1 && gradeNumber <= 3) return 'KS1'
    if (gradeNumber >= 4 && gradeNumber <= 6) return 'KS2'
    if (gradeNumber >= 7 && gradeNumber <= 10) return 'KS3'
    if (gradeNumber >= 11 && gradeNumber <= 12) return 'KS4'
  }

  if (keyStage === 'ks1') return 'KS1'
  if (keyStage === 'ks2') return 'KS2'
  if (keyStage === 'ks3') return 'KS3'
  if (keyStage === 'ks4') return 'KS4'

  const gNums = submissions
    .map(s => s.grade_level?.grade_number)
    .filter((g): g is number => typeof g === 'number' && !isNaN(g))

  if (gNums.length > 0) {
    const minG = Math.min(...gNums)
    const maxG = Math.max(...gNums)
    if (minG >= 1 && maxG <= 3) return 'KS1'
    if (minG >= 4 && maxG <= 6) return 'KS2'
    if (minG >= 7 && maxG <= 10) return 'KS3'
    if (minG >= 11 && maxG <= 12) return 'KS4'

    const minKS = minG <= 3 ? '1' : minG <= 6 ? '2' : minG <= 10 ? '3' : '4'
    const maxKS = maxG >= 11 ? '4' : maxG >= 7 ? '3' : maxG >= 4 ? '2' : '1'
    return minKS === maxKS ? `KS${minKS}` : `KS${minKS}-${maxKS}`
  }

  if (formType === 'ks1') return 'KS1'
  if (formType === 'ks2to4') return 'KS2-4'

  return 'KS1'
}

const thinBorder = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
}

function fillRange(
  ws: any,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  hexColor: string
) {
  const fgColor = { argb: 'FF' + hexColor.replace('#', '').toUpperCase() }
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor }
    }
  }
}

function borderRange(
  ws: any,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  border = thinBorder
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const cell = ws.getCell(r, c)
      cell.border = { ...border }
    }
  }
}

// Helper to aggregate data across matching submissions (identical to OfficialTermcatTemplate)
function getAggregatedRowData(matchingSubs: TermcatSubmission[]) {
  if (matchingSubs.length === 0) return null

  const total_learners = matchingSubs.reduce(
    (acc, s) => acc + (s.ks1_learner_data?.total_learners || s.ks2to4_learner_data?.total_learners || 0),
    0
  )
  const advancing = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.advancing || 0), 0)
  const benchmarking = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.benchmarking || 0), 0)
  const connecting = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.connecting || 0), 0)
  const developing = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.developing || 0), 0)
  const emerging = matchingSubs.reduce((acc, s) => acc + (s.ks1_learner_data?.emerging || 0), 0)

  const mpsVals = matchingSubs
    .map(s => s.ks2to4_learner_data?.mps)
    .filter(m => m !== null && m !== undefined) as number[]
  const mps = mpsVals.length > 0 ? +(mpsVals.reduce((a, b) => a + b, 0) / mpsVals.length).toFixed(2) : null

  const firstCompSummary = matchingSubs.find(
    s => s.competency_summary && s.competency_summary.total_intended_competencies > 0
  )?.competency_summary
  const total_intended =
    firstCompSummary?.total_intended_competencies ??
    (matchingSubs.length > 0
      ? Math.round(matchingSubs.reduce((acc, s) => acc + (s.competency_summary?.total_intended_competencies || 0), 0) / matchingSubs.length)
      : 0)
  const competencies_taught =
    firstCompSummary?.competencies_taught ??
    (matchingSubs.length > 0
      ? Math.round(matchingSubs.reduce((acc, s) => acc + (s.competency_summary?.competencies_taught || 0), 0) / matchingSubs.length)
      : 0)
  const competencies_not_taught = Math.max(0, total_intended - competencies_taught)

  function getTop5(category: string) {
    const rawList: string[] = []
    for (const sub of matchingSubs) {
      for (const c of sub.submission_competencies || []) {
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
    factors_text,
  }
}

function formatNumberedList(items: string[]): string {
  if (!items || items.length === 0) return '—'
  return items.map((txt, i) => `${i + 1}. ${txt}`).join('\n')
}

/**
 * Builds Key Stage 1 Official DepEd Worksheet
 */
function buildOfficialKS1Sheet(
  ws: any,
  allSubmissions: TermcatSubmission[],
  meta: { sdo: string; eps: string; la: string; term: string; sy: string }
) {
  // Page setup: Folio (8.5" x 13"), Landscape, 0.4" margins
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 14, // Folio (8.5 x 13 in)
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }

  // Column Widths (15 columns: A to O)
  const widths = [18, 13, 14, 14, 14, 14, 14, 13, 12, 12, 26, 36, 36, 36, 32]
  ws.columns = widths.map(w => ({ width: w }))

  // Title Header
  ws.mergeCells('A1:O1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'ASSESSMENT RESULTS AND COMPETENCY ANALYSIS TOOL (KS 1)'
  titleCell.font = { bold: true, size: 12, name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 26

  // Instructions Box
  ws.mergeCells('A2:O2')
  const instCell = ws.getCell('A2')
  instCell.value =
    'Instructions: The assigned Schools Division Office (SDO) Learning Area Education Program Supervisor (EPS) shall accomplish this Competency Analysis Tool by providing the required information for each Key Stage 1 grade level (Grades 1–3) based on the official assessment results for the specified learning area, term, and school year. For each grade level, indicate the total number of learners and the number of learners in each performance level: Advancing (Namumukod-tangi), Benchmarking (Naipamalas), Connecting (Natutungo), Developing (Napauunlad), and Emerging (Nagsisimula). Likewise, provide the total number of intended competencies, the number of competencies taught, the number of competencies not taught, and the corresponding reasons for any untaught competencies. Identify the Top Five (5) Most Learned Competencies, Top Five (5) Least Mastered Competencies, and Top Five (5) Most Difficult Competencies to Teach using the appropriate competency codes and descriptions, and indicate the factors contributing to the instructional difficulty of the identified competencies. Ensure that all entries are complete, accurate, evidence-based, and supported by official assessment results, curriculum implementation records, classroom observations, and teacher feedback prior to submission.'
  instCell.font = { size: 8.5, italic: true, name: 'Calibri' }
  instCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  fillRange(ws, 2, 1, 2, 15, 'F8FAFC')
  borderRange(ws, 2, 1, 2, 15)
  ws.getRow(2).height = 65

  // Row 3: Blank separator
  ws.getRow(3).height = 8

  // Header Metadata Block (5-Row Light Blue Block #DEEBF7)
  const metaRows = [
    { label: 'SDO Name', value: meta.sdo },
    { label: 'EPS Name', value: meta.eps },
    { label: 'Learning Area', value: meta.la },
    { label: 'Term', value: meta.term },
    { label: 'School Year', value: meta.sy },
  ]

  metaRows.forEach((item, idx) => {
    const rNum = 4 + idx
    ws.getRow(rNum).height = 20
    const cellA = ws.getCell(rNum, 1)
    cellA.value = item.label
    cellA.font = { bold: true, size: 9.5 }

    ws.mergeCells(rNum, 2, rNum, 15)
    const cellB = ws.getCell(rNum, 2)
    cellB.value = item.value
    cellB.font = { bold: true, size: 9.5 }

    fillRange(ws, rNum, 1, rNum, 15, 'DEEBF7')
    borderRange(ws, rNum, 1, rNum, 15)
  })

  // Row 9: Blank separator
  ws.getRow(9).height = 8

  // Multi-subject check
  const learningAreaIds = new Set(
    allSubmissions.map(s => s.learning_area_id || s.learning_area?.id || s.learning_area?.name).filter(Boolean)
  )
  const gradeLevelIds = new Set(
    allSubmissions.map(s => s.grade_level_id || s.grade_level?.id || s.grade_level?.grade_number).filter(Boolean)
  )
  const isMultiSubjectSingleGradeConsolidation =
    allSubmissions.length > 1 && gradeLevelIds.size === 1 && learningAreaIds.size > 1

  // Rows 10 & 11: Main Data Table Headers
  ws.getRow(10).height = 24
  ws.getRow(11).height = 48

  // Col A: Grade Level / Learning Area
  ws.mergeCells('A10:A11')
  const colAHead = ws.getCell('A10')
  colAHead.value = isMultiSubjectSingleGradeConsolidation ? 'Key Stage 1\nLearning Area' : 'Key Stage 1\nGrade Level'
  colAHead.font = { bold: true, size: 9 }
  colAHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Col B: Total Learners
  ws.mergeCells('B10:B11')
  const colBHead = ws.getCell('B10')
  colBHead.value = 'Total Number\nof Learners'
  colBHead.font = { bold: true, size: 9 }
  colBHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Cols C-G: Performance Levels
  ws.mergeCells('C10:G10')
  const perfHead = ws.getCell('C10')
  perfHead.value = 'Performance Levels'
  perfHead.font = { bold: true, size: 9.5 }
  perfHead.alignment = { horizontal: 'center', vertical: 'middle' }

  // Cols H-K: Competency Summary
  ws.mergeCells('H10:K10')
  const compHead = ws.getCell('H10')
  compHead.value = 'Competency Summary'
  compHead.font = { bold: true, size: 9.5 }
  compHead.alignment = { horizontal: 'center', vertical: 'middle' }

  // Col L: Top 5 Most Learned
  ws.mergeCells('L10:L11')
  const lHead = ws.getCell('L10')
  lHead.value = 'Top 5 Most Learned Competencies'
  lHead.font = { bold: true, size: 9 }
  lHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Col M: Top 5 Least Mastered
  ws.mergeCells('M10:M11')
  const mHead = ws.getCell('M10')
  mHead.value = 'Top 5 Least Mastered Competencies'
  mHead.font = { bold: true, size: 9 }
  mHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Col N: Top 5 Most Difficult
  ws.mergeCells('N10:N11')
  const nHead = ws.getCell('N10')
  nHead.value = 'Top 5 Most Difficult Competencies to Teach'
  nHead.font = { bold: true, size: 9 }
  nHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Col O: Factors
  ws.mergeCells('O10:O11')
  const oHead = ws.getCell('O10')
  oHead.value = 'Factors Contributing to Instructional Difficulty'
  oHead.font = { bold: true, size: 9 }
  oHead.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

  // Fills for Row 10
  fillRange(ws, 10, 1, 10, 2, 'D9EAD3')
  fillRange(ws, 10, 3, 10, 7, 'D9EAD3')
  fillRange(ws, 10, 8, 10, 11, 'D9EAD3')
  fillRange(ws, 10, 12, 10, 13, 'FFF2CC')
  fillRange(ws, 10, 14, 10, 15, 'FCE5CD')

  // Sub-headers in Row 11
  const subHeaders = [
    { col: 3, text: 'Number of Learners Reached the "Advancing" (Namumukod-tangi) Level', fill: '6AA84F', fontColor: 'FFFFFF' },
    { col: 4, text: 'Number of Learners Reached the "Benchmarking" (Naipamalas) Level', fill: 'FFD966', fontColor: '000000' },
    { col: 5, text: 'Number of Learners Reached the "Connecting" (Natutungo) Level', fill: '6FA8DC', fontColor: '000000' },
    { col: 6, text: 'Number of Learners Reached the "Developing" (Napauunlad) Level', fill: 'F6B26B', fontColor: '000000' },
    { col: 7, text: 'Number of Learners Reached the "Emerging" (Nagsisimula) Level', fill: 'CC0000', fontColor: 'FFFFFF' },
    { col: 8, text: 'Total Number of Intended Competencies', fill: 'D9EAD3', fontColor: '000000' },
    { col: 9, text: 'Number of Competencies Taught', fill: 'D9EAD3', fontColor: '000000' },
    { col: 10, text: 'Number of Competencies Not Taught', fill: 'D9EAD3', fontColor: '000000' },
    { col: 11, text: 'Reasons for Untaught Competencies', fill: 'D9EAD3', fontColor: '000000' },
  ]

  subHeaders.forEach(sh => {
    const cell = ws.getCell(11, sh.col)
    cell.value = sh.text
    cell.font = { bold: true, size: 7.5, color: { argb: 'FF' + sh.fontColor } }
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
    fillRange(ws, 11, sh.col, 11, sh.col, sh.fill)
  })

  // Border all header cells
  borderRange(ws, 10, 1, 11, 15)

  // Data Rows Rendering
  const gradeNumbers = [1, 2, 3]
  const rowsToRender = isMultiSubjectSingleGradeConsolidation
    ? allSubmissions.map((s, idx) => ({
        matchingSubs: [s],
        label: s.learning_area?.name || 'Subject',
        key: s.id || `sub-${idx}`,
      }))
    : gradeNumbers
        .map(gradeNum => {
          const matching = allSubmissions.filter(s => s.grade_level?.grade_number === gradeNum)
          return {
            matchingSubs: matching,
            label: `Grade ${gradeNum}`,
            key: `grade-${gradeNum}`,
          }
        })
        .filter(item => item.matchingSubs.length > 0)

  let currentRow = 12

  rowsToRender.forEach(({ matchingSubs, label }) => {
    const data = getAggregatedRowData(matchingSubs)

    const mostLearnedText = formatNumberedList(data?.most_learned || [])
    const leastMasteredText = formatNumberedList(data?.least_mastered || [])
    const mostDifficultText = formatNumberedList(data?.most_difficult || [])

    // Max lines calculation for dynamic row height
    const maxLines = Math.max(
      (data?.most_learned || []).length,
      (data?.least_mastered || []).length,
      (data?.most_difficult || []).length,
      1
    )
    ws.getRow(currentRow).height = Math.max(45, maxLines * 16 + 12)

    // Col 1: Label
    const c1 = ws.getCell(currentRow, 1)
    c1.value = label
    c1.font = { bold: true, size: 9.5 }
    c1.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 1, currentRow, 1, 'F1F5F9')

    // Col 2: Total Learners
    const c2 = ws.getCell(currentRow, 2)
    c2.value = data?.total_learners ?? '—'
    c2.font = { bold: true, size: 9.5 }
    c2.alignment = { horizontal: 'center', vertical: 'middle' }

    // Col 3: Advancing
    const c3 = ws.getCell(currentRow, 3)
    c3.value = data?.advancing ?? '—'
    c3.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 3, currentRow, 3, 'F0FDF4')

    // Col 4: Benchmarking
    const c4 = ws.getCell(currentRow, 4)
    c4.value = data?.benchmarking ?? '—'
    c4.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 4, currentRow, 4, 'FEFCE8')

    // Col 5: Connecting
    const c5 = ws.getCell(currentRow, 5)
    c5.value = data?.connecting ?? '—'
    c5.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 5, currentRow, 5, 'F0F9FF')

    // Col 6: Developing
    const c6 = ws.getCell(currentRow, 6)
    c6.value = data?.developing ?? '—'
    c6.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 6, currentRow, 6, 'FFF7ED')

    // Col 7: Emerging
    const c7 = ws.getCell(currentRow, 7)
    c7.value = data?.emerging ?? '—'
    c7.font = { bold: true, color: { argb: 'FFB91C1C' } }
    c7.alignment = { horizontal: 'center', vertical: 'middle' }
    fillRange(ws, currentRow, 7, currentRow, 7, 'FEF2F2')

    // Col 8: Total Intended
    const c8 = ws.getCell(currentRow, 8)
    c8.value = data?.total_intended ?? '—'
    c8.font = { bold: true }
    c8.alignment = { horizontal: 'center', vertical: 'middle' }

    // Col 9: Taught
    const c9 = ws.getCell(currentRow, 9)
    c9.value = data?.competencies_taught ?? '—'
    c9.font = { bold: true }
    c9.alignment = { horizontal: 'center', vertical: 'middle' }

    // Col 10: Not Taught
    const c10 = ws.getCell(currentRow, 10)
    c10.value = data?.competencies_not_taught ?? '—'
    c10.font = { bold: true }
    c10.alignment = { horizontal: 'center', vertical: 'middle' }

    // Col 11: Reasons Untaught
    const c11 = ws.getCell(currentRow, 11)
    c11.value = data?.reasons_untaught || '—'
    c11.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

    // Col 12: Top 5 Most Learned
    const c12 = ws.getCell(currentRow, 12)
    c12.value = mostLearnedText
    c12.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

    // Col 13: Top 5 Least Mastered
    const c13 = ws.getCell(currentRow, 13)
    c13.value = leastMasteredText
    c13.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

    // Col 14: Top 5 Most Difficult
    const c14 = ws.getCell(currentRow, 14)
    c14.value = mostDifficultText
    c14.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

    // Col 15: Factors
    const c15 = ws.getCell(currentRow, 15)
    c15.value = data?.factors_text || '—'
    c15.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

    borderRange(ws, currentRow, 1, currentRow, 15)
    currentRow++
  })

  // Signatures Section (Vertical Stacked Layout as per official DepEd template)
  currentRow += 2

  // 1. Prepared by
  const pBy = ws.getCell(currentRow, 1)
  pBy.value = 'Prepared by:'
  pBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const pName = ws.getCell(currentRow, 3)
  pName.value = meta.eps || 'CRISTINA F. FALLARME'
  pName.font = { bold: true, size: 10 }
  pName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 6; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const pTitle = ws.getCell(currentRow, 3)
  pTitle.value = 'Education Program Supervisor'
  pTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  pTitle.alignment = { horizontal: 'center' }

  currentRow += 2

  // 2. Noted
  const nBy = ws.getCell(currentRow, 1)
  nBy.value = 'Noted:'
  nBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const nName = ws.getCell(currentRow, 3)
  nName.value = ' '
  nName.font = { bold: true, size: 10 }
  nName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 6; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const nTitle = ws.getCell(currentRow, 3)
  nTitle.value = 'Chief Education Supervisor'
  nTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  nTitle.alignment = { horizontal: 'center' }

  currentRow += 2

  // 3. Approved by
  const aBy = ws.getCell(currentRow, 1)
  aBy.value = 'Approved by:'
  aBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const aName = ws.getCell(currentRow, 3)
  aName.value = 'ROGER F. CAPA, CESO VI'
  aName.font = { bold: true, size: 10 }
  aName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 6; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 6)
  const aTitle = ws.getCell(currentRow, 3)
  aTitle.value = 'Schools Division Superintendent'
  aTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  aTitle.alignment = { horizontal: 'center' }
}

/**
 * Builds Key Stage 2-4 Official DepEd Worksheet
 */
function buildOfficialKS2to4Sheet(
  ws: any,
  allSubmissions: TermcatSubmission[],
  meta: { sdo: string; eps: string; la: string; term: string; sy: string }
) {
  // Page setup: Folio (8.5" x 13"), Landscape, 0.4" margins
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 14, // Folio (8.5 x 13 in)
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  }

  // Column Widths (11 columns: A to K)
  const widths = [18, 13, 12, 13, 11, 11, 26, 38, 38, 38, 34]
  ws.columns = widths.map(w => ({ width: w }))

  // Title Header
  ws.mergeCells('A1:K1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'TERM EXAMINATION ASSESSMENT RESULTS AND COMPETENCY ANALYSIS TOOL (TERMCAT) (KS 2-4)'
  titleCell.font = { bold: true, size: 11, name: 'Calibri' }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 26

  // Instructions Box
  ws.mergeCells('A2:K2')
  const instCell = ws.getCell('A2')
  instCell.value =
    'Instructions: The assigned Schools Division Office (SDO) Learning Area Education Program Supervisor (EPS) shall accomplish this tool by providing the required information for each grade level based on the official assessment results for the specified learning area, term, and school year. Indicate the total number of learners, Mean Percentage Score (MPS), the top five (5) most learned competencies, the top five (5) least mastered competencies, and the top five (5) most difficult competencies to teach using the appropriate competency codes and descriptions. Ensure that all entries are accurate, evidence-based, and supported by official assessment data, classroom observations, and teacher feedback prior to submission.'
  instCell.font = { size: 8.5, italic: true, name: 'Calibri' }
  instCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  fillRange(ws, 2, 1, 2, 11, 'F8FAFC')
  borderRange(ws, 2, 1, 2, 11)
  ws.getRow(2).height = 50

  // Row 3: Blank separator
  ws.getRow(3).height = 8

  // Header Metadata Block (5-Row Light Blue Block #DEEBF7)
  const metaRows = [
    { label: 'SDO Name', value: meta.sdo },
    { label: 'EPS Name', value: meta.eps },
    { label: 'Learning Area', value: meta.la },
    { label: 'Term', value: meta.term },
    { label: 'School Year', value: meta.sy },
  ]

  metaRows.forEach((item, idx) => {
    const rNum = 4 + idx
    ws.getRow(rNum).height = 20
    const cellA = ws.getCell(rNum, 1)
    cellA.value = item.label
    cellA.font = { bold: true, size: 9.5 }

    ws.mergeCells(rNum, 2, rNum, 11)
    const cellB = ws.getCell(rNum, 2)
    cellB.value = item.value
    cellB.font = { bold: true, size: 9.5 }

    fillRange(ws, rNum, 1, rNum, 11, 'DEEBF7')
    borderRange(ws, rNum, 1, rNum, 11)
  })

  // Row 9: Blank separator
  ws.getRow(9).height = 8

  // Multi-subject check
  const learningAreaIds = new Set(
    allSubmissions.map(s => s.learning_area_id || s.learning_area?.id || s.learning_area?.name).filter(Boolean)
  )
  const gradeLevelIds = new Set(
    allSubmissions.map(s => s.grade_level_id || s.grade_level?.id || s.grade_level?.grade_number).filter(Boolean)
  )
  const isMultiSubjectSingleGradeConsolidation =
    allSubmissions.length > 1 && gradeLevelIds.size === 1 && learningAreaIds.size > 1

  // Row 10: Main Data Table Headers (KS 2-4)
  ws.getRow(10).height = 36

  const headers = [
    { col: 1, text: isMultiSubjectSingleGradeConsolidation ? 'Learning Area' : 'Grade Level', fill: 'D9EAD3' },
    { col: 2, text: 'Total Number of Learners', fill: 'D9EAD3' },
    { col: 3, text: 'MPS', fill: 'D9EAD3' },
    { col: 4, text: 'Total Number of Intended Competencies', fill: 'D9EAD3' },
    { col: 5, text: 'Number of Competencies Taught', fill: 'D9EAD3' },
    { col: 6, text: 'Number of Competencies Not Taught', fill: 'D9EAD3' },
    { col: 7, text: 'Reasons for Untaught Competencies', fill: 'D9EAD3' },
    { col: 8, text: 'Top 5 Most Learned Competencies', fill: 'FFFF00' },
    { col: 9, text: 'Top 5 Least Mastered Competencies', fill: 'FFFF00' },
    { col: 10, text: 'Top 5 Most Difficult Competencies to Teach', fill: 'FFFF00' },
    { col: 11, text: 'Factors Contributing to Instructional Difficulty', fill: 'FCE5CD' },
  ]

  headers.forEach(h => {
    const cell = ws.getCell(10, h.col)
    cell.value = h.text
    cell.font = { bold: true, size: 8.5 }
    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }
    fillRange(ws, 10, h.col, 10, h.col, h.fill)
  })

  borderRange(ws, 10, 1, 10, 11)

  let currentRow = 11
  const primarySub = allSubmissions[0]

  if (isMultiSubjectSingleGradeConsolidation) {
    allSubmissions.forEach((sub, idx) => {
      const gradeLabel = sub.learning_area?.name || 'Subject'
      const data = getAggregatedRowData([sub])

      const mostLearnedText = formatNumberedList(data?.most_learned || [])
      const leastMasteredText = formatNumberedList(data?.least_mastered || [])
      const mostDifficultText = formatNumberedList(data?.most_difficult || [])

      const maxLines = Math.max(
        (data?.most_learned || []).length,
        (data?.least_mastered || []).length,
        (data?.most_difficult || []).length,
        1
      )
      ws.getRow(currentRow).height = Math.max(45, maxLines * 16 + 12)

      const c1 = ws.getCell(currentRow, 1)
      c1.value = gradeLabel
      c1.font = { bold: true, size: 9.5 }
      c1.alignment = { horizontal: 'center', vertical: 'middle' }
      fillRange(ws, currentRow, 1, currentRow, 1, 'F1F5F9')

      const c2 = ws.getCell(currentRow, 2)
      c2.value = data?.total_learners ?? '—'
      c2.font = { bold: true, size: 9.5 }
      c2.alignment = { horizontal: 'center', vertical: 'middle' }

      const c3 = ws.getCell(currentRow, 3)
      c3.value = data?.mps !== null && data?.mps !== undefined ? `${data.mps}%` : '—'
      c3.font = { bold: true, color: { argb: 'FF1E3A8A' } }
      c3.alignment = { horizontal: 'center', vertical: 'middle' }
      fillRange(ws, currentRow, 3, currentRow, 3, 'EFF6FF')

      const c4 = ws.getCell(currentRow, 4)
      c4.value = data?.total_intended ?? '—'
      c4.alignment = { horizontal: 'center', vertical: 'middle' }

      const c5 = ws.getCell(currentRow, 5)
      c5.value = data?.competencies_taught ?? '—'
      c5.alignment = { horizontal: 'center', vertical: 'middle' }

      const c6 = ws.getCell(currentRow, 6)
      c6.value = data?.competencies_not_taught ?? '—'
      c6.alignment = { horizontal: 'center', vertical: 'middle' }

      const c7 = ws.getCell(currentRow, 7)
      c7.value = data?.reasons_untaught || '—'
      c7.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

      const c8 = ws.getCell(currentRow, 8)
      c8.value = mostLearnedText
      c8.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

      const c9 = ws.getCell(currentRow, 9)
      c9.value = leastMasteredText
      c9.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

      const c10 = ws.getCell(currentRow, 10)
      c10.value = mostDifficultText
      c10.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

      const c11 = ws.getCell(currentRow, 11)
      c11.value = data?.factors_text || '—'
      c11.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

      borderRange(ws, currentRow, 1, currentRow, 11)
      currentRow++
    })
  } else {
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

    groupsToRender.forEach(({ keyStage, validGrades }) => {
      // Key Stage Banner Row
      ws.mergeCells(currentRow, 1, currentRow, 11)
      const ksCell = ws.getCell(currentRow, 1)
      ksCell.value = keyStage.toUpperCase()
      ksCell.font = { bold: true, size: 9.5, color: { argb: 'FF0C4A6E' } }
      ksCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      fillRange(ws, currentRow, 1, currentRow, 11, 'BAE6FD')
      borderRange(ws, currentRow, 1, currentRow, 11)
      ws.getRow(currentRow).height = 22
      currentRow++

      validGrades.forEach(gradeNum => {
        const matching = allSubmissions.filter(s => s.grade_level?.grade_number === gradeNum)
        const rowSubs =
          matching.length > 0
            ? matching
            : primarySub?.grade_level?.grade_number === gradeNum
            ? [primarySub]
            : []
        const data = getAggregatedRowData(rowSubs)

        const mostLearnedText = formatNumberedList(data?.most_learned || [])
        const leastMasteredText = formatNumberedList(data?.least_mastered || [])
        const mostDifficultText = formatNumberedList(data?.most_difficult || [])

        const maxLines = Math.max(
          (data?.most_learned || []).length,
          (data?.least_mastered || []).length,
          (data?.most_difficult || []).length,
          1
        )
        ws.getRow(currentRow).height = Math.max(45, maxLines * 16 + 12)

        const c1 = ws.getCell(currentRow, 1)
        c1.value = `Grade ${gradeNum}`
        c1.font = { bold: true, size: 9.5 }
        c1.alignment = { horizontal: 'center', vertical: 'middle' }
        fillRange(ws, currentRow, 1, currentRow, 1, 'F1F5F9')

        const c2 = ws.getCell(currentRow, 2)
        c2.value = data?.total_learners ?? '—'
        c2.font = { bold: true, size: 9.5 }
        c2.alignment = { horizontal: 'center', vertical: 'middle' }

        const c3 = ws.getCell(currentRow, 3)
        c3.value = data?.mps !== null && data?.mps !== undefined ? `${data.mps}%` : '—'
        c3.font = { bold: true, color: { argb: 'FF1E3A8A' } }
        c3.alignment = { horizontal: 'center', vertical: 'middle' }
        fillRange(ws, currentRow, 3, currentRow, 3, 'EFF6FF')

        const c4 = ws.getCell(currentRow, 4)
        c4.value = data?.total_intended ?? '—'
        c4.alignment = { horizontal: 'center', vertical: 'middle' }

        const c5 = ws.getCell(currentRow, 5)
        c5.value = data?.competencies_taught ?? '—'
        c5.alignment = { horizontal: 'center', vertical: 'middle' }

        const c6 = ws.getCell(currentRow, 6)
        c6.value = data?.competencies_not_taught ?? '—'
        c6.alignment = { horizontal: 'center', vertical: 'middle' }

        const c7 = ws.getCell(currentRow, 7)
        c7.value = data?.reasons_untaught || '—'
        c7.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' }

        const c8 = ws.getCell(currentRow, 8)
        c8.value = mostLearnedText
        c8.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

        const c9 = ws.getCell(currentRow, 9)
        c9.value = leastMasteredText
        c9.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

        const c10 = ws.getCell(currentRow, 10)
        c10.value = mostDifficultText
        c10.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

        const c11 = ws.getCell(currentRow, 11)
        c11.value = data?.factors_text || '—'
        c11.alignment = { wrapText: true, horizontal: 'left', vertical: 'top' }

        borderRange(ws, currentRow, 1, currentRow, 11)
        currentRow++
      })
    })
  }

  // Signatures Section (Vertical Stacked Layout as per official DepEd template)
  currentRow += 2

  // 1. Prepared by
  const pBy = ws.getCell(currentRow, 1)
  pBy.value = 'Prepared by:'
  pBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const pName = ws.getCell(currentRow, 3)
  pName.value = meta.eps || 'CRISTINA F. FALLARME'
  pName.font = { bold: true, size: 10 }
  pName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 5; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const pTitle = ws.getCell(currentRow, 3)
  pTitle.value = 'Education Program Supervisor'
  pTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  pTitle.alignment = { horizontal: 'center' }

  currentRow += 2

  // 2. Noted
  const nBy = ws.getCell(currentRow, 1)
  nBy.value = 'Noted:'
  nBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const nName = ws.getCell(currentRow, 3)
  nName.value = ' '
  nName.font = { bold: true, size: 10 }
  nName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 5; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const nTitle = ws.getCell(currentRow, 3)
  nTitle.value = 'Chief Education Supervisor'
  nTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  nTitle.alignment = { horizontal: 'center' }

  currentRow += 2

  // 3. Approved by
  const aBy = ws.getCell(currentRow, 1)
  aBy.value = 'Approved by:'
  aBy.font = { size: 9, bold: true, color: { argb: 'FF000000' } }

  currentRow += 2

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const aName = ws.getCell(currentRow, 3)
  aName.value = 'ROGER F. CAPA, CESO VI'
  aName.font = { bold: true, size: 10 }
  aName.alignment = { horizontal: 'center' }
  for (let c = 3; c <= 5; c++) ws.getCell(currentRow, c).border = { bottom: thinBorder.bottom }

  currentRow++

  ws.mergeCells(currentRow, 3, currentRow, 5)
  const aTitle = ws.getCell(currentRow, 3)
  aTitle.value = 'Schools Division Superintendent'
  aTitle.font = { size: 9, italic: true, color: { argb: 'FF000000' } }
  aTitle.alignment = { horizontal: 'center' }
}

export async function exportOfficialTermcatExcel(options: OfficialExportOptions) {
  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'TERMCAT System'
  wb.created = new Date()

  const allSubmissions = options.submissions || (options.submission ? [options.submission] : [])
  const primarySub = allSubmissions[0]

  const formType: FormType = options.formType || primarySub?.form_type || 'ks1'

  const meta = {
    sdo: options.sdoName || 'Division of Romblon',
    eps: options.epsName || 'Cristina F. Fallarme',
    la: options.learningAreaName || primarySub?.learning_area?.name || '',
    term: options.termName || primarySub?.term?.name || '',
    sy: options.schoolYearName || primarySub?.school_year?.name || '',
  }

  const ks1Subs = allSubmissions.filter(s => (options.formType ? options.formType === 'ks1' : s.form_type === 'ks1'))
  const ks24Subs = allSubmissions.filter(s =>
    options.formType ? options.formType === 'ks2to4' : s.form_type === 'ks2to4'
  )

  if (formType === 'ks1' || ks1Subs.length > 0) {
    const ws = wb.addWorksheet('KS1 Official Form')
    buildOfficialKS1Sheet(ws, ks1Subs.length > 0 ? ks1Subs : allSubmissions, meta)
  }

  if (formType === 'ks2to4' || ks24Subs.length > 0) {
    const ws = wb.addWorksheet('KS 2-4 Official Form')
    buildOfficialKS2to4Sheet(ws, ks24Subs.length > 0 ? ks24Subs : allSubmissions, meta)
  }

  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet('Official Form')
    buildOfficialKS1Sheet(ws, allSubmissions, meta)
  }

  const ksPrefix = determineKsPrefix(
    allSubmissions,
    formType,
    options.gradeNumber,
    options.keyStage
  )

  const rawLA = meta.la || 'Learning_Area'
  const cleanLA = rawLA.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_')

  let outFilename = options.filename ? options.filename : `${ksPrefix}_${cleanLA}`
  
  // Ensure the filename starts with KS prefix and contains Learning Area if custom name wasn't properly formatted
  if (options.filename && !options.filename.startsWith('KS')) {
    outFilename = `${ksPrefix}_${cleanLA}`
  }

  // Strip .xlsx extension if already included
  if (outFilename.endsWith('.xlsx')) {
    outFilename = outFilename.slice(0, -5)
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${outFilename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
