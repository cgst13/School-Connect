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

// Fetch Teacher Name Suggestions from Faculty & Staff directory and Submissions
export async function fetchTeacherNameSuggestions(schoolId?: string): Promise<string[]> {
  try {
    const namesSet = new Set<string>()

    // 1. Fetch Teachers from Faculty and Staff Directory (sc_admin_profiles / termcat_admin_profiles)
    let { data: staffData, error: staffError } = await supabase
      .from('sc_admin_profiles')
      .select('full_name, assigned_school_ids, role')
      .eq('role', 'teacher')
      .order('full_name')

    if (staffError) {
      const res = await supabase
        .from('termcat_admin_profiles')
        .select('full_name, assigned_school_ids, role')
        .eq('role', 'teacher')
        .order('full_name')
      staffData = res.data
    }

    if (staffData && staffData.length > 0) {
      // If schoolId provided, prioritize teachers assigned to that school
      const schoolTeachers = schoolId
        ? staffData.filter((s: any) => s.assigned_school_ids && s.assigned_school_ids.includes(schoolId))
        : staffData

      schoolTeachers.forEach((s: any) => {
        if (s.full_name && s.full_name.trim()) {
          namesSet.add(s.full_name.trim())
        }
      })

      // Add all remaining teachers from directory
      staffData.forEach((s: any) => {
        if (s.full_name && s.full_name.trim()) {
          namesSet.add(s.full_name.trim())
        }
      })
    }

    // 2. Fetch Historical Submissions Teacher Names
    let subQuery = supabase
      .from('termcat_submissions')
      .select('teacher_name, school_id')
      .order('submitted_at', { ascending: false })
      .limit(100)

    if (schoolId) subQuery = subQuery.eq('school_id', schoolId)

    const { data: subData } = await subQuery
    if (subData) {
      subData.forEach((d: any) => {
        if (d.teacher_name && d.teacher_name.trim()) {
          namesSet.add(d.teacher_name.trim())
        }
      })
    }

    // If schoolId was passed but namesSet is still small, also load general submission teacher names
    if (schoolId && namesSet.size < 10) {
      const { data: allSubData } = await supabase
        .from('termcat_submissions')
        .select('teacher_name')
        .order('submitted_at', { ascending: false })
        .limit(50)
      if (allSubData) {
        allSubData.forEach((d: any) => {
          if (d.teacher_name && d.teacher_name.trim()) {
            namesSet.add(d.teacher_name.trim())
          }
        })
      }
    }

    return Array.from(namesSet).slice(0, 30)
  } catch (err) {
    console.error('Error fetching teacher suggestions:', err)
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
