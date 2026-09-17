import { supabase } from './client'

export interface SuggestionHistory {
  teachers: string[]
  reasons: string[]
  competencies: string[]
  difficulties: string[]
}

// Retained for API compatibility, local storage writes removed
export function saveLocalSuggestion(_type: keyof SuggestionHistory, _text: string) {
  // No-op: Data is saved directly in Supabase on submission create
}

export function saveTeacherSchoolMapping(_teacherName: string, _schoolId: string) {
  // No-op: Teacher to school mapping is retrieved directly from Supabase submissions history
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

    return data?.school_id || null
  } catch {
    return null
  }
}

// Fetch Previous Teacher Names directly from Supabase
export async function fetchTeacherNameSuggestions(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('termcat_submissions')
      .select('teacher_name')
      .order('submitted_at', { ascending: false })
      .limit(50)

    const dbNames = (data || []).map((d: any) => d.teacher_name).filter(Boolean)
    return Array.from(new Set(dbNames)).slice(0, 25)
  } catch {
    return []
  }
}

// Fetch Previous Untaught Reasons directly from Supabase
export async function fetchUntaughtReasonsSuggestions(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('termcat_competency_summary')
      .select('reasons_for_untaught')
      .neq('reasons_for_untaught', '')
      .limit(50)

    const dbReasons = (data || []).map((d: any) => d.reasons_for_untaught).filter(Boolean)
    return Array.from(new Set(dbReasons)).slice(0, 25)
  } catch {
    return []
  }
}

// Fetch Previous Competency Descriptions directly from Supabase
export async function fetchCompetencySuggestions(category?: string): Promise<string[]> {
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
    return Array.from(new Set(dbComps))
  } catch {
    return []
  }
}

// Fetch Previous Instructional Difficulty Factors directly from Supabase
export async function fetchDifficultyFactorsSuggestions(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('termcat_instructional_difficulty')
      .select('factors_text')
      .neq('factors_text', '')
      .limit(50)

    const dbDiffs = (data || []).map((d: any) => d.factors_text).filter(Boolean)
    return Array.from(new Set(dbDiffs)).slice(0, 25)
  } catch {
    return []
  }
}
