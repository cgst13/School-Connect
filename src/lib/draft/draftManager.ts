import type { DraftData, FullSubmissionFormData } from '@/types'

const DRAFT_KEY = 'termcat_draft'
const DRAFT_VERSION = 1

export function saveDraft(step: number, formData: Partial<FullSubmissionFormData>): void {
  try {
    const draft: DraftData = {
      step,
      formData,
      savedAt: new Date().toISOString(),
      version: DRAFT_VERSION,
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // localStorage might be unavailable
  }
}

export function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as DraftData
    if (draft.version !== DRAFT_VERSION) {
      clearDraft()
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // no-op
  }
}

export function hasDraft(): boolean {
  return loadDraft() !== null
}
