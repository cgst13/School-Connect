import { useState, useEffect } from 'react'
import { FormSection, FormField } from '@/components/forms/FormField'
import { SuggestionInput } from '@/components/forms/SuggestionInput'
import { SuggestionTextarea } from '@/components/forms/SuggestionTextarea'
import { fetchCompetencySuggestions, fetchDifficultyFactorsSuggestions } from '@/lib/supabase/suggestions'
import type { TopCompetenciesData, InstructionalDifficulty } from '@/types'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface Props {
  topCompetencies: TopCompetenciesData
  instructionalDifficulty: InstructionalDifficulty
  onNext: (tc: TopCompetenciesData, id: InstructionalDifficulty) => void
  onBack: () => void
}

interface RankedListProps {
  label: string
  description: string
  values: string[]
  suggestions?: string[]
  onChange: (values: string[]) => void
  idPrefix: string
}

function RankedList({ label, description, values, suggestions = [], onChange, idPrefix }: RankedListProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-content-primary">{label}</p>
        <p className="text-xs text-content-secondary">{description}</p>
      </div>
      {values.map((val, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-deped-blue-light text-deped-blue text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2">
            {i + 1}
          </span>
          <div className="flex-1">
            <SuggestionInput
              id={`${idPrefix}-${i + 1}`}
              placeholder={`${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} competency...`}
              suggestions={suggestions}
              value={val}
              onChange={e => {
                const next = [...values]
                next[i] = e.target.value
                onChange(next)
              }}
              onSelectSuggestion={selectedVal => {
                const next = [...values]
                next[i] = selectedVal
                onChange(next)
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Step4CompetencyAnalysis({ topCompetencies, instructionalDifficulty, onNext, onBack }: Props) {
  const [tc, setTc] = useState<TopCompetenciesData>(topCompetencies)
  const [id, setId] = useState<InstructionalDifficulty>(instructionalDifficulty)
  const [compSuggestions, setCompSuggestions] = useState<string[]>([])
  const [diffSuggestions, setDiffSuggestions] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetchCompetencySuggestions(),
      fetchDifficultyFactorsSuggestions(),
    ]).then(([cs, ds]) => {
      setCompSuggestions(cs)
      setDiffSuggestions(ds)
    })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext(tc, id)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="card p-6 space-y-8">
        <RankedList
          label="Top 5 Most Learned Competencies"
          description="List the competencies that learners mastered most this term."
          values={tc.most_learned}
          suggestions={compSuggestions}
          onChange={v => setTc(prev => ({ ...prev, most_learned: v }))}
          idPrefix="most-learned"
        />

        <div className="divider" />

        <RankedList
          label="Top 5 Least Mastered Competencies"
          description="List the competencies that learners struggled with most this term."
          values={tc.least_mastered}
          suggestions={compSuggestions}
          onChange={v => setTc(prev => ({ ...prev, least_mastered: v }))}
          idPrefix="least-mastered"
        />

        <div className="divider" />

        <RankedList
          label="Top 5 Most Difficult to Teach"
          description="List the competencies that were most difficult to teach this term."
          values={tc.most_difficult_to_teach}
          suggestions={compSuggestions}
          onChange={v => setTc(prev => ({ ...prev, most_difficult_to_teach: v }))}
          idPrefix="most-difficult"
        />

        <div className="divider" />

        <FormSection
          title="Factors Contributing to Instructional Difficulty"
          description="Describe the factors that made teaching difficult during this term."
        >
          <FormField label="Instructional Difficulty Factors" id="instructional_difficulty">
            <SuggestionTextarea
              id="instructional_difficulty"
              placeholder="e.g., Limited reference materials, large class size, varied learning levels, absence of learners during key lessons..."
              suggestions={diffSuggestions}
              value={id.factors_text}
              onChange={e => setId({ factors_text: e.target.value })}
              onSelectSuggestion={selectedVal => setId({ factors_text: selectedVal })}
            />
          </FormField>
        </FormSection>
      </div>

      <div className="flex justify-between mt-4">
        <button type="button" className="btn-md btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <button type="submit" id="step4-continue" className="btn-md btn-primary">
          Review Submission <ArrowRight size={16} />
        </button>
      </div>
    </form>
  )
}

