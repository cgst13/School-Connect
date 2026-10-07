/**
 * Official DepEd Grading System Calculator & Weight Configuration (DO 8, s. 2015 / MATATAG Curriculum)
 */

export interface SubjectWeightConfig {
  writtenWorks: number // percentage e.g. 30
  performanceTasks: number // percentage e.g. 50
  quarterlyAssessment: number // percentage e.g. 20
}

export const DEPED_DEFAULT_WEIGHTS: Record<string, SubjectWeightConfig> = {
  // Languages (English, Filipino, Mother Tongue), Araling Panlipunan (AP), Edukasyon sa Pagpapakatao (EsP)
  languages_ap_esp: { writtenWorks: 30, performanceTasks: 50, quarterlyAssessment: 20 },
  // Science, Mathematics
  science_math: { writtenWorks: 40, performanceTasks: 40, quarterlyAssessment: 20 },
  // MAPEH (Music, Arts, PE, Health), EPP / TLE
  mapeh_epp_tle: { writtenWorks: 20, performanceTasks: 60, quarterlyAssessment: 20 },
  // Default general fallback
  default: { writtenWorks: 30, performanceTasks: 50, quarterlyAssessment: 20 }
}

/**
 * Resolves standard DepEd weight profile based on learning area / subject name
 */
export function getSubjectWeightProfile(subjectName: string): SubjectWeightConfig {
  const s = (subjectName || '').toLowerCase()
  if (s.includes('math') || s.includes('science')) {
    return DEPED_DEFAULT_WEIGHTS.science_math
  }
  if (s.includes('mapeh') || s.includes('music') || s.includes('art') || s.includes('pe') || s.includes('physical') || s.includes('health') || s.includes('epp') || s.includes('tle')) {
    return DEPED_DEFAULT_WEIGHTS.mapeh_epp_tle
  }
  return DEPED_DEFAULT_WEIGHTS.languages_ap_esp
}

/**
 * Official DepEd Transmutation Table (DO 8, s. 2015)
 * Converts Initial Grade (0 - 100) to Transmuted Quarterly Grade (60 - 100)
 */
export function transmuteInitialGrade(initialGrade: number): number {
  const ig = Math.round(initialGrade * 100) / 100

  if (ig === 100) return 100
  if (ig >= 98.40) return 99
  if (ig >= 96.80) return 98
  if (ig >= 95.20) return 97
  if (ig >= 93.60) return 96
  if (ig >= 92.00) return 95
  if (ig >= 90.40) return 94
  if (ig >= 88.80) return 93
  if (ig >= 87.20) return 92
  if (ig >= 85.60) return 91
  if (ig >= 84.00) return 90
  if (ig >= 82.40) return 89
  if (ig >= 80.80) return 88
  if (ig >= 79.20) return 87
  if (ig >= 77.60) return 86
  if (ig >= 76.00) return 85
  if (ig >= 74.40) return 84
  if (ig >= 72.80) return 83
  if (ig >= 71.20) return 82
  if (ig >= 69.60) return 81
  if (ig >= 68.00) return 80
  if (ig >= 66.40) return 79
  if (ig >= 64.80) return 78
  if (ig >= 63.20) return 77
  if (ig >= 61.60) return 76
  if (ig >= 60.00) return 75
  if (ig >= 56.00) return 74
  if (ig >= 52.00) return 73
  if (ig >= 48.00) return 72
  if (ig >= 44.00) return 71
  if (ig >= 40.00) return 70
  if (ig >= 36.00) return 69
  if (ig >= 32.00) return 68
  if (ig >= 28.00) return 67
  if (ig >= 24.00) return 66
  if (ig >= 20.00) return 65
  if (ig >= 16.00) return 64
  if (ig >= 12.00) return 63
  if (ig >= 8.00) return 62
  if (ig >= 4.00) return 61
  return 60
}

/**
 * Resolves DepEd Descriptor / Level of Proficiency
 */
export function getDepEdProficiencyLevel(finalRating: number): {
  descriptor: string
  gradingScale: string
  remarks: 'Passed' | 'Failed'
} {
  if (finalRating >= 90) {
    return { descriptor: 'Outstanding', gradingScale: '90 - 100', remarks: 'Passed' }
  }
  if (finalRating >= 85) {
    return { descriptor: 'Very Satisfactory', gradingScale: '85 - 89', remarks: 'Passed' }
  }
  if (finalRating >= 80) {
    return { descriptor: 'Satisfactory', gradingScale: '80 - 84', remarks: 'Passed' }
  }
  if (finalRating >= 75) {
    return { descriptor: 'Fairly Satisfactory', gradingScale: '75 - 79', remarks: 'Passed' }
  }
  return { descriptor: 'Did Not Meet Expectations', gradingScale: 'Below 75', remarks: 'Failed' }
}
