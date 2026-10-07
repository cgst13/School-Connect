import type { GradeLevel } from '@/types'

/**
 * Checks whether a given grade level name, grade number, or text represents Kindergarten
 */
export function isKindergartenGrade(name?: string | null, gradeNumber?: number | null): boolean {
  if (gradeNumber === 0) return true
  if (!name) return false
  const clean = name.toLowerCase().trim()
  if (clean.includes('kinder')) return true
  if (
    clean === 'k' ||
    clean.startsWith('k-') ||
    clean.startsWith('k ') ||
    clean.startsWith('k –') ||
    clean === 'k1' ||
    clean === 'k2' ||
    clean === 'kindergarten' ||
    clean === 'kinder'
  ) {
    return true
  }
  return false
}

/**
 * Robust matcher checking whether a learner or record matches the selected grade level filter
 */
export function isGradeMatch(
  record: {
    grade_level_id?: string | null
    grade_level_name?: string | null
    section_name?: string | null
  },
  selectedGradeId: string | undefined | null,
  gradeLevels: GradeLevel[]
): boolean {
  if (!selectedGradeId || selectedGradeId === 'all') return true

  // 1. Direct ID match
  if (record.grade_level_id && record.grade_level_id === selectedGradeId) return true

  const activeGradeObj = gradeLevels.find(g => g.id === selectedGradeId)
  if (!activeGradeObj) return false

  const targetIsKinder = isKindergartenGrade(activeGradeObj.name, activeGradeObj.grade_number)
  const lGradeName = (record.grade_level_name || '').toLowerCase().trim()
  const lSectionName = (record.section_name || '').toLowerCase().trim()

  if (targetIsKinder) {
    if (isKindergartenGrade(lGradeName)) return true
    if (isKindergartenGrade(lSectionName)) return true

    // Check if record's grade_level_id points to another Kindergarten grade level in gradeLevels
    if (record.grade_level_id) {
      const recGradeObj = gradeLevels.find(g => g.id === record.grade_level_id)
      if (recGradeObj && isKindergartenGrade(recGradeObj.name, recGradeObj.grade_number)) {
        return true
      }
    }
    return false
  }

  // Non-Kindergarten Grade matching
  if (lGradeName) {
    const targetName = (activeGradeObj.name || '').toLowerCase().trim()
    if (lGradeName === targetName || lGradeName.includes(targetName) || targetName.includes(lGradeName)) {
      return true
    }

    if (activeGradeObj.grade_number !== undefined && activeGradeObj.grade_number !== null) {
      const gNum = activeGradeObj.grade_number
      const extractedNum = parseInt(lGradeName.replace(/\D/g, ''), 10)
      if (!isNaN(extractedNum) && extractedNum === gNum) {
        return true
      }
    }
  }

  // Check if record's grade_level_id has matching grade_number
  if (record.grade_level_id) {
    const recGradeObj = gradeLevels.find(g => g.id === record.grade_level_id)
    if (
      recGradeObj &&
      activeGradeObj.grade_number !== undefined &&
      recGradeObj.grade_number === activeGradeObj.grade_number
    ) {
      return true
    }
  }

  return false
}
