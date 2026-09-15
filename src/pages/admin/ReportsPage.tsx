import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { fetchSubmissions, fetchSchools, fetchGradeLevels, fetchLearningAreas, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import { generateExcelExport } from '@/lib/excel/excelExport'
import { useToast } from '@/hooks/useToast'
import type { TermcatSubmission, School, GradeLevel, LearningArea, SchoolYear, Term } from '@/types'
import { Download, BarChart3 } from 'lucide-react'

interface ReportType {
  id: string
  title: string
  description: string
}

const REPORT_TYPES: ReportType[] = [
  { id: 'submission_summary', title: 'Submission Summary', description: 'Overview of all submissions with status counts.' },
  { id: 'school_summary', title: 'School Summary', description: 'Submissions grouped and summarized by school.' },
  { id: 'grade_summary', title: 'Grade Level Summary', description: 'Submissions grouped by grade level.' },
  { id: 'learning_area_summary', title: 'Learning Area Summary', description: 'Submissions grouped by learning area.' },
  { id: 'key_stage_summary', title: 'Key Stage Summary', description: 'Submissions grouped by key stage.' },
  { id: 'term_summary', title: 'Term Summary', description: 'Submissions grouped by term.' },
  { id: 'school_year_summary', title: 'School Year Summary', description: 'Submissions grouped by school year.' },
]

export function ReportsPage() {
  const { toast } = useToast()
  const [schools, setSchools] = useState<School[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedReport, setSelectedReport] = useState<string>('submission_summary')
  const [filters, setFilters] = useState({ school_year_id: '', term_id: '', school_id: '', grade_level_id: '', learning_area_id: '' })
  const [reportData, setReportData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [rawSubmissions, setRawSubmissions] = useState<TermcatSubmission[]>([])

  useEffect(() => {
    Promise.all([fetchSchools(), fetchGradeLevels(), fetchLearningAreas(), fetchSchoolYears(), fetchTerms()])
      .then(([s, g, la, sy, t]) => { setSchools(s); setGrades(g); setLearningAreas(la); setSchoolYears(sy); setTerms(t) })
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const f: any = {}
      if (filters.school_year_id) f.school_year_id = filters.school_year_id
      if (filters.term_id) f.term_id = filters.term_id
      if (filters.school_id) f.school_id = filters.school_id
      if (filters.grade_level_id) f.grade_level_id = filters.grade_level_id
      if (filters.learning_area_id) f.learning_area_id = filters.learning_area_id

      const { data } = await fetchSubmissions({ ...f, page: 1, page_size: 1000 })
      setRawSubmissions(data)

      // Build report data based on type
      if (selectedReport === 'submission_summary') {
        const statuses = ['submitted', 'reviewed', 'returned', 'finalized'] as const
        setReportData([{
          label: 'All Submissions',
          total: data.length,
          submitted: data.filter(s => s.status === 'submitted').length,
          reviewed: data.filter(s => s.status === 'reviewed').length,
          returned: data.filter(s => s.status === 'returned').length,
          finalized: data.filter(s => s.status === 'finalized').length,
        }])
      } else if (selectedReport === 'school_summary') {
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = s.school?.name || 'Unknown'
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([school, subs]) => ({
          label: school,
          total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      } else if (selectedReport === 'grade_summary') {
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = s.grade_level?.name || 'Unknown'
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([grade, subs]) => ({
          label: grade,
          total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      } else if (selectedReport === 'learning_area_summary') {
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = s.learning_area?.name || 'Unknown'
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([la, subs]) => ({
          label: la,
          total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      } else if (selectedReport === 'key_stage_summary') {
        const ksLabels: Record<string, string> = { ks1: 'Key Stage 1', ks2: 'Key Stage 2', ks3: 'Key Stage 3', ks4: 'Key Stage 4' }
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = ksLabels[s.key_stage] || s.key_stage
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([ks, subs]) => ({
          label: ks, total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      } else if (selectedReport === 'term_summary') {
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = s.term?.name || 'Unknown'
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([term, subs]) => ({
          label: term, total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      } else if (selectedReport === 'school_year_summary') {
        const grouped: Record<string, TermcatSubmission[]> = {}
        data.forEach(s => {
          const k = s.school_year?.name || 'Unknown'
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(s)
        })
        setReportData(Object.entries(grouped).map(([sy, subs]) => ({
          label: sy, total: subs.length,
          submitted: subs.filter(s => s.status === 'submitted').length,
          reviewed: subs.filter(s => s.status === 'reviewed').length,
          returned: subs.filter(s => s.status === 'returned').length,
          finalized: subs.filter(s => s.status === 'finalized').length,
        })))
      }
    } catch { toast('Failed to generate report.', 'error') } finally { setLoading(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const reportTitle = REPORT_TYPES.find(r => r.id === selectedReport)?.title || 'Report'
      await generateExcelExport(rawSubmissions, `TERMCAT_${reportTitle.replace(/\s+/g, '_')}`)
      toast('Excel file generated successfully.', 'success')
    } catch { toast('Failed to generate Excel.', 'error') } finally { setExporting(false) }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="page-title">Reports</h1>

        <div className="grid sm:grid-cols-3 gap-4">
          {/* Report Types */}
          <div className="sm:col-span-1 space-y-2">
            <h2 className="section-title">Report Type</h2>
            <div className="card divide-y divide-surface-border">
              {REPORT_TYPES.map(rt => (
                <button
                  key={rt.id}
                  onClick={() => { setSelectedReport(rt.id); setReportData(null) }}
                  className={`w-full text-left px-4 py-3 transition-colors ${selectedReport === rt.id ? 'bg-deped-blue-light text-deped-blue' : 'hover:bg-surface-soft'}`}
                >
                  <p className="text-sm font-medium">{rt.title}</p>
                  <p className="text-xs text-content-tertiary mt-0.5">{rt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Filters + Results */}
          <div className="sm:col-span-2 space-y-4">
            <div className="card p-4 space-y-3">
              <h2 className="section-title">Filters</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">School Year</label>
                  <select className="form-select text-sm" value={filters.school_year_id} onChange={e => setFilters(f => ({ ...f, school_year_id: e.target.value }))}>
                    <option value="">All</option>
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Term</label>
                  <select className="form-select text-sm" value={filters.term_id} onChange={e => setFilters(f => ({ ...f, term_id: e.target.value }))}>
                    <option value="">All</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">School</label>
                  <select className="form-select text-sm" value={filters.school_id} onChange={e => setFilters(f => ({ ...f, school_id: e.target.value }))}>
                    <option value="">All</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Learning Area</label>
                  <select className="form-select text-sm" value={filters.learning_area_id} onChange={e => setFilters(f => ({ ...f, learning_area_id: e.target.value }))}>
                    <option value="">All</option>
                    {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-md btn-primary" onClick={handleGenerate} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
                {reportData && (
                  <button className="btn-md btn-secondary" onClick={handleExport} disabled={exporting}>
                    <Download size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
                  </button>
                )}
              </div>
            </div>

            {/* Report Table */}
            {reportData && (
              <div className="card overflow-hidden animate-fade-in">
                <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
                  <h2 className="section-title">{REPORT_TYPES.find(r => r.id === selectedReport)?.title}</h2>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{selectedReport === 'submission_summary' ? 'Category' : 'Name'}</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Submitted</th>
                      <th className="text-right">Reviewed</th>
                      <th className="text-right">Returned</th>
                      <th className="text-right">Finalized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={i}>
                        <td className="font-medium">{row.label}</td>
                        <td className="text-right font-bold text-deped-blue">{row.total}</td>
                        <td className="text-right">{row.submitted}</td>
                        <td className="text-right">{row.reviewed}</td>
                        <td className="text-right">{row.returned}</td>
                        <td className="text-right text-deped-green font-medium">{row.finalized}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
