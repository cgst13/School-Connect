import type { KeyStage, FormType } from '@/types'

export function getKeyStageFromGrade(gradeNumber: number): KeyStage {
  if (gradeNumber <= 3) return 'ks1'
  if (gradeNumber <= 6) return 'ks2'
  if (gradeNumber <= 10) return 'ks3'
  return 'ks4'
}

export function getFormTypeFromGrade(gradeNumber: number): FormType {
  return gradeNumber <= 3 ? 'ks1' : 'ks2to4'
}

export function getKeyStageLabel(ks: KeyStage): string {
  const labels: Record<KeyStage, string> = {
    ks1: 'Key Stage 1',
    ks2: 'Key Stage 2',
    ks3: 'Key Stage 3',
    ks4: 'Key Stage 4',
  }
  return labels[ks]
}

export function getFormTypeLabel(ft: FormType): string {
  return ft === 'ks1' ? 'Key Stage 1 Form' : 'Key Stages 2–4 Form'
}
