import { Learner } from '@/types'

/**
 * Utility functions for generating, formatting, and verifying DepEd Learner QR Codes
 */

export interface LearnerQRPayload {
  system: 'SchoolConnect'
  type: 'DEPED_LEARNER_ID'
  lrn: string
  id?: string
  schoolId?: string
  name?: string
  code: string
}

/**
 * Formats learner's LRN and personal details into standard vCard 3.0 format.
 * Standard vCard 3.0 is recognized natively by 100% of smartphone cameras (Samsung, iOS, Xiaomi, Google Pixel)
 * and displays the learner's name, LRN, personal details, contact, and address directly on screen.
 */
export function formatLearnerQRText(learner: Partial<Learner>): string {
  if (!learner) return ''
  const lrn = (learner.lrn || '').trim()

  const lastName = (learner.last_name || '').trim().toUpperCase()
  const firstName = (learner.first_name || '').trim()
  const middleName = (learner.middle_name || '').trim()
  const extName = (learner.extension_name || '').trim()
  const fullName = [lastName, firstName, middleName, extName].filter(Boolean).join(' ')
  const formattedFN = `${lastName}${firstName ? `, ${firstName}` : ''}${middleName ? ` ${middleName}` : ''}${extName ? ` ${extName}` : ''}`

  const addressParts = [
    learner.address_house_no,
    learner.address_street,
    learner.address_barangay,
    learner.address_city_municipality,
    learner.address_province
  ].filter(Boolean).join(', ')

  const guardian = (learner.guardian_name || learner.father_name || learner.mother_maiden_name || '').trim()
  const phone = (learner.guardian_contact_no || '').trim()

  const noteDetails = [
    `LRN: ${lrn || 'N/A'}`,
    learner.sex ? `Sex: ${learner.sex}` : '',
    learner.birthdate ? `Birthdate: ${learner.birthdate}` : '',
    learner.age ? `Age: ${learner.age}` : '',
    addressParts ? `Address: ${addressParts}` : '',
    guardian ? `Guardian: ${guardian}` : '',
    learner.grade_level_name ? `Grade: ${learner.grade_level_name}` : '',
    learner.section_name ? `Section: ${learner.section_name}` : ''
  ].filter(Boolean).join(' | ')

  const vcardLines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};${middleName};${extName};`,
    `FN:${formattedFN || fullName || 'DepEd Learner'}`,
    `TITLE:DepEd Learner (LRN: ${lrn || 'N/A'})`,
    `NOTE:${noteDetails}`,
  ]

  if (phone) {
    vcardLines.push(`TEL;TYPE=CELL:${phone}`)
  }

  if (addressParts) {
    vcardLines.push(`ADR;TYPE=HOME:;;${learner.address_street || ''};${learner.address_barangay || ''};${learner.address_city_municipality || ''};${learner.address_province || ''};Philippines`)
  }

  vcardLines.push('END:VCARD')

  return vcardLines.join('\r\n')
}

/**
 * Generates a DepEd Learner QR Code text value containing LRN and personal details.
 */
export function generateLearnerQRCode(
  learnerOrLrn?: string | Partial<Learner> | null,
  id?: string | null,
  schoolId?: string | null
): string {
  if (typeof learnerOrLrn === 'object' && learnerOrLrn !== null) {
    const formatted = formatLearnerQRText(learnerOrLrn)
    if (formatted) return formatted
  }

  const lrn = typeof learnerOrLrn === 'string' ? learnerOrLrn.trim() : ''
  if (lrn) {
    return `LRN: ${lrn}`
  }

  // Fallback token if LRN is not yet assigned
  const uniqueToken = (id || Math.random().toString(36).substring(2, 8)).toUpperCase()
  return `LRN: Pending (${uniqueToken})`
}

/**
 * Returns the plain text QR Code string for a learner, ensuring LRN and personal details
 * are formatted cleanly for camera scanning.
 */
export function getLearnerQRValue(learner?: Partial<Learner> | null): string {
  if (!learner) return ''
  
  // Format clean LRN and personal details text
  const formatted = formatLearnerQRText(learner)
  if (formatted && formatted.trim() !== '') {
    return formatted
  }
  
  const lrn = (learner.lrn || '').trim()
  if (lrn) {
    return `LRN: ${lrn}`
  }
  
  return learner.qr_code || generateLearnerQRCode(learner.lrn, learner.id, learner.school_id)
}

/**
 * Parses and resolves a scanned QR Code or manual barcode input from any camera or reader
 */
export function parseScannedQRCode(scannedText: string): {
  raw: string
  lrn?: string
  id?: string
  isValidDepEdQR: boolean
} {
  const trimmed = (scannedText || '').trim()
  if (!trimmed) {
    return { raw: '', isValidDepEdQR: false }
  }

  // 1. Look for explicit "LRN: <digits>" or "LRN:<digits>" in text
  const lrnMatch = trimmed.match(/LRN\s*:\s*([0-9]{10,12})/i)
  if (lrnMatch && lrnMatch[1]) {
    return { raw: trimmed, lrn: lrnMatch[1].trim(), isValidDepEdQR: true }
  }

  // 2. Look for "DEPED-SC-<payload>"
  if (trimmed.startsWith('DEPED-SC-')) {
    const payload = trimmed.replace('DEPED-SC-', '')
    const digitsOnly = payload.replace(/[^0-9]/g, '')
    if (digitsOnly.length >= 10) {
      return { raw: trimmed, lrn: digitsOnly, isValidDepEdQR: true }
    }
    return { raw: trimmed, lrn: payload, id: payload, isValidDepEdQR: true }
  }

  // 3. Look for direct 12-digit LRN
  const cleanDigits = trimmed.replace(/[^0-9]/g, '')
  if (cleanDigits.length === 12) {
    return { raw: trimmed, lrn: cleanDigits, isValidDepEdQR: true }
  }

  // 4. Any 12 consecutive digits in the text
  const seqMatch = trimmed.match(/\b([0-9]{12})\b/)
  if (seqMatch && seqMatch[1]) {
    return { raw: trimmed, lrn: seqMatch[1], isValidDepEdQR: true }
  }

  // 5. Check JSON payload if structured
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.lrn || parsed.id) {
        return {
          raw: trimmed,
          lrn: parsed.lrn,
          id: parsed.id,
          isValidDepEdQR: true
        }
      }
    } catch {
      // ignore json parse error
    }
  }

  // Fallback string match
  return { raw: trimmed, lrn: trimmed, isValidDepEdQR: false }
}

