import * as XLSX from 'xlsx'
import type { Learner, LearnerSex, LearnerStatus } from '@/types'
import { generateLearnerQRCode, formatLearnerQRText } from './qrCodeGenerator'

export interface ParsedSF1Result {
  metadata: {
    schoolId?: string
    schoolName?: string
    region?: string
    division?: string
    district?: string
    schoolYear?: string
    gradeLevel?: string
    section?: string
    preparedBy?: string
    certifiedCorrect?: string
  }
  learners: Partial<Learner>[]
}

/**
 * Automatically calculates age from birthdate (YYYY-MM-DD or MM/DD/YYYY or Date)
 */
export function calculateAge(birthdateStr?: string | Date | null, refDateStr?: string | Date): number {
  if (!birthdateStr) return 0
  const bdate = typeof birthdateStr === 'string' ? new Date(birthdateStr) : birthdateStr
  if (isNaN(bdate.getTime())) return 0

  const refDate = refDateStr ? (typeof refDateStr === 'string' ? new Date(refDateStr) : refDateStr) : new Date()
  let age = refDate.getFullYear() - bdate.getFullYear()
  const m = refDate.getMonth() - bdate.getMonth()
  if (m < 0 || (m === 0 && refDate.getDate() < bdate.getDate())) {
    age--
  }
  return age > 0 ? age : 0
}

/**
 * Parses an official DepEd SF1 Excel file (.xls or .xlsx)
 */
export async function parseSF1Excel(file: File): Promise<ParsedSF1Result> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { cellDates: true, raw: true })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel file contains no worksheets.')

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })

  const metadata: ParsedSF1Result['metadata'] = {}
  const learners: Partial<Learner>[] = []

  const headerKeywords = [
    'school id',
    'school name',
    'region',
    'division',
    'district',
    'school year',
    'grade level',
    'section'
  ]

  const extractHeaderValue = (row: any[], startCol: number): string => {
    for (let offset = 1; offset <= 8 && startCol + offset < row.length; offset++) {
      const rawVal = String(row[startCol + offset] || '').trim()
      if (!rawVal) continue
      const lowerVal = rawVal.toLowerCase()
      // Skip if this cell is itself another header label (e.g. "Division", "District")
      if (headerKeywords.some(kw => lowerVal.includes(kw))) continue
      return rawVal
    }
    return ''
  }

  // Extract Metadata from Header Rows
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const row = rows[r] || []
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase()
      if (!val) continue

      if (val.includes('school id') && !metadata.schoolId) {
        metadata.schoolId = extractHeaderValue(row, c)
        // Check if adjacent cell contains Region name (e.g. MIMAROPA) when Region label is missing
        if (!metadata.region) {
          for (let offset = 2; offset <= 12 && c + offset < row.length; offset++) {
            const nextVal = String(row[c + offset] || '').trim()
            if (!nextVal) continue
            const lowerNext = nextVal.toLowerCase()
            if (headerKeywords.some(kw => lowerNext.includes(kw))) break
            if (nextVal !== metadata.schoolId) {
              metadata.region = nextVal
              break
            }
          }
        }
      }
      if (val.includes('school name') && !metadata.schoolName) {
        metadata.schoolName = extractHeaderValue(row, c)
      }
      if (val.includes('division') && !metadata.division) {
        metadata.division = extractHeaderValue(row, c)
      }
      if (val.includes('district') && !metadata.district) {
        metadata.district = extractHeaderValue(row, c)
      }
      if (val.includes('school year') && !metadata.schoolYear) {
        metadata.schoolYear = extractHeaderValue(row, c)
      }
      if (val.includes('grade level') && !metadata.gradeLevel) {
        const rawGradeStr = extractHeaderValue(row, c)
        if (rawGradeStr.toLowerCase().includes('section')) {
          const parts = rawGradeStr.split(/section:?/i)
          metadata.gradeLevel = (parts[0] || '').trim()
          if (!metadata.section && parts[1]) {
            metadata.section = parts[1].trim()
          }
        } else {
          metadata.gradeLevel = rawGradeStr
        }
      }
      if (val.includes('section') && !metadata.section) {
        metadata.section = extractHeaderValue(row, c)
      }
      if (val.includes('region') && !metadata.region) {
        metadata.region = extractHeaderValue(row, c)
      }
    }
  }

  // Iterate Data Rows starting from row 6 (0-indexed)
  let currentSex: LearnerSex = 'Male'

  for (let r = 6; r < rows.length; r++) {
    const row = rows[r] || []
    const firstCol = String(row[0] || '').trim()
    const nameCol = String(row[2] || '').trim()

    // Detect Sex separator or total rows
    if (nameCol.toUpperCase().includes('TOTAL MALE')) {
      currentSex = 'Female'
      continue
    }
    if (nameCol.toUpperCase().includes('TOTAL FEMALE') || nameCol.toUpperCase().includes('COMBINED')) {
      continue
    }

    // Detect LRN (12 digits)
    if (/^\d{12}$/.test(firstCol)) {
      const lrn = firstCol

      // Parse Name: LAST, FIRST, MIDDLE
      const fullNameStr = String(nameCol).replace(/,+$/, '').trim()
      const nameParts = fullNameStr.split(',').map(s => s.trim())
      const lastName = (nameParts[0] || '').replace(/\s+/g, ' ').trim()
      const firstName = (nameParts[1] || '').replace(/\s+/g, ' ').trim()
      const middleName = (nameParts[2] || '').replace(/\s+/g, ' ').trim()

      const sexChar = String(row[6] || '').trim().toUpperCase()
      const sex: LearnerSex = sexChar === 'F' ? 'Female' : sexChar === 'M' ? 'Male' : currentSex

      // Birthdate
      let birthdateStr = '2018-01-01'
      const rawDate = row[7]
      if (rawDate) {
        if (rawDate instanceof Date) {
          birthdateStr = rawDate.toISOString().split('T')[0]
        } else {
          const dStr = String(rawDate).trim()
          const parts = dStr.split(/[-/]/)
          if (parts.length === 3) {
            // MM-DD-YYYY or YYYY-MM-DD
            if (parts[2].length === 4) {
              birthdateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
            } else if (parts[0].length === 4) {
              birthdateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
            }
          }
        }
      }

      // Age (automatically calculated from birthdate if missing or 0)
      const ageNum = parseInt(String(row[9] || ''), 10)
      const age = !isNaN(ageNum) && ageNum > 0 ? ageNum : calculateAge(birthdateStr)

      // Helper to clean trailing commas and normalize spacing
      const cleanStr = (s?: any) => {
        if (!s) return ''
        return String(s)
          .replace(/,+$/, '')
          .replace(/,/g, ', ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      // Mother Tongue, IP, Religion
      const motherTongue = cleanStr(row[11]) || 'Tagalog'
      const ipGroup = cleanStr(row[13]) || 'N/A'
      const religion = cleanStr(row[14]) || 'Roman Catholic'

      // Address
      const barangay = cleanStr(row[17] || row[16])
      const city = cleanStr(row[20] || row[19]) || 'Concepcion'
      const province = cleanStr(row[22] || row[21]) || 'Romblon'

      // Parents & Guardian
      const fatherName = cleanStr(row[27])
      const motherName = cleanStr(row[31])
      const rawGuardian = cleanStr(row[36])
      const rawRel = cleanStr(row[40])
      const contactNo = cleanStr(row[41] || row[40])

      // DepEd SF1 standard: Guardian column is "GUARDIAN (if Not Parent)".
      // If living with parents, guardian columns should remain empty.
      let guardianName = ''
      let guardianRelationship = ''

      if (rawGuardian && rawGuardian.toUpperCase() !== fatherName.toUpperCase() && rawGuardian.toUpperCase() !== motherName.toUpperCase()) {
        guardianName = rawGuardian
        guardianRelationship = rawRel || 'Guardian'
      } else if (rawRel && !['FATHER', 'MOTHER', 'PARENT'].includes(rawRel.toUpperCase())) {
        guardianName = rawGuardian
        guardianRelationship = rawRel
      }

      // Remarks & 4Ps Tag
      const remarksStr = String(row[44] || row[43] || '').trim()
      const is4Ps = remarksStr.toUpperCase().includes('CCT') || remarksStr.toUpperCase().includes('4PS')
      const isBalikAral = remarksStr.toUpperCase().includes('B/A') || remarksStr.toUpperCase().includes('BALIK')

      let status: LearnerStatus = 'enrolled'
      if (remarksStr.toUpperCase().includes('T/O') || remarksStr.toUpperCase().includes('TRANSFERRED OUT')) {
        status = 'transferred_out'
      } else if (remarksStr.toUpperCase().includes('DRP') || remarksStr.toUpperCase().includes('DROPPED')) {
        status = 'dropped'
      } else if (remarksStr.toUpperCase().includes('T/I') || remarksStr.toUpperCase().includes('TRANSFERRED IN')) {
        status = 'transferred_in'
      }

      learners.push({
        lrn,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        sex,
        birthdate: birthdateStr,
        age,
        mother_tongue: motherTongue,
        ip_group: ipGroup,
        religion,
        address_barangay: barangay,
        address_city_municipality: city,
        address_province: province,
        father_name: fatherName,
        mother_maiden_name: motherName,
        guardian_name: guardianName,
        guardian_relationship: guardianRelationship,
        guardian_contact_no: contactNo,
        is_4ps_cct: is4Ps,
        is_balik_aral: isBalikAral,
        status,
        qr_code: formatLearnerQRText({
          lrn,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          sex: sex as any,
          birthdate: birthdateStr || '2018-01-01',
          age,
          address_barangay: barangay,
          address_city_municipality: city,
          address_province: province,
          guardian_name: guardianName || fatherName || motherName,
          guardian_contact_no: contactNo,
        }),
        remarks: remarksStr,
        school_name: metadata.schoolName,
        grade_level_name: metadata.gradeLevel,
        section_name: metadata.section,
        school_year: metadata.schoolYear || '2026-2027',
      })
    }
  }

  // Extract Footer Metadata & Signatures (Prepared by & Certified Correct)
  for (let r = Math.max(0, rows.length - 30); r < rows.length; r++) {
    const row = rows[r] || []
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase()
      if (val.includes('prepared by') && !metadata.preparedBy) {
        for (let rOff = 0; rOff <= 3 && r + rOff < rows.length; rOff++) {
          const targetRow = rows[r + rOff] || []
          for (let cOff = 0; cOff <= 6; cOff++) {
            const cand = String(targetRow[c + cOff] || '').trim()
            if (cand && !cand.toLowerCase().includes('prepared by') && !cand.toLowerCase().includes('signature') && !cand.toLowerCase().includes('adviser') && cand.length > 3) {
              metadata.preparedBy = cand
              break
            }
          }
          if (metadata.preparedBy) break
        }
      }

      if ((val.includes('certified correct') || val.includes('school head')) && !metadata.certifiedCorrect) {
        for (let rOff = 0; rOff <= 3 && r + rOff < rows.length; rOff++) {
          const targetRow = rows[r + rOff] || []
          for (let cOff = 0; cOff <= 6; cOff++) {
            const cand = String(targetRow[c + cOff] || '').trim()
            if (cand && !cand.toLowerCase().includes('certified correct') && !cand.toLowerCase().includes('signature') && !cand.toLowerCase().includes('school head') && cand.length > 3) {
              metadata.certifiedCorrect = cand
              break
            }
          }
          if (metadata.certifiedCorrect) break
        }
      }
    }
  }

  return { metadata, learners }
}

/**
 * Exports current active learners into official DepEd SF1 Excel workbook
 */
export function exportOfficialSF1Excel(
  learners: Learner[],
  schoolInfo?: {
    name?: string
    id?: string
    region?: string
    division?: string
    district?: string
    year?: string
    grade?: string
    section?: string
    preparedBy?: string
    certifiedCorrect?: string
  }
) {
  const maleLearners = learners.filter(l => l.sex === 'Male')
  const femaleLearners = learners.filter(l => l.sex === 'Female')

  const rows: any[][] = []

  // Header Rows
  rows.push(['School Form 1 (SF 1) School Register'])
  rows.push(['(This replaces Form 1, Master List & STS Form 2-Family Background and Profile)'])
  rows.push(['School ID', '', '', '', '', schoolInfo?.id || '', '', '', '', '', schoolInfo?.region || '', '', '', '', '', '', 'Division', '', '', schoolInfo?.division || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'District', '', '', schoolInfo?.district || ''])
  rows.push(['School Name', '', '', '', '', schoolInfo?.name || '', '', '', '', '', '', '', '', '', '', '', 'School Year', '', '', schoolInfo?.year || '', '', '', '', '', '', 'Grade Level', '', '', '', schoolInfo?.grade || '', '', '', '', '', 'Section', '', '', schoolInfo?.section || ''])

  // Table Column Headers
  rows.push([
    'LRN', '', 'NAME (Last Name, First Name, Middle Name)', '', '', '', 'Sex (M/F)', 'BIRTH DATE (mm/dd/yyyy)', '', 'AGE as of 1st Friday June', '', 'MOTHER TONGUE', '', 'IP (Ethnic Group)', 'RELIGION', 'ADDRESS', '', '', '', '', '', '', '', '', '', '', 'PARENTS', '', '', '', '', '', '', '', '', 'GUARDIAN (if Not Parent)', '', '', '', 'Contact Number', 'Learning Modality', 'REMARKS'
  ])
  rows.push([
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'House #/ Street', '', 'Barangay', '', '', 'Municipality/ City', '', 'Province', '', '', '', "Father's Name", '', '', '', "Mother's Maiden Name", '', '', '', '', 'Name', '', '', 'Relationship', '', '', ''
  ])

  // Helper to determine non-parent guardian
  const getNonParentG = (l: Learner) => {
    const fName = (l.father_name || '').trim().toUpperCase()
    const mName = (l.mother_maiden_name || '').trim().toUpperCase()
    const gName = (l.guardian_name || '').trim().toUpperCase()
    const gRel = (l.guardian_relationship || '').trim().toUpperCase()

    if (!gName || gName === fName || gName === mName || ['FATHER', 'MOTHER', 'PARENT'].includes(gRel)) {
      return { name: '', relationship: '' }
    }
    return { name: l.guardian_name || '', relationship: l.guardian_relationship || '' }
  }

  // Male Data Rows
  maleLearners.forEach(l => {
    const gInfo = getNonParentG(l)
    rows.push([
      l.lrn,
      '',
      `${l.last_name.toUpperCase()}, ${l.first_name.toUpperCase()}, ${l.middle_name ? l.middle_name.toUpperCase() : ''}`,
      '', '', '',
      'M',
      l.birthdate,
      '',
      calculateAge(l.birthdate) || l.age || '',
      '',
      l.mother_tongue || 'Tagalog',
      '',
      l.ip_group || 'N/A',
      l.religion || 'Roman Catholic',
      l.address_house_no || '',
      '',
      l.address_barangay || '',
      '', '',
      l.address_city_municipality || 'Concepcion',
      '',
      l.address_province || 'Romblon',
      '', '', '',
      l.father_name || '',
      '', '', '',
      l.mother_maiden_name || '',
      '', '', '',
      gInfo.name,
      '', '',
      gInfo.relationship,
      l.guardian_contact_no || '',
      'Face to Face',
      l.is_4ps_cct ? 'CCT' : l.remarks || ''
    ])
  })

  // Total Male Row
  rows.push([maleLearners.length, '', '<=== TOTAL MALE'])

  // Female Data Rows
  femaleLearners.forEach(l => {
    const gInfo = getNonParentG(l)
    rows.push([
      l.lrn,
      '',
      `${l.last_name.toUpperCase()}, ${l.first_name.toUpperCase()}, ${l.middle_name ? l.middle_name.toUpperCase() : ''}`,
      '', '', '',
      'F',
      l.birthdate,
      '',
      calculateAge(l.birthdate) || l.age || '',
      '',
      l.mother_tongue || 'Tagalog',
      '',
      l.ip_group || 'N/A',
      l.religion || 'Roman Catholic',
      l.address_house_no || '',
      '',
      l.address_barangay || '',
      '', '',
      l.address_city_municipality || 'Concepcion',
      '',
      l.address_province || 'Romblon',
      '', '', '',
      l.father_name || '',
      '', '', '',
      l.mother_maiden_name || '',
      '', '', '',
      gInfo.name,
      '', '',
      gInfo.relationship,
      l.guardian_contact_no || '',
      'Face to Face',
      l.is_4ps_cct ? 'CCT' : l.remarks || ''
    ])
  })

  // Total Female & Combined Rows
  rows.push([femaleLearners.length, '', '<=== TOTAL FEMALE'])
  rows.push([learners.length, '', '<=== COMBINED'])

  // Legend & Signatures Rows
  rows.push(['List and Code of Indicators under REMARKS column'])
  rows.push(['Indicator', 'Code', '', 'Required Information', '', '', '', '', 'Indicator', '', '', '', 'Code', 'Required Information', '', '', '', '', '', '', '', 'REGISTERED', '', 'BoSY', '', '', 'EoSY', '', '', '', 'Prepared by:', '', '', '', '', '', 'Certified Correct:'])
  rows.push(['Transferred Out', 'T/O', '', 'Name of School & Date', '', '', '', '', 'CCT Recipient', '', '', '', 'CCT', 'CCT Reference Number', '', '', '', '', '', '', '', 'MALE', '', maleLearners.length, '', '', '', '', '', '', 'Class Adviser Signature', '', '', '', '', '', 'School Head Signature'])
  rows.push(['Transferred In', 'T/I', '', 'Name of School & Date', '', '', '', '', 'Balik Aral', '', '', '', 'B/A', 'Name of School Last Attended', '', '', '', '', '', '', '', 'FEMALE', '', femaleLearners.length])
  rows.push(['Dropped', 'DRP', '', 'Reason & Effectivity Date', '', '', '', '', 'Special Needs', '', '', '', 'SNED', 'Specify', '', '', '', '', '', '', '', 'TOTAL', '', learners.length])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'school_form_1_ver2014')

  XLSX.writeFile(wb, `SF1_${schoolInfo?.year || '2026'}_${schoolInfo?.grade || 'Grade 5'}_${schoolInfo?.section || 'Maambisyon'}.xlsx`)
}
