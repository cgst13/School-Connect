import type { Learner } from '@/types'

export interface DetailedChangeLog {
  lrn: string
  name: string
  action: 'created' | 'updated' | 'error'
  changes: string[]
  errorReason?: string
}

export interface ImportResultSummary {
  totalProcessed: number
  createdCount: number
  updatedCount: number
  errorCount: number
  logs: DetailedChangeLog[]
  schoolName: string
  schoolId?: string
  schoolYear?: string
  gradeLevelName?: string
  sectionName?: string
  fileName?: string
}

/**
 * Compares an existing learner with the incoming payload to detect specific changes made.
 */
export function getLearnerDiff(existing: Learner, incoming: Partial<Learner>): string[] {
  const changes: string[] = []

  if (incoming.school_name && existing.school_name && incoming.school_name.toLowerCase() !== existing.school_name.toLowerCase()) {
    changes.push(`School: "${existing.school_name}" ➔ "${incoming.school_name}"`)
  }

  if (incoming.grade_level_name && existing.grade_level_name && incoming.grade_level_name.toLowerCase() !== existing.grade_level_name.toLowerCase()) {
    changes.push(`Grade Level: "${existing.grade_level_name}" ➔ "${incoming.grade_level_name}"`)
  }

  if (incoming.section_name && existing.section_name && incoming.section_name.toLowerCase() !== existing.section_name.toLowerCase()) {
    changes.push(`Section: "${existing.section_name}" ➔ "${incoming.section_name}"`)
  }

  if (incoming.status && existing.status && incoming.status !== existing.status) {
    changes.push(`Status: "${existing.status.replace('_', ' ')}" ➔ "${incoming.status.replace('_', ' ')}"`)
  }

  if (incoming.birthdate && existing.birthdate && incoming.birthdate !== existing.birthdate) {
    changes.push(`Birthdate: "${existing.birthdate}" ➔ "${incoming.birthdate}"`)
  }

  if (incoming.guardian_name && incoming.guardian_name !== existing.guardian_name) {
    changes.push(`Guardian: "${existing.guardian_name || 'None'}" ➔ "${incoming.guardian_name}"`)
  }

  if (incoming.address_barangay && incoming.address_barangay !== existing.address_barangay) {
    changes.push(`Barangay: "${existing.address_barangay || 'None'}" ➔ "${incoming.address_barangay}"`)
  }

  if (incoming.remarks && incoming.remarks !== existing.remarks) {
    changes.push(`Remarks: "${existing.remarks || 'None'}" ➔ "${incoming.remarks}"`)
  }

  if (incoming.is_4ps_cct !== undefined && incoming.is_4ps_cct !== existing.is_4ps_cct) {
    changes.push(`4Ps / CCT Status: ${existing.is_4ps_cct ? 'Yes' : 'No'} ➔ ${incoming.is_4ps_cct ? 'Yes' : 'No'}`)
  }

  if (changes.length === 0) {
    changes.push('Re-verified existing learner record (no field changes)')
  }

  return changes
}
