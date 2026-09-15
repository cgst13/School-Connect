import { z } from 'zod'

// ---- Teacher Info ----
export const teacherInfoSchema = z.object({
  teacher_name: z.string().min(2, 'Teacher name is required').max(100, 'Name too long'),
  school_id: z.string().uuid('Please select a school'),
  grade_level_id: z.string().uuid('Please select a grade level'),
  learning_area_id: z.string().uuid('Please select a learning area'),
  school_year_id: z.string().uuid('Please select a school year'),
  term_id: z.string().uuid('Please select a term'),
})

// ---- KS1 Learner Data ----
export const ks1LearnerDataSchema = z.object({
  total_learners: z.number().int().min(0, 'Must be 0 or more'),
  advancing: z.number().int().min(0, 'Must be 0 or more'),
  benchmarking: z.number().int().min(0, 'Must be 0 or more'),
  connecting: z.number().int().min(0, 'Must be 0 or more'),
  developing: z.number().int().min(0, 'Must be 0 or more'),
  emerging: z.number().int().min(0, 'Must be 0 or more'),
})

// ---- KS2-4 Learner Data ----
export const ks2to4LearnerDataSchema = z.object({
  total_learners: z.number().int().min(0, 'Must be 0 or more'),
  mps: z.number().min(0, 'MPS must be 0 or more').max(100, 'MPS cannot exceed 100').nullable(),
})

// ---- Competency Summary ----
export const competencySummarySchema = z
  .object({
    total_intended_competencies: z.number().int().min(0, 'Must be 0 or more'),
    competencies_taught: z.number().int().min(0, 'Must be 0 or more'),
    competencies_not_taught: z.number().int().min(0, 'Must be 0 or more'),
    reasons_for_untaught: z.string(),
  })
  .refine(
    data => data.competencies_taught + data.competencies_not_taught <= data.total_intended_competencies,
    {
      message: 'Taught + Not Taught cannot exceed Total Intended Competencies',
      path: ['competencies_not_taught'],
    }
  )

// ---- Top Competencies ----
const competencyListSchema = z.array(z.string()).length(5)

export const topCompetenciesSchema = z.object({
  most_learned: competencyListSchema,
  least_mastered: competencyListSchema,
  most_difficult_to_teach: competencyListSchema,
})

// ---- Instructional Difficulty ----
export const instructionalDifficultySchema = z.object({
  factors_text: z.string(),
})

// ---- School Form ----
export const schoolFormSchema = z.object({
  name: z.string().min(2, 'School name is required').max(200),
  school_type: z.enum(['elementary', 'secondary']),
  is_active: z.boolean(),
})

// ---- Learning Area Form ----
export const learningAreaFormSchema = z.object({
  name: z.string().min(1, 'Learning area name is required').max(100),
  is_active: z.boolean(),
  grade_ids: z.array(z.string()).min(1, 'Assign at least one grade'),
})

// ---- School Year Form ----
export const schoolYearFormSchema = z.object({
  name: z.string().min(4, 'School year name is required').max(20),
  is_active: z.boolean(),
})

// ---- Term Form ----
export const termFormSchema = z.object({
  name: z.string().min(1, 'Term name is required').max(50),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
})

// ---- Return Submission ----
export const returnSubmissionSchema = z.object({
  return_reason: z.string().min(10, 'Please provide a reason of at least 10 characters'),
})

export type TeacherInfoForm = z.infer<typeof teacherInfoSchema>
export type KS1LearnerDataForm = z.infer<typeof ks1LearnerDataSchema>
export type KS2to4LearnerDataForm = z.infer<typeof ks2to4LearnerDataSchema>
export type CompetencySummaryForm = z.infer<typeof competencySummarySchema>
export type TopCompetenciesForm = z.infer<typeof topCompetenciesSchema>
export type InstructionalDifficultyForm = z.infer<typeof instructionalDifficultySchema>
export type SchoolForm = z.infer<typeof schoolFormSchema>
export type LearningAreaForm = z.infer<typeof learningAreaFormSchema>
export type SchoolYearForm = z.infer<typeof schoolYearFormSchema>
export type TermForm = z.infer<typeof termFormSchema>
export type ReturnSubmissionForm = z.infer<typeof returnSubmissionSchema>
