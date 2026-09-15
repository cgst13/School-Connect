import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ks1LearnerDataSchema, ks2to4LearnerDataSchema } from '@/lib/validation/schemas'
import { FormSection, FormField, NumberField, DecimalField } from '@/components/forms/FormField'
import type { KS1LearnerData, KS2to4LearnerData } from '@/types'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface Props {
  isKS1: boolean
  ks1Data: KS1LearnerData
  ks2to4Data: KS2to4LearnerData
  onNext: (ks1?: KS1LearnerData, ks24?: KS2to4LearnerData) => void
  onBack: () => void
}

function KS1Form({ data, onNext, onBack }: { data: KS1LearnerData; onNext: (d: KS1LearnerData) => void; onBack: () => void }) {
  const { handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(ks1LearnerDataSchema),
    defaultValues: data,
  })
  const values = watch()

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="card p-6 space-y-6">
        <FormSection
          title="Key Stage 1 — Learner Information"
          description="Enter the number of learners in each performance level for Grade 1–3."
        >
          <FormField label="Total Number of Learners" required error={(errors as any).total_learners?.message} id="total_learners">
            <NumberField id="total_learners" value={values.total_learners} onChange={v => setValue('total_learners', v)} />
          </FormField>
        </FormSection>

        <div className="divider" />

        <FormSection title="Performance Levels" description="Enter the count of learners per performance level.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { key: 'advancing', label: 'Advancing' },
              { key: 'benchmarking', label: 'Benchmarking' },
              { key: 'connecting', label: 'Connecting' },
              { key: 'developing', label: 'Developing' },
              { key: 'emerging', label: 'Emerging' },
            ].map(({ key, label }) => (
              <FormField key={key} label={label} id={key} error={(errors as any)[key]?.message}>
                <NumberField
                  id={key}
                  value={(values as any)[key]}
                  onChange={v => setValue(key as any, v)}
                />
              </FormField>
            ))}
          </div>
          {/* Sum indicator */}
          <div className="text-xs text-content-secondary bg-surface-soft rounded px-3 py-2">
            Performance total:{' '}
            <span className="font-semibold text-content-primary">
              {values.advancing + values.benchmarking + values.connecting + values.developing + values.emerging}
            </span>
            {' '}/ Total learners: <span className="font-semibold">{values.total_learners}</span>
          </div>
        </FormSection>
      </div>
      <div className="flex justify-between mt-4">
        <button type="button" className="btn-md btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" id="step2-continue-ks1" className="btn-md btn-primary">
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}

function KS2to4Form({ data, onNext, onBack }: { data: KS2to4LearnerData; onNext: (d: KS2to4LearnerData) => void; onBack: () => void }) {
  const { handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(ks2to4LearnerDataSchema),
    defaultValues: data,
  })
  const values = watch()

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <div className="card p-6 space-y-6">
        <FormSection
          title="Learner & Assessment Data"
          description="Enter the total number of learners and the Mean Percentage Score (MPS) for this class."
        >
          <FormField label="Total Number of Learners" required error={(errors as any).total_learners?.message} id="total_learners_ks24">
            <NumberField id="total_learners_ks24" value={values.total_learners} onChange={v => setValue('total_learners', v)} />
          </FormField>

          <FormField
            label="MPS (Mean Percentage Score)"
            required
            error={(errors as any).mps?.message}
            hint="Enter a value between 0 and 100. Decimal values are accepted (e.g., 85.42)."
            id="mps"
          >
            <DecimalField
              id="mps"
              value={values.mps}
              onChange={v => setValue('mps', v)}
              min={0}
              max={100}
              placeholder="e.g., 85.42"
            />
          </FormField>
        </FormSection>
      </div>
      <div className="flex justify-between mt-4">
        <button type="button" className="btn-md btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" id="step2-continue-ks24" className="btn-md btn-primary">
          Continue <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}

export function Step2LearnerData({ isKS1, ks1Data, ks2to4Data, onNext, onBack }: Props) {
  if (isKS1) {
    return (
      <KS1Form
        data={ks1Data}
        onNext={(d) => onNext(d, undefined)}
        onBack={onBack}
      />
    )
  }
  return (
    <KS2to4Form
      data={ks2to4Data}
      onNext={(d) => onNext(undefined, d)}
      onBack={onBack}
    />
  )
}
