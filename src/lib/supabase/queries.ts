import { supabase } from './client'
import type {
  School,
  GradeLevel,
  LearningArea,
  LearningAreaGrade,
  SchoolYear,
  Term,
  Section,
  LearningCompetency,
  TermcatSubmission,
  FullSubmissionFormData,
  SubmissionFilters,
  AdminProfile,
  AuditLog,
  ConsolidationFilters,
  Learner,
  LearnerStatus,
  LearnerSex,
  LearnerAttendanceRecord,
  LearnerFilters,
  ClassRecord,
  LearnerGrade,
  SubjectGradeRecord,
} from '@/types'
import { generateLearnerQRCode, formatLearnerQRText } from '@/utils/qrCodeGenerator'

// ============================================================
// MASTER DATA QUERIES (Global School Connect Tables: sc_*)
// ============================================================


// ============================================================
// TERMCAT SUBMISSIONS (TermCat Specific Tables: termcat_*)
// ============================================================

export async function checkDuplicateSubmission(
  teacherName: string,
  schoolId: string,
  gradeLevelId: string,
  learningAreaId: string,
  schoolYearId: string,
  termId: string
): Promise<Pick<TermcatSubmission, 'id' | 'reference_number' | 'status' | 'teacher_name'> | null> {
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select('id, reference_number, status, teacher_name')
    .ilike('teacher_name', teacherName.trim())
    .eq('school_id', schoolId)
    .eq('grade_level_id', gradeLevelId)
    .eq('learning_area_id', learningAreaId)
    .eq('school_year_id', schoolYearId)
    .eq('term_id', termId)
    .neq('status', 'returned')
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function generateReferenceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('termcat_generate_reference_number')
  if (error) throw error
  return data as string
}

export async function createSubmission(
  formData: FullSubmissionFormData,
  referenceNumber: string
): Promise<TermcatSubmission> {
  const { teacherInfo, ks1LearnerData, ks2to4LearnerData, competencySummary, topCompetencies, instructionalDifficulty } = formData

  // Get grade from sc_grade_levels to determine key_stage and form_type
  const { data: grade, error: gradeError } = await supabase
    .from('sc_grade_levels')
    .select('key_stage, grade_number')
    .eq('id', teacherInfo.grade_level_id)
    .single()
  if (gradeError) throw gradeError

  const formType: 'ks1' | 'ks2to4' = grade.grade_number <= 3 ? 'ks1' : 'ks2to4'

  // 1. Insert main submission
  const { data: submission, error: subError } = await supabase
    .from('termcat_submissions')
    .insert({
      reference_number: referenceNumber,
      teacher_name: teacherInfo.teacher_name.trim(),
      school_id: teacherInfo.school_id,
      grade_level_id: teacherInfo.grade_level_id,
      learning_area_id: teacherInfo.learning_area_id,
      school_year_id: teacherInfo.school_year_id,
      term_id: teacherInfo.term_id,
      key_stage: grade.key_stage,
      form_type: formType,
      status: 'submitted',
    })
    .select()
    .single()
  if (subError) throw subError

  const submissionId = submission.id

  // 2. Insert learner data
  if (formType === 'ks1' && ks1LearnerData) {
    const { error } = await supabase.from('termcat_ks1_learner_data').insert({ ...ks1LearnerData, submission_id: submissionId })
    if (error) throw error
  } else if (formType === 'ks2to4' && ks2to4LearnerData) {
    const { error } = await supabase.from('termcat_ks2to4_learner_data').insert({ ...ks2to4LearnerData, submission_id: submissionId })
    if (error) throw error
  }

  // 3. Insert competency summary (sanitized & explicitly converted to numbers to enforce constraint: taught + notTaught <= intended)
  const csTaught = Math.max(0, Number(competencySummary.competencies_taught) || 0)
  const csNotTaught = Math.max(0, Number(competencySummary.competencies_not_taught) || 0)
  const csIntendedRaw = Math.max(0, Number(competencySummary.total_intended_competencies) || 0)
  const csIntended = Math.max(csIntendedRaw, csTaught + csNotTaught)
  const safeNotTaught = Math.min(csNotTaught, Math.max(0, csIntended - csTaught))

  const { error: csError } = await supabase.from('termcat_competency_summary').insert({
    ...competencySummary,
    total_intended_competencies: csIntended,
    competencies_taught: csTaught,
    competencies_not_taught: safeNotTaught,
    submission_id: submissionId,
  })
  if (csError) throw csError

  // 4. Insert top competencies
  const competencyInserts = [
    ...topCompetencies.most_learned.map((text, i) => ({
      submission_id: submissionId,
      category: 'most_learned' as const,
      rank: i + 1,
      competency_text: text,
    })),
    ...topCompetencies.least_mastered.map((text, i) => ({
      submission_id: submissionId,
      category: 'least_mastered' as const,
      rank: i + 1,
      competency_text: text,
    })),
    ...topCompetencies.most_difficult_to_teach.map((text, i) => ({
      submission_id: submissionId,
      category: 'most_difficult_to_teach' as const,
      rank: i + 1,
      competency_text: text,
    })),
  ].filter(c => c.competency_text.trim())

  if (competencyInserts.length > 0) {
    const { error: compError } = await supabase.from('termcat_submission_competencies').insert(competencyInserts)
    if (compError) throw compError
  }

  // 5. Insert instructional difficulty
  if (instructionalDifficulty.factors_text.trim()) {
    const { error: idError } = await supabase.from('termcat_instructional_difficulty').insert({
      ...instructionalDifficulty,
      submission_id: submissionId,
    })
    if (idError) throw idError
  }

  return submission as TermcatSubmission
}

export async function fetchSubmissionByReference(refNumber: string): Promise<TermcatSubmission | null> {
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(*),
      grade_level:sc_grade_levels(*),
      learning_area:sc_learning_areas(*),
      school_year:sc_school_years(*),
      term:sc_terms(*),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*),
      competency_summary:termcat_competency_summary(*),
      submission_competencies:termcat_submission_competencies(*),
      instructional_difficulty:termcat_instructional_difficulty(*)
    `)
    .eq('reference_number', refNumber)
    .single()
  if (error) return null
  return data as TermcatSubmission
}

export async function checkExistingSubjectSubmission(
  schoolId: string,
  gradeLevelId: string,
  learningAreaId: string,
  schoolYearId: string,
  termId: string
): Promise<TermcatSubmission | null> {
  if (!schoolId || !gradeLevelId || !learningAreaId || !schoolYearId || !termId) return null
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(id, name),
      grade_level:sc_grade_levels(id, name),
      learning_area:sc_learning_areas(id, name),
      term:sc_terms(id, name)
    `)
    .eq('school_id', schoolId)
    .eq('grade_level_id', gradeLevelId)
    .eq('learning_area_id', learningAreaId)
    .eq('school_year_id', schoolYearId)
    .eq('term_id', termId)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data as TermcatSubmission
}

// ============================================================
// ADMIN — SUBMISSIONS & DISCOVERY
// ============================================================

export async function fetchSubmissions(filters: Partial<SubmissionFilters> = {}): Promise<{
  data: TermcatSubmission[]
  count: number
}> {
  const {
    search,
    teacher_name,
    school_year_id,
    term_id,
    school_id,
    school_type,
    grade_level_id,
    learning_area_id,
    status,
    key_stage,
    date_from,
    date_to,
    page = 1,
    page_size = 20,
    sort_by = 'submitted_at',
    sort_dir = 'desc',
  } = filters

  let query = supabase
    .from('termcat_submissions')
    .select(
      `
      *,
      school:sc_schools(id, name, school_type),
      grade_level:sc_grade_levels(id, name, grade_number),
      learning_area:sc_learning_areas(id, name),
      school_year:sc_school_years(id, name),
      term:sc_terms(id, name),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*)
    `,
      { count: 'exact' }
    )

  if (search) query = query.ilike('teacher_name', `%${search}%`)
  if (teacher_name) query = query.ilike('teacher_name', `%${teacher_name}%`)
  if (school_year_id) query = query.eq('school_year_id', school_year_id)
  if (term_id) query = query.eq('term_id', term_id)
  if (school_id) {
    query = query.eq('school_id', school_id)
  } else if (filters.school_ids && filters.school_ids.length > 0) {
    query = query.in('school_id', filters.school_ids)
  }
  if (grade_level_id) query = query.eq('grade_level_id', grade_level_id)
  if (learning_area_id) query = query.eq('learning_area_id', learning_area_id)
  if (status) query = query.eq('status', status)
  if (key_stage) query = query.eq('key_stage', key_stage)
  if (date_from) query = query.gte('submitted_at', date_from)
  if (date_to) query = query.lte('submitted_at', date_to + 'T23:59:59')

  // School type filter via sc_grade_levels join
  if (school_type) {
    const { data: grades } = await supabase
      .from('sc_grade_levels')
      .select('id')
      .eq('school_type', school_type)
    if (grades && grades.length > 0) {
      query = query.in('grade_level_id', grades.map(g => g.id))
    }
  }

  const from = (page - 1) * (page_size || 20)
  const to = from + (page_size || 20) - 1

  query = query.order(sort_by, { ascending: sort_dir === 'asc' }).range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return { data: (data || []) as TermcatSubmission[], count: count || 0 }
}

export async function fetchSubmitterTeacherNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select('teacher_name')
    .not('teacher_name', 'is', null)

  if (error || !data) return []
  const names = new Set<string>()
  data.forEach(item => {
    if (item.teacher_name && item.teacher_name.trim()) {
      names.add(item.teacher_name.trim())
    }
  })
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

export async function fetchSubmissionById(id: string): Promise<TermcatSubmission | null> {
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(*),
      grade_level:sc_grade_levels(*),
      learning_area:sc_learning_areas(*),
      school_year:sc_school_years(*),
      term:sc_terms(*),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*),
      competency_summary:termcat_competency_summary(*),
      submission_competencies:termcat_submission_competencies(*),
      instructional_difficulty:termcat_instructional_difficulty(*)
    `)
    .eq('id', id)
    .single()
  if (error) return null
  return data as TermcatSubmission
}

export async function updateSubmissionStatus(
  id: string,
  status: 'reviewed' | 'returned' | 'finalized',
  adminId: string,
  returnReason?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === 'reviewed') {
    updates.reviewed_at = new Date().toISOString()
    updates.reviewed_by = adminId
  } else if (status === 'returned') {
    updates.returned_at = new Date().toISOString()
    updates.returned_by = adminId
    updates.return_reason = returnReason || ''
  } else if (status === 'finalized') {
    updates.finalized_at = new Date().toISOString()
    updates.finalized_by = adminId
    updates.is_locked = true
  }
  const { error } = await supabase.from('termcat_submissions').update(updates).eq('id', id)
  if (error) throw error
}

export async function unlockSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('termcat_submissions').update({ is_locked: false }).eq('id', id)
  if (error) throw error
}

export async function fetchSubmissionsByTeacher(teacherName: string): Promise<TermcatSubmission[]> {
  if (!teacherName || !teacherName.trim()) return []
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(*),
      grade_level:sc_grade_levels(*),
      learning_area:sc_learning_areas(*),
      school_year:sc_school_years(*),
      term:sc_terms(*),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*),
      competency_summary:termcat_competency_summary(*),
      submission_competencies:termcat_submission_competencies(*),
      instructional_difficulty:termcat_instructional_difficulty(*)
    `)
    .ilike('teacher_name', teacherName.trim())
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchSubmissionsBySchool(schoolId: string): Promise<TermcatSubmission[]> {
  if (!schoolId || !schoolId.trim()) return []
  const { data, error } = await supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(*),
      grade_level:sc_grade_levels(*),
      learning_area:sc_learning_areas(*),
      school_year:sc_school_years(*),
      term:sc_terms(*),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*),
      competency_summary:termcat_competency_summary(*),
      submission_competencies:termcat_submission_competencies(*),
      instructional_difficulty:termcat_instructional_difficulty(*)
    `)
    .eq('school_id', schoolId.trim())
    .order('submitted_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('termcat_submissions').delete().eq('id', id)
  if (error) throw error
}

export async function updateSubmissionData(
  submissionId: string,
  formData: FullSubmissionFormData,
  adminId: string
): Promise<void> {
  const { teacherInfo, ks1LearnerData, ks2to4LearnerData, competencySummary, topCompetencies, instructionalDifficulty } = formData

  // Determine form_type from grade_level_id
  let formType: 'ks1' | 'ks2to4' = 'ks2to4'
  if (teacherInfo.grade_level_id) {
    let { data: gl, error: glErr } = await supabase
      .from('sc_grade_levels')
      .select('grade_number')
      .eq('id', teacherInfo.grade_level_id)
      .maybeSingle()
    if (glErr || !gl) {
      const res = await supabase
        .from('termcat_grade_levels')
        .select('grade_number')
        .eq('id', teacherInfo.grade_level_id)
        .maybeSingle()
      gl = res.data
    }
    if (gl && typeof gl.grade_number === 'number' && gl.grade_number <= 3) {
      formType = 'ks1'
    }
  }

  // Update main submission record
  const { error: mainError } = await supabase
    .from('termcat_submissions')
    .update({
      teacher_name: teacherInfo.teacher_name.trim(),
      school_id: teacherInfo.school_id,
      grade_level_id: teacherInfo.grade_level_id,
      learning_area_id: teacherInfo.learning_area_id,
      school_year_id: teacherInfo.school_year_id,
      term_id: teacherInfo.term_id,
      form_type: formType,
      last_edited_by: adminId,
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
  if (mainError) throw mainError

  // Upsert learner data based on formType
  if (formType === 'ks1' && ks1LearnerData) {
    const { error } = await supabase
      .from('termcat_ks1_learner_data')
      .upsert({ ...ks1LearnerData, submission_id: submissionId }, { onConflict: 'submission_id' })
    if (error) throw error
    // Delete any stale ks2to4 data if form_type changed
    await supabase.from('termcat_ks2to4_learner_data').delete().eq('submission_id', submissionId)
  } else if (formType === 'ks2to4' && ks2to4LearnerData) {
    const { error } = await supabase
      .from('termcat_ks2to4_learner_data')
      .upsert({ ...ks2to4LearnerData, submission_id: submissionId }, { onConflict: 'submission_id' })
    if (error) throw error
    // Delete any stale ks1 data if form_type changed
    await supabase.from('termcat_ks1_learner_data').delete().eq('submission_id', submissionId)
  }

  // Upsert competency summary (sanitized & explicitly converted to numbers to enforce constraint: taught + notTaught <= intended)
  const csTaught = Math.max(0, Number(competencySummary.competencies_taught) || 0)
  const csNotTaught = Math.max(0, Number(competencySummary.competencies_not_taught) || 0)
  const csIntendedRaw = Math.max(0, Number(competencySummary.total_intended_competencies) || 0)
  const csIntended = Math.max(csIntendedRaw, csTaught + csNotTaught)
  const safeNotTaught = Math.min(csNotTaught, Math.max(0, csIntended - csTaught))

  const { error: csError } = await supabase
    .from('termcat_competency_summary')
    .upsert({
      ...competencySummary,
      total_intended_competencies: csIntended,
      competencies_taught: csTaught,
      competencies_not_taught: safeNotTaught,
      submission_id: submissionId
    }, { onConflict: 'submission_id' })
  if (csError) throw csError

  // Delete and re-insert competencies
  await supabase.from('termcat_submission_competencies').delete().eq('submission_id', submissionId)
  const competencyInserts = [
    ...topCompetencies.most_learned.map((text, i) => ({
      submission_id: submissionId,
      category: 'most_learned' as const,
      rank: i + 1,
      competency_text: text,
    })),
    ...topCompetencies.least_mastered.map((text, i) => ({
      submission_id: submissionId,
      category: 'least_mastered' as const,
      rank: i + 1,
      competency_text: text,
    })),
    ...topCompetencies.most_difficult_to_teach.map((text, i) => ({
      submission_id: submissionId,
      category: 'most_difficult_to_teach' as const,
      rank: i + 1,
      competency_text: text,
    })),
  ].filter(c => c.competency_text.trim())
  if (competencyInserts.length > 0) {
    const { error } = await supabase.from('termcat_submission_competencies').insert(competencyInserts)
    if (error) throw error
  }

  // Upsert instructional difficulty
  if (instructionalDifficulty && instructionalDifficulty.factors_text?.trim()) {
    await supabase
      .from('termcat_instructional_difficulty')
      .upsert({ ...instructionalDifficulty, submission_id: submissionId }, { onConflict: 'submission_id' })
  }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function fetchDashboardStats(filters: {
  school_year_id?: string
  term_id?: string
  school_id?: string
  school_ids?: string[]
  key_stage?: string
  grade_level_id?: string
  learning_area_id?: string
} = {}): Promise<{
  total: number
  submitted: number
  reviewed: number
  returned: number
  finalized: number
  schools: number
  teachers: number
}> {
  let query = supabase.from('termcat_submissions').select('status, teacher_name, school_id', { count: 'exact' })
  if (filters.school_year_id) query = query.eq('school_year_id', filters.school_year_id)
  if (filters.term_id) query = query.eq('term_id', filters.term_id)
  if (filters.school_id) {
    query = query.eq('school_id', filters.school_id)
  } else if (filters.school_ids && filters.school_ids.length > 0) {
    query = query.in('school_id', filters.school_ids)
  }
  if (filters.key_stage) query = query.eq('key_stage', filters.key_stage)
  if (filters.grade_level_id) query = query.eq('grade_level_id', filters.grade_level_id)
  if (filters.learning_area_id) query = query.eq('learning_area_id', filters.learning_area_id)

  const { data, count } = await query
  const submissions = data || []

  const uniqueSchools = new Set(submissions.map(s => s.school_id)).size
  const uniqueTeachers = new Set(submissions.map(s => s.teacher_name.toLowerCase())).size

  return {
    total: count || 0,
    submitted: submissions.filter(s => s.status === 'submitted').length,
    reviewed: submissions.filter(s => s.status === 'reviewed').length,
    returned: submissions.filter(s => s.status === 'returned').length,
    finalized: submissions.filter(s => s.status === 'finalized').length,
    schools: uniqueSchools,
    teachers: uniqueTeachers,
  }
}

// ============================================================
// CONSOLIDATION
// ============================================================

export async function fetchConsolidationData(filters: ConsolidationFilters): Promise<TermcatSubmission[]> {
  let query = supabase
    .from('termcat_submissions')
    .select(`
      *,
      school:sc_schools(*),
      grade_level:sc_grade_levels(*),
      learning_area:sc_learning_areas(*),
      school_year:sc_school_years(*),
      term:sc_terms(*),
      ks1_learner_data:termcat_ks1_learner_data(*),
      ks2to4_learner_data:termcat_ks2to4_learner_data(*),
      competency_summary:termcat_competency_summary(*),
      submission_competencies:termcat_submission_competencies(*),
      instructional_difficulty:termcat_instructional_difficulty(*)
    `)
    .eq('school_year_id', filters.school_year_id)
    .eq('term_id', filters.term_id)
    .in('status', filters.statuses)

  if (filters.school_id !== 'all') {
    query = query.eq('school_id', filters.school_id)
  } else if ((filters as any).school_ids && (filters as any).school_ids.length > 0) {
    query = query.in('school_id', (filters as any).school_ids)
  }
  if (filters.grade_level_id !== 'all') query = query.eq('grade_level_id', filters.grade_level_id)
  if (filters.learning_area_id !== 'all') query = query.eq('learning_area_id', filters.learning_area_id)
  if (filters.key_stage !== 'all') query = query.eq('key_stage', filters.key_stage)

  const { data, error } = await query
  if (error) throw error
  return (data || []) as TermcatSubmission[]
}

const SAVED_REPORTS_LOCAL_KEY = 'termcat_saved_reports_v1'

export async function saveConsolidatedReport(reportPayload: {
  title: string
  school_year_id: string
  term_id: string
  level_type: string
  grade_level_id?: string | null
  learning_area_id?: string | null
  total_schools_included: number
  total_submissions_count: number
  total_learners_count: number
  average_mps?: number | null
  consolidated_data: Record<string, any>
  created_by?: string | null
  created_by_name?: string | null
}) {
  const payload = {
    title: reportPayload.title,
    school_year_id: reportPayload.school_year_id,
    term_id: reportPayload.term_id,
    level_type: reportPayload.level_type,
    grade_level_id: reportPayload.grade_level_id === 'all' ? null : reportPayload.grade_level_id,
    learning_area_id: reportPayload.learning_area_id === 'all' ? null : reportPayload.learning_area_id,
    total_schools_included: reportPayload.total_schools_included,
    total_submissions_count: reportPayload.total_submissions_count,
    total_learners_count: reportPayload.total_learners_count,
    average_mps: reportPayload.average_mps,
    consolidated_data: reportPayload.consolidated_data,
    created_by: reportPayload.created_by,
    created_by_name: reportPayload.created_by_name,
  }

  let savedItem: any = null

  try {
    const { data, error } = await supabase
      .from('termcat_consolidated_reports')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      savedItem = data
    } else {
      console.warn('Supabase table missing, storing in local fallback storage:', error?.message)
    }
  } catch (err) {
    console.warn('Failed to insert into Supabase table, saving to local fallback:', err)
  }

  // Fallback storage if Supabase table does not exist yet
  if (!savedItem) {
    savedItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `rep-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
    }
    try {
      const existing = JSON.parse(localStorage.getItem(SAVED_REPORTS_LOCAL_KEY) || '[]')
      const updated = [savedItem, ...existing.filter((x: any) => x.id !== savedItem.id)]
      localStorage.setItem(SAVED_REPORTS_LOCAL_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn('LocalStorage save failed:', e)
    }
  }

  // Always record audit log as well
  try {
    await insertAuditLog({
      admin_id: reportPayload.created_by || null,
      admin_name: reportPayload.created_by_name || 'System Admin',
      action: 'save_consolidated_report',
      entity_type: 'consolidated_report',
      entity_id: savedItem?.id || null,
      entity_label: reportPayload.title,
      details: {
        total_schools: reportPayload.total_schools_included,
        total_submissions: reportPayload.total_submissions_count,
        total_learners: reportPayload.total_learners_count,
        average_mps: reportPayload.average_mps,
      }
    })
  } catch {}

  return savedItem
}

export async function fetchConsolidatedReports() {
  let dbReports: any[] = []
  try {
    const { data, error } = await supabase
      .from('termcat_consolidated_reports')
      .select(`
        *,
        school_year:sc_school_years(*),
        term:sc_terms(*),
        grade_level:sc_grade_levels(*),
        learning_area:sc_learning_areas(*)
      `)
      .order('created_at', { ascending: false })

    if (!error && data) {
      dbReports = data
    } else {
      console.warn('Using local fallback for consolidated reports:', error?.message)
    }
  } catch (e) {
    console.warn('Could not fetch from Supabase, loading local fallback:', e)
  }

  // Read local fallback reports
  let localReports: any[] = []
  try {
    localReports = JSON.parse(localStorage.getItem(SAVED_REPORTS_LOCAL_KEY) || '[]')
  } catch {}

  if (dbReports.length > 0) return dbReports

  return localReports
}

export async function deleteConsolidatedReport(id: string) {
  try {
    await supabase
      .from('termcat_consolidated_reports')
      .delete()
      .eq('id', id)
  } catch {}

  // Delete from local storage fallback
  try {
    const existing = JSON.parse(localStorage.getItem(SAVED_REPORTS_LOCAL_KEY) || '[]')
    const updated = existing.filter((x: any) => x.id !== id)
    localStorage.setItem(SAVED_REPORTS_LOCAL_KEY, JSON.stringify(updated))
  } catch {}
}

// ============================================================
// ADMIN — MASTER DATA CRUD (sc_*)
// ============================================================

// Schools
export async function upsertSchool(school: Partial<School>): Promise<School> {
  cachedSchoolsStore = null
  const { id, created_at, updated_at, school_id, ...payload } = school as any
  try {
    const { data, error } = id
      ? await supabase.from('sc_schools').update(payload).eq('id', id).select().single()
      : await supabase.from('sc_schools').insert(payload).select().single()

    if (error) {
      const fallback = { ...payload }
      delete fallback.code
      delete fallback.region
      delete fallback.division
      delete fallback.district
      delete fallback.offered_grade_numbers

      const { data: retryData, error: retryErr } = id
        ? await supabase.from('sc_schools').update(fallback).eq('id', id).select().single()
        : await supabase.from('sc_schools').insert(fallback).select().single()

      if (!retryErr && retryData) return { ...school, ...retryData } as School
      return school as School
    }
    return { ...school, ...data } as School
  } catch (err) {
    return school as School
  }
}

// Learning Areas
export async function upsertLearningArea(la: Partial<LearningArea>): Promise<LearningArea> {
  const { data, error } = la.id
    ? await supabase.from('sc_learning_areas').update(la).eq('id', la.id).select().single()
    : await supabase.from('sc_learning_areas').insert(la).select().single()
  if (error) throw error
  return data as LearningArea
}

export async function setLearningAreaGrades(learningAreaId: string, gradeIds: string[]): Promise<void> {
  let targetTable = 'sc_learning_area_grades'
  let { error: delError } = await supabase.from(targetTable).delete().eq('learning_area_id', learningAreaId)
  
  if (isTableMissingError(delError, targetTable)) {
    targetTable = 'termcat_learning_area_grades'
    const res = await supabase.from(targetTable).delete().eq('learning_area_id', learningAreaId)
    delError = res.error
  }
  if (delError) throw delError

  if (gradeIds.length > 0) {
    const inserts = gradeIds.map(gid => ({ learning_area_id: learningAreaId, grade_level_id: gid }))
    const { error: insError } = await supabase.from(targetTable).insert(inserts)
    if (insError) throw insError
  }
}

export async function setGradeLearningAreas(gradeLevelId: string, learningAreaIds: string[]): Promise<void> {
  let targetTable = 'sc_learning_area_grades'
  let { error: delError } = await supabase.from(targetTable).delete().eq('grade_level_id', gradeLevelId)

  if (isTableMissingError(delError, targetTable)) {
    targetTable = 'termcat_learning_area_grades'
    const res = await supabase.from(targetTable).delete().eq('grade_level_id', gradeLevelId)
    delError = res.error
  }
  if (delError) throw delError

  if (learningAreaIds.length > 0) {
    const inserts = learningAreaIds.map(laId => ({ learning_area_id: laId, grade_level_id: gradeLevelId }))
    const { error: insError } = await supabase.from(targetTable).insert(inserts)
    if (insError) throw insError
  }
}

// School Years
export async function upsertSchoolYear(sy: Partial<SchoolYear>): Promise<SchoolYear> {
  const { data, error } = sy.id
    ? await supabase.from('sc_school_years').update(sy).eq('id', sy.id).select().single()
    : await supabase.from('sc_school_years').insert(sy).select().single()
  if (error) throw error
  return data as SchoolYear
}

// Terms
export async function upsertTerm(term: Partial<Term>): Promise<Term> {
  const { data, error } = term.id
    ? await supabase.from('sc_terms').update(term).eq('id', term.id).select().single()
    : await supabase.from('sc_terms').insert(term).select().single()
  if (error) throw error
  return data as Term
}

export async function setDefaultTerm(termId: string): Promise<void> {
  localStorage.setItem('termcat_default_term_id', termId)
  try {
    await supabase.from('sc_terms').update({ is_default: false }).neq('id', termId)
    const { error } = await supabase.from('sc_terms').update({ is_default: true, is_active: true }).eq('id', termId)
    if (error) {
      console.warn('Could not update is_default in Supabase:', error)
    }
  } catch (err) {
    console.warn('Error setting default term in database:', err)
  }
}

// Helper for fallback between sc_ and legacy termcat_ table names before database migration execution
const isTableMissingError = (err: any, tableName: string) => {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  // Table missing error is strictly when PostgreSQL table (42P01) or PostgREST route (PGRST204/PGRST205) does not exist
  if (err.code === '42P01' || err.code === 'PGRST205') return true
  if (msg.includes('relation') && msg.includes('does not exist')) return true
  if (msg.includes('could not find the table') && msg.includes('schema cache')) return true
  if (err.code === 'PGRST204' && msg.includes('table')) return true
  return false
}

const isColumnMissingError = (err: any) => {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  const code = (err.code || '').toUpperCase()
  if (code === 'PGRST204' || code === '42703' || code === 'PGRST200') return true
  if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))) return true
  if (err.status === 400 && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'))) return true
  return false
}

function cleanPayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value
    }
  }
  return result
}

// Helper to automatically retry queries on transient network drops (e.g. ERR_CONNECTION_CLOSED)
export async function execWithRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 300): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase()
      const isNetError =
        msg.includes('failed to fetch') ||
        msg.includes('err_connection_closed') ||
        msg.includes('networkerror') ||
        msg.includes('network error') ||
        err?.status === 0
      if (isNetError && attempt < retries) {
        attempt++
        await new Promise(r => setTimeout(r, delayMs * attempt))
        continue
      }
      throw err
    }
  }
}

let cachedSchoolsStore: { data: School[]; timestamp: number } | null = null
let cachedGradesStore: { data: GradeLevel[]; timestamp: number } | null = null
let cachedLAStore: { data: LearningArea[]; timestamp: number } | null = null
let cachedLAGStore: { data: LearningAreaGrade[]; timestamp: number } | null = null
let cachedSectionsStore: { data: Section[]; timestamp: number } | null = null

export function invalidateLISCache() {
  cachedSchoolsStore = null
  cachedGradesStore = null
  cachedLAStore = null
  cachedLAGStore = null
  cachedSectionsStore = null
}

export async function fetchSchools(activeOnly = true, forceRefresh = false): Promise<School[]> {
  if (!forceRefresh && cachedSchoolsStore && (Date.now() - cachedSchoolsStore.timestamp < 300000)) {
    return activeOnly ? cachedSchoolsStore.data.filter(s => s.is_active) : cachedSchoolsStore.data
  }
  return execWithRetry(async () => {
    let query = supabase.from('sc_schools').select('*').order('school_type').order('name')
    if (activeOnly) query = query.eq('is_active', true)
    let { data, error } = await query

    if (isTableMissingError(error, 'sc_schools')) {
      let fallback = supabase.from('termcat_schools').select('*').order('school_type').order('name')
      if (activeOnly) fallback = fallback.eq('is_active', true)
      const res = await fallback
      data = res.data
      error = res.error
    }

    if (error) throw error
    const result = data || []
    if (!activeOnly) {
      cachedSchoolsStore = { data: result, timestamp: Date.now() }
    }
    return result
  })
}

export async function fetchGradeLevels(schoolType?: string, forceRefresh = false): Promise<GradeLevel[]> {
  if (!forceRefresh && cachedGradesStore && (Date.now() - cachedGradesStore.timestamp < 300000)) {
    const list = cachedGradesStore.data
    return schoolType ? list.filter(g => g.school_type === schoolType) : list
  }
  return execWithRetry(async () => {
    let query = supabase.from('sc_grade_levels').select('*').eq('is_active', true).order('grade_number')
    if (schoolType) query = query.eq('school_type', schoolType)
    let { data, error } = await query

    if (isTableMissingError(error, 'sc_grade_levels')) {
      let fallback = supabase.from('termcat_grade_levels').select('*').eq('is_active', true).order('grade_number')
      if (schoolType) fallback = fallback.eq('school_type', schoolType)
      const res = await fallback
      data = res.data
      error = res.error
    }

    if (error) throw error
    const result = data || []
    const hasKinder = result.some(g => g.name.toLowerCase().includes('kinder') || g.grade_number === 0)
    if (!hasKinder && (!schoolType || schoolType === 'elementary')) {
      result.unshift({
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Kindergarten',
        grade_number: 0,
        school_type: 'elementary',
        key_stage: 'ks1',
        is_active: true
      })
    }
    result.sort((a, b) => a.grade_number - b.grade_number)
    if (!schoolType) {
      cachedGradesStore = { data: result, timestamp: Date.now() }
    }
    return result
  })
}

export async function fetchLearningAreas(activeOnly = true, forceRefresh = false): Promise<LearningArea[]> {
  if (!forceRefresh && cachedLAStore && (Date.now() - cachedLAStore.timestamp < 300000)) {
    return activeOnly ? cachedLAStore.data.filter(la => la.is_active) : cachedLAStore.data
  }
  return execWithRetry(async () => {
    let query = supabase.from('sc_learning_areas').select('*').order('name')
    if (activeOnly) query = query.eq('is_active', true)
    let { data, error } = await query

    if (isTableMissingError(error, 'sc_learning_areas')) {
      let fallback = supabase.from('termcat_learning_areas').select('*').order('name')
      if (activeOnly) fallback = fallback.eq('is_active', true)
      const res = await fallback
      data = res.data
      error = res.error
    }

    if (error) throw error
    const result = data || []
    if (!activeOnly) {
      cachedLAStore = { data: result, timestamp: Date.now() }
    }
    return result
  })
}

export async function fetchLearningAreaGrades(forceRefresh = false): Promise<LearningAreaGrade[]> {
  if (!forceRefresh && cachedLAGStore && (Date.now() - cachedLAGStore.timestamp < 300000)) {
    return cachedLAGStore.data
  }
  return execWithRetry(async () => {
    let { data, error } = await supabase.from('sc_learning_area_grades').select('*')
    if (isTableMissingError(error, 'sc_learning_area_grades')) {
      const res = await supabase.from('termcat_learning_area_grades').select('*')
      data = res.data
      error = res.error
    }
    if (error) throw error
    const result = data || []
    cachedLAGStore = { data: result, timestamp: Date.now() }
    return result
  })
}

export async function fetchLearningAreasForGrade(gradeId: string): Promise<LearningArea[]> {
  let { data, error } = await supabase
    .from('sc_learning_area_grades')
    .select('learning_areas:sc_learning_areas(*)')
    .eq('grade_level_id', gradeId)

  if (isTableMissingError(error, 'sc_learning_area_grades')) {
    const res = await supabase
      .from('termcat_learning_area_grades')
      .select('learning_areas:termcat_learning_areas(*)')
      .eq('grade_level_id', gradeId)
    data = res.data
    error = res.error
  }

  if (error) throw error
  return (data || []).flatMap((d: any) => (d.learning_areas ? [d.learning_areas] : [])).filter(la => la.is_active)
}

export async function fetchSchoolYears(activeOnly = true): Promise<SchoolYear[]> {
  let query = supabase.from('sc_school_years').select('*').order('name', { ascending: false })
  if (activeOnly) query = query.eq('is_active', true)
  let { data, error } = await query

  if (isTableMissingError(error, 'sc_school_years')) {
    let fallback = supabase.from('termcat_school_years').select('*').order('name', { ascending: false })
    if (activeOnly) fallback = fallback.eq('is_active', true)
    const res = await fallback
    data = res.data
    error = res.error
  }

  if (error) throw error
  return data || []
}

export async function fetchTerms(activeOnly = true): Promise<Term[]> {
  let query = supabase.from('sc_terms').select('*').order('sort_order')
  if (activeOnly) query = query.eq('is_active', true)
  let { data, error } = await query

  if (isTableMissingError(error, 'sc_terms')) {
    let fallback = supabase.from('termcat_terms').select('*').order('sort_order')
    if (activeOnly) fallback = fallback.eq('is_active', true)
    const res = await fallback
    data = res.data
    error = res.error
  }

  if (error) throw error
  return data || []
}

// ============================================================
// ADMIN PROFILES (sc_admin_profiles)
// ============================================================

export async function fetchAdminProfile(userId: string): Promise<AdminProfile | null> {
  let { data, error } = await supabase
    .from('sc_admin_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (isTableMissingError(error, 'sc_admin_profiles')) {
    const res = await supabase.from('termcat_admin_profiles').select('*').eq('id', userId).single()
    data = res.data
    error = res.error
  }

  if (!error && data) return data as AdminProfile
  return null
}

let cachedAdminsStore: { data: AdminProfile[]; timestamp: number } | null = null

export function clearAdminProfilesCache() {
  cachedAdminsStore = null
}

export async function fetchAllAdmins(forceRefresh = false): Promise<AdminProfile[]> {
  if (!forceRefresh && cachedAdminsStore && (Date.now() - cachedAdminsStore.timestamp < 120000)) {
    return cachedAdminsStore.data
  }

  return execWithRetry(async () => {
    let { data, error } = await supabase
      .from('sc_admin_profiles')
      .select('*')
      .order('full_name')

    if (isTableMissingError(error, 'sc_admin_profiles')) {
      const res = await supabase.from('termcat_admin_profiles').select('*').order('full_name')
      data = res.data
      error = res.error
    }

    if (error) {
      console.error('Failed to fetch admin profiles:', error)
      return cachedAdminsStore?.data || []
    }
    const result = (data || []) as AdminProfile[]
    cachedAdminsStore = { data: result, timestamp: Date.now() }
    return result
  })
}

export const fetchStaffProfiles = fetchAllAdmins


export async function authenticateWithUserTable(email: string, password: string): Promise<AdminProfile | null> {
  const normEmail = email.trim().toLowerCase()
  const normPass = password.trim()

  try {
    let { data, error } = await supabase
      .from('sc_admin_profiles')
      .select('*')
      .ilike('email', normEmail)
      .limit(1)

    if (isTableMissingError(error, 'sc_admin_profiles')) {
      const res = await supabase.from('termcat_admin_profiles').select('*').ilike('email', normEmail).limit(1)
      data = res.data
      error = res.error
    }

    if (!error && data && data.length > 0) {
      const user = data[0] as AdminProfile

      // Check if user account is disabled or inactive
      if (user.is_active === false) {
        throw new Error('ACCOUNT_DISABLED: Your user account is currently disabled or inactive.')
      }

      const dbPassword = (user.password || '').trim()

      if (dbPassword) {
        // Password is set in database: strictly enforce password match
        if (dbPassword === normPass) {
          return user
        }
        // Password set but entered password does not match -> reject authentication
        throw new Error('WRONG_CREDENTIALS: Invalid email or password.')
      }

      // If user profile exists but has no password stored yet, accept default initial passwords
      if (normPass === 'admin123' || normPass === 'password123') {
        return user
      }
      throw new Error('WRONG_CREDENTIALS: Invalid email or password.')
    }

    // Auto-bootstrap default administrator in Supabase if not created in database yet
    if ((normEmail === 'admin@deped.gov.ph' || normEmail === 'admin.termcat@gmail.com') && (normPass === 'admin123' || normPass === 'password123')) {
      const defaultAdmin: Partial<AdminProfile> = {
        id: '00000000-0000-0000-0000-000000000001',
        email: normEmail,
        password: 'admin123',
        full_name: 'System Administrator',
        role: 'superadmin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      try {
        let { data: created, error: createError } = await supabase
          .from('sc_admin_profiles')
          .upsert(defaultAdmin)
          .select()
          .single()

        if (isTableMissingError(createError, 'sc_admin_profiles')) {
          const res = await supabase.from('termcat_admin_profiles').upsert(defaultAdmin).select().single()
          created = res.data
          createError = res.error
        }

        if (!createError && created) {
          return created as AdminProfile
        }
      } catch {
        // Fall back to returning default profile object if database insertion fails
      }

      return defaultAdmin as AdminProfile
    }
  } catch (err: any) {
    if (err?.message?.includes('ACCOUNT_DISABLED') || err?.message?.includes('WRONG_CREDENTIALS')) {
      throw err
    }
    console.error('Database user auth check failed:', err)
  }

  // Fallback check for default admin credentials if database connection fails completely
  if ((normEmail === 'admin@deped.gov.ph' || normEmail === 'admin.termcat@gmail.com') && (normPass === 'admin123' || normPass === 'password123')) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: normEmail,
      password: 'admin123',
      full_name: 'System Administrator',
      role: 'superadmin',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  throw new Error('WRONG_CREDENTIALS: Invalid email or password.')
}

export async function upsertStaffProfile(profile: Partial<AdminProfile>): Promise<AdminProfile> {
  let existing: AdminProfile | null = null
  if (profile.id) {
    try {
      existing = await fetchAdminProfile(profile.id)
    } catch {
      existing = null
    }
  }

  const assignedSchoolIds = profile.assigned_school_ids !== undefined
    ? profile.assigned_school_ids
    : (existing?.assigned_school_ids || [])

  const assignedGradeIds = profile.assigned_grade_ids !== undefined
    ? profile.assigned_grade_ids
    : (existing?.assigned_grade_ids || [])

  const assignedSubjectIds = profile.assigned_subject_ids !== undefined
    ? profile.assigned_subject_ids
    : (existing?.assigned_subject_ids || [])

  const assignedGradeSubjectIds = profile.assigned_grade_subject_ids !== undefined
    ? profile.assigned_grade_subject_ids
    : (existing?.assigned_grade_subject_ids || {})

  const teacherCategory = profile.teacher_category !== undefined
    ? profile.teacher_category
    : existing?.teacher_category

  const districtName = profile.district_name !== undefined
    ? profile.district_name
    : (existing?.district_name || (profile.role === 'psds' ? 'Concepcion District' : undefined))

  const schoolSessions = profile.school_sessions !== undefined
    ? profile.school_sessions
    : existing?.school_sessions

  const workingHoursPreset = profile.working_hours_preset !== undefined
    ? profile.working_hours_preset
    : (existing?.working_hours_preset || 'option_1')

  const newProfile: AdminProfile = {
    id: profile.id || crypto.randomUUID(),
    email: (profile.email || existing?.email || '').trim().toLowerCase(),
    password: profile.password || existing?.password || 'password123',
    full_name: profile.full_name || existing?.full_name || '',
    role: profile.role || existing?.role || 'teacher',
    is_active: profile.is_active ?? existing?.is_active ?? true,
    avatar_url: profile.avatar_url ?? existing?.avatar_url,
    teacher_category: teacherCategory,
    assigned_school_ids: assignedSchoolIds,
    assigned_grade_ids: assignedGradeIds,
    assigned_subject_ids: assignedSubjectIds,
    assigned_grade_subject_ids: assignedGradeSubjectIds,
    school_sessions: schoolSessions,
    working_hours_preset: workingHoursPreset,
    district_name: districtName,
    created_at: profile.created_at || existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const fullPayload = cleanPayload(newProfile)

  clearAdminProfilesCache()

  // 1. Primary Attempt: sc_admin_profiles with full payload
  try {
    const { data, error } = await supabase
      .from('sc_admin_profiles')
      .upsert(fullPayload)
      .select()
      .single()
    if (!error && data) return data as AdminProfile

    // If schema cache/column mismatch error occurs, strip new columns and retry
    if (error && isColumnMissingError(error)) {
      const fallbackPayload = { ...fullPayload }
      delete fallbackPayload.assigned_subject_ids
      delete fallbackPayload.assigned_grade_subject_ids
      delete fallbackPayload.school_sessions
      delete fallbackPayload.working_hours_preset
      delete fallbackPayload.last_seen_at

      const retry1 = await supabase
        .from('sc_admin_profiles')
        .upsert(fallbackPayload)
        .select()
        .single()
      if (!retry1.error && retry1.data) return { ...retry1.data, ...newProfile } as AdminProfile

      if (retry1.error && isColumnMissingError(retry1.error)) {
        delete fallbackPayload.teacher_category
        delete fallbackPayload.assigned_grade_ids
        delete fallbackPayload.assigned_school_ids
        delete fallbackPayload.district_name

        const retry1b = await supabase
          .from('sc_admin_profiles')
          .upsert(fallbackPayload)
          .select()
          .single()
        if (!retry1b.error && retry1b.data) return { ...retry1b.data, ...newProfile } as AdminProfile
      }
    }
  } catch {}

  // 2. Secondary Attempt: sc_admin_profiles with schema-safe base payload
  try {
    const baseRole = newProfile.role || 'teacher'
    const basePayload: Record<string, any> = {
      id: newProfile.id,
      email: newProfile.email,
      full_name: newProfile.full_name,
      role: baseRole,
      is_active: newProfile.is_active,
      updated_at: newProfile.updated_at,
    }
    if (newProfile.password) basePayload.password = newProfile.password
    if (newProfile.avatar_url) basePayload.avatar_url = newProfile.avatar_url

    const { data, error } = await supabase
      .from('sc_admin_profiles')
      .upsert(basePayload)
      .select()
      .single()
    if (!error && data) return { ...data, ...newProfile } as AdminProfile

    // Retry sc_admin_profiles without optional columns if schema rejection occurs
    delete basePayload.avatar_url
    delete basePayload.password
    const retry2 = await supabase
      .from('sc_admin_profiles')
      .upsert(basePayload)
      .select()
      .single()
    if (!retry2.error && retry2.data) return { ...retry2.data, ...newProfile } as AdminProfile
  } catch {}

  // 3. Tertiary Attempt: Legacy termcat_admin_profiles table
  try {
    const legacyRole = (newProfile.role === 'admin' || newProfile.role === 'superadmin') ? newProfile.role : 'admin'
    const legacyPayload: Record<string, any> = {
      id: newProfile.id,
      email: newProfile.email,
      full_name: newProfile.full_name,
      role: legacyRole,
      is_active: newProfile.is_active,
      updated_at: newProfile.updated_at,
    }
    const { data, error } = await supabase
      .from('termcat_admin_profiles')
      .upsert(legacyPayload)
      .select()
      .single()
    if (!error && data) return { ...data, ...newProfile } as AdminProfile
  } catch {}

  // 4. Resilient Fallback: Return constructed profile object so application state & UI function uninterruptedly
  console.warn('Supabase DB profile upsert did not return row, using local profile state fallback:', newProfile.email)
  return newProfile
}

export async function deleteStaffProfile(staffId: string): Promise<void> {
  clearAdminProfilesCache()
  // Nullify foreign key references in termcat_submissions & sc_audit_log to avoid 409 FK conflict
  try {
    await Promise.all([
      supabase.from('termcat_submissions').update({ last_edited_by: null }).eq('last_edited_by', staffId),
      supabase.from('termcat_submissions').update({ reviewed_by: null }).eq('reviewed_by', staffId),
      supabase.from('termcat_submissions').update({ returned_by: null }).eq('returned_by', staffId),
      supabase.from('termcat_submissions').update({ finalized_by: null }).eq('finalized_by', staffId),
      supabase.from('sc_audit_log').update({ admin_id: null }).eq('admin_id', staffId),
      supabase.from('termcat_audit_log').update({ admin_id: null }).eq('admin_id', staffId),
    ])
  } catch (err) {
    console.warn('Non-fatal error nullifying staff foreign key references:', err)
  }

  let { error } = await supabase
    .from('sc_admin_profiles')
    .delete()
    .eq('id', staffId)

  if (isTableMissingError(error, 'sc_admin_profiles')) {
    const res = await supabase.from('termcat_admin_profiles').delete().eq('id', staffId)
    error = res.error
  }

  if (error) {
    console.error('Failed to delete staff profile in Supabase:', error)
    throw error
  }
}

// ============================================================
// AUDIT LOG (sc_audit_log with termcat_audit_log fallback)
// ============================================================

export async function insertAuditLog(entry: {
  admin_id: string | null
  admin_name: string | null
  action: string
  entity_type?: string
  entity_id?: string
  entity_label?: string
  details?: Record<string, unknown>
}): Promise<void> {
  let { error } = await supabase.from('sc_audit_log').insert(entry)
  if (isTableMissingError(error, 'sc_audit_log')) {
    const res = await supabase.from('termcat_audit_log').insert(entry)
    error = res.error
  }
  if (error) console.error('Audit log error:', error)
}

export async function fetchAuditLogs(page = 1, pageSize = 50): Promise<{ data: AuditLog[]; count: number }> {
  try {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    let { data, error, count } = await supabase
      .from('sc_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error || isTableMissingError(error, 'sc_audit_log')) {
      const res = await supabase
        .from('termcat_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (!res.error && res.data) {
        data = res.data
        count = res.count
      }
    }

    return { data: (data || []) as AuditLog[], count: count || (data?.length || 0) }
  } catch (err) {
    console.warn('Audit logs query error, returning fallback array:', err)
    return { data: [], count: 0 }
  }
}

// ============================================================
// PORTAL TASKS, ANNOUNCEMENTS & EVENTS QUERIES (sc_portal_*)
// ============================================================

import type {
  PortalTask,
  PortalAnnouncement,
  PortalEvent,
  TaskScopeType,
  UserNote,
  NoteCategory,
  NoteColorTheme
} from '@/types'

// --- PORTAL TASKS & SCOPE FILTERING ---

export async function fetchPortalTasks(currentUser?: AdminProfile | null): Promise<PortalTask[]> {
  try {
    const { data: rawTasks, error: tasksError } = await supabase
      .from('sc_portal_tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (tasksError) throw tasksError

    // Fetch user completions for current user
    let completedTaskIds = new Set<string>()
    if (currentUser?.id) {
      const { data: completions, error: compError } = await supabase
        .from('sc_portal_task_completions')
        .select('task_id')
        .eq('user_id', currentUser.id)
      
      if (!compError && completions) {
        completions.forEach((c: { task_id: string }) => completedTaskIds.add(c.task_id))
      }
    }

    const mappedTasks: PortalTask[] = (rawTasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      dueDate: t.due_date,
      reminderDaysBefore: t.reminder_days_before ?? 3,
      priority: t.priority as 'high' | 'medium' | 'normal',
      category: t.category,
      scopeType: (t.scope_type || 'district') as TaskScopeType,
      targetSchoolId: t.target_school_id || undefined,
      targetRole: t.target_role || undefined,
      targetUserId: t.target_user_id || undefined,
      createdBy: t.created_by || undefined,
      completed: completedTaskIds.has(t.id),
      isArchived: !!t.is_archived,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }))

    // Filter by Scope for current user if applicable
    if (!currentUser) return mappedTasks

    const userSchoolIds = currentUser.assigned_school_ids || []

    return mappedTasks.filter(task => {
      // 1. Created by this user
      if (task.createdBy === currentUser.id) return true
      // 2. Targeted to specific user
      if (task.scopeType === 'user' && task.targetUserId === currentUser.id) return true
      // 3. District wide
      if (task.scopeType === 'district') return true
      // 4. Target School (applies to all staff of that school if no specific target user)
      if (task.scopeType === 'school' && task.targetSchoolId) {
        if (userSchoolIds.includes(task.targetSchoolId)) return true
      }
      // 5. Target Role / Position (applies to all staff holding that role or District AO II holding admin scope)
      if (task.scopeType === 'role' && task.targetRole) {
        if (task.targetRole === currentUser.role) return true
        if (task.targetRole === 'admin' && currentUser.role === 'ao_2' && !!currentUser.district_name) return true
      }
      return false
    })
  } catch (err) {
    console.warn('Failed to fetch portal tasks from Supabase:', err)
    return []
  }
}

export async function createPortalTask(task: {
  title: string
  description?: string
  dueDate?: string
  reminderDaysBefore?: number
  priority: 'high' | 'medium' | 'normal'
  category: string
  scopeType: TaskScopeType
  targetSchoolId?: string
  targetRole?: string
  targetUserId?: string
  createdBy?: string
}): Promise<PortalTask | null> {
  const payload: Record<string, any> = {
    title: task.title.trim(),
    description: task.description?.trim() || null,
    due_date: task.dueDate && task.dueDate.trim() ? task.dueDate.trim() : null,
    reminder_days_before: task.reminderDaysBefore ?? 3,
    priority: task.priority,
    category: task.category,
    scope_type: task.scopeType,
    target_school_id: task.targetSchoolId || null,
    target_role: task.targetRole || null,
    target_user_id: task.targetUserId || null,
    created_by: task.createdBy || null,
  }

  let { data, error } = await supabase
    .from('sc_portal_tasks')
    .insert(payload)
    .select()
    .single()

  // Fallback 1: If due_date NOT NULL constraint fails because null was passed, retry with empty string ''
  if (error && (error.code === '23502' || error.message?.includes('due_date') || error.message?.includes('violates not-null constraint'))) {
    payload.due_date = ''
    const retry = await supabase
      .from('sc_portal_tasks')
      .insert(payload)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  // Fallback 2: If reminder_days_before column does not exist in Supabase schema yet, retry without it
  if (error && (error.message?.includes('reminder_days_before') || error.code === 'PGRST204')) {
    delete payload.reminder_days_before
    const retry = await supabase
      .from('sc_portal_tasks')
      .insert(payload)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Error creating portal task:', error)
    throw error
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    dueDate: data.due_date || '',
    reminderDaysBefore: data.reminder_days_before ?? 3,
    priority: data.priority,
    category: data.category,
    scopeType: data.scope_type,
    targetSchoolId: data.target_school_id,
    targetRole: data.target_role,
    targetUserId: data.target_user_id,
    createdBy: data.created_by,
    completed: false,
    createdAt: data.created_at
  }
}

export async function updatePortalTask(id: string, updates: Partial<PortalTask>): Promise<void> {
  const patch: Record<string, any> = {}
  if (updates.title !== undefined) patch.title = updates.title.trim()
  if (updates.description !== undefined) patch.description = updates.description.trim()
  if (updates.dueDate !== undefined) patch.due_date = updates.dueDate && updates.dueDate.trim() ? updates.dueDate.trim() : null
  if (updates.reminderDaysBefore !== undefined) patch.reminder_days_before = updates.reminderDaysBefore
  if (updates.priority !== undefined) patch.priority = updates.priority
  if (updates.category !== undefined) patch.category = updates.category
  if (updates.scopeType !== undefined) {
    patch.scope_type = updates.scopeType
    patch.target_school_id = updates.scopeType === 'school' ? (updates.targetSchoolId || null) : null
    patch.target_role = updates.scopeType === 'role' ? (updates.targetRole || null) : null
    patch.target_user_id = updates.scopeType === 'user' ? (updates.targetUserId || null) : null
  } else {
    if (updates.targetSchoolId !== undefined) patch.target_school_id = updates.targetSchoolId || null
    if (updates.targetRole !== undefined) patch.target_role = updates.targetRole || null
    if (updates.targetUserId !== undefined) patch.target_user_id = updates.targetUserId || null
  }
  if (updates.isArchived !== undefined) patch.is_archived = updates.isArchived
  patch.updated_at = new Date().toISOString()

  let { error } = await supabase.from('sc_portal_tasks').update(patch).eq('id', id)

  if (error && (error.code === '23502' || error.message?.includes('due_date') || error.message?.includes('violates not-null constraint'))) {
    patch.due_date = ''
    const retry = await supabase.from('sc_portal_tasks').update(patch).eq('id', id)
    error = retry.error
  }

  if (error && (error.message?.includes('reminder_days_before') || error.code === 'PGRST204')) {
    delete patch.reminder_days_before
    const retry = await supabase.from('sc_portal_tasks').update(patch).eq('id', id)
    error = retry.error
  }

  if (error) {
    console.error('Error updating task:', error)
    throw error
  }
}

export async function archivePortalTask(id: string, isArchived: boolean = true): Promise<void> {
  const { error } = await supabase.from('sc_portal_tasks').update({ is_archived: isArchived, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.error('Error archiving task:', error)
    throw error
  }
}

export async function deletePortalTask(id: string): Promise<void> {
  return archivePortalTask(id, true)
}

export async function toggleTaskCompletionInSupabase(
  taskId: string,
  userId: string,
  completed: boolean
): Promise<void> {
  if (completed) {
    const { error } = await supabase
      .from('sc_portal_task_completions')
      .upsert({ task_id: taskId, user_id: userId }, { onConflict: 'task_id,user_id' })
    if (error) console.error('Error setting task completion:', error)
  } else {
    const { error } = await supabase
      .from('sc_portal_task_completions')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId)
    if (error) console.error('Error clearing task completion:', error)
  }
}

export async function fetchTaskCompletionsForTask(taskId: string): Promise<{
  id: string
  taskId: string
  userId: string
  completedAt: string
}[]> {
  try {
    const { data, error } = await supabase
      .from('sc_portal_task_completions')
      .select('*')
      .eq('task_id', taskId)

    if (error) throw error

    return (data || []).map((c: any) => ({
      id: c.id,
      taskId: c.task_id,
      userId: c.user_id,
      completedAt: c.created_at || c.completed_at || ''
    }))
  } catch (err) {
    console.error('Error fetching task completions:', err)
    return []
  }
}

// --- PORTAL ANNOUNCEMENTS ---

export async function fetchPortalAnnouncements(): Promise<PortalAnnouncement[]> {
  try {
    const { data, error } = await supabase
      .from('sc_portal_announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      tag: a.tag || 'General',
      author: a.author_name || 'District Office',
      authorId: a.author_id,
      isPinned: !!a.is_pinned,
      isArchived: !!a.is_archived,
      date: new Date(a.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      createdAt: a.created_at
    }))
  } catch (err) {
    console.warn('Failed to fetch announcements from Supabase:', err)
    return []
  }
}

export async function createPortalAnnouncement(ann: {
  title: string
  content: string
  tag: string
  authorName: string
  authorId?: string
  isPinned: boolean
}): Promise<PortalAnnouncement | null> {
  const { data, error } = await supabase
    .from('sc_portal_announcements')
    .insert({
      title: ann.title.trim(),
      content: ann.content.trim(),
      tag: ann.tag,
      author_name: ann.authorName.trim(),
      author_id: ann.authorId || null,
      is_pinned: ann.isPinned
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating announcement:', error)
    throw error
  }

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    tag: data.tag,
    author: data.author_name,
    authorId: data.author_id,
    isPinned: data.is_pinned,
    date: new Date(data.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }),
    createdAt: data.created_at
  }
}

export async function updatePortalAnnouncement(id: string, updates: {
  title?: string
  content?: string
  tag?: string
  authorName?: string
  isPinned?: boolean
  isArchived?: boolean
}): Promise<void> {
  const patch: Record<string, any> = {}
  if (updates.title !== undefined) patch.title = updates.title.trim()
  if (updates.content !== undefined) patch.content = updates.content.trim()
  if (updates.tag !== undefined) patch.tag = updates.tag
  if (updates.authorName !== undefined) patch.author_name = updates.authorName.trim()
  if (updates.isPinned !== undefined) patch.is_pinned = updates.isPinned
  if (updates.isArchived !== undefined) patch.is_archived = updates.isArchived
  patch.updated_at = new Date().toISOString()

  const { error } = await supabase.from('sc_portal_announcements').update(patch).eq('id', id)
  if (error) {
    console.error('Error updating announcement:', error)
    throw error
  }
}

export async function archivePortalAnnouncement(id: string, isArchived: boolean = true): Promise<void> {
  const { error } = await supabase.from('sc_portal_announcements').update({ is_archived: isArchived, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.error('Error archiving announcement:', error)
    throw error
  }
}

export async function deletePortalAnnouncement(id: string): Promise<void> {
  return archivePortalAnnouncement(id, true)
}

// --- PORTAL EVENTS ---

export async function fetchPortalEvents(): Promise<PortalEvent[]> {
  try {
    const { data, error } = await supabase
      .from('sc_portal_events')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const todayYmd = new Date().toISOString().split('T')[0]

    return (data || []).map((e: any) => {
      const eventDateStr = e.event_date
      const isPast = eventDateStr ? eventDateStr < todayYmd : false
      const autoArchived = !!e.is_archived || isPast

      if (isPast && !e.is_archived && e.id) {
        archivePortalEvent(e.id, true).catch(() => {})
      }

      return {
        id: e.id,
        title: e.title,
        date: e.event_date,
        time: e.event_time,
        venue: e.venue,
        category: e.category,
        description: e.description || '',
        createdBy: e.created_by,
        isArchived: autoArchived,
        createdAt: e.created_at
      }
    })
  } catch (err) {
    console.warn('Failed to fetch events from Supabase:', err)
    return []
  }
}

export async function createPortalEvent(evt: {
  title: string
  date: string
  time: string
  venue: string
  category: string
  description?: string
  createdBy?: string
}): Promise<PortalEvent | null> {
  const { data, error } = await supabase
    .from('sc_portal_events')
    .insert({
      title: evt.title.trim(),
      event_date: evt.date.trim(),
      event_time: evt.time.trim(),
      venue: evt.venue.trim(),
      category: evt.category,
      description: evt.description?.trim() || null,
      created_by: evt.createdBy || null
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating event:', error)
    throw error
  }

  return {
    id: data.id,
    title: data.title,
    date: data.event_date,
    time: data.event_time,
    venue: data.venue,
    category: data.category,
    description: data.description || '',
    createdBy: data.created_by,
    createdAt: data.created_at
  }
}

export async function updatePortalEvent(id: string, updates: Partial<PortalEvent>): Promise<void> {
  const patch: Record<string, any> = {}
  if (updates.title !== undefined) patch.title = updates.title.trim()
  if (updates.date !== undefined) patch.event_date = updates.date.trim()
  if (updates.time !== undefined) patch.event_time = updates.time.trim()
  if (updates.venue !== undefined) patch.venue = updates.venue.trim()
  if (updates.category !== undefined) patch.category = updates.category
  if (updates.description !== undefined) patch.description = updates.description.trim()
  if (updates.isArchived !== undefined) patch.is_archived = updates.isArchived
  patch.updated_at = new Date().toISOString()

  const { error } = await supabase.from('sc_portal_events').update(patch).eq('id', id)
  if (error) {
    console.error('Error updating event:', error)
    throw error
  }
}

export async function archivePortalEvent(id: string, isArchived: boolean = true): Promise<void> {
  const { error } = await supabase.from('sc_portal_events').update({ is_archived: isArchived, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.error('Error archiving event:', error)
    throw error
  }
}

export async function deletePortalEvent(id: string): Promise<void> {
  return archivePortalEvent(id, true)
}

// Local storage fallback helpers for notes when Supabase table is unreachable or fails FK constraint
const NOTE_STORAGE_KEY_PREFIX = 'sc_portal_user_notes_'

function getLocalStorageNotes(userId?: string): UserNote[] {
  if (typeof window === 'undefined' || !userId) return []
  try {
    const raw = localStorage.getItem(NOTE_STORAGE_KEY_PREFIX + userId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNoteToLocalStorage(note: UserNote): void {
  if (typeof window === 'undefined' || !note.userId) return
  try {
    const list = getLocalStorageNotes(note.userId)
    const existingIndex = list.findIndex(n => n.id === note.id)
    if (existingIndex >= 0) {
      list[existingIndex] = note
    } else {
      list.unshift(note)
    }
    localStorage.setItem(NOTE_STORAGE_KEY_PREFIX + note.userId, JSON.stringify(list))
  } catch (e) {
    console.warn('Failed to save note to localStorage:', e)
  }
}

function removeNoteFromLocalStorage(id: string, userId?: string): void {
  if (typeof window === 'undefined') return
  try {
    if (userId) {
      const list = getLocalStorageNotes(userId).filter(n => n.id !== id)
      localStorage.setItem(NOTE_STORAGE_KEY_PREFIX + userId, JSON.stringify(list))
    } else {
      // Search all keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(NOTE_STORAGE_KEY_PREFIX)) {
          const list: UserNote[] = JSON.parse(localStorage.getItem(key) || '[]')
          const filtered = list.filter(n => n.id !== id)
          localStorage.setItem(key, JSON.stringify(filtered))
        }
      }
    }
  } catch (e) {
    console.warn('Failed to remove note from localStorage:', e)
  }
}

function mapDbNoteToUserNote(data: any): UserNote {
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    content: data.content || '',
    category: data.category as NoteCategory,
    systemName: data.system_name || undefined,
    accountUsername: data.account_username || undefined,
    accountPassword: data.account_password || undefined,
    targetUrl: data.target_url || undefined,
    reminderDate: data.reminder_date || data.reminder_at || undefined,
    isPinned: !!data.is_pinned,
    colorTheme: (data.color_theme || 'yellow') as NoteColorTheme,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

export async function fetchUserNotes(userId?: string): Promise<UserNote[]> {
  if (!userId) return []
  const localNotes = getLocalStorageNotes(userId)
  
  try {
    const { data, error } = await supabase
      .from('sc_portal_user_notes')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) throw error

    const dbNotes = (data || []).map(mapDbNoteToUserNote)
    
    // Combine dbNotes and localNotes (avoiding duplicates)
    const dbNoteIds = new Set(dbNotes.map(n => n.id))
    const merged = [...dbNotes, ...localNotes.filter(n => !dbNoteIds.has(n.id))]
    
    merged.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    })
    
    return merged
  } catch (err) {
    console.warn('Failed to fetch user notes from Supabase, returning local notes:', err)
    return localNotes
  }
}

export async function createUserNote(note: {
  userId: string
  title: string
  content?: string
  category: NoteCategory
  systemName?: string
  accountUsername?: string
  accountPassword?: string
  targetUrl?: string
  reminderDate?: string
  isPinned?: boolean
  colorTheme?: NoteColorTheme
}): Promise<UserNote | null> {
  let finalContent = note.content?.trim() || ''
  if (note.targetUrl?.trim() && !finalContent.includes(note.targetUrl.trim())) {
    finalContent = finalContent ? `${finalContent}\nURL: ${note.targetUrl.trim()}` : `URL: ${note.targetUrl.trim()}`
  }

  const insertPayload: Record<string, any> = {
    user_id: note.userId,
    title: note.title.trim(),
    content: finalContent || null,
    category: note.category,
    system_name: note.systemName?.trim() || null,
    account_username: note.accountUsername?.trim() || null,
    account_password: note.accountPassword?.trim() || null,
    reminder_date: note.reminderDate?.trim() || null,
    is_pinned: !!note.isPinned,
    color_theme: note.colorTheme || 'yellow'
  }

  try {
    const response = await supabase
      .from('sc_portal_user_notes')
      .insert(insertPayload)
      .select()
      .single()

    if (response.error) throw response.error

    if (response.data) {
      const created = mapDbNoteToUserNote(response.data)
      if (note.targetUrl?.trim()) created.targetUrl = note.targetUrl.trim()
      saveNoteToLocalStorage(created)
      return created
    }
  } catch (err: any) {
    console.warn('Supabase note creation failed, falling back to local storage:', err?.message || err)
    
    const fallbackNote: UserNote = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: note.userId,
      title: note.title.trim(),
      content: finalContent,
      category: note.category,
      systemName: note.systemName?.trim(),
      accountUsername: note.accountUsername?.trim(),
      accountPassword: note.accountPassword,
      targetUrl: note.targetUrl?.trim(),
      reminderDate: note.reminderDate?.trim(),
      isPinned: !!note.isPinned,
      colorTheme: note.colorTheme || 'yellow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    saveNoteToLocalStorage(fallbackNote)
    return fallbackNote
  }

  return null
}

export async function updateUserNote(id: string, updates: Partial<UserNote>, userId?: string): Promise<void> {
  const patch: Record<string, any> = {}
  if (updates.title !== undefined) patch.title = updates.title.trim()
  if (updates.content !== undefined) patch.content = updates.content ? updates.content.trim() : null
  if (updates.category !== undefined) patch.category = updates.category
  if (updates.systemName !== undefined) patch.system_name = updates.systemName ? updates.systemName.trim() : null
  if (updates.accountUsername !== undefined) patch.account_username = updates.accountUsername ? updates.accountUsername.trim() : null
  if (updates.accountPassword !== undefined) patch.account_password = updates.accountPassword || null
  if (updates.reminderDate !== undefined) patch.reminder_date = updates.reminderDate ? updates.reminderDate.trim() : null
  if (updates.isPinned !== undefined) patch.is_pinned = updates.isPinned
  if (updates.colorTheme !== undefined) patch.color_theme = updates.colorTheme
  patch.updated_at = new Date().toISOString()

  // Update local storage first
  if (userId) {
    const list = getLocalStorageNotes(userId)
    const targetIndex = list.findIndex(n => n.id === id)
    if (targetIndex >= 0) {
      list[targetIndex] = { ...list[targetIndex], ...updates, updatedAt: patch.updated_at }
      saveNoteToLocalStorage(list[targetIndex])
    }
  }

  if (id.startsWith('local_')) {
    return
  }

  try {
    const { error } = await supabase.from('sc_portal_user_notes').update(patch).eq('id', id)
    if (error) throw error
  } catch (err) {
    console.warn('Supabase note update failed:', err)
  }
}

export async function deleteUserNote(id: string, userId?: string): Promise<void> {
  removeNoteFromLocalStorage(id, userId)

  if (id.startsWith('local_')) {
    return
  }

  try {
    const { error } = await supabase.from('sc_portal_user_notes').delete().eq('id', id)
    if (error) throw error
  } catch (err) {
    console.warn('Supabase note delete failed:', err)
  }
}



// ============================================================
// CIVIL SERVICE FORM NO. 48 DTR SUPABASE API QUERIES
// ============================================================

export async function fetchDTRRecordsSupabase(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('sc_dtr_records')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('Supabase fetch DTR records warning:', err)
    return []
  }
}

export async function saveDTRRecordSupabase(record: {
  created_by_user_id?: string
  created_by_name?: string
  employee_name: string
  role: string
  month: number
  year: number
  official_hours_text?: string
  school_head_name?: string
  entries: any[]
}): Promise<any> {
  const insertPayload: any = {
    created_by_user_id: record.created_by_user_id || null,
    created_by_name: record.created_by_name || null,
    employee_name: record.employee_name,
    role: record.role,
    month: record.month,
    year: record.year,
    official_hours_text: record.official_hours_text,
    school_head_name: record.school_head_name,
    entries: record.entries
  }

  try {
    const { data, error } = await supabase
      .from('sc_dtr_records')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('created_by_name')) {
        delete insertPayload.created_by_name
        const { data: retryData, error: retryErr } = await supabase
          .from('sc_dtr_records')
          .insert(insertPayload)
          .select()
          .single()
        if (retryErr) throw retryErr
        return retryData
      }
      throw error
    }
    return data
  } catch (err) {
    throw err
  }
}

export async function updateDTRRecordSupabase(id: string, updates: Partial<{
  created_by_name: string
  employee_name: string
  role: string
  month: number
  year: number
  official_hours_text: string
  school_head_name: string
  entries: any[]
}>): Promise<void> {
  try {
    const { error } = await supabase
      .from('sc_dtr_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('created_by_name')) {
        const fallbackUpdates = { ...updates }
        delete fallbackUpdates.created_by_name
        const { error: retryErr } = await supabase
          .from('sc_dtr_records')
          .update({
            ...fallbackUpdates,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
        if (retryErr) throw retryErr
        return
      }
      throw error
    }
  } catch (err) {
    throw err
  }
}

export async function deleteDTRRecordSupabase(id: string): Promise<void> {
  const { error } = await supabase
    .from('sc_dtr_records')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function fetchDTRCustomHolidaysSupabase(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('sc_dtr_custom_holidays')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('Supabase fetch DTR custom holidays warning:', err)
    return []
  }
}

export async function saveDTRCustomHolidaySupabase(holiday: {
  created_by_user_id?: string
  date_str: string
  title: string
  is_recurring: boolean
  is_half_day?: boolean
  half_day_session?: 'am' | 'pm' | 'half_day'
  applicable_roles?: string[]
}): Promise<any> {
  const insertPayload: any = {
    created_by_user_id: holiday.created_by_user_id || null,
    date_str: holiday.date_str,
    title: holiday.title,
    is_recurring: holiday.is_recurring,
    is_half_day: holiday.is_half_day ?? false,
    half_day_session: holiday.half_day_session || 'am'
  }
  if (holiday.applicable_roles && holiday.applicable_roles.length > 0) {
    insertPayload.applicable_roles = holiday.applicable_roles
  }

  const { data, error } = await supabase
    .from('sc_dtr_custom_holidays')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    // If column `applicable_roles` doesn't exist in Supabase DB schema yet, retry without it
    if (insertPayload.applicable_roles) {
      delete insertPayload.applicable_roles
      const { data: retryData, error: retryError } = await supabase
        .from('sc_dtr_custom_holidays')
        .insert(insertPayload)
        .select()
        .single()
      if (retryError) throw retryError
      return retryData
    }
    throw error
  }
  return data
}

export async function deleteDTRCustomHolidaySupabase(id: string): Promise<void> {
  const { error } = await supabase
    .from('sc_dtr_custom_holidays')
    .delete()
    .eq('id', id)
  if (error) throw error
}

import extractedCompetencies from '@/data/extractedCompetencies.json'

// ============================================================
// LEARNING COMPETENCIES / BUDGET OF WORK QUERIES (sc_budget_of_work)
// ============================================================

export async function fetchLearningCompetencies(filters?: {
  grade_number?: number
  learning_area_name?: string
  term_name?: string
  search?: string
}): Promise<{ data: LearningCompetency[]; isLiveFromSupabase: boolean }> {
  try {
    let allData: LearningCompetency[] = []
    let page = 0
    const PAGE_SIZE = 1000
    let hasMore = true
    let isLiveFromSupabase = false

    while (hasMore) {
      let query = supabase
        .from('sc_budget_of_work')
        .select('*')
        .order('grade_number', { ascending: true })
        .order('learning_area_name', { ascending: true })
        .order('code', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filters?.grade_number) {
        query = query.eq('grade_number', filters.grade_number)
      }
      if (filters?.learning_area_name && filters.learning_area_name !== 'all') {
        query = query.ilike('learning_area_name', `%${filters.learning_area_name}%`)
      }
      if (filters?.term_name && filters.term_name !== 'all') {
        query = query.ilike('term_name', `%${filters.term_name}%`)
      }

      const { data, error } = await query

      if (error || !data) {
        hasMore = false
      } else {
        if (data.length > 0) {
          isLiveFromSupabase = true
          allData = allData.concat(data as LearningCompetency[])
        }
        if (data.length < PAGE_SIZE) {
          hasMore = false
        } else {
          page++
        }
      }
    }

    let results: LearningCompetency[] = []

    if (isLiveFromSupabase && allData.length > 0) {
      results = allData
    } else {
      isLiveFromSupabase = false
      results = extractedCompetencies as LearningCompetency[]

      if (filters?.grade_number) {
        results = results.filter(c => c.grade_number === filters.grade_number)
      }
      if (filters?.learning_area_name && filters.learning_area_name !== 'all') {
        const la = filters.learning_area_name.toLowerCase()
        results = results.filter(c => c.learning_area_name.toLowerCase().includes(la))
      }
      if (filters?.term_name && filters.term_name !== 'all') {
        const tm = filters.term_name.toLowerCase()
        results = results.filter(c => c.term_name.toLowerCase().includes(tm))
      }
    }

    if (filters?.search && filters.search.trim() !== '') {
      const s = filters.search.toLowerCase().trim()
      results = results.filter(
        c =>
          (c.code && c.code.toLowerCase().includes(s)) ||
          (c.domain_strand && c.domain_strand.toLowerCase().includes(s)) ||
          (c.competency_description && c.competency_description.toLowerCase().includes(s)) ||
          (c.learning_area_name && c.learning_area_name.toLowerCase().includes(s))
      )
    }

    return { data: results, isLiveFromSupabase }
  } catch (err) {
    console.warn('Supabase fetch budget of work warning:', err)
    return { data: extractedCompetencies as LearningCompetency[], isLiveFromSupabase: false }
  }
}

export async function createLearningCompetency(
  competency: Partial<LearningCompetency>
): Promise<LearningCompetency> {
  const { data, error } = await supabase
    .from('sc_budget_of_work')
    .insert({
      grade_number: competency.grade_number || 1,
      learning_area_name: competency.learning_area_name || 'General',
      term_name: competency.term_name || '1st Term / Quarter 1',
      code: competency.code || '',
      domain_strand: competency.domain_strand || 'General',
      competency_description: competency.competency_description || '',
      target_week: competency.target_week || 'Week 1-2',
      target_days: competency.target_days || 5,
      is_active: competency.is_active ?? true,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLearningCompetency(
  id: string,
  competency: Partial<LearningCompetency>
): Promise<LearningCompetency> {
  const { data, error } = await supabase
    .from('sc_budget_of_work')
    .update({
      grade_number: competency.grade_number,
      learning_area_name: competency.learning_area_name,
      term_name: competency.term_name,
      code: competency.code,
      domain_strand: competency.domain_strand,
      competency_description: competency.competency_description,
      target_week: competency.target_week,
      target_days: competency.target_days,
      is_active: competency.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLearningCompetency(id: string): Promise<void> {
  const { error } = await supabase
    .from('sc_budget_of_work')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function importBudgetOfWorkToSupabase(
  items: Partial<LearningCompetency>[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; insertedCount: number }> {
  const BATCH_SIZE = 250
  let insertedCount = 0

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE).map(item => ({
      grade_number: item.grade_number || 1,
      learning_area_name: item.learning_area_name || 'General',
      term_name: item.term_name || '1st Term / Quarter 1',
      code: item.code || '',
      domain_strand: item.domain_strand || 'General',
      competency_description: item.competency_description || '',
      target_week: item.target_week || 'Week 1-2',
      target_days: item.target_days || 5,
      is_active: item.is_active ?? true,
    }))

    const { data, error } = await supabase.from('sc_budget_of_work').insert(chunk).select('id')
    if (error) {
      console.error('Batch import error details:', error)
      if (error.code === '42P01' || error.message?.includes('relation "sc_budget_of_work" does not exist')) {
        throw new Error('Table "sc_budget_of_work" does not exist in Supabase yet. Please run migration 018_create_budget_of_work_table.sql in your Supabase SQL Editor.')
      }
      if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
        throw new Error('Supabase RLS Permission Error: Please run migration 018_create_budget_of_work_table.sql in Supabase SQL Editor to grant insert policy to anon/authenticated users.')
      }
      throw new Error(`Supabase Import Error (${error.code || '401'}): ${error.message || 'Permission denied or unauthorized request'}`)
    }

    insertedCount += data ? data.length : chunk.length
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, items.length), items.length)
    }
  }

  return { success: true, insertedCount }
}

export async function clearBudgetOfWorkSupabase(): Promise<void> {
  const { error } = await supabase.from('sc_budget_of_work').delete().gte('grade_number', 1)
  if (error) throw error
}

// --- SECTIONS MASTER DATA QUERIES ---

const LOCAL_SECTIONS_KEY = 'schoolconnect_local_sections'

export async function fetchSections(schoolId?: string, gradeId?: string): Promise<Section[]> {
  try {
    let query = supabase.from('sc_sections').select('*').order('name', { ascending: true })
    if (schoolId && schoolId !== 'all') query = query.eq('school_id', schoolId)
    if (gradeId && gradeId !== 'all') query = query.eq('grade_level_id', gradeId)

    const { data, error } = await query
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "sc_sections" does not exist')) {
        console.warn('Table sc_sections does not exist in Supabase yet. Using local cache fallback.')
        const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
        let list: Section[] = raw ? JSON.parse(raw) : []
        if (schoolId && schoolId !== 'all') list = list.filter(s => s.school_id === schoolId)
        if (gradeId && gradeId !== 'all') list = list.filter(s => s.grade_level_id === gradeId)
        return list
      }
      throw error
    }
    const result = (data || []) as Section[]
    if ((!schoolId || schoolId === 'all') && (!gradeId || gradeId === 'all')) {
      cachedSectionsStore = { data: result, timestamp: Date.now() }
    }
    return result
  } catch (err) {
    console.warn('Fallback fetching sections from local cache due to error:', err)
    const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
    let list: Section[] = raw ? JSON.parse(raw) : []
    if (schoolId && schoolId !== 'all') list = list.filter(s => s.school_id === schoolId)
    if (gradeId && gradeId !== 'all') list = list.filter(s => s.grade_level_id === gradeId)
    return list
  }
}

export async function upsertSection(payload: Partial<Section>): Promise<Section> {
  const sectionData: Partial<Section> = {
    ...payload,
    id: payload.id || crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from('sc_sections')
      .upsert(sectionData)
      .select('*')
      .single()

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "sc_sections" does not exist')) {
        console.warn('Table sc_sections does not exist in Supabase yet. Saving to local cache.')
        const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
        const list: Section[] = raw ? JSON.parse(raw) : []
        const existingIdx = list.findIndex(s => s.id === sectionData.id)
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...sectionData } as Section
        } else {
          list.push({ ...sectionData, created_at: new Date().toISOString() } as Section)
        }
        localStorage.setItem(LOCAL_SECTIONS_KEY, JSON.stringify(list))
        return (sectionData as Section)
      }
      throw error
    }
    return data as Section
  } catch (err) {
    console.warn('Saving section to local cache due to Supabase error:', err)
    const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
    const list: Section[] = raw ? JSON.parse(raw) : []
    const existingIdx = list.findIndex(s => s.id === sectionData.id)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...sectionData } as Section
    } else {
      list.push({ ...sectionData, created_at: new Date().toISOString() } as Section)
    }
    localStorage.setItem(LOCAL_SECTIONS_KEY, JSON.stringify(list))
    return (sectionData as Section)
  }
}

export async function deleteSection(sectionId: string): Promise<void> {
  try {
    const { error } = await supabase.from('sc_sections').delete().eq('id', sectionId)
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation "sc_sections" does not exist')) {
        const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
        if (raw) {
          const list: Section[] = JSON.parse(raw)
          localStorage.setItem(LOCAL_SECTIONS_KEY, JSON.stringify(list.filter(s => s.id !== sectionId)))
        }
        return
      }
      throw error
    }
  } catch (err) {
    console.warn('Deleting section from local cache:', err)
    const raw = localStorage.getItem(LOCAL_SECTIONS_KEY)
    if (raw) {
      const list: Section[] = JSON.parse(raw)
      localStorage.setItem(LOCAL_SECTIONS_KEY, JSON.stringify(list.filter(s => s.id !== sectionId)))
    }
  }
}

// --- LEARNER INFORMATION SYSTEM (LIS) QUERIES ---

const LOCAL_LEARNERS_KEY = 'schoolconnect_local_learners'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(val?: string | null): boolean {
  return typeof val === 'string' && UUID_REGEX.test(val)
}

function generateValidUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isLISDBError(err: any): boolean {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  const code = String(err.code || '').toUpperCase()
  return (
    code === '42P01' ||
    code === '22P02' ||
    code === '23503' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === 'PGRST102' ||
    err.status === 400 ||
    err.status === 404 ||
    msg.includes('relation') ||
    msg.includes('uuid') ||
    msg.includes('does not exist') ||
    msg.includes('column') ||
    msg.includes('schema cache')
  )
}

function getLocalCacheLearners(): Learner[] {
  const raw = localStorage.getItem(LOCAL_LEARNERS_KEY)
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    // Filter out old demo sample IDs if present
    const demoIds = new Set(['l-001', 'l-002', 'l-003', 'l-004', 'l-005', 'l-006'])
    const cleaned = list.filter(l => !demoIds.has(l.id))
    if (cleaned.length !== list.length) {
      localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(cleaned))
    }
    return cleaned
  } catch {
    return []
  }
}

export function clearLocalLearnersCache() {
  localStorage.removeItem(LOCAL_LEARNERS_KEY)
}

export async function fetchLearners(filters?: LearnerFilters): Promise<Learner[]> {
  try {
    let query = supabase.from('sc_learners').select('*').order('last_name', { ascending: true })

    if (filters?.school_id && filters.school_id !== 'all' && isValidUUID(filters.school_id)) query = query.eq('school_id', filters.school_id)
    if (filters?.grade_level_id && filters.grade_level_id !== 'all' && isValidUUID(filters.grade_level_id)) query = query.eq('grade_level_id', filters.grade_level_id)
    if (filters?.section_id && filters.section_id !== 'all' && isValidUUID(filters.section_id)) query = query.eq('section_id', filters.section_id)
    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters?.sex && filters.sex !== 'all') query = query.eq('sex', filters.sex)
    if (filters?.is_4ps !== undefined) query = query.eq('is_4ps_cct', filters.is_4ps)

    const { data, error } = await query

    if (error) {
      if (isLISDBError(error)) {
        console.warn('Using local cache fallback for learners:', error.message)
        let list = getLocalCacheLearners()
        if (filters?.school_id && filters.school_id !== 'all') list = list.filter(l => l.school_id === filters.school_id)
        if (filters?.grade_level_id && filters.grade_level_id !== 'all') list = list.filter(l => l.grade_level_id === filters.grade_level_id)
        if (filters?.section_id && filters.section_id !== 'all') list = list.filter(l => l.section_id === filters.section_id)
        if (filters?.status && filters.status !== 'all') list = list.filter(l => l.status === filters.status)
        if (filters?.sex && filters.sex !== 'all') list = list.filter(l => l.sex === filters.sex)
        if (filters?.is_4ps !== undefined) list = list.filter(l => l.is_4ps_cct === filters.is_4ps)
        if (filters?.search) {
          const q = filters.search.toLowerCase()
          list = list.filter(l =>
            l.lrn.toLowerCase().includes(q) ||
            l.first_name.toLowerCase().includes(q) ||
            l.last_name.toLowerCase().includes(q) ||
            (l.guardian_name && l.guardian_name.toLowerCase().includes(q)) ||
            (l.father_name && l.father_name.toLowerCase().includes(q)) ||
            (l.mother_maiden_name && l.mother_maiden_name.toLowerCase().includes(q))
          )
        }
        return list
      }
      throw error
    }

    const localList = getLocalCacheLearners()
    const localMap = new Map(localList.map(l => [l.lrn || l.id, l]))

    let result = (data || []).map(dbL => {
      const localL = localMap.get(dbL.lrn) || localMap.get(dbL.id)
      return {
        ...localL,
        ...dbL,
        qr_code: dbL.qr_code || localL?.qr_code || generateLearnerQRCode(dbL.lrn, dbL.id, dbL.school_id),
        father_name: dbL.father_name || localL?.father_name || '',
        mother_maiden_name: dbL.mother_maiden_name || localL?.mother_maiden_name || '',
        guardian_name: dbL.guardian_name || localL?.guardian_name || '',
        guardian_relationship: dbL.guardian_relationship || localL?.guardian_relationship || '',
        grade_level_name: dbL.grade_level_name || localL?.grade_level_name || '',
        section_name: dbL.section_name || localL?.section_name || '',
        school_name: dbL.school_name || localL?.school_name || '',
        school_year: dbL.school_year || localL?.school_year || '2026 - 2027',
      } as Learner
    })

    // Synchronize local storage cache with Supabase DB when unfiltered
    const isUnfiltered = !filters || (
      (!filters.school_id || filters.school_id === 'all') &&
      (!filters.grade_level_id || filters.grade_level_id === 'all') &&
      (!filters.section_id || filters.section_id === 'all') &&
      (!filters.status || filters.status === 'all') &&
      (!filters.sex || filters.sex === 'all') &&
      filters.is_4ps === undefined &&
      !filters.search
    )

    if (isUnfiltered) {
      localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(result))
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(l =>
        l.lrn.toLowerCase().includes(q) ||
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        (l.guardian_name && l.guardian_name.toLowerCase().includes(q)) ||
        (l.father_name && l.father_name.toLowerCase().includes(q)) ||
        (l.mother_maiden_name && l.mother_maiden_name.toLowerCase().includes(q))
      )
    }
    return result
  } catch (err) {
    console.warn('Fallback fetching learners from local cache due to error:', err)
    let list = getLocalCacheLearners()
    if (filters?.school_id && filters.school_id !== 'all') list = list.filter(l => l.school_id === filters.school_id)
    if (filters?.grade_level_id && filters.grade_level_id !== 'all') list = list.filter(l => l.grade_level_id === filters.grade_level_id)
    if (filters?.section_id && filters.section_id !== 'all') list = list.filter(l => l.section_id === filters.section_id)
    if (filters?.status && filters.status !== 'all') list = list.filter(l => l.status === filters.status)
    if (filters?.sex && filters.sex !== 'all') list = list.filter(l => l.sex === filters.sex)
    if (filters?.is_4ps !== undefined) list = list.filter(l => l.is_4ps_cct === filters.is_4ps)
    if (filters?.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(l =>
        l.lrn.toLowerCase().includes(q) ||
        l.first_name.toLowerCase().includes(q) ||
        l.last_name.toLowerCase().includes(q) ||
        (l.guardian_name && l.guardian_name.toLowerCase().includes(q)) ||
        (l.father_name && l.father_name.toLowerCase().includes(q)) ||
        (l.mother_maiden_name && l.mother_maiden_name.toLowerCase().includes(q))
      )
    }
    return list
  }
}

export async function fetchLearnerById(idOrLrn: string): Promise<Learner | null> {
  if (!idOrLrn) return null
  try {
    const isUUID = isValidUUID(idOrLrn)
    let query = supabase.from('sc_learners').select('*')
    if (isUUID) {
      query = query.eq('id', idOrLrn)
    } else {
      query = query.eq('lrn', idOrLrn)
    }
    const { data, error } = await query.maybeSingle()
    if (!error && data) {
      const localList = getLocalCacheLearners()
      const localL = localList.find(l => l.id === data.id || l.lrn === data.lrn)
      return {
        ...localL,
        ...data,
        qr_code: data.qr_code || localL?.qr_code || generateLearnerQRCode(data.lrn, data.id, data.school_id),
        father_name: data.father_name || localL?.father_name || '',
        mother_maiden_name: data.mother_maiden_name || localL?.mother_maiden_name || '',
        guardian_name: data.guardian_name || localL?.guardian_name || '',
        guardian_relationship: data.guardian_relationship || localL?.guardian_relationship || '',
        grade_level_name: data.grade_level_name || localL?.grade_level_name || '',
        section_name: data.section_name || localL?.section_name || '',
        school_name: data.school_name || localL?.school_name || '',
        school_year: data.school_year || localL?.school_year || '2026 - 2027',
      } as Learner
    }
  } catch (err) {
    console.warn('Error fetching learner from Supabase:', err)
  }

  // Fallback to local cache
  const localList = getLocalCacheLearners()
  const found = localList.find(l => l.id === idOrLrn || l.lrn === idOrLrn)
  return found || null
}

function formatISODate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '2018-01-01'
  const str = dateStr.trim()
  if (!str) return '2018-01-01'
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const parts = str.split(/[\/\-\.]/)
  if (parts.length === 3) {
    let [p1, p2, p3] = parts.map(p => p.padStart(2, '0'))
    if (p1.length === 4) return `${p1}-${p2}-${p3}`
    if (p3.length === 4) {
      let month = parseInt(p1, 10)
      let day = parseInt(p2, 10)
      if (month > 12 && day <= 12) {
        const temp = month
        month = day
        day = temp
      }
      const mStr = String(Math.min(Math.max(month, 1), 12)).padStart(2, '0')
      const dStr = String(Math.min(Math.max(day, 1), 31)).padStart(2, '0')
      return `${p3}-${mStr}-${dStr}`
    }
  }
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }
  return '2018-01-01'
}

export async function upsertLearner(payload: Partial<Learner>): Promise<Learner> {
  const now = new Date().toISOString()

  const cleanLRN = String(payload.lrn || '').trim()
  const localList = getLocalCacheLearners()
  const existingByLRN = cleanLRN ? localList.find(l => l.lrn && l.lrn.trim() === cleanLRN) : null

  // Resolve target UUID: check payload ID, local cache, or lookup in Supabase DB by LRN
  let targetId = isValidUUID(payload.id) ? payload.id! : (existingByLRN && isValidUUID(existingByLRN.id) ? existingByLRN.id : '')
  let existingDbRecord: { id?: string; qr_code?: string; school_id?: string } | null = null

  if (cleanLRN) {
    try {
      const { data: dbMatch } = await supabase
        .from('sc_learners')
        .select('id, qr_code, school_id')
        .eq('lrn', cleanLRN)
        .maybeSingle()
      if (dbMatch) {
        existingDbRecord = dbMatch
        if (!targetId && dbMatch.id && isValidUUID(dbMatch.id)) {
          targetId = dbMatch.id
        }
      }
    } catch {
      // Ignore DB query errors during pre-lookup
    }
  }

  if (!targetId) {
    targetId = generateValidUUID()
  }

  // Strictly preserve existing QR code based on LRN: never overwrite or regenerate if one exists
  const existingQRCode = existingDbRecord?.qr_code || existingByLRN?.qr_code || payload.qr_code
  const finalQRCode = existingQRCode && String(existingQRCode).trim() !== ''
    ? String(existingQRCode).trim()
    : (formatLearnerQRText(payload) || generateLearnerQRCode(cleanLRN, targetId, payload.school_id || existingDbRecord?.school_id))

  const learnerData: Partial<Learner> = {
    ...(existingByLRN || {}),
    ...payload,
    id: targetId,
    lrn: cleanLRN,
    qr_code: finalQRCode,
    updated_at: now,
  }

  const cleanBirthdate = formatISODate(learnerData.birthdate)
  learnerData.birthdate = cleanBirthdate

  // Calculate age if birthdate provided
  if (cleanBirthdate) {
    const bday = new Date(cleanBirthdate)
    const today = new Date()
    let age = today.getFullYear() - bday.getFullYear()
    const m = today.getMonth() - bday.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--
    learnerData.age = age > 0 ? age : 0
  }

  const schoolIds = cachedSchoolsStore ? new Set(cachedSchoolsStore.data.map(s => s.id)) : null
  const gradeIds = cachedGradesStore ? new Set(cachedGradesStore.data.map(g => g.id)) : null
  const sectionIds = cachedSectionsStore ? new Set(cachedSectionsStore.data.map(sec => sec.id)) : null

  const dbRecord: Record<string, any> = {
    id: targetId,
    lrn: cleanLRN,
    qr_code: finalQRCode,
    first_name: String(learnerData.first_name || '').trim(),
    middle_name: learnerData.middle_name ? String(learnerData.middle_name).trim() : null,
    last_name: String(learnerData.last_name || '').trim(),
    extension_name: learnerData.extension_name ? String(learnerData.extension_name).trim() : null,
    sex: learnerData.sex === 'Female' ? 'Female' : 'Male',
    birthdate: cleanBirthdate,
    mother_tongue: learnerData.mother_tongue ? String(learnerData.mother_tongue).trim() : null,
    ip_group: learnerData.ip_group ? String(learnerData.ip_group).trim() : null,
    religion: learnerData.religion ? String(learnerData.religion).trim() : null,
    address_house_no: learnerData.address_house_no ? String(learnerData.address_house_no).trim() : null,
    address_street: learnerData.address_street ? String(learnerData.address_street).trim() : null,
    address_barangay: learnerData.address_barangay ? String(learnerData.address_barangay).trim() : null,
    address_city_municipality: learnerData.address_city_municipality ? String(learnerData.address_city_municipality).trim() : null,
    address_province: learnerData.address_province ? String(learnerData.address_province).trim() : null,
    father_name: learnerData.father_name ? String(learnerData.father_name).trim() : null,
    mother_maiden_name: learnerData.mother_maiden_name ? String(learnerData.mother_maiden_name).trim() : null,
    guardian_name: learnerData.guardian_name ? String(learnerData.guardian_name).trim() : null,
    guardian_relationship: learnerData.guardian_relationship ? String(learnerData.guardian_relationship).trim() : null,
    guardian_contact_no: learnerData.guardian_contact_no ? String(learnerData.guardian_contact_no).trim() : null,
    is_4ps_cct: Boolean(learnerData.is_4ps_cct),
    is_balik_aral: Boolean(learnerData.is_balik_aral),
    is_ecd_alive_sped: Boolean(learnerData.is_ecd_alive_sped),
    school_id: isValidUUID(learnerData.school_id) && (!schoolIds || schoolIds.has(learnerData.school_id!)) ? learnerData.school_id : null,
    grade_level_id: isValidUUID(learnerData.grade_level_id) && (!gradeIds || gradeIds.has(learnerData.grade_level_id!)) ? learnerData.grade_level_id : null,
    section_id: isValidUUID(learnerData.section_id) && (!sectionIds || sectionIds.has(learnerData.section_id!)) ? learnerData.section_id : null,
    school_year: learnerData.school_year || '2025-2026',
    status: ['enrolled', 'transferred_in', 'transferred_out', 'dropped', 'promoted', 'graduated'].includes(learnerData.status || '') ? learnerData.status : 'enrolled',
    remarks: learnerData.remarks ? String(learnerData.remarks).trim() : null,
    updated_at: now
  }

  try {
    let { data, error } = await supabase
      .from('sc_learners')
      .upsert(dbRecord)
      .select('*')
      .single()

    if (error) {
      console.warn('[upsertLearner] Primary DB upsert notice:', error.message, error.code)
      const fallbackRecord = { ...dbRecord }
      delete fallbackRecord.school_id
      delete fallbackRecord.grade_level_id
      delete fallbackRecord.section_id
      delete fallbackRecord.father_name
      delete fallbackRecord.mother_maiden_name

      const retry = await supabase
        .from('sc_learners')
        .upsert(fallbackRecord)
        .select('*')
        .single()

      if (!retry.error && retry.data) {
        data = retry.data
        error = null
      }
    }

    if (error) {
      if (isLISDBError(error)) {
        console.warn('Supabase sc_learners table error or missing migration. Saving to local cache.', error.message)
        const list = getLocalCacheLearners()
        const existingIdx = list.findIndex(l => l.id === learnerData.id || l.lrn === learnerData.lrn)
        if (existingIdx >= 0) {
          list[existingIdx] = { ...list[existingIdx], ...learnerData } as Learner
        } else {
          list.push({ ...learnerData, created_at: now } as Learner)
        }
        localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(list))
        return (learnerData as Learner)
      }
      throw error
    }

    // Save to local cache as well so local state always retains full data
    const mergedResult = {
      ...learnerData,
      ...data,
      school_name: learnerData.school_name || data?.school_name || '',
      grade_level_name: learnerData.grade_level_name || data?.grade_level_name || '',
      section_name: learnerData.section_name || data?.section_name || '',
      school_year: learnerData.school_year || data?.school_year || '2026 - 2027',
    } as Learner
    const list = getLocalCacheLearners()
    const existingIdx = list.findIndex(l => l.id === mergedResult.id || l.lrn === mergedResult.lrn)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...mergedResult }
    } else {
      list.push({ ...mergedResult, created_at: now })
    }
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(list))

    return mergedResult
  } catch (err) {
    console.warn('Saving learner to local cache due to error:', err)
    const list = getLocalCacheLearners()
    const existingIdx = list.findIndex(l => l.id === learnerData.id || l.lrn === learnerData.lrn)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...learnerData } as Learner
    } else {
      list.push({ ...learnerData, created_at: now } as Learner)
    }
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(list))
    return learnerData as Learner
  }
}


export async function deleteLearner(learnerId: string): Promise<void> {
  try {
    const queryId = isValidUUID(learnerId) ? learnerId : null
    if (queryId) {
      const { error } = await supabase.from('sc_learners').delete().eq('id', queryId)
      if (error && !isLISDBError(error)) throw error
    }

    const list = getLocalCacheLearners()
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(list.filter(l => l.id !== learnerId)))
  } catch (err) {
    console.warn('Deleting learner from local cache:', err)
    const list = getLocalCacheLearners()
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(list.filter(l => l.id !== learnerId)))
  }
}

export async function bulkUpdateLearnerSection(learnerIds: string[], sectionId: string, sectionName?: string): Promise<void> {
  try {
    const validTargetSectionId = isValidUUID(sectionId) ? sectionId : null
    const validLearnerIds = learnerIds.filter(id => isValidUUID(id))

    if (validTargetSectionId && validLearnerIds.length > 0) {
      const { error } = await supabase
        .from('sc_learners')
        .update({ section_id: validTargetSectionId, updated_at: new Date().toISOString() })
        .in('id', validLearnerIds)

      if (error && !isLISDBError(error)) throw error
    }

    const list = getLocalCacheLearners()
    const updated = list.map(l => {
      if (learnerIds.includes(l.id)) {
        return { ...l, section_id: sectionId, section_name: sectionName || l.section_name, updated_at: new Date().toISOString() }
      }
      return l
    })
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('Bulk updating learner sections in local cache:', err)
    const list = getLocalCacheLearners()
    const updated = list.map(l => {
      if (learnerIds.includes(l.id)) {
        return { ...l, section_id: sectionId, section_name: sectionName || l.section_name, updated_at: new Date().toISOString() }
      }
      return l
    })
    localStorage.setItem(LOCAL_LEARNERS_KEY, JSON.stringify(updated))
  }
}

// ============================================================
// e-CLASS RECORD & LEARNER GRADES (sc_class_records, sc_learner_grades)
// ============================================================

const LOCAL_CLASS_RECORDS_KEY = 'sc_class_records_db'
const LOCAL_LEARNER_GRADES_KEY = 'sc_learner_grades_db'

function getLocalClassRecords(): ClassRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CLASS_RECORDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function getLocalLearnerGrades(): LearnerGrade[] {
  try {
    const raw = localStorage.getItem(LOCAL_LEARNER_GRADES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function fetchClassRecord(
  schoolId: string,
  gradeLevelId: string,
  sectionId: string | undefined | null,
  learningAreaId: string,
  quarter: number,
  schoolYear: string = '2026-2027'
): Promise<ClassRecord | null> {
  try {
    let query = supabase
      .from('sc_class_records')
      .select('*')
      .eq('school_id', schoolId)
      .eq('grade_level_id', gradeLevelId)
      .eq('learning_area_id', learningAreaId)
      .eq('quarter', quarter)
      .eq('school_year', schoolYear)

    if (sectionId) {
      query = query.eq('section_id', sectionId)
    }

    const { data, error } = await query.maybeSingle()
    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase fetchClassRecord query warning:', error)
    }
    if (data) return data as ClassRecord
  } catch (err) {
    console.warn('Falling back to local cache for fetchClassRecord:', err)
  }

  // Fallback to local cache
  const localList = getLocalClassRecords()
  const found = localList.find(
    r =>
      r.school_id === schoolId &&
      r.grade_level_id === gradeLevelId &&
      (!sectionId || r.section_id === sectionId) &&
      r.learning_area_id === learningAreaId &&
      r.quarter === quarter &&
      r.school_year === schoolYear
  )
  return found || null
}

export async function upsertClassRecord(record: ClassRecord): Promise<ClassRecord> {
  const payload = {
    ...record,
    updated_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('sc_class_records')
      .upsert(payload, {
        onConflict: 'school_id,grade_level_id,section_id,learning_area_id,quarter,school_year'
      })
      .select()
      .single()

    if (error) {
      console.warn('Supabase upsertClassRecord warning:', error)
    } else if (data) {
      // Also update local cache
      const list = getLocalClassRecords().filter(r => r.id !== data.id)
      list.push(data as ClassRecord)
      localStorage.setItem(LOCAL_CLASS_RECORDS_KEY, JSON.stringify(list))
      return data as ClassRecord
    }
  } catch (err) {
    console.warn('Upserting class record to local cache only:', err)
  }

  // Fallback local persistence
  const savedRecord: ClassRecord = {
    ...payload,
    id: record.id || `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: record.created_at || new Date().toISOString()
  }
  const list = getLocalClassRecords().filter(
    r =>
      !(
        r.school_id === savedRecord.school_id &&
        r.grade_level_id === savedRecord.grade_level_id &&
        r.section_id === savedRecord.section_id &&
        r.learning_area_id === savedRecord.learning_area_id &&
        r.quarter === savedRecord.quarter &&
        r.school_year === savedRecord.school_year
      )
  )
  list.push(savedRecord)
  localStorage.setItem(LOCAL_CLASS_RECORDS_KEY, JSON.stringify(list))
  return savedRecord
}

export async function fetchLearnerGradesByFilters(
  schoolId: string,
  gradeLevelId: string,
  sectionId: string | undefined | null,
  learningAreaId?: string,
  quarter?: number,
  schoolYear: string = '2026-2027'
): Promise<LearnerGrade[]> {
  try {
    let query = supabase
      .from('sc_learner_grades')
      .select('*')
      .eq('school_id', schoolId)
      .eq('grade_level_id', gradeLevelId)
      .eq('school_year', schoolYear)

    if (sectionId) query = query.eq('section_id', sectionId)
    if (learningAreaId) query = query.eq('learning_area_id', learningAreaId)
    if (quarter) query = query.eq('quarter', quarter)

    const { data, error } = await query
    if (error) {
      console.warn('Supabase fetchLearnerGradesByFilters warning:', error)
    } else if (data && data.length > 0) {
      return data as LearnerGrade[]
    }
  } catch (err) {
    console.warn('Falling back to local cache for fetchLearnerGradesByFilters:', err)
  }

  const localList = getLocalLearnerGrades()
  return localList.filter(
    g =>
      g.school_id === schoolId &&
      g.grade_level_id === gradeLevelId &&
      (!sectionId || g.section_id === sectionId) &&
      (!learningAreaId || g.learning_area_id === learningAreaId) &&
      (!quarter || g.quarter === quarter) &&
      g.school_year === schoolYear
  )
}

export async function fetchLearnerGradesByLearner(
  learnerId: string,
  schoolYear: string = '2026-2027'
): Promise<LearnerGrade[]> {
  try {
    const { data, error } = await supabase
      .from('sc_learner_grades')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('school_year', schoolYear)

    if (error) {
      console.warn('Supabase fetchLearnerGradesByLearner warning:', error)
    } else if (data) {
      return data as LearnerGrade[]
    }
  } catch (err) {
    console.warn('Falling back to local cache for fetchLearnerGradesByLearner:', err)
  }

  const localList = getLocalLearnerGrades()
  return localList.filter(g => g.learner_id === learnerId && g.school_year === schoolYear)
}

export async function saveLearnerGradesBatch(grades: Partial<LearnerGrade>[]): Promise<void> {
  if (!grades || grades.length === 0) return

  const payloads = grades.map(g => ({
    ...g,
    id: g.id || (g.learner_id && g.learning_area_id && g.quarter ? undefined : `lg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    updated_at: new Date().toISOString()
  }))

  try {
    const { error } = await supabase
      .from('sc_learner_grades')
      .upsert(payloads, {
        onConflict: 'learner_id,learning_area_id,quarter,school_year'
      })

    if (error) {
      console.warn('Supabase saveLearnerGradesBatch error:', error)
    }
  } catch (err) {
    console.warn('Saving learner grades to local cache:', err)
  }

  // Update local cache
  const localList = getLocalLearnerGrades()
  payloads.forEach(item => {
    const idx = localList.findIndex(
      l =>
        l.learner_id === item.learner_id &&
        l.learning_area_id === item.learning_area_id &&
        l.quarter === item.quarter &&
        l.school_year === item.school_year
    )
    if (idx >= 0) {
      localList[idx] = { ...localList[idx], ...item } as LearnerGrade
    } else {
      localList.push(item as LearnerGrade)
    }
  })
  localStorage.setItem(LOCAL_LEARNER_GRADES_KEY, JSON.stringify(localList))
}




