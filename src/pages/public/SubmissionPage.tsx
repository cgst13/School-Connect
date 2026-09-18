import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { FormStepper } from '@/components/forms/FormStepper'
import { Step1TeacherInfo } from '@/features/submissions/steps/Step1TeacherInfo'
import { Step2LearnerData } from '@/features/submissions/steps/Step2LearnerData'
import { Step3CompetencyData } from '@/features/submissions/steps/Step3CompetencyData'
import { Step4CompetencyAnalysis } from '@/features/submissions/steps/Step4CompetencyAnalysis'
import { Step5Review } from '@/features/submissions/steps/Step5Review'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft/draftManager'
import {
  createSubmission, generateReferenceNumber, checkDuplicateSubmission,
  fetchSchools, fetchGradeLevels, fetchLearningAreas
} from '@/lib/supabase/queries'
import { saveLocalSuggestion, saveTeacherSchoolMapping } from '@/lib/supabase/suggestions'
import { useToast } from '@/hooks/useToast'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { FullSubmissionFormData, TeacherInfo, KS1LearnerData, KS2to4LearnerData, CompetencySummary, TopCompetenciesData, InstructionalDifficulty, School, GradeLevel, LearningArea } from '@/types'
import { SuccessPage } from './SuccessPage'

const STEPS = [
  { number: 1, label: 'Teacher Info' },
  { number: 2, label: 'Learner Data' },
  { number: 3, label: 'Competencies' },
  { number: 4, label: 'Analysis' },
  { number: 5, label: 'Review' },
]

const EMPTY_FORM: FullSubmissionFormData = {
  teacherInfo: {
    teacher_name: '',
    school_id: '',
    grade_level_id: '',
    learning_area_id: '',
    school_year_id: '',
    term_id: '',
  },
  ks1LearnerData: {
    total_learners: 0,
    advancing: 0,
    benchmarking: 0,
    connecting: 0,
    developing: 0,
    emerging: 0,
  },
  ks2to4LearnerData: {
    total_learners: 0,
    mps: null,
  },
  competencySummary: {
    total_intended_competencies: 0,
    competencies_taught: 0,
    competencies_not_taught: 0,
    reasons_for_untaught: '',
  },
  topCompetencies: {
    most_learned: ['', '', '', '', ''],
    least_mastered: ['', '', '', '', ''],
    most_difficult_to_teach: ['', '', '', '', ''],
  },
  instructionalDifficulty: {
    factors_text: '',
  },
}

export function SubmissionPage() {
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const isOnline = useOnlineStatus()

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FullSubmissionFormData>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedRef, setSubmittedRef] = useState<string | null>(null)
  const [gradeNumber, setGradeNumber] = useState<number>(1)

  // Load draft on mount
  useEffect(() => {
    const useDraft = searchParams.get('draft') === 'true'
    const newSub = searchParams.get('new') === 'true'
    if (useDraft) {
      const draft = loadDraft()
      if (draft) {
        setCurrentStep(draft.step)
        setFormData({ ...EMPTY_FORM, ...draft.formData } as FullSubmissionFormData)
        toast('Draft loaded. Continue where you left off.', 'info')
      }
    } else if (newSub) {
      clearDraft()
      setFormData(EMPTY_FORM)
      setCurrentStep(1)
    }
  }, [])

  // Auto-save on form change
  const autoSave = useCallback((step: number, data: Partial<FullSubmissionFormData>) => {
    saveDraft(step, data)
  }, [])

  const updateFormData = useCallback(<K extends keyof FullSubmissionFormData>(
    key: K,
    value: FullSubmissionFormData[K]
  ) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value }
      autoSave(currentStep, next)
      return next
    })
  }, [currentStep, autoSave])

  const handleNext = useCallback((stepData?: Partial<FullSubmissionFormData>) => {
    if (stepData) {
      setFormData(prev => {
        const next = { ...prev, ...stepData }
        autoSave(currentStep + 1, next)
        return next
      })
    }
    setCurrentStep(s => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep, autoSave])

  const handleBack = useCallback(() => {
    setCurrentStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleGoToStep = useCallback((step: number) => {
    setCurrentStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!isOnline) {
      toast('You are offline. Please connect to the internet to submit.', 'warning', 6000)
      return
    }

    setIsSubmitting(true)
    try {
      // Duplicate detection
      const ti = formData.teacherInfo
      const duplicate = await checkDuplicateSubmission(
        ti.teacher_name,
        ti.school_id,
        ti.grade_level_id,
        ti.learning_area_id,
        ti.school_year_id,
        ti.term_id
      )
      if (duplicate) {
        toast(
          `A submission already exists for these details (Ref: ${duplicate.reference_number}). Please verify your information or contact the Administrative Officer.`,
          'warning',
          10000
        )
        setIsSubmitting(false)
        return
      }

      const refNumber = await generateReferenceNumber()
      await createSubmission(formData, refNumber)

      // Save entered character/text fields to local suggestion history
      try {
        saveLocalSuggestion('teachers', formData.teacherInfo.teacher_name)
        saveTeacherSchoolMapping(formData.teacherInfo.teacher_name, formData.teacherInfo.school_id)
        saveLocalSuggestion('reasons', formData.competencySummary.reasons_for_untaught)
        formData.topCompetencies.most_learned.forEach(c => saveLocalSuggestion('competencies', c))
        formData.topCompetencies.least_mastered.forEach(c => saveLocalSuggestion('competencies', c))
        formData.topCompetencies.most_difficult_to_teach.forEach(c => saveLocalSuggestion('competencies', c))
        saveLocalSuggestion('difficulties', formData.instructionalDifficulty.factors_text)
      } catch {
        // Ignore storage errors
      }

      clearDraft()
      setSubmittedRef(refNumber)
      toast('Submission successful!', 'success')
    } catch (err: any) {
      console.error('Error creating submission:', err)
      const is409 = err?.status === 409 || err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')
      const is401 = err?.status === 401 || err?.code === '42501' || err?.message?.includes('row-level security')
      const msg = is409
        ? 'A submission already exists for this Teacher, School, Grade Level, Subject, School Year, and Quarter. Duplicate submissions are not allowed.'
        : is401
        ? 'Database RLS Permission Error on submission child data. Please run migration 014 in Supabase SQL Editor.'
        : err?.message?.includes('network') || err?.code === 'PGRST'
        ? 'Network connection error. Please check your internet and try again.'
        : 'An error occurred while saving your submission. Please try again.'
      toast(msg, 'error', 10000)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, isOnline, toast])

  const [autoFocusLA, setAutoFocusLA] = useState(false)

  const handleSubmitAnother = useCallback(() => {
    const prevTeacherInfo = formData.teacherInfo
    const resetForm: FullSubmissionFormData = {
      ...EMPTY_FORM,
      teacherInfo: {
        ...prevTeacherInfo,
        learning_area_id: '',
      },
    }

    clearDraft()
    setFormData(resetForm)
    setSubmittedRef(null)
    setCurrentStep(1)
    setAutoFocusLA(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [formData.teacherInfo])

  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])

  useEffect(() => {
    Promise.all([
      fetchSchools(false),
      fetchGradeLevels(),
      fetchLearningAreas(false),
    ]).then(([s, g, la]) => {
      setSchools(s)
      setGrades(g)
      setLearningAreas(la)
    })
  }, [])

  const selectedGrade = grades.find(g => g.id === formData.teacherInfo.grade_level_id)
  const selectedLA = learningAreas.find(l => l.id === formData.teacherInfo.learning_area_id)
  const selectedSchool = schools.find(s => s.id === formData.teacherInfo.school_id)

  // Show success page after submit
  if (submittedRef) {
    return (
      <SuccessPage
        referenceNumber={submittedRef}
        formData={formData}
        onSubmitAnother={handleSubmitAnother}
      />
    )
  }

  const isKS1 = gradeNumber <= 3

  return (
    <PublicLayout>
      <div className="w-full px-4 sm:px-8 py-6 sm:py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="page-title">TERMCAT Submission</h1>
          <p className="text-sm text-content-secondary mt-1">
            Complete all sections to submit your TERMCAT data.
          </p>
        </div>

        {/* Stepper */}
        <div className="card p-4 mb-6">
          <FormStepper
            steps={STEPS}
            currentStep={currentStep}
            selectedContext={{
              gradeName: selectedGrade?.name,
              learningAreaName: selectedLA?.name,
              schoolName: selectedSchool?.name,
              teacherName: formData.teacherInfo.teacher_name,
            }}
            onEditStep1={() => handleGoToStep(1)}
          />
        </div>

        {/* Step content */}
        <div className="animate-fade-in">
          {currentStep === 1 && (
            <Step1TeacherInfo
              data={formData.teacherInfo}
              autoFocusLA={autoFocusLA}
              onNext={(data, gn) => {
                setAutoFocusLA(false)
                setGradeNumber(gn)
                handleNext({ teacherInfo: data })
              }}
            />
          )}
          {currentStep === 2 && (
            <Step2LearnerData
              isKS1={isKS1}
              ks1Data={formData.ks1LearnerData!}
              ks2to4Data={formData.ks2to4LearnerData!}
              onNext={(ks1, ks24) => handleNext({ ks1LearnerData: ks1, ks2to4LearnerData: ks24 })}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <Step3CompetencyData
              data={formData.competencySummary}
              isKS1={isKS1}
              onNext={(data) => handleNext({ competencySummary: data })}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <Step4CompetencyAnalysis
              topCompetencies={formData.topCompetencies}
              instructionalDifficulty={formData.instructionalDifficulty}
              onNext={(tc, id) => handleNext({ topCompetencies: tc, instructionalDifficulty: id })}
              onBack={handleBack}
            />
          )}
          {currentStep === 5 && (
            <Step5Review
              formData={formData}
              gradeNumber={gradeNumber}
              isKS1={isKS1}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onBack={handleBack}
              onEditStep={handleGoToStep}
            />
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
