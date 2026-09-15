import { useEffect, useState } from 'react'
import type { FullSubmissionFormData } from '@/types'
import { fetchSchools, fetchGradeLevels, fetchLearningAreas, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import { getKeyStageLabel } from '@/utils/keyStage'
import { ArrowLeft, Pencil, Send } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/EmptyState'

interface Props {
  formData: FullSubmissionFormData
  gradeNumber: number
  isKS1: boolean
  isSubmitting: boolean
  onSubmit: () => void
  onBack: () => void
  onEditStep: (step: number) => void
}

function ReviewRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between py-2.5 border-b border-surface-border last:border-0 gap-1">
      <span className="text-xs font-medium text-content-secondary uppercase tracking-wide">{label}</span>
      <span className="text-sm text-content-primary font-medium sm:text-right">{value || '—'}</span>
    </div>
  )
}

function SectionCard({
  title, step, onEdit, children
}: { title: string; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-soft border-b border-surface-border">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="btn-ghost btn-sm text-deped-blue"
          aria-label={`Edit ${title}`}
        >
          <Pencil size={14} /> Edit
        </button>
      </div>
      <div className="px-4">{children}</div>
    </div>
  )
}

export function Step5Review({ formData, gradeNumber, isKS1, isSubmitting, onSubmit, onBack, onEditStep }: Props) {
  const [labels, setLabels] = useState<{
    school: string; grade: string; la: string; sy: string; term: string
  }>({ school: '', grade: '', la: '', sy: '', term: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSchools(false), fetchGradeLevels(), fetchLearningAreas(false), fetchSchoolYears(false), fetchTerms(false)])
      .then(([schools, grades, las, sys, terms]) => {
        const ti = formData.teacherInfo
        setLabels({
          school: schools.find(s => s.id === ti.school_id)?.name || '',
          grade: grades.find(g => g.id === ti.grade_level_id)?.name || '',
          la: las.find(la => la.id === ti.learning_area_id)?.name || '',
          sy: sys.find(sy => sy.id === ti.school_year_id)?.name || '',
          term: terms.find(t => t.id === ti.term_id)?.name || '',
        })
      })
      .finally(() => setLoading(false))
  }, [formData])

  if (loading) return <div className="card p-8 flex justify-center"><LoadingSpinner /></div>

  const keyStageLabel = isKS1 ? getKeyStageLabel('ks1') :
    gradeNumber <= 6 ? getKeyStageLabel('ks2') :
    gradeNumber <= 10 ? getKeyStageLabel('ks3') : getKeyStageLabel('ks4')

  const { ks1LearnerData: k1, ks2to4LearnerData: k24, competencySummary: cs, topCompetencies: tc, instructionalDifficulty: id } = formData

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-deped-blue-light border-deped-blue/20">
        <p className="text-sm text-deped-blue font-medium">
          Please review all information below before submitting. Use the Edit buttons to make corrections.
        </p>
      </div>

      {/* Teacher Info */}
      <SectionCard title="Teacher Information" step={1} onEdit={onEditStep}>
        <ReviewRow label="Teacher Name" value={formData.teacherInfo.teacher_name} />
        <ReviewRow label="School" value={labels.school} />
        <ReviewRow label="Grade Level" value={labels.grade} />
        <ReviewRow label="Key Stage" value={keyStageLabel} />
        <ReviewRow label="Learning Area" value={labels.la} />
        <ReviewRow label="School Year" value={labels.sy} />
        <ReviewRow label="Term" value={labels.term} />
      </SectionCard>

      {/* Learner Data */}
      <SectionCard title="Learner & Assessment Data" step={2} onEdit={onEditStep}>
        {isKS1 ? (
          <>
            <ReviewRow label="Total Learners" value={k1?.total_learners} />
            <ReviewRow label="Advancing" value={k1?.advancing} />
            <ReviewRow label="Benchmarking" value={k1?.benchmarking} />
            <ReviewRow label="Connecting" value={k1?.connecting} />
            <ReviewRow label="Developing" value={k1?.developing} />
            <ReviewRow label="Emerging" value={k1?.emerging} />
          </>
        ) : (
          <>
            <ReviewRow label="Total Learners" value={k24?.total_learners} />
            <ReviewRow label="MPS" value={k24?.mps !== null ? `${k24?.mps}%` : '—'} />
          </>
        )}
      </SectionCard>

      {/* Competency Summary */}
      <SectionCard title="Competency Summary" step={3} onEdit={onEditStep}>
        <ReviewRow label="Total Intended" value={cs.total_intended_competencies} />
        <ReviewRow label="Taught" value={cs.competencies_taught} />
        <ReviewRow label="Not Taught" value={cs.competencies_not_taught} />
        <ReviewRow label="Reasons (untaught)" value={cs.reasons_for_untaught || '—'} />
      </SectionCard>

      {/* Competency Analysis */}
      <SectionCard title="Competency Analysis" step={4} onEdit={onEditStep}>
        <div className="py-2 space-y-3">
          {[
            { label: 'Most Learned', items: tc.most_learned },
            { label: 'Least Mastered', items: tc.least_mastered },
            { label: 'Most Difficult to Teach', items: tc.most_difficult_to_teach },
          ].map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1">{label}</p>
              <ol className="space-y-0.5">
                {items.map((item, i) => item && (
                  <li key={i} className="text-sm text-content-primary flex gap-2">
                    <span className="text-content-tertiary">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <div>
            <p className="text-xs font-semibold text-content-secondary uppercase tracking-wide mb-1">Instructional Difficulty Factors</p>
            <p className="text-sm text-content-primary">{id.factors_text || '—'}</p>
          </div>
        </div>
      </SectionCard>

      {/* Submit */}
      <div className="flex justify-between mt-2">
        <button type="button" className="btn-md btn-secondary" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft size={16} /> Back
        </button>
        <button
          id="submit-termcat"
          type="button"
          className="btn-lg btn-primary"
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-label="Submit TERMCAT data"
        >
          {isSubmitting ? (
            <>Submitting...</>
          ) : (
            <><Send size={18} /> Submit Data</>
          )}
        </button>
      </div>
    </div>
  )
}
