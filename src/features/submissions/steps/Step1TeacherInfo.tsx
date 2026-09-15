import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { teacherInfoSchema, type TeacherInfoForm } from '@/lib/validation/schemas'
import { FormSection, FormField } from '@/components/forms/FormField'
import { SuggestionInput } from '@/components/forms/SuggestionInput'
import {
  fetchSchools, fetchGradeLevels, fetchLearningAreasForGrade,
  fetchSchoolYears, fetchTerms, checkExistingSubjectSubmission
} from '@/lib/supabase/queries'
import { fetchTeacherNameSuggestions, fetchTeacherPreviousSchool } from '@/lib/supabase/suggestions'
import type { School, GradeLevel, LearningArea, SchoolYear, Term, TeacherInfo, TermcatSubmission } from '@/types'
import { LoadingSpinner } from '@/components/ui/EmptyState'
import { getKeyStageLabel } from '@/utils/keyStage'
import { ArrowRight, AlertTriangle, CheckCircle2, Sparkles, Ban } from 'lucide-react'

interface Props {
  data: TeacherInfo
  autoFocusLA?: boolean
  onNext: (data: TeacherInfo, gradeNumber: number) => void
}

export function Step1TeacherInfo({ data, autoFocusLA = false, onNext }: Props) {
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teacherSuggestions, setTeacherSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>('')
  const [selectedGradeNumber, setSelectedGradeNumber] = useState<number>(0)

  // Auto-selection & Restriction state
  const [autoSelectedSchoolName, setAutoSelectedSchoolName] = useState<string>('')
  const [existingSub, setExistingSub] = useState<TermcatSubmission | null>(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<TeacherInfoForm>({
    resolver: zodResolver(teacherInfoSchema),
    defaultValues: data,
  })

  const watchSchoolId = watch('school_id')
  const watchGradeId = watch('grade_level_id')
  const watchLAId = watch('learning_area_id')
  const watchSYId = watch('school_year_id')
  const watchTermId = watch('term_id')
  const watchTeacherName = watch('teacher_name')

  // Sync prefilled data when data prop updates
  useEffect(() => {
    if (data.teacher_name) setValue('teacher_name', data.teacher_name)
    if (data.school_id) setValue('school_id', data.school_id)
    if (data.grade_level_id) setValue('grade_level_id', data.grade_level_id)
    if (data.school_year_id) setValue('school_year_id', data.school_year_id)
    if (data.term_id) setValue('term_id', data.term_id)
    setValue('learning_area_id', data.learning_area_id || '')
  }, [data, setValue])

  // Load initial data & suggestions
  useEffect(() => {
    const storedDefaultTermId = localStorage.getItem('termcat_default_term_id')
    Promise.all([
      fetchSchools(true),
      fetchSchoolYears(true),
      fetchTerms(true),
      fetchTeacherNameSuggestions(),
    ])
      .then(([s, sy, t, ts]) => {
        setSchools(s)
        setSchoolYears(sy)
        setTerms(t)
        setTeacherSuggestions(ts)
        
        // Auto-set default active school year
        const activeSY = sy.find(item => item.is_active) || sy[0]
        if (activeSY && !data.school_year_id) setValue('school_year_id', activeSY.id)

        // Auto-set default term
        const defaultTerm = t.find(item => item.is_default) ||
          t.find(item => item.id === storedDefaultTermId) ||
          t.find(item => item.is_active) ||
          t[0]

        if (defaultTerm && !data.term_id) {
          setValue('term_id', defaultTerm.id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Auto-select school when teacher name is typed or selected from suggestions
  const handleTeacherNameSelect = async (name: string) => {
    setValue('teacher_name', name)
    if (!name || name.trim().length < 2) return

    const prevSchoolId = await fetchTeacherPreviousSchool(name)
    if (prevSchoolId && schools.some(s => s.id === prevSchoolId)) {
      setValue('school_id', prevSchoolId)
      const school = schools.find(s => s.id === prevSchoolId)
      if (school) setAutoSelectedSchoolName(school.name)
    }
  }

  // Load grades when school changes
  useEffect(() => {
    if (!watchSchoolId) {
      setGrades([])
      setLearningAreas([])
      setValue('grade_level_id', '')
      setValue('learning_area_id', '')
      setSelectedSchoolType('')
      return
    }
    const school = schools.find(s => s.id === watchSchoolId)
    if (!school) return
    setSelectedSchoolType(school.school_type)

    fetchGradeLevels(school.school_type).then(fetchedGrades => {
      setGrades(fetchedGrades)
      if (data.grade_level_id && fetchedGrades.some(g => g.id === data.grade_level_id)) {
        setValue('grade_level_id', data.grade_level_id)
      }
    })
  }, [watchSchoolId, schools, data.grade_level_id])

  // Load learning areas when grade changes
  useEffect(() => {
    if (!watchGradeId) {
      setLearningAreas([])
      setValue('learning_area_id', '')
      return
    }
    const grade = grades.find(g => g.id === watchGradeId)
    setSelectedGradeNumber(grade?.grade_number || 0)
    
    fetchLearningAreasForGrade(watchGradeId).then(fetchedLAs => {
      setLearningAreas(fetchedLAs)
      if (data.learning_area_id && fetchedLAs.some(la => la.id === data.learning_area_id)) {
        setValue('learning_area_id', data.learning_area_id)
      } else {
        setValue('learning_area_id', '')
      }
    })
  }, [watchGradeId, grades, data.learning_area_id])

  // Auto focus Learning Area / Subject select dropdown when autoFocusLA is true
  useEffect(() => {
    if (autoFocusLA && watchGradeId && learningAreas.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById('learning_area_id') as HTMLSelectElement | null
        if (el && !el.disabled) {
          el.focus()
        }
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [autoFocusLA, watchGradeId, learningAreas])

  // Restriction check: Check if subject data has ALREADY been submitted by any teacher
  useEffect(() => {
    if (watchSchoolId && watchGradeId && watchLAId && watchSYId && watchTermId) {
      setCheckingDuplicate(true)
      checkExistingSubjectSubmission(watchSchoolId, watchGradeId, watchLAId, watchSYId, watchTermId)
        .then(setExistingSub)
        .finally(() => setCheckingDuplicate(false))
    } else {
      setExistingSub(null)
    }
  }, [watchSchoolId, watchGradeId, watchLAId, watchSYId, watchTermId])

  const selectedGrade = grades.find(g => g.id === watchGradeId)

  const onSubmit = (values: TeacherInfoForm) => {
    if (existingSub) return
    const grade = grades.find(g => g.id === values.grade_level_id)
    onNext(values, grade?.grade_number || 0)
  }

  if (loading) {
    return (
      <div className="card p-8 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="card p-6 space-y-6">
        <FormSection title="Teacher Information" description="Enter your personal and class information.">
          {/* Teacher Name */}
          <FormField label="Teacher Name" required error={errors.teacher_name?.message} id="teacher_name">
            <Controller
              name="teacher_name"
              control={control}
              render={({ field }) => (
                <SuggestionInput
                  id="teacher_name"
                  placeholder="e.g., Juan Dela Cruz"
                  suggestions={teacherSuggestions}
                  value={field.value}
                  onChange={e => {
                    field.onChange(e)
                    handleTeacherNameSelect(e.target.value)
                  }}
                  onSelectSuggestion={val => handleTeacherNameSelect(val)}
                />
              )}
            />
          </FormField>

          {/* School Auto-select Notification */}
          {autoSelectedSchoolName && watchSchoolId && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in">
              <Sparkles size={14} className="text-amber-500" />
              <span>Auto-selected <strong>{autoSelectedSchoolName}</strong> from previous records.</span>
            </div>
          )}

          {/* School */}
          <FormField label="School Name" required error={errors.school_id?.message} id="school_id">
            <Controller
              name="school_id"
              control={control}
              render={({ field }) => (
                <select id="school_id" className="form-select" {...field}>
                  <option value="">Select school...</option>
                  <optgroup label="Elementary Schools">
                    {schools.filter(s => s.school_type === 'elementary').map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Secondary Schools">
                    {schools.filter(s => s.school_type === 'secondary').map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                </select>
              )}
            />
          </FormField>

          {/* Grade */}
          <FormField
            label="Grade Level"
            required
            error={errors.grade_level_id?.message}
            id="grade_level_id"
            hint={!watchSchoolId ? 'Please select a school first.' : undefined}
          >
            <Controller
              name="grade_level_id"
              control={control}
              render={({ field }) => (
                <select id="grade_level_id" className="form-select" disabled={!watchSchoolId} {...field}>
                  <option value="">Select grade level...</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* Key Stage indicator */}
          {selectedGrade && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-deped-blue-light text-sm text-deped-blue animate-fade-in">
              <span className="font-semibold">Key Stage determined:</span>
              <span className="font-bold">{getKeyStageLabel(selectedGrade.key_stage)}</span>
            </div>
          )}

          {/* Learning Area */}
          <FormField
            label="Learning Area / Subject"
            required
            error={errors.learning_area_id?.message}
            id="learning_area_id"
            hint={!watchGradeId ? 'Please select a grade level first.' : undefined}
          >
            <Controller
              name="learning_area_id"
              control={control}
              render={({ field }) => (
                <select id="learning_area_id" className="form-select" disabled={!watchGradeId} {...field}>
                  <option value="">Select learning area...</option>
                  {learningAreas.map(la => (
                    <option key={la.id} value={la.id}>{la.name}</option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* School Year */}
          <FormField label="School Year" required error={errors.school_year_id?.message} id="school_year_id">
            <Controller
              name="school_year_id"
              control={control}
              render={({ field }) => (
                <select id="school_year_id" className="form-select" {...field}>
                  <option value="">Select school year...</option>
                  {schoolYears.map(sy => (
                    <option key={sy.id} value={sy.id}>{sy.name}</option>
                  ))}
                </select>
              )}
            />
          </FormField>

          {/* Term */}
          <FormField label="Term / Quarter" required error={errors.term_id?.message} id="term_id">
            <Controller
              name="term_id"
              control={control}
              render={({ field }) => {
                const storedDefaultTermId = localStorage.getItem('termcat_default_term_id')
                return (
                  <select id="term_id" className="form-select" {...field}>
                    <option value="">Select term...</option>
                    {terms.map(t => {
                      const isDefault = t.is_default || t.id === storedDefaultTermId || (!storedDefaultTermId && t.sort_order === 1)
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} {isDefault ? ' (Default)' : ''}
                        </option>
                      )
                    })}
                  </select>
                )
              }}
            />
          </FormField>
        </FormSection>

        {/* Existing Submission Restriction Alert */}
        {existingSub && (
          <div className="card p-4 bg-red-50 border-2 border-red-300 text-red-900 rounded-xl space-y-2 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <Ban size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm text-red-900 flex items-center gap-1.5">
                  Submission Restricted — Subject Data Already Logged!
                </p>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  A TERMCAT evaluation form has already been submitted for{' '}
                  <strong>{existingSub.school?.name}</strong> · <strong>{existingSub.grade_level?.name}</strong> · <strong>{existingSub.learning_area?.name}</strong> for {existingSub.term?.name}.
                </p>
                <div className="mt-2 p-2 bg-white/80 rounded-lg border border-red-200 text-xs text-red-900">
                  <span>Logged by: <strong>{existingSub.teacher_name}</strong></span> ·{' '}
                  <span>Ref No: <strong className="font-mono">{existingSub.reference_number}</strong></span>
                </div>
                <p className="text-[11px] text-red-600 italic mt-1">
                  Duplicate submissions for the exact same grade level and learning area are restricted to maintain division data integrity.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Available Subject Confirmation Badge */}
        {!existingSub && watchSchoolId && watchGradeId && watchLAId && watchSYId && watchTermId && !checkingDuplicate && (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl animate-fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>Subject available for submission. No prior evaluation logged for this grade and learning area.</span>
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          type="submit"
          id="step1-continue"
          disabled={!!existingSub || checkingDuplicate}
          className={`btn-lg ${existingSub ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-transparent' : 'btn-primary'}`}
          title={existingSub ? 'Data for this subject and grade level has already been submitted.' : undefined}
        >
          {checkingDuplicate ? 'Verifying...' : 'Continue'}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  )
}

