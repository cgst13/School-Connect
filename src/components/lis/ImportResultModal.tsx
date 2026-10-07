import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  FileSpreadsheet,
  X,
  Search,
  Check,
  Building2,
  ListFilter
} from 'lucide-react'
import type { ImportResultSummary } from '@/utils/importReportUtils'

interface ImportResultModalProps {
  isOpen: boolean
  onClose: () => void
  summary: ImportResultSummary | null
}

export function ImportResultModal({ isOpen, onClose, summary }: ImportResultModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'updated' | 'error'>('all')
  const [searchFilter, setSearchFilter] = useState('')

  if (!isOpen || !summary) return null

  const filteredLogs = summary.logs.filter(log => {
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'created' && log.action === 'created') ||
      (activeTab === 'updated' && log.action === 'updated') ||
      (activeTab === 'error' && log.action === 'error')

    const matchesSearch =
      !searchFilter.trim() ||
      log.lrn.includes(searchFilter) ||
      log.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      log.changes.some(c => c.toLowerCase().includes(searchFilter.toLowerCase()))

    return matchesTab && matchesSearch
  })

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200/80 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header Banner */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-white shrink-0 font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">
                SF1 Import & Learner Audit Summary
              </h2>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                <span>School: <strong>{summary.schoolName}</strong>{summary.schoolId ? ` (ID: ${summary.schoolId})` : ''}</span>
                {summary.schoolYear && <span>• SY: <strong>{summary.schoolYear}</strong></span>}
                {summary.gradeLevelName && <span>• Grade: <strong>{summary.gradeLevelName}</strong></span>}
                {summary.sectionName && <span>• Section: <strong>{summary.sectionName}</strong></span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stat Counter Grid */}
        <div className="p-6 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* Total Processed */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Records
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {summary.totalProcessed}
            </div>
            <span className="text-[10px] font-semibold text-blue-600">Processed in SF1 file</span>
          </div>

          {/* Newly Enrolled */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                New Enrollees
              </span>
              <UserPlus className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900 font-mono">
              {summary.createdCount}
            </div>
            <span className="text-[10px] font-semibold text-emerald-700">Newly inserted learners</span>
          </div>

          {/* Records Updated */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                Updated Records
              </span>
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-900 font-mono">
              {summary.updatedCount}
            </div>
            <span className="text-[10px] font-semibold text-blue-700">Existing LRNs updated</span>
          </div>

          {/* Errors / Warnings */}
          <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                Skipped / Errors
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-900 font-mono">
              {summary.errorCount}
            </div>
            <span className="text-[10px] font-semibold text-rose-700">Invalid records</span>
          </div>
        </div>

        {/* Filter Bar & Search Input */}
        <div className="px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({summary.logs.length})
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'created'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              ✨ New ({summary.createdCount})
            </button>
            <button
              onClick={() => setActiveTab('updated')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'updated'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              🔄 Updated ({summary.updatedCount})
            </button>
            {summary.errorCount > 0 && (
              <button
                onClick={() => setActiveTab('error')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'error'
                    ? 'bg-rose-600 text-white shadow-xs font-bold'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                ⚠️ Errors ({summary.errorCount})
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search LRN, name, changes..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Detailed Change Log Table */}
        <div className="p-6 pt-2 overflow-y-auto flex-1 font-sans">
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="p-3 w-32 font-mono">LRN</th>
                  <th className="p-3 w-48">Learner Name</th>
                  <th className="p-3 w-36">Action Status</th>
                  <th className="p-3">Specific Field Changes / Audit Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold italic">
                      No records match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900 select-all">
                        {log.lrn}
                      </td>
                      <td className="p-3 font-bold text-slate-900 uppercase">
                        {log.name}
                      </td>
                      <td className="p-3">
                        {log.action === 'created' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                            <UserPlus size={12} />
                            NEW ENROLLEE
                          </span>
                        )}
                        {log.action === 'updated' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1 w-fit">
                            <RefreshCw size={12} />
                            UPDATED RECORD
                          </span>
                        )}
                        {log.action === 'error' && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 w-fit">
                            <AlertTriangle size={12} />
                            FAILED RECORD
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs leading-relaxed text-slate-800">
                        {log.action === 'error' ? (
                          <span className="text-rose-700 font-bold">{log.errorReason || 'Database write failed'}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {log.changes.map((c, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px]">
                                <span className="text-blue-600 font-bold shrink-0">•</span>
                                <span className={c.includes('➔') ? 'font-semibold text-slate-800' : 'text-slate-600 italic'}>
                                  {c}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Learner database updated & synchronized.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2"
          >
            <Check size={16} />
            Done & Close Summary
          </button>
        </div>
      </div>
    </div>
  )
}
