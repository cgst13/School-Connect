import { supabase } from './client'

const LOCAL_SUGGESTIONS_KEY = 'termcat_suggestion_history_v1'

export interface SuggestionHistory {
  teachers: string[]
  reasons: string[]
  competencies: string[]
  difficulties: string[]
}

export function getLocalSuggestionHistory(): SuggestionHistory {
  try {
    const raw = localStorage.getItem(LOCAL_SUGGESTIONS_KEY)
    if (!raw) return { teachers: [], reasons: [], competencies: [], difficulties: [] }
    return JSON.parse(raw)
  } catch {
    return { teachers: [], reasons: [], competencies: [], difficulties: [] }
  }
}

export function saveLocalSuggestion(type: keyof SuggestionHistory, text: string) {
  if (!text || text.trim().length < 2) return
  const cleanText = text.trim()
  const history = getLocalSuggestionHistory()
  const list = history[type] || []
  if (!list.includes(cleanText)) {
    const updated = [cleanText, ...list].slice(0, 40)
    history[type] = updated
    localStorage.setItem(LOCAL_SUGGESTIONS_KEY, JSON.stringify(history))
  }
}

export function saveTeacherSchoolMapping(teacherName: string, schoolId: string) {
  if (!teacherName || !schoolId) return
  try {
    const mapRaw = localStorage.getItem('termcat_teacher_school_map')
    const map = mapRaw ? JSON.parse(mapRaw) : {}
    map[teacherName.trim().toLowerCase()] = schoolId
    localStorage.setItem('termcat_teacher_school_map', JSON.stringify(map))
  } catch {
    // Ignore storage error
  }
}

export async function fetchTeacherPreviousSchool(teacherName: string): Promise<string | null> {
  if (!teacherName || teacherName.trim().length < 2) return null
  try {
    const { data } = await supabase
      .from('termcat_submissions')
      .select('school_id')
      .ilike('teacher_name', teacherName.trim())
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.school_id) return data.school_id

    const mapRaw = localStorage.getItem('termcat_teacher_school_map')
    if (mapRaw) {
      const map = JSON.parse(mapRaw)
      return map[teacherName.trim().toLowerCase()] || null
    }

    return null
  } catch {
    return null
  }
}

// Fetch Previous Teacher Names
export async function fetchTeacherNameSuggestions(): Promise<string[]> {
  const local = getLocalSuggestionHistory().teachers
  try {
    const { data } = await supabase
      .from('termcat_submissions')
      .select('teacher_name')
      .order('submitted_at', { ascending: false })
      .limit(50)

    const dbNames = (data || []).map((d: any) => d.teacher_name).filter(Boolean)
    const combined = Array.from(new Set([...dbNames, ...local]))
    return combined.slice(0, 25)
  } catch {
    return Array.from(new Set(local)).slice(0, 25)
  }
}

// Fetch Previous Untaught Reasons
export async function fetchUntaughtReasonsSuggestions(): Promise<string[]> {
  const local = getLocalSuggestionHistory().reasons
  try {
    const { data } = await supabase
      .from('termcat_competency_summaries')
      .select('reasons_for_untaught')
      .neq('reasons_for_untaught', '')
      .limit(50)

    const dbReasons = (data || []).map((d: any) => d.reasons_for_untaught).filter(Boolean)
    const combined = Array.from(new Set([...dbReasons, ...local]))
    return combined.slice(0, 25)
  } catch {
    return Array.from(new Set(local)).slice(0, 25)
  }
}

// Fetch Previous Competency Descriptions from consolidated competencies table
export async function fetchCompetencySuggestions(category?: string): Promise<string[]> {
  const local = getLocalSuggestionHistory().competencies
  try {
    let query = supabase
      .from('termcat_submission_competencies')
      .select('competency_text')
      .neq('competency_text', '')
      .order('id', { ascending: false })
      .limit(1000)

    if (category) query = query.eq('category', category)

    const { data } = await query
    const dbComps = (data || []).map((d: any) => d.competency_text).filter(Boolean)
    const combined = Array.from(new Set([...dbComps, ...local]))
    return combined
  } catch {
    return Array.from(new Set(local))
  }
}

// Fetch Previous Instructional Difficulty Factors
export async function fetchDifficultyFactorsSuggestions(): Promise<string[]> {
  const local = getLocalSuggestionHistory().difficulties
  try {
    const { data } = await supabase
      .from('termcat_instructional_difficulties')
      .select('factors_text')
      .neq('factors_text', '')
      .limit(50)

    const dbDiffs = (data || []).map((d: any) => d.factors_text).filter(Boolean)
    const combined = Array.from(new Set([...dbDiffs, ...local]))
    return combined.slice(0, 25)
  } catch {
    return Array.from(new Set(local)).slice(0, 25)
  }
}
