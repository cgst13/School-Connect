import type { LearningArea } from '@/types'

async function getExcelJS() {
  const ExcelJS = await import('exceljs')
  return ExcelJS.default || ExcelJS
}

export interface ParsedSubjectRow {
  rowIndex: number
  learningAreaRaw: string
  learningAreaId: string | null
  formType: 'ks1' | 'ks2to4'
  totalLearners: number
  // KS1 performance levels
  advancing: number
  benchmarking: number
  connecting: number
  developing: number
  emerging: number
  // KS2-4 field
  mps: number | null
  // Competency summary
  totalIntended: number
  taught: number
  notTaught: number
  reasonsUntaught: string
  // Top competencies & factors
  mostLearned: string[]
  leastMastered: string[]
  mostDifficult: string[]
  instructionalFactors: string
  errors: string[]
}

/**
 * Extract exact text string from an Excel cell (handles richText, objects, primitives)
 */
export function extractExactCellText(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return ''

  let str = ''
  if (typeof cellValue === 'object') {
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      str = cellValue.richText.map((rt: any) => rt.text || '').join('')
    } else if (cellValue.text !== undefined) {
      str = String(cellValue.text)
    } else if (cellValue.result !== undefined) {
      str = String(cellValue.result)
    } else {
      str = JSON.stringify(cellValue)
    }
  } else {
    str = String(cellValue)
  }

  return str.trim()
}

/**
 * Parse line(s) or cell content into clean competency array items.
 * Preserves the EXACT complete content of every cell (including inner newlines and sub-bullets).
 */
export function parseCompetencyLines(cellValue: any): string[] {
  const str = extractExactCellText(cellValue)
  if (!str) return []

  // Check if cell has top-level numbered items (1., 2., 3.) separated by newlines
  const hasMultipleNumberedItems = /\n\s*\d+[\.\)]\s+/.test(str)

  let rawItems: string[] = []
  if (hasMultipleNumberedItems) {
    // Split ONLY on newlines followed by a top-level digit index like "2. ", "3. "
    rawItems = str.split(/\r?\n(?=\s*\d+[\.\)]\s+)/)
  } else {
    // The entire cell is 1 single competency item (preserving all internal line breaks & sub-bullets!)
    rawItems = [str]
  }

  const items: string[] = []
  for (const item of rawItems) {
    const trimmed = item.trim()
    if (!trimmed) continue

    // Strip ONLY the leading top-level index (e.g., "1. ", "2) ") at the start of the item
    const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '').trim()

    // Ensure it's not a standalone digit or empty marker (e.g., "3.")
    if (cleaned && cleaned.replace(/[\d\.\s]/g, '').length > 0) {
      items.push(cleaned)
    }
  }

  return items
}

function getCellValueAsString(cell: any): string {
  if (!cell || cell.value === null || cell.value === undefined) return ''
  const val = cell.isMerged && cell.master ? cell.master.value : cell.value
  return extractExactCellText(val)
}

function getCellValueAsNumber(cell: any): number {
  if (!cell || cell.value === null || cell.value === undefined) return 0
  const val = cell.isMerged && cell.master ? cell.master.value : cell.value

  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  if (typeof val === 'object' && val.result !== undefined) {
    return Number(val.result) || 0
  }
  const parsed = parseFloat(String(val).replace(/[^0-9.]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Extract all worksheet names from an Excel workbook buffer
 */
export async function getExcelSheetNames(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  return workbook.worksheets.map(ws => ws.name)
}

/**
 * Robustly parse subject submission blocks from a chosen worksheet tab.
 * Automatically detects whether the sheet is Key Stage 1 (KS1: Cols A–O)
 * or Key Stage 2–4 (KS2–4: Cols A–K).
 */
export async function parseSubjectImportExcel(
  arrayBuffer: ArrayBuffer,
  learningAreas: LearningArea[],
  targetSheetName?: string
): Promise<ParsedSubjectRow[]> {
  const ExcelJS = await getExcelJS()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  if (workbook.worksheets.length === 0) {
    throw new Error('No worksheets found in the uploaded Excel file.')
  }

  let worksheet = workbook.worksheets[0]
  if (targetSheetName) {
    const found = workbook.getWorksheet(targetSheetName)
    if (found) worksheet = found
  }

  let detectedFormType: 'ks1' | 'ks2to4' = 'ks2to4'
  let headerRowIndex = 0

  // Standard column maps
  const defaultKS24Cols = {
    learningArea: 1,
    learners: 2,
    mps: 3,
    intended: 4,
    taught: 5,
    notTaught: 6,
    reasonsUntaught: 7,
    mostLearned: 8,
    leastMastered: 9,
    mostDifficult: 10,
    instructionalFactors: 11,
  }

  const defaultKS1Cols = {
    learningArea: 1,
    learners: 2,
    advancing: 3,
    benchmarking: 4,
    connecting: 5,
    developing: 6,
    emerging: 7,
    intended: 8,
    taught: 9,
    notTaught: 10,
    reasonsUntaught: 11,
    mostLearned: 12,
    leastMastered: 13,
    mostDifficult: 14,
    instructionalFactors: 15,
  }

  let colMap: any = { ...defaultKS24Cols }

  // Scan first 25 rows to identify header row & form type
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 25 || headerRowIndex > 0) return

    let rowTextCombined = ''
    const tempCols: Record<string, number> = {}

    row.eachCell((cell, colNumber) => {
      const val = getCellValueAsString(cell).toLowerCase()
      rowTextCombined += ' ' + val

      if (val.includes('learning area') || val.includes('subject') || val.includes('asignatura')) {
        tempCols.learningArea = colNumber
      } else if (val.includes('mps') || val.includes('mean')) {
        tempCols.mps = colNumber
      } else if (val.includes('advancing') || val.includes('namumukod')) {
        tempCols.advancing = colNumber
        detectedFormType = 'ks1'
      } else if (val.includes('benchmarking') || val.includes('naipamalas')) {
        tempCols.benchmarking = colNumber
        detectedFormType = 'ks1'
      } else if (val.includes('connecting') || val.includes('natutungo')) {
        tempCols.connecting = colNumber
        detectedFormType = 'ks1'
      } else if (val.includes('developing') || val.includes('napauunlad')) {
        tempCols.developing = colNumber
        detectedFormType = 'ks1'
      } else if (val.includes('emerging') || val.includes('nagsisimula')) {
        tempCols.emerging = colNumber
        detectedFormType = 'ks1'
      } else if (val.includes('intended') || val.includes('kabuoan')) {
        tempCols.intended = colNumber
      } else if (val.includes('not taught') || val.includes('hindi naituro')) {
        tempCols.notTaught = colNumber
      } else if (val.includes('taught') || val.includes('naituro')) {
        if (!tempCols.taught) tempCols.taught = colNumber
      } else if (val.includes('reason') || val.includes('dahilan')) {
        tempCols.reasonsUntaught = colNumber
      } else if (val.includes('most learned') || val.includes('learned') || val.includes('pinakamataas')) {
        tempCols.mostLearned = colNumber
      } else if (val.includes('least mastered') || val.includes('least') || val.includes('pinakamababang')) {
        tempCols.leastMastered = colNumber
      } else if (val.includes('difficult') || val.includes('mahirap')) {
        tempCols.mostDifficult = colNumber
      } else if (val.includes('factor') || val.includes('salik') || val.includes('instructional')) {
        tempCols.instructionalFactors = colNumber
      } else if (val.includes('learner') || val.includes('bilang')) {
        tempCols.learners = colNumber
      }
    })

    if (
      rowTextCombined.includes('learning area') ||
      rowTextCombined.includes('subject') ||
      rowTextCombined.includes('mps') ||
      rowTextCombined.includes('advancing') ||
      rowTextCombined.includes('competencies')
    ) {
      headerRowIndex = rowNumber
      colMap = detectedFormType === 'ks1' ? { ...defaultKS1Cols, ...tempCols } : { ...defaultKS24Cols, ...tempCols }
    }
  })

  // If no header row was detected, check cell count of row 1 or 2
  if (headerRowIndex === 0) {
    const r1CellCount = worksheet.getRow(1).cellCount
    if (r1CellCount >= 14 || worksheet.getRow(1).getCell(15).value) {
      detectedFormType = 'ks1'
      colMap = { ...defaultKS1Cols }
    }
  }

  const nonSubjectTitles = [
    'learning area', 'subject', 'total number of learners', 'mps', 'intended competencies',
    'termcat', 'key stage', 'generated', 'reference', 'reasons', 'factors', 'status', 'teacher'
  ]

  interface PendingBlock {
    firstRowIndex: number
    learningAreaRaw: string
    formType: 'ks1' | 'ks2to4'
    totalLearners: number
    advancing: number
    benchmarking: number
    connecting: number
    developing: number
    emerging: number
    mps: number | null
    totalIntended: number
    taught: number
    notTaught: number
    reasonsUntaught: string
    mostLearned: string[]
    leastMastered: string[]
    mostDifficult: string[]
    instructionalFactors: string[]
  }

  const blocks: PendingBlock[] = []
  let currentBlock: PendingBlock | null = null

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowIndex > 0 && rowNumber <= headerRowIndex) return

    const cellA = row.getCell(colMap.learningArea)
    const rawVal = getCellValueAsString(cellA)
    const lowerVal = rawVal.trim().toLowerCase()

    if (nonSubjectTitles.some(t => lowerVal === t || (lowerVal.includes('learning area') && lowerVal.length < 30))) {
      return
    }

    const isMasterCell = !cellA.isMerged || (cellA.master && cellA.address === cellA.master.address)
    const isExplicitNewSubject =
      rawVal.length > 0 &&
      currentBlock !== null &&
      currentBlock.learningAreaRaw.trim().toLowerCase() !== lowerVal &&
      isMasterCell

    if (!currentBlock || isExplicitNewSubject) {
      if (currentBlock) {
        blocks.push(currentBlock)
      }
      currentBlock = {
        firstRowIndex: rowNumber,
        learningAreaRaw: rawVal || (currentBlock ? (currentBlock as any).learningAreaRaw : 'Unknown Subject'),
        formType: detectedFormType,
        totalLearners: getCellValueAsNumber(row.getCell(colMap.learners)),
        advancing: colMap.advancing ? getCellValueAsNumber(row.getCell(colMap.advancing)) : 0,
        benchmarking: colMap.benchmarking ? getCellValueAsNumber(row.getCell(colMap.benchmarking)) : 0,
        connecting: colMap.connecting ? getCellValueAsNumber(row.getCell(colMap.connecting)) : 0,
        developing: colMap.developing ? getCellValueAsNumber(row.getCell(colMap.developing)) : 0,
        emerging: colMap.emerging ? getCellValueAsNumber(row.getCell(colMap.emerging)) : 0,
        mps: colMap.mps && row.getCell(colMap.mps).value !== null && row.getCell(colMap.mps).value !== undefined ? getCellValueAsNumber(row.getCell(colMap.mps)) : null,
        totalIntended: getCellValueAsNumber(row.getCell(colMap.intended)),
        taught: getCellValueAsNumber(row.getCell(colMap.taught)),
        notTaught: colMap.notTaught ? getCellValueAsNumber(row.getCell(colMap.notTaught)) : 0,
        reasonsUntaught: getCellValueAsString(row.getCell(colMap.reasonsUntaught)),
        mostLearned: [],
        leastMastered: [],
        mostDifficult: [],
        instructionalFactors: [],
      }
    }

    if (currentBlock) {
      const ml = parseCompetencyLines(row.getCell(colMap.mostLearned).value)
      const lm = parseCompetencyLines(row.getCell(colMap.leastMastered).value)
      const md = parseCompetencyLines(row.getCell(colMap.mostDifficult).value)
      const fac = parseCompetencyLines(row.getCell(colMap.instructionalFactors).value)

      currentBlock.mostLearned.push(...ml)
      currentBlock.leastMastered.push(...lm)
      currentBlock.mostDifficult.push(...md)
      currentBlock.instructionalFactors.push(...fac)

      // Update metric fields if present on subsequent merged rows
      if (!currentBlock.totalLearners && getCellValueAsNumber(row.getCell(colMap.learners))) {
        currentBlock.totalLearners = getCellValueAsNumber(row.getCell(colMap.learners))
      }
      if (detectedFormType === 'ks1') {
        if (!currentBlock.advancing && colMap.advancing && getCellValueAsNumber(row.getCell(colMap.advancing))) {
          currentBlock.advancing = getCellValueAsNumber(row.getCell(colMap.advancing))
        }
        if (!currentBlock.benchmarking && colMap.benchmarking && getCellValueAsNumber(row.getCell(colMap.benchmarking))) {
          currentBlock.benchmarking = getCellValueAsNumber(row.getCell(colMap.benchmarking))
        }
        if (!currentBlock.connecting && colMap.connecting && getCellValueAsNumber(row.getCell(colMap.connecting))) {
          currentBlock.connecting = getCellValueAsNumber(row.getCell(colMap.connecting))
        }
        if (!currentBlock.developing && colMap.developing && getCellValueAsNumber(row.getCell(colMap.developing))) {
          currentBlock.developing = getCellValueAsNumber(row.getCell(colMap.developing))
        }
        if (!currentBlock.emerging && colMap.emerging && getCellValueAsNumber(row.getCell(colMap.emerging))) {
          currentBlock.emerging = getCellValueAsNumber(row.getCell(colMap.emerging))
        }
      } else {
        if (currentBlock.mps === null && colMap.mps && row.getCell(colMap.mps).value !== null) {
          currentBlock.mps = getCellValueAsNumber(row.getCell(colMap.mps))
        }
      }

      if (!currentBlock.totalIntended && getCellValueAsNumber(row.getCell(colMap.intended))) {
        currentBlock.totalIntended = getCellValueAsNumber(row.getCell(colMap.intended))
      }
      if (!currentBlock.taught && getCellValueAsNumber(row.getCell(colMap.taught))) {
        currentBlock.taught = getCellValueAsNumber(row.getCell(colMap.taught))
      }
      if (!currentBlock.reasonsUntaught && getCellValueAsString(row.getCell(colMap.reasonsUntaught))) {
        currentBlock.reasonsUntaught = getCellValueAsString(row.getCell(colMap.reasonsUntaught))
      }
    }
  })

  if (currentBlock) {
    blocks.push(currentBlock)
  }

  const rows: ParsedSubjectRow[] = blocks.map(b => {
    const raw = b.learningAreaRaw.trim()
    const lowerRaw = raw.toLowerCase()

    const match =
      learningAreas.find(la => la.name.trim().toLowerCase() === lowerRaw) ||
      learningAreas.find(
        la => lowerRaw.includes(la.name.trim().toLowerCase()) || la.name.trim().toLowerCase().includes(lowerRaw)
      )

    const errors: string[] = []
    if (!match) {
      errors.push(`Learning Area "${raw}" not recognized. Please select from dropdown.`)
    }

    const formattedFactors = b.instructionalFactors
      .map((f, i) => {
        const cleaned = f.replace(/^\d+[\.\)]\s*/, '').trim()
        return cleaned ? `${i + 1}. ${cleaned}` : ''
      })
      .filter(Boolean)
      .join('\n')

    return {
      rowIndex: b.firstRowIndex,
      learningAreaRaw: raw,
      learningAreaId: match ? match.id : null,
      formType: b.formType,
      totalLearners: b.totalLearners,
      advancing: b.advancing,
      benchmarking: b.benchmarking,
      connecting: b.connecting,
      developing: b.developing,
      emerging: b.emerging,
      mps: b.mps,
      totalIntended: b.totalIntended,
      taught: b.taught,
      notTaught: b.notTaught,
      reasonsUntaught: b.reasonsUntaught,
      mostLearned: b.mostLearned.slice(0, 5),
      leastMastered: b.leastMastered.slice(0, 5),
      mostDifficult: b.mostDifficult.slice(0, 5),
      instructionalFactors: formattedFactors,
      errors,
    }
  })

  return rows
}

/**
 * Generate official TERMCAT template with both worksheets combined in 1 Excel workbook:
 * - Sheet 1: Key Stage 1 (KS1: Cols A–O)
 * - Sheet 2: Key Stages 2-4 (KS2-4: Cols A–K)
 */
export async function downloadImportTemplate() {
  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'TERMCAT System'
  wb.created = new Date()

  // ==========================================
  // SHEET 1: Key Stage 1 (KS1: Grades 1–3)
  // ==========================================
  const ws1 = wb.addWorksheet('Key Stage 1 (KS1)')

  const ks1Headers = [
    'Learning Area',
    'Total Number of Learners',
    'Number of Learners Reaching the "Advancing" (Namumukod-tangi) Level',
    'Number of Learners Reaching the "Benchmarking" (Naipamalas) Level',
    'Number of Learners Reaching the "Connecting" (Natutungo) Level',
    'Number of Learners Reaching the "Developing" (Napauunlad) Level',
    'Number of Learners Reaching the "Emerging" (Nagsisimula) Level',
    'Total Number of Intended Competencies',
    'Number of Competencies Taught',
    'Number of Competencies Not Taught',
    'Reasons for Untaught Competencies',
    'Top 5 Most Learned Competencies',
    'Top 5 Least Mastered Competencies',
    'Top 5 Most Difficult Competencies to Teach',
    'Factors Contributing to Instructional Difficulty',
  ]

  const ks1HeaderRow = ws1.addRow(ks1Headers)
  ks1HeaderRow.height = 42
  ks1HeaderRow.font = { bold: true, size: 9, color: { argb: 'FF0F172A' } }
  ks1HeaderRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }

  const ks1Fills = [
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // A: Learning Area
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // B: Total Learners
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF81C784' } }, // C: Advancing
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF1C40F' } }, // D: Benchmarking
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF4FC3F7' } }, // E: Connecting
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFAB91' } }, // F: Developing
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE57373' } }, // G: Emerging
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // H: Intended
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // I: Taught
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // J: Not Taught
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }, // K: Reasons
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF1C40F' } }, // L: Most Learned
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF1C40F' } }, // M: Least Mastered
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCE4D6' } }, // N: Most Difficult
    { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCE4D6' } }, // O: Factors
  ]

  for (let col = 1; col <= 15; col++) {
    const cell = ks1HeaderRow.getCell(col)
    cell.fill = ks1Fills[col - 1]
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  }

  ws1.columns = [
    { width: 18 }, // A: Learning Area
    { width: 14 }, // B: Total Learners
    { width: 16 }, // C: Advancing
    { width: 16 }, // D: Benchmarking
    { width: 16 }, // E: Connecting
    { width: 16 }, // F: Developing
    { width: 16 }, // G: Emerging
    { width: 16 }, // H: Intended
    { width: 14 }, // I: Taught
    { width: 14 }, // J: Not Taught
    { width: 25 }, // K: Reasons Untaught
    { width: 45 }, // L: Top 5 Most Learned
    { width: 45 }, // M: Top 5 Least Mastered
    { width: 45 }, // N: Top 5 Most Difficult
    { width: 35 }, // O: Factors
  ]

  const addKS1Block = (
    startRow: number,
    learningArea: string,
    learners: number,
    adv: number,
    bench: number,
    conn: number,
    dev: number,
    emg: number,
    intended: number,
    taught: number,
    notTaught: number,
    reasonsUntaught: string,
    mostLearnedList: string[],
    leastMasteredList: string[],
    mostDifficultList: string[],
    factorsList: string[]
  ) => {
    const endRow = startRow + 4

    for (let i = 0; i < 5; i++) {
      const rNum = startRow + i
      const row = ws1.getRow(rNum)
      row.height = 40
      row.font = { size: 9 }

      row.getCell(12).value = mostLearnedList[i] || `${i + 1}.`
      row.getCell(13).value = leastMasteredList[i] || `${i + 1}.`
      row.getCell(14).value = mostDifficultList[i] || `${i + 1}.`
      row.getCell(15).value = factorsList[i] || `${i + 1}.`

      for (let c = 1; c <= 15; c++) {
        const cell = row.getCell(c)
        cell.alignment = { wrapText: true, vertical: 'top' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      }
    }

    ;['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
      ws1.mergeCells(`${col}${startRow}:${col}${endRow}`)
    })

    ws1.getCell(`A${startRow}`).value = learningArea
    ws1.getCell(`B${startRow}`).value = learners
    ws1.getCell(`C${startRow}`).value = adv
    ws1.getCell(`D${startRow}`).value = bench
    ws1.getCell(`E${startRow}`).value = conn
    ws1.getCell(`F${startRow}`).value = dev
    ws1.getCell(`G${startRow}`).value = emg
    ws1.getCell(`H${startRow}`).value = intended
    ws1.getCell(`I${startRow}`).value = taught
    ws1.getCell(`J${startRow}`).value = notTaught
    ws1.getCell(`K${startRow}`).value = reasonsUntaught

    ;['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
      const cell = ws1.getCell(`${col}${startRow}`)
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      cell.font = { bold: col === 'A', size: 9.5 }
    })
  }

  // =========================================================
  // ADD SAMPLE SUBJECT BLOCKS FOR SHEET 1: Key Stage 1 (KS1)
  // =========================================================

  // Block 1: Mathematics (Grade 1–3)
  addKS1Block(
    2,
    'Mathematics',
    32,
    6,
    14,
    8,
    3,
    1,
    15,
    15,
    0,
    '',
    [
      '1. Reads and writes numbers up to 100 in symbols and in words',
      '2. Visualizes and gives the place value and value of a digit in one- to two-digit numbers',
      '3. Compares numbers up to 100 using relation symbols (>, <, =)',
      '4. Adds 2-digit by 1-digit numbers with sums up to 99 without regrouping',
      '5. Illustrates multiplication as repeated addition and counting by multiples',
    ],
    [
      '1. Solves routine and non-routine problems involving addition of whole numbers including money',
      '2. Visualizes, represents, and subtracts 2- to 3-digit numbers with regrouping',
      '3. Identifies and creates patterns using basic shapes and geometric figures',
      '4. Solves one-step word problems involving subtraction with sums up to 100',
      '5. Tells and writes time in minutes using analog and digital clocks',
    ],
    [
      '1. Word problems involving regrouping across multi-digit numbers and money values',
      '2. Concept of division as equal sharing and repeated subtraction',
      '3. Interpretation of simple pictographs without scales',
      '4. Measuring lengths using non-standard vs standard metric units',
      '5. Distinguishing fractional parts (halves, thirds, fourths) of a given whole',
    ],
    [
      '1. Abstract nature of word problems requiring reading comprehension in early grade',
      '2. Limited manipulative learning resources and visual math kits in the classroom',
      '3. Varied mathematical readiness levels among early grade learners',
      '4. Irregular attendance affecting step-by-step skill progression',
      '5. Lack of parental guidance and reinforcement at home for practice exercises',
    ]
  )

  // Block 2: English / Literacy (Grade 1–3)
  addKS1Block(
    7,
    'English',
    32,
    5,
    12,
    9,
    4,
    2,
    14,
    12,
    2,
    'Suspension of classes due to typhoon disruption and weather advisories.',
    [
      '1. Recognizes rhyming words in nursery rhymes, poems, and chants listened to',
      '2. Identifies letters of the alphabet and produces their corresponding basic sounds',
      '3. Uses common expressions and courteous greetings in daily conversations',
      '4. Names common objects, animals, and places shown in picture cards',
      '5. Distinguishes between sentence and non-sentence phrases',
    ],
    [
      '1. Uses simple present tense of verbs in sentences correctly',
      '2. Identifies cause and effect relationships in short stories listened to',
      '3. Note important details regarding character, setting, and plot in simple narrative stories',
      '4. Uses demonstrative pronouns (this/that, these/those) accurately in context',
      '5. Spells one- to two-syllable sight words correctly in simple sentences',
    ],
    [
      '1. Explicit phonics instruction for blending consonant-vowel-consonant (CVC) sounds',
      '2. Transitioning from L1 Mother Tongue vocabulary to English reading fluency',
      '3. Expressing thoughts and ideas using complete English sentences orally and in writing',
      '4. Identifying main ideas vs supporting details in simple informational texts',
      '5. Correct application of subject-verb agreement rules for young learners',
    ],
    [
      '1. Language barrier transitioning from Mother Tongue to English instruction',
      '2. Insufficient decodable storybooks and big books for guided reading groups',
      '3. Short attention span and diverse auditory processing speeds among children',
      '4. Limited home exposure to English conversational environment',
      '5. Time constraints during allotted literacy blocks for individual reading support',
    ]
  )

  // Block 3: Makabansa / Araling Panlipunan (Grade 1–3)
  addKS1Block(
    12,
    'Makabansa',
    32,
    8,
    16,
    6,
    2,
    0,
    10,
    10,
    0,
    '',
    [
      '1. Nailalarawan ang sariling paaralan, kinaroroonan, at mga bahagi nito',
      '2. Natutukoy ang mga alituntunin at tungkulin ng bawat kasapi ng pamilya at paaralan',
      '3. Naipapahayag ang kahalagahan ng pagtutulungan sa sariling komunidad',
      '4. Nakikilala ang mga pambansang sagisag ng Pilipinas (watawat, awit, pambansang bulaklak)',
      '5. Naipakikita ang paggalang sa kultura at paniniwala ng kapwa mag-aaral',
    ],
    [
      '1. Naisasalaysay ang kwento ng sariling komunidad batay sa mga makasaysayang pook at sagisag',
      '2. Naipaliliwanag ang ugnayan ng panahon at kapaligiran sa pamumuhay ng komunidad',
      '3. Natutukoy ang mga likas na yaman ng sariling lalawigan at wastong pangangalaga rito',
      '4. Nakagagawa ng payak na mapa ng tahanan at paaralan gamit ang pangunahing direksyon',
      '5. Napahahalagahan ang mga tungkulin ng mga namumuno sa pamayanan',
    ],
    [
      '1. Pag-unawa sa konsepto ng nakaraan, kasalukuyan, at hinaharap gamit ang timeline',
      '2. Paggawa at pagbasa ng oryentasyon ng simpleng mapa at mga simbolo nito',
      '3. Pag-uugnay ng heograpiya sa uri ng kabuhayan at produkto ng komunidad',
      '4. Pag-unawa sa payak na tungkulin ng pamahalaang pambarangay at pambayan',
      '5. Pagsusuri sa epekto ng kalamidad at paghahanda sa sakuna sa komunidad',
    ],
    [
      '1. Kakulangan ng localized at kontekstuwalisadong kagamitang pagtuturo (AP modules)',
      '2. Limitadong visual maps, globe, at makukulay na larawan para sa mga batang mag-aaral',
      '3. Mahirap na pag-unawa sa mga abstract na konseptong pangkasaysayan sa murang edad',
      '4. Pangangailangan ng mas maraming lakbay-aral o community walkthrough activities',
      '5. Kakulangan sa sangguniang aklat na nakasulat sa angkop na antas ng pagbasa',
    ]
  )

  // ==========================================
  // SHEET 2: Key Stages 2-4 (KS2-4: Grades 4–12)
  // ==========================================
  const ws2 = wb.addWorksheet('Key Stages 2-4 (KS2-4)')

  const ks24Headers = [
    'Learning Area',
    'Total Number of Learners',
    'MPS',
    'Total Number of Intended Competencies',
    'Number of Competencies Taught',
    'Number of Competencies Not Taught',
    'Reasons for Untaught Competencies',
    'Top 5 Most Learned Competencies',
    'Top 5 Least Mastered Competencies',
    'Top 5 Most Difficult Competencies to Teach',
    'Factors Contributing to Instructional Difficulty',
  ]

  const ks24HeaderRow = ws2.addRow(ks24Headers)
  ks24HeaderRow.height = 36
  ks24HeaderRow.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
  ks24HeaderRow.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }

  const lightGreen = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE2EFDA' } }
  const lightYellow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCE4D6' } }

  for (let col = 1; col <= 11; col++) {
    const cell = ks24HeaderRow.getCell(col)
    cell.fill = col <= 7 ? lightGreen : lightYellow
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }
  }

  ws2.columns = [
    { width: 22 },
    { width: 16 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 30 },
    { width: 45 },
    { width: 45 },
    { width: 45 },
    { width: 35 },
  ]

  const addKS24Block = (
    startRow: number,
    learningArea: string,
    learners: number,
    mps: number,
    intended: number,
    taught: number,
    notTaught: number,
    reasonsUntaught: string,
    mostLearnedList: string[],
    leastMasteredList: string[],
    mostDifficultList: string[],
    factorsList: string[]
  ) => {
    const endRow = startRow + 4

    for (let i = 0; i < 5; i++) {
      const rNum = startRow + i
      const row = ws2.getRow(rNum)
      row.height = 42
      row.font = { size: 9.5 }

      row.getCell(8).value = mostLearnedList[i] || `${i + 1}.`
      row.getCell(9).value = leastMasteredList[i] || `${i + 1}.`
      row.getCell(10).value = mostDifficultList[i] || `${i + 1}.`
      row.getCell(11).value = factorsList[i] || `${i + 1}.`

      for (let c = 1; c <= 11; c++) {
        const cell = row.getCell(c)
        cell.alignment = { wrapText: true, vertical: 'top' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      }
    }

    ws2.mergeCells(`A${startRow}:A${endRow}`)
    ws2.mergeCells(`B${startRow}:B${endRow}`)
    ws2.mergeCells(`C${startRow}:C${endRow}`)
    ws2.mergeCells(`D${startRow}:D${endRow}`)
    ws2.mergeCells(`E${startRow}:E${endRow}`)
    ws2.mergeCells(`F${startRow}:F${endRow}`)
    ws2.mergeCells(`G${startRow}:G${endRow}`)

    ws2.getCell(`A${startRow}`).value = learningArea
    ws2.getCell(`B${startRow}`).value = learners
    ws2.getCell(`C${startRow}`).value = mps
    ws2.getCell(`D${startRow}`).value = intended
    ws2.getCell(`E${startRow}`).value = taught
    ws2.getCell(`F${startRow}`).value = notTaught
    ws2.getCell(`G${startRow}`).value = reasonsUntaught

    ;['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
      const cell = ws2.getCell(`${col}${startRow}`)
      cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
      cell.font = { bold: col === 'A', size: 10 }
    })
  }

  // =========================================================
  // ADD SAMPLE SUBJECT BLOCKS FOR SHEET 2: Key Stages 2-4 (KS2-4)
  // =========================================================

  // Block 1: Filipino (Grade 5 / Key Stage 2)
  addKS24Block(
    2,
    'Filipino',
    38,
    86.45,
    20,
    20,
    0,
    '',
    [
      "1. Nasasagot ang mga tanong sa nabasa o napakinggang kuwento, tekstong pang-impormasyon, at balita",
      "2. Nagagamit nang wasto ang mga pangngalan at panghalip sa pagtalakay tungkol sa sarili at ibang tao",
      "3. Nakabubuo ng transaksyonal na teksto gaya ng liham pangkaibigan at paanyaya",
      "4. Nagagamit ang denotasyon at konotasyong kahulugan ng mga salita sa pagbuo ng pangungusap",
      "5. Naibibigay ang kahulugan ng mga salitang pamilyar at di-pamilyar sa pamamagitan ng pahiwatig",
    ],
    [
      "1. Nagagamit ang iba't ibang uri ng pandiwa ayon sa pokus (tagaganap, layon, at tagatanggap)",
      "2. Nasusuri ang kaangkupan ng mga elementong multimedia sa target na manonood o tagapakinig",
      "3. Nakabubuo ng tekstong may mga panandang nag-uugnay ng mga ideya at magkakasunod na pangyayari",
      "4. Naibibigay ang mahahalagang kaisipan at pangunahing ideya sa binasang tekstong pampanitikan",
      "5. Nagagamit ang pangkalahatang sanggunian sa paghalap ng datos (diksyunaryo, encyclopedia)",
    ],
    [
      "1. Pagpaliwanag at paggamit ng iba't ibang pokus ng pandiwa sa malikhaing pagsulat",
      "2. Pagsusuri at kritikal na pag-unawa sa mga malalim na tayutay at talinghaga sa tula",
      "3. Pagbuo ng maayos na balangkas (outline) bago sumulat ng sulating pananaliksik",
      "4. Pagpasiya sa uri ng argumento at opinyon laban sa katotohanan sa mga tekstong persweysib",
      "5. Paggamit ng wastong bantas, baybay, at gramatika sa pagsulat ng pormal na sanaysay",
    ],
    [
      "1. Kakulangan ng sapat na babasahin at reference materials na angkop sa MATATAG Curriculum",
      "2. Mababang antas ng kasanayan sa malalim na pag-unawa sa pagbasa (comprehension gap)",
      "3. Limitadong oras sa pagsasanay ng pagsulat at pagrerebisa ng mga komposisyon sa klase",
      "4. Impluwensya ng wikang ginagamit sa social media na nakakaapekto sa pormal na balarila",
      "5. Kakulangan sa mga pagsasanay at pagsusulit na nakatuon sa Higher Order Thinking Skills (HOTS)",
    ]
  )

  // Block 2: Science (Grade 6 / Key Stage 2)
  addKS24Block(
    7,
    'Science',
    38,
    82.10,
    18,
    17,
    1,
    'Interruption of regular classes due to regional athletic meets and school-wide activities.',
    [
      '1. Describe the appearance and uses of uniform and non-uniform mixtures',
      '2. Identify the parts and functions of the human musculoskeletal and digestive systems',
      '3. Classify vertebrates into mammals, birds, reptiles, amphibians, and fishes based on characteristics',
      '4. Describe how energy is transformed from one form to another in simple machines and electrical appliances',
      '5. Differentiate renewable resources from non-renewable resources found in the Philippines',
    ],
    [
      '1. Design an experiment to show how factors affect the rate of dissolving solid solutes in liquid solvents',
      '2. Explain how the circulatory and respiratory systems work together to distribute oxygen and nutrients',
      '3. Compare the life cycles of different invertebrates and describe their ecological importance',
      '4. Demonstrate how electrical circuits function using simple series and parallel circuit connections',
      '5. Explain how soil erosion affects the environment, living things, and human activities in communities',
    ],
    [
      '1. Hands-on laboratory setup for investigating factors influencing solubility and chemical changes',
      '2. Complex physiological mechanisms connecting circulatory, respiratory, and excretory organ systems',
      '3. Constructing and troubleshooting series vs parallel circuits safely with batteries and mini bulbs',
      '4. Quantitative analysis of simple machine efficiency (mechanical advantage calculations)',
      '5. Explaining weather patterns, monsoon winds (Habagat/Amihan), and typhoon formation dynamics',
    ],
    [
      '1. Inadequate laboratory facilities, apparatuses, science kits, and safety equipment in school',
      '2. Large class size preventing hands-on individual experimentation during laboratory periods',
      '3. Abstract scientific concepts requiring digital simulations or video demonstrations unavailable offline',
      '4. Insufficient consumables such as wires, bulbs, chemicals, and measurement sensors for groups',
      '5. Limited time allotment per period to perform setup, experimentation, data logging, and discussion',
    ]
  )

  // Block 3: Mathematics (Grade 8 / Key Stage 3)
  addKS24Block(
    12,
    'Mathematics',
    45,
    79.50,
    22,
    22,
    0,
    '',
    [
      '1. Factors completely different types of polynomials (common monomial factor, difference of two squares)',
      '2. Illustrates linear equations in two variables and finds the slope of a line given two points',
      '3. Graphs linear equations in two variables using x- and y-intercepts and slope-intercept form',
      '4. Determines the dependent and independent variables in real-life functional relationships',
      '5. Describes the domain and range of a relation and identifies functions using vertical line test',
    ],
    [
      '1. Performs operations on rational algebraic expressions and simplifies complex rational expressions',
      '2. Solves problems involving systems of linear equations in two variables by substitution and elimination',
      '3. Proves statements on triangle congruence using SSS, SAS, ASA, and AAS congruence postulates',
      '4. Solves routine and non-routine problems involving linear inequalities in two variables',
      '5. Calculates measures of central tendency and variability for grouped statistical data',
    ],
    [
      '1. Algebraic simplification of complex rational expressions with polynomial numerators and denominators',
      '2. Formal two-column geometric proofs establishing triangle congruence and parallel line properties',
      '3. Translating complex multi-step real-world word problems into systems of linear equations or inequalities',
      '4. Graphing linear inequalities in two variables and shading solution regions accurately',
      '5. Deriving and applying statistical formulas for grouped data variance and standard deviation',
    ],
    [
      '1. Gaps in foundational prerequisite skills (integer operations, fraction arithmetic, basic factoring)',
      '2. High level of math anxiety and negative perception toward abstract geometric proofs',
      '3. Insufficient supplementary drill sheets, graphing workbooks, and scientific calculators',
      '4. Heterogeneous learning capacity in large class sections requiring extensive tier-differentiation',
      '5. Fast pace of curriculum competencies relative to student mastery acquisition timelines',
    ]
  )

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `TERMCAT_Subject_Import_Template.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
