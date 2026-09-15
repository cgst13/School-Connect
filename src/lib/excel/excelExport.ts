import type { TermcatSubmission } from '@/types'
import { getKeyStageLabel } from '@/utils/keyStage'
import { format } from 'date-fns'

async function getExcelJS() {
  // Dynamic import for code splitting
  const ExcelJS = await import('exceljs')
  return ExcelJS.default || ExcelJS
}

function applyHeaderRow(row: any, isBold = true) {
  row.font = { bold: isBold, size: 10 }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FD' } }
  row.border = {
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  }
  row.alignment = { wrapText: true, vertical: 'middle' }
}

function applyDataRow(row: any, isEven: boolean) {
  row.fill = isEven
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
  row.font = { size: 10 }
  row.alignment = { wrapText: true, vertical: 'top' }
}

function formatCompetencies(sub: TermcatSubmission, category: string): string {
  const items = (sub.submission_competencies || [])
    .filter(c => c.category === category)
    .sort((a, b) => a.rank - b.rank)
    .map((c, i) => `${i + 1}. ${c.competency_text}`)
  return items.join('\n')
}

async function buildKS1Sheet(wb: any, ks1Subs: TermcatSubmission[]) {
  const ws = wb.addWorksheet('Key Stage 1')

  // Title
  ws.mergeCells('A1:W1')
  const titleRow = ws.getRow(1)
  titleRow.getCell(1).value = 'TERMCAT — Key Stage 1 Consolidated Data'
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1a56db' } }
  titleRow.getCell(1).alignment = { horizontal: 'center' }
  titleRow.height = 24

  // Generated
  ws.mergeCells('A2:W2')
  ws.getRow(2).getCell(1).value = `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`
  ws.getRow(2).getCell(1).font = { italic: true, size: 9, color: { argb: 'FF94a3b8' } }

  // Header row
  const headers = [
    'Reference No.', 'Teacher Name', 'School', 'Grade Level', 'Key Stage',
    'Learning Area', 'School Year', 'Term', 'Status', 'Date Submitted',
    'Total Learners', 'Advancing', 'Benchmarking', 'Connecting', 'Developing', 'Emerging',
    'Total Intended', 'Taught', 'Not Taught', 'Reasons for Untaught',
    'Most Learned (Top 5)', 'Least Mastered (Top 5)', 'Most Difficult to Teach (Top 5)',
    'Instructional Difficulty Factors',
  ]
  const hRow = ws.addRow(headers)
  applyHeaderRow(hRow)
  hRow.height = 30

  // Column widths
  const widths = [18, 22, 35, 12, 12, 22, 12, 10, 12, 18,
    14, 12, 14, 12, 12, 12,
    14, 12, 12, 35,
    35, 35, 35, 35]
  ws.columns = headers.map((_, i) => ({ width: widths[i] || 15 }))

  // Data rows
  ks1Subs.forEach((sub, idx) => {
    const row = ws.addRow([
      sub.reference_number,
      sub.teacher_name,
      sub.school?.name || '',
      sub.grade_level?.name || '',
      getKeyStageLabel(sub.key_stage),
      sub.learning_area?.name || '',
      sub.school_year?.name || '',
      sub.term?.name || '',
      sub.status,
      format(new Date(sub.submitted_at), 'yyyy-MM-dd'),
      sub.ks1_learner_data?.total_learners || 0,
      sub.ks1_learner_data?.advancing || 0,
      sub.ks1_learner_data?.benchmarking || 0,
      sub.ks1_learner_data?.connecting || 0,
      sub.ks1_learner_data?.developing || 0,
      sub.ks1_learner_data?.emerging || 0,
      sub.competency_summary?.total_intended_competencies || 0,
      sub.competency_summary?.competencies_taught || 0,
      sub.competency_summary?.competencies_not_taught || 0,
      sub.competency_summary?.reasons_for_untaught || '',
      formatCompetencies(sub, 'most_learned'),
      formatCompetencies(sub, 'least_mastered'),
      formatCompetencies(sub, 'most_difficult_to_teach'),
      sub.instructional_difficulty?.factors_text || '',
    ])
    applyDataRow(row, idx % 2 === 0)
    row.height = 60
  })

  // Freeze header
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
}

async function buildKS2to4Sheet(wb: any, ks24Subs: TermcatSubmission[]) {
  const ws = wb.addWorksheet('Key Stages 2-4')

  ws.mergeCells('A1:V1')
  const titleRow = ws.getRow(1)
  titleRow.getCell(1).value = 'TERMCAT — Key Stages 2–4 Consolidated Data'
  titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1a56db' } }
  titleRow.getCell(1).alignment = { horizontal: 'center' }
  titleRow.height = 24

  ws.mergeCells('A2:V2')
  ws.getRow(2).getCell(1).value = `Generated: ${format(new Date(), 'MMMM d, yyyy h:mm a')}`
  ws.getRow(2).getCell(1).font = { italic: true, size: 9, color: { argb: 'FF94a3b8' } }

  const headers = [
    'Reference No.', 'Teacher Name', 'School', 'Grade Level', 'Key Stage',
    'Learning Area', 'School Year', 'Term', 'Status', 'Date Submitted',
    'Total Learners', 'MPS (%)',
    'Total Intended', 'Taught', 'Not Taught', 'Reasons for Untaught',
    'Most Learned (Top 5)', 'Least Mastered (Top 5)', 'Most Difficult to Teach (Top 5)',
    'Instructional Difficulty Factors',
  ]
  const hRow = ws.addRow(headers)
  applyHeaderRow(hRow)
  hRow.height = 30

  const widths = [18, 22, 35, 12, 12, 22, 12, 10, 12, 18, 14, 10,
    14, 12, 12, 35, 35, 35, 35, 35]
  ws.columns = headers.map((_, i) => ({ width: widths[i] || 15 }))

  ks24Subs.forEach((sub, idx) => {
    const row = ws.addRow([
      sub.reference_number,
      sub.teacher_name,
      sub.school?.name || '',
      sub.grade_level?.name || '',
      getKeyStageLabel(sub.key_stage),
      sub.learning_area?.name || '',
      sub.school_year?.name || '',
      sub.term?.name || '',
      sub.status,
      format(new Date(sub.submitted_at), 'yyyy-MM-dd'),
      sub.ks2to4_learner_data?.total_learners || 0,
      sub.ks2to4_learner_data?.mps ?? '',
      sub.competency_summary?.total_intended_competencies || 0,
      sub.competency_summary?.competencies_taught || 0,
      sub.competency_summary?.competencies_not_taught || 0,
      sub.competency_summary?.reasons_for_untaught || '',
      formatCompetencies(sub, 'most_learned'),
      formatCompetencies(sub, 'least_mastered'),
      formatCompetencies(sub, 'most_difficult_to_teach'),
      sub.instructional_difficulty?.factors_text || '',
    ])
    applyDataRow(row, idx % 2 === 0)
    row.height = 60
  })

  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
}

export async function generateExcelExport(submissions: TermcatSubmission[], filename = 'TERMCAT') {
  const ExcelJS = await getExcelJS()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'TERMCAT System'
  wb.created = new Date()

  const ks1Subs = submissions.filter(s => s.form_type === 'ks1')
  const ks24Subs = submissions.filter(s => s.form_type === 'ks2to4')

  if (ks1Subs.length > 0) await buildKS1Sheet(wb, ks1Subs)
  if (ks24Subs.length > 0) await buildKS2to4Sheet(wb, ks24Subs)

  if (wb.worksheets.length === 0) {
    const ws = wb.addWorksheet('No Data')
    ws.addRow(['No submissions found for the selected filters.'])
  }

  // Trigger download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
