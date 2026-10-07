import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { fetchSubmissions, fetchSchools, fetchGradeLevels, fetchLearningAreas, fetchSchoolYears, fetchTerms } from '@/lib/supabase/queries'
import { generateExcelExport } from '@/lib/excel/excelExport'
import { useToast } from '@/hooks/useToast'
import type { TermcatSubmission, School, GradeLevel, LearningArea, SchoolYear, Term } from '@/types'
import { Download, BarChart3 } from 'lucide-react'

import { useAuth } from '@/features/auth/useAuth'

import { PageHeader } from '@/components/ui/PageHeader'

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
  const { admin, getPermittedSchoolIds, getPermittedSchools, hasFullAccess } = useAuth()
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

  const permittedSchools = getPermittedSchools(schools)

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
      if (!hasFullAccess() && schools.length > 0) {
        f.school_ids = getPermittedSchoolIds(schools.map(s => s.id))
      }

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
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          badge="Analytics & Intelligence"
          title="Reports & Analytics"
          description="Generate, visualize, and export comprehensive evaluation monitoring summaries across the district."
        />

        <div className="grid sm:grid-cols-3 gap-5">
          {/* Report Types Sidebar */}
          <div className="sm:col-span-1 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">Select Report Type</h2>
            <div className="bg-white rounded-2xl border border-slate-200/80 p-2 space-y-1 shadow-xs">
              {REPORT_TYPES.map(rt => {
                const isActive = selectedReport === rt.id
                return (
                  <button
                    key={rt.id}
                    onClick={() => { setSelectedReport(rt.id); setReportData(null) }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <p className="text-xs font-bold">{rt.title}</p>
                    <p className={`text-[11px] mt-0.5 font-medium ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                      {rt.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filters + Results */}
          <div className="sm:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Report Filters</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">School Year</label>
                  <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={filters.school_year_id} onChange={e => setFilters(f => ({ ...f, school_year_id: e.target.value }))}>
                    <option value="">All School Years</option>
                    {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Term</label>
                  <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={filters.term_id} onChange={e => setFilters(f => ({ ...f, term_id: e.target.value }))}>
                    <option value="">All Terms</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">School</label>
                  <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={filters.school_id} onChange={e => setFilters(f => ({ ...f, school_id: e.target.value }))}>
                    {hasFullAccess() && <option value="">All Schools</option>}
                    {permittedSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Learning Area</label>
                  <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" value={filters.learning_area_id} onChange={e => setFilters(f => ({ ...f, learning_area_id: e.target.value }))}>
                    <option value="">All Learning Areas</option>
                    {learningAreas.map(la => <option key={la.id} value={la.id}>{la.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <BarChart3 size={15} />
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
                {reportData && (
                  <button
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-all cursor-pointer flex items-center gap-2"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    <Download size={15} /> {exporting ? 'Exporting...' : 'Export Excel'}
                  </button>
                )}
              </div>
            </div>

            {/* Report Table Card */}
            {reportData && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-fade-in">
                <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    {REPORT_TYPES.find(r => r.id === selectedReport)?.title}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100">
                    {reportData.length} Entries
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50/80">
                        <th className="py-3 px-4">{selectedReport === 'submission_summary' ? 'Category' : 'Name'}</th>
                        <th className="py-3 px-4 text-right">Total</th>
                        <th className="py-3 px-4 text-right">Submitted</th>
                        <th className="py-3 px-4 text-right">Reviewed</th>
                        <th className="py-3 px-4 text-right">Returned</th>
                        <th className="py-3 px-4 text-right">Finalized</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                      {reportData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-semibold">{row.label}</td>
                          <td className="py-3 px-4 text-right font-bold text-blue-600">{row.total}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{row.submitted}</td>
                          <td className="py-3 px-4 text-right text-amber-600">{row.reviewed}</td>
                          <td className="py-3 px-4 text-right text-rose-600">{row.returned}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-bold">{row.finalized}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
