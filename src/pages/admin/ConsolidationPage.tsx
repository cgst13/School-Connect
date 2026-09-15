import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { fetchConsolidationData, fetchSchools, fetchGradeLevels, fetchLearningAreas, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import type { ConsolidationFilters, ConsolidationResult, TermcatSubmission, CompetencyCount, School, GradeLevel, LearningArea, SchoolYear, Term, KeyStage, SubmissionStatus } from '@/types'
import { getKeyStageLabel } from '@/utils/keyStage'
import { Download, RefreshCw, Printer, FileSpreadsheet, LayoutList } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { generateExcelExport } from '@/lib/excel/excelExport'
import { OfficialTermcatTemplate } from '@/components/templates/OfficialTermcatTemplate'

function computeConsolidation(submissions: TermcatSubmission[], filters: ConsolidationFilters): ConsolidationResult {
  const ks1Subs = submissions.filter(s => s.form_type === 'ks1')
  const ks24Subs = submissions.filter(s => s.form_type === 'ks2to4')

  // Numeric aggregates
  const totalLearners = submissions.reduce((acc, s) => acc + (s.ks1_learner_data?.total_learners || s.ks2to4_learner_data?.total_learners || 0), 0)
  const ks1Advancing = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.advancing || 0), 0)
  const ks1Benchmarking = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.benchmarking || 0), 0)
  const ks1Connecting = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.connecting || 0), 0)
  const ks1Developing = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.developing || 0), 0)
  const ks1Emerging = ks1Subs.reduce((acc, s) => acc + (s.ks1_learner_data?.emerging || 0), 0)

  const mpsValues = ks24Subs.filter(s => s.ks2to4_learner_data?.mps !== null).map(s => s.ks2to4_learner_data!.mps!)
  const averageMps = mpsValues.length > 0 ? +(mpsValues.reduce((a, b) => a + b, 0) / mpsValues.length).toFixed(2) : null

  const totalIntended = submissions.reduce((acc, s) => acc + (s.competency_summary?.total_intended_competencies || 0), 0)
  const totalTaught = submissions.reduce((acc, s) => acc + (s.competency_summary?.competencies_taught || 0), 0)
  const totalNotTaught = submissions.reduce((acc, s) => acc + (s.competency_summary?.competencies_not_taught || 0), 0)

  // Competency frequency
  function aggregateCompetencies(category: string): CompetencyCount[] {
    const counts: Record<string, number> = {}
    for (const sub of submissions) {
      for (const c of (sub.submission_competencies || [])) {
        if (c.category === category && c.competency_text.trim()) {
          counts[c.competency_text] = (counts[c.competency_text] || 0) + 1
        }
      }
    }
    return Object.entries(counts).map(([text, count]) => ({ competency_text: text, count })).sort((a, b) => b.count - a.count)
  }

  const instructionalDifficultyTexts = submissions
    .map(s => s.instructional_difficulty?.factors_text)
    .filter(Boolean) as string[]

  return {
    filters,
    submissions,
    totalSubmissions: submissions.length,
    totalLearners,
    ks1Advancing, ks1Benchmarking, ks1Connecting, ks1Developing, ks1Emerging,
    averageMps,
    totalIntended, totalTaught, totalNotTaught,
    mostLearned: aggregateCompetencies('most_learned'),
    leastMastered: aggregateCompetencies('least_mastered'),
    mostDifficult: aggregateCompetencies('most_difficult_to_teach'),
    instructionalDifficultyTexts,
  }
}

export function ConsolidationPage() {
  const { toast } = useToast()
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [viewMode, setViewMode] = useState<'cards' | 'official_template'>('official_template')

  const [filters, setFilters] = useState<ConsolidationFilters>({
    school_year_id: '',
    term_id: '',
    school_id: 'all',
    grade_level_id: 'all',
    learning_area_id: 'all',
    key_stage: 'all',
    statuses: ['submitted', 'reviewed', 'finalized'],
  })

  const [result, setResult] = useState<ConsolidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([fetchSchools(), fetchGradeLevels(), fetchLearningAreas(), fetchSchoolYears(), fetchTerms()])
      .then(([s, g, la, sy, t]) => {
        setSchools(s); setGrades(g); setLearningAreas(la); setSchoolYears(sy); setTerms(t)
        const activeSY = sy.find(y => y.is_active)
        if (activeSY) setFilters(f => ({ ...f, school_year_id: activeSY.id }))
      })
  }, [])

  const handleGenerate = async () => {
    if (!filters.school_year_id || !filters.term_id) {
      toast('Please select a School Year and Term.', 'warning')
      return
    }
    setLoading(true)
    try {
      const subs = await fetchConsolidationData(filters)
      const res = computeConsolidation(subs, filters)
      setResult(res)
    } catch { toast('Failed to load data.', 'error') } finally { setLoading(false) }
  }

  const handleExport = async () => {
    if (!result) return
    setExporting(true)
    try {
      await generateExcelExport(result.submissions, 'Consolidation')
      toast('Excel file generated successfully.', 'success')
    } catch { toast('Failed to generate Excel.', 'error') } finally { setExporting(false) }
  }

  const setF = (key: keyof ConsolidationFilters, val: any) => setFilters(f => ({ ...f, [key]: val }))

  const selectedSY = schoolYears.find(y => y.id === filters.school_year_id)?.name
  const selectedTerm = terms.find(t => t.id === filters.term_id)?.name
  const selectedLA = learningAreas.find(l => l.id === filters.learning_area_id)?.name || 'All Learning Areas'

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="page-title">Consolidation</h1>

        {/* Filters */}
        <div className="card p-4 space-y-4 no-print">
          <h2 className="section-title">Consolidation Filters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <label className="form-label text-xs">School Year *</label>
              <select className="form-select text-sm" value={filters.school_year_id} onChange={e => setF('school_year_id', e.target.value)}>
                <option value="">Select...</option>
                {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Term *</label>
              <select className="form-select text-sm" value={filters.term_id} onChange={e => setF('term_id', e.target.value)}>
                <option value="">Select...</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">School</label>
              <select className="form-select text-sm" value={filters.school_id} onChange={e => setF('school_id', e.target.value)}>
                <option value="all">All Schools</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Grade Level</label>
              <select className="form-select text-sm" value={filters.grade_level_id} onChange={e => setF('grade_level_id', e.target.value)}>
                <option value="all">All Grades</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Learning Area</label>
              <select className="form-select text-sm" value={filters.learning_area_id} onChange={e => setF('learning_area_id', e.target.value)}>
                <option value="all">All Learning Areas</option>
                {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Key Stage</label>
              <select className="form-select text-sm" value={filters.key_stage} onChange={e => setF('key_stage', e.target.value)}>
                <option value="all">All Key Stages</option>
                <option value="ks1">Key Stage 1</option>
                <option value="ks2">Key Stage 2</option>
                <option value="ks3">Key Stage 3</option>
                <option value="ks4">Key Stage 4</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label text-xs">Include Statuses</label>
            <div className="flex flex-wrap gap-2">
              {(['submitted', 'reviewed', 'finalized', 'returned'] as SubmissionStatus[]).map(s => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(s)}
                    onChange={e => setF('statuses', e.target.checked ? [...filters.statuses, s] : filters.statuses.filter(x => x !== s))}
                  />
                  <span className="capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex gap-2">
              <button className="btn-md btn-primary" onClick={handleGenerate} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Generating...' : 'Generate Consolidation'}
              </button>
              {result && (
                <button className="btn-md btn-secondary" onClick={handleExport} disabled={exporting}>
                  <Download size={16} />
                  {exporting ? 'Exporting...' : 'Export Excel'}
                </button>
              )}
            </div>

            {result && (
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                <button
                  onClick={() => setViewMode('official_template')}
                  className={`btn-sm ${viewMode === 'official_template' ? 'btn-primary shadow-xs' : 'btn-ghost text-slate-600'}`}
                >
                  <FileSpreadsheet size={14} /> Official DepEd Template View
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`btn-sm ${viewMode === 'cards' ? 'btn-primary shadow-xs' : 'btn-ghost text-slate-600'}`}
                >
                  <LayoutList size={14} /> Aggregate Summary Cards
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {viewMode === 'official_template' ? (
              <div className="space-y-6">
                {/* KS 1 Section Template */}
                {(filters.key_stage === 'all' || filters.key_stage === 'ks1') && (
                  <OfficialTermcatTemplate
                    submissions={result.submissions.filter(s => s.form_type === 'ks1')}
                    formType="ks1"
                    learningAreaName={selectedLA}
                    termName={selectedTerm}
                    schoolYearName={selectedSY}
                    showPrintButton
                  />
                )}

                {/* KS 2-4 Section Template */}
                {(filters.key_stage === 'all' || filters.key_stage !== 'ks1') && (
                  <OfficialTermcatTemplate
                    submissions={result.submissions.filter(s => s.form_type === 'ks2to4')}
                    formType="ks2to4"
                    learningAreaName={selectedLA}
                    termName={selectedTerm}
                    schoolYearName={selectedSY}
                    showPrintButton
                  />
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Submissions', value: result.totalSubmissions },
                    { label: 'Total Learners', value: result.totalLearners },
                    { label: 'Average MPS', value: result.averageMps !== null ? `${result.averageMps}%` : '—' },
                    { label: 'Competencies Taught', value: result.totalTaught },
                  ].map(s => (
                    <div key={s.label} className="card p-4 text-center">
                      <p className="text-xs text-content-secondary uppercase tracking-wide">{s.label}</p>
                      <p className="text-2xl font-bold text-deped-blue mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* KS1 Performance (if applicable) */}
                {result.submissions.some(s => s.form_type === 'ks1') && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
                      <h2 className="section-title">Key Stage 1 — Performance Levels (Aggregate)</h2>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-surface-border">
                      {[
                        { label: 'Advancing', value: result.ks1Advancing },
                        { label: 'Benchmarking', value: result.ks1Benchmarking },
                        { label: 'Connecting', value: result.ks1Connecting },
                        { label: 'Developing', value: result.ks1Developing },
                        { label: 'Emerging', value: result.ks1Emerging },
                      ].map(s => (
                        <div key={s.label} className="p-4 text-center">
                          <p className="text-xs text-content-secondary">{s.label}</p>
                          <p className="text-xl font-bold text-content-primary mt-1">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Competency Frequency Tables */}
                {[
                  { title: 'Most Frequently Reported — Most Learned', data: result.mostLearned },
                  { title: 'Most Frequently Reported — Least Mastered', data: result.leastMastered },
                  { title: 'Most Frequently Reported — Most Difficult to Teach', data: result.mostDifficult },
                ].map(({ title, data }) => data.length > 0 && (
                  <div key={title} className="card overflow-hidden">
                    <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
                      <h2 className="section-title">{title}</h2>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Competency</th>
                          <th className="text-right">Reports</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.slice(0, 20).map((c, i) => (
                          <tr key={c.competency_text}>
                            <td className="w-12 text-content-tertiary">{i + 1}</td>
                            <td>{c.competency_text}</td>
                            <td className="text-right font-semibold text-deped-blue">{c.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Instructional Difficulty */}
                {result.instructionalDifficultyTexts.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
                      <h2 className="section-title">Instructional Difficulty — Teacher Responses ({result.instructionalDifficultyTexts.length})</h2>
                    </div>
                    <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
                      {result.instructionalDifficultyTexts.map((text, i) => (
                        <p key={i} className="px-4 py-3 text-sm text-content-secondary">
                          {i + 1}. {text}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
