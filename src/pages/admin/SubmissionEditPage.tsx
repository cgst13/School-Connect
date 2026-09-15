import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { PageLoader } from '@/components/ui/EmptyState'
import { SuggestionInput } from '@/components/forms/SuggestionInput'
import { SuggestionTextarea } from '@/components/forms/SuggestionTextarea'
import { parseFactorsText, formatFactorsList } from '@/features/submissions/steps/Step4CompetencyAnalysis'

import {
  fetchSubmissionById,
  updateSubmissionData,
  fetchSchools,
  fetchGradeLevels,
  fetchLearningAreas,
  fetchSchoolYears,
  fetchTerms,
  insertAuditLog
} from '@/lib/supabase/queries'
import { fetchCompetencySuggestions, fetchDifficultyFactorsSuggestions, fetchUntaughtReasonsSuggestions } from '@/lib/supabase/suggestions'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { TermcatSubmission, FullSubmissionFormData, School, GradeLevel, LearningArea, SchoolYear, Term } from '@/types'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'

export function SubmissionEditPage() {
  const { id } = useParams<{ id: string }>()
  const { admin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submission, setSubmission] = useState<TermcatSubmission | null>(null)

  // Master options
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])

  // Suggestions
  const [compSuggestions, setCompSuggestions] = useState<string[]>([])
  const [diffSuggestions, setDiffSuggestions] = useState<string[]>([])
  const [reasonsSuggestions, setReasonsSuggestions] = useState<string[]>([])

  // Form State
  const [formData, setFormData] = useState<FullSubmissionFormData>({
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
  })

  useEffect(() => {
    Promise.all([
      fetchSchools(false),
      fetchGradeLevels(),
      fetchLearningAreas(false),
      fetchSchoolYears(false),
      fetchTerms(false),
      fetchCompetencySuggestions(),
      fetchDifficultyFactorsSuggestions(),
      fetchUntaughtReasonsSuggestions(),
    ]).then(([s, g, la, sy, t, cs, ds, rs]) => {
      setSchools(s)
      setGrades(g)
      setLearningAreas(la)
      setSchoolYears(sy)
      setTerms(t)
      setCompSuggestions(cs)
      setDiffSuggestions(ds)
      setReasonsSuggestions(rs)
    })
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const sub = await fetchSubmissionById(id)
      if (!sub) return
      setSubmission(sub)

      const sc = sub.submission_competencies || []
      const getCatTexts = (cat: string) => {
        const items = sc.filter(c => c.category === cat).sort((a, b) => a.rank - b.rank)
        const arr = ['', '', '', '', '']
        items.forEach((item, idx) => {
          if (idx < 5) arr[idx] = item.competency_text
        })
        return arr
      }

      setFormData({
        teacherInfo: {
          teacher_name: sub.teacher_name || '',
          school_id: sub.school_id || '',
          grade_level_id: sub.grade_level_id || '',
          learning_area_id: sub.learning_area_id || '',
          school_year_id: sub.school_year_id || '',
          term_id: sub.term_id || '',
        },
        ks1LearnerData: sub.ks1_learner_data ? {
          total_learners: sub.ks1_learner_data.total_learners || 0,
          advancing: sub.ks1_learner_data.advancing || 0,
          benchmarking: sub.ks1_learner_data.benchmarking || 0,
          connecting: sub.ks1_learner_data.connecting || 0,
          developing: sub.ks1_learner_data.developing || 0,
          emerging: sub.ks1_learner_data.emerging || 0,
        } : { total_learners: 0, advancing: 0, benchmarking: 0, connecting: 0, developing: 0, emerging: 0 },
        ks2to4LearnerData: sub.ks2to4_learner_data ? {
          total_learners: sub.ks2to4_learner_data.total_learners || 0,
          mps: sub.ks2to4_learner_data.mps ?? null,
        } : { total_learners: 0, mps: null },
        competencySummary: sub.competency_summary ? {
          total_intended_competencies: sub.competency_summary.total_intended_competencies || 0,
          competencies_taught: sub.competency_summary.competencies_taught || 0,
          competencies_not_taught: sub.competency_summary.competencies_not_taught || 0,
          reasons_for_untaught: sub.competency_summary.reasons_for_untaught || '',
        } : { total_intended_competencies: 0, competencies_taught: 0, competencies_not_taught: 0, reasons_for_untaught: '' },
        topCompetencies: {
          most_learned: getCatTexts('most_learned'),
          least_mastered: getCatTexts('least_mastered'),
          most_difficult_to_teach: getCatTexts('most_difficult_to_teach'),
        },
        instructionalDifficulty: {
          factors_text: sub.instructional_difficulty?.factors_text || '',
        },
      })
    } catch {
      toast('Failed to load submission.', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submission || !admin || !id) return

    setSaving(true)
    try {
      await updateSubmissionData(id, formData, admin.id)
      await insertAuditLog({
        admin_id: admin.id,
        admin_name: admin.full_name,
        action: 'edit_submission',
        entity_type: 'submission',
        entity_id: id,
        entity_label: submission.reference_number,
      })
      toast('Submission updated successfully!', 'success')
      navigate(`/admin/submissions/${id}`)
    } catch (err: any) {
      toast(err?.message || 'Failed to update submission.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <AdminLayout><PageLoader /></AdminLayout>
  if (!submission) return <AdminLayout><div className="card p-8 text-center"><p>Submission not found.</p></div></AdminLayout>

  const isKS1 = submission.form_type === 'ks1'

  return (
    <AdminLayout>
      <div className="w-full space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <Link to={`/admin/submissions/${id}`} className="btn-sm btn-secondary inline-flex items-center gap-1.5 mb-2">
              <ArrowLeft size={14} /> Back to Details
            </Link>
            <h1 className="page-title">Edit Submission</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ref: <span className="font-mono font-bold text-blue-600">{submission.reference_number}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-md btn-primary shadow-sm"
          >
            <Save size={16} />
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Teacher & School Info */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              1. Teacher & Assignment Info
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="form-label text-xs font-semibold">Teacher Name</label>
                <input
                  type="text"
                  required
                  className="form-input text-sm"
                  value={formData.teacherInfo.teacher_name}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, teacher_name: e.target.value } }))}
                />
              </div>

              <div>
                <label className="form-label text-xs font-semibold">School</label>
                <select
                  required
                  className="form-select text-sm"
                  value={formData.teacherInfo.school_id}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, school_id: e.target.value } }))}
                >
                  <option value="">Select School</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Grade Level</label>
                <select
                  required
                  className="form-select text-sm"
                  value={formData.teacherInfo.grade_level_id}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, grade_level_id: e.target.value } }))}
                >
                  <option value="">Select Grade</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Learning Area / Subject</label>
                <select
                  required
                  className="form-select text-sm"
                  value={formData.teacherInfo.learning_area_id}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, learning_area_id: e.target.value } }))}
                >
                  <option value="">Select Learning Area</option>
                  {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">School Year</label>
                <select
                  required
                  className="form-select text-sm"
                  value={formData.teacherInfo.school_year_id}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, school_year_id: e.target.value } }))}
                >
                  <option value="">Select SY</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label text-xs font-semibold">Quarter / Term</label>
                <select
                  required
                  className="form-select text-sm"
                  value={formData.teacherInfo.term_id}
                  onChange={e => setFormData(p => ({ ...p, teacherInfo: { ...p.teacherInfo, term_id: e.target.value } }))}
                >
                  <option value="">Select Term</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Learner & Assessment Data */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              2. {isKS1 ? 'Key Stage 1 (Grades 1–3) Performance Level Data' : 'Key Stage 2–4 Assessment Data'}
            </h2>
            {isKS1 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="form-label text-xs">Total Learners</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm font-semibold"
                    value={formData.ks1LearnerData?.total_learners ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, total_learners: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs text-emerald-700 font-bold">Advancing</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm"
                    value={formData.ks1LearnerData?.advancing ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, advancing: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs text-amber-700 font-bold">Benchmarking</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm"
                    value={formData.ks1LearnerData?.benchmarking ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, benchmarking: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs text-sky-700 font-bold">Connecting</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm"
                    value={formData.ks1LearnerData?.connecting ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, connecting: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs text-orange-700 font-bold">Developing</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm"
                    value={formData.ks1LearnerData?.developing ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, developing: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs text-red-700 font-bold">Emerging</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm"
                    value={formData.ks1LearnerData?.emerging ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks1LearnerData: { ...p.ks1LearnerData!, emerging: Number(e.target.value) } }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label text-xs">Total Learners</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input text-sm font-semibold"
                    value={formData.ks2to4LearnerData?.total_learners ?? 0}
                    onChange={e => setFormData(p => ({ ...p, ks2to4LearnerData: { ...p.ks2to4LearnerData!, total_learners: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="form-label text-xs font-bold text-blue-700">Mean Percentage Score (MPS %)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    className="form-input text-sm"
                    value={formData.ks2to4LearnerData?.mps ?? ''}
                    onChange={e => setFormData(p => ({ ...p, ks2to4LearnerData: { ...p.ks2to4LearnerData!, mps: e.target.value === '' ? null : Number(e.target.value) } }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Competency Summary */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              3. Competency Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label text-xs">Total Intended Competencies</label>
                <input
                  type="number"
                  min={0}
                  className="form-input text-sm font-semibold"
                  value={formData.competencySummary.total_intended_competencies}
                  onChange={e => setFormData(p => ({ ...p, competencySummary: { ...p.competencySummary, total_intended_competencies: Number(e.target.value) } }))}
                />
              </div>
              <div>
                <label className="form-label text-xs text-emerald-700 font-semibold">Competencies Taught</label>
                <input
                  type="number"
                  min={0}
                  className="form-input text-sm"
                  value={formData.competencySummary.competencies_taught}
                  onChange={e => setFormData(p => ({ ...p, competencySummary: { ...p.competencySummary, competencies_taught: Number(e.target.value) } }))}
                />
              </div>
              <div>
                <label className="form-label text-xs text-red-700 font-semibold">Competencies Not Taught</label>
                <input
                  type="number"
                  min={0}
                  className="form-input text-sm"
                  value={formData.competencySummary.competencies_not_taught}
                  onChange={e => setFormData(p => ({ ...p, competencySummary: { ...p.competencySummary, competencies_not_taught: Number(e.target.value) } }))}
                />
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Reasons for Untaught Competencies</label>
              <SuggestionTextarea
                suggestions={reasonsSuggestions}
                value={formData.competencySummary.reasons_for_untaught}
                onChange={e => setFormData(p => ({ ...p, competencySummary: { ...p.competencySummary, reasons_for_untaught: e.target.value } }))}
                onSelectSuggestion={val => setFormData(p => ({ ...p, competencySummary: { ...p.competencySummary, reasons_for_untaught: val } }))}
                placeholder="e.g., Suspended classes due to inclement weather, school events..."
                className="form-textarea min-h-[90px]"
              />
            </div>
          </div>

          {/* Section 4: Ranked Competency Analysis */}
          <div className="card p-5 space-y-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              4. Competency Analysis & Difficulty Factors
            </h2>

            {/* Top 5 Most Learned */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                Top 5 Most Learned Competencies
              </h3>
              {formData.topCompetencies.most_learned.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <SuggestionInput
                      suggestions={compSuggestions}
                      value={val}
                      onChange={e => {
                        const arr = [...formData.topCompetencies.most_learned]
                        arr[idx] = e.target.value
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, most_learned: arr } }))
                      }}
                      onSelectSuggestion={selected => {
                        const arr = [...formData.topCompetencies.most_learned]
                        arr[idx] = selected
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, most_learned: arr } }))
                      }}
                      placeholder={`Most learned competency ${idx + 1}...`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            {/* Top 5 Least Mastered */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                Top 5 Least Mastered Competencies
              </h3>
              {formData.topCompetencies.least_mastered.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <SuggestionInput
                      suggestions={compSuggestions}
                      value={val}
                      onChange={e => {
                        const arr = [...formData.topCompetencies.least_mastered]
                        arr[idx] = e.target.value
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, least_mastered: arr } }))
                      }}
                      onSelectSuggestion={selected => {
                        const arr = [...formData.topCompetencies.least_mastered]
                        arr[idx] = selected
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, least_mastered: arr } }))
                      }}
                      placeholder={`Least mastered competency ${idx + 1}...`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            {/* Top 5 Most Difficult */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide">
                Top 5 Most Difficult to Teach
              </h3>
              {formData.topCompetencies.most_difficult_to_teach.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <SuggestionInput
                      suggestions={compSuggestions}
                      value={val}
                      onChange={e => {
                        const arr = [...formData.topCompetencies.most_difficult_to_teach]
                        arr[idx] = e.target.value
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, most_difficult_to_teach: arr } }))
                      }}
                      onSelectSuggestion={selected => {
                        const arr = [...formData.topCompetencies.most_difficult_to_teach]
                        arr[idx] = selected
                        setFormData(p => ({ ...p, topCompetencies: { ...p.topCompetencies, most_difficult_to_teach: arr } }))
                      }}
                      placeholder={`Most difficult to teach competency ${idx + 1}...`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            {/* Factors Contributing to Instructional Difficulty */}
            <div className="space-y-3">
              <div>
                <label className="form-label text-xs font-semibold">Top 5 Factors Contributing to Instructional Difficulty</label>
                <p className="text-xs text-content-tertiary">List up to 5 factors that contributed to instructional difficulty.</p>
              </div>

              {parseFactorsText(formData.instructionalDifficulty.factors_text).map((factorVal, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-deped-blue-light text-deped-blue text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <SuggestionInput
                      suggestions={diffSuggestions}
                      value={factorVal}
                      onChange={e => {
                        const currentList = parseFactorsText(formData.instructionalDifficulty.factors_text)
                        currentList[idx] = e.target.value
                        setFormData(p => ({
                          ...p,
                          instructionalDifficulty: { factors_text: formatFactorsList(currentList) },
                        }))
                      }}
                      onSelectSuggestion={selected => {
                        const currentList = parseFactorsText(formData.instructionalDifficulty.factors_text)
                        currentList[idx] = selected
                        setFormData(p => ({
                          ...p,
                          instructionalDifficulty: { factors_text: formatFactorsList(currentList) },
                        }))
                      }}
                      placeholder={`Instructional difficulty factor ${idx + 1}...`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Bottom Save Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link to={`/admin/submissions/${id}`} className="btn-md btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-md btn-primary shadow-md"
            >
              <Save size={16} />
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
