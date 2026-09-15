import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { competencySummarySchema } from '@/lib/validation/schemas'
import { FormSection, FormField, NumberField } from '@/components/forms/FormField'
import { SuggestionTextarea } from '@/components/forms/SuggestionTextarea'
import { fetchUntaughtReasonsSuggestions } from '@/lib/supabase/suggestions'
import type { CompetencySummary } from '@/types'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface Props {
  data: CompetencySummary
  isKS1: boolean
  onNext: (data: CompetencySummary) => void
  onBack: () => void
}

export function Step3CompetencyData({ data, isKS1, onNext, onBack }: Props) {
  const [reasonsSuggestions, setReasonsSuggestions] = useState<string[]>([])
  const { handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(competencySummarySchema),
    defaultValues: data,
  })
  const values = watch()

  useEffect(() => {
    fetchUntaughtReasonsSuggestions().then(setReasonsSuggestions)
  }, [])

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="card p-6 space-y-6">
        <FormSection
          title="Competency Summary"
          description="Enter the total number of intended, taught, and untaught competencies for this term."
        >
          <FormField
            label="Total Intended Competencies"
            required
            error={(errors as any).total_intended_competencies?.message}
            id="total_intended"
          >
            <NumberField
              id="total_intended"
              value={values.total_intended_competencies}
              onChange={v => setValue('total_intended_competencies', v)}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Competencies Taught"
              required
              error={(errors as any).competencies_taught?.message}
              id="competencies_taught"
            >
              <NumberField
                id="competencies_taught"
                value={values.competencies_taught}
                onChange={v => setValue('competencies_taught', v)}
              />
            </FormField>

            <FormField
              label="Competencies Not Taught"
              required
              error={(errors as any).competencies_not_taught?.message}
              id="competencies_not_taught"
            >
              <NumberField
                id="competencies_not_taught"
                value={values.competencies_not_taught}
                onChange={v => setValue('competencies_not_taught', v)}
              />
            </FormField>
          </div>

          {/* Validation summary */}
          {values.total_intended_competencies > 0 && (
            <div className={`text-xs px-3 py-2 rounded ${
              values.competencies_taught + values.competencies_not_taught <= values.total_intended_competencies
                ? 'bg-deped-green-light text-green-800'
                : 'bg-deped-red-light text-deped-red'
            }`}>
              Taught + Not Taught = {values.competencies_taught + values.competencies_not_taught}{' '}
              / Total = {values.total_intended_competencies}
            </div>
          )}
        </FormSection>

        <div className="divider" />

        <FormSection
          title="Reasons for Untaught Competencies"
          description={`Explain why certain competencies were not taught this term. ${values.competencies_not_taught === 0 ? 'Leave blank if all competencies were taught.' : ''}`}
        >
          <FormField label="Reasons" id="reasons_for_untaught" error={(errors as any).reasons_for_untaught?.message}>
            <SuggestionTextarea
              id="reasons_for_untaught"
              placeholder="e.g., Limited time due to school events; complex topic required extended instruction; limited learning materials..."
              suggestions={reasonsSuggestions}
              value={values.reasons_for_untaught || ''}
              onChange={e => setValue('reasons_for_untaught', e.target.value)}
              onSelectSuggestion={val => setValue('reasons_for_untaught', val)}
            />
          </FormField>
        </FormSection>
      </div>

      <div className="flex justify-between mt-4">
        <button type="button" className="btn-md btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" id="step3-continue" className="btn-md btn-primary">
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}
