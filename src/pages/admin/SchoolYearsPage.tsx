import { useEffect, useState } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { fetchSchoolYears, fetchTerms, upsertSchoolYear, upsertTerm, setDefaultTerm, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { SchoolYear, Term } from '@/types'
import { Plus, Edit2, Star, Check, Calendar, Clock, Sparkles } from 'lucide-react'
import { captureGenieOrigin } from '@/utils/genieAnimation'

// -- School Years Section --
function SchoolYearsSection() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<SchoolYear[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<SchoolYear> | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => { setLoading(true); fetchSchoolYears(false).then(setItems).finally(() => setLoading(false)) }
  useEffect(load, [])

  const handleSave = async () => {
    if (!editing?.name?.trim()) return
    setSaving(true)
    try {
      await upsertSchoolYear(editing)
      await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: editing.id ? 'edit_school_year' : 'add_school_year', entity_label: editing.name })
      toast(editing.id ? 'School year updated.' : 'School year added.', 'success')
      setEditing(null); load()
    } catch { toast('Failed to save.', 'error') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAF0] bg-[#F8FAFC]">
        <div>
          <h2 className="text-sm font-black text-[#1F2937] flex items-center gap-2">
            <Calendar size={18} className="text-[#6366F1]" />
            Academic School Years
          </h2>
          <p className="text-[11px] text-[#64748B]">Manage active and historical academic calendar years</p>
        </div>
        <button
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:animate-button-sparkle"
          onClick={(e) => { captureGenieOrigin(e); setEditing({ name: '', is_active: true }) }}
        >
          <Plus size={14} /> Add School Year
        </button>
      </div>

      <div className="divide-y divide-[#E8EAF0]">
        {loading ? (
          <div className="p-6"><DepEdSpinner size="md" label="Loading School Years..." /></div>
        ) : (
          items.map(sy => (
            <div key={sy.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFC]/70 transition-colors">
              <div>
                <p className={`text-xs font-bold ${sy.is_active ? 'text-[#1F2937]' : 'text-[#94A3B8] line-through'}`}>{sy.name}</p>
                <span className={`text-[10px] font-bold ${sy.is_active ? 'text-[#1E6B48]' : 'text-[#94A3B8]'}`}>
                  {sy.is_active ? 'Active Year' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#3B49B8] hover:bg-[#EEF0FF] transition-colors cursor-pointer active:animate-button-sparkle"
                  onClick={(e) => { captureGenieOrigin(e); setEditing(sy) }}
                  title="Edit School Year"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    sy.is_active
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                  onClick={() => { upsertSchoolYear({ ...sy, is_active: !sy.is_active }).then(load) }}
                >
                  {sy.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Inline editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-[#E8EAF0] shadow-2xl space-y-4 animate-genie-expand z-10">
            <h3 className="text-base font-black text-[#1F2937] tracking-tight">{editing.id ? 'Edit School Year' : 'Add School Year'}</h3>
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">School Year Title *</label>
              <input
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E8EAF0] focus:outline-none focus:border-[#6366F1]"
                value={editing.name || ''}
                onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))}
                placeholder="e.g., 2026-2027"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="sy-active" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))} className="rounded text-[#6366F1]" />
              <label htmlFor="sy-active" className="text-xs font-bold text-[#1F2937] cursor-pointer">Set as Active Academic Year</label>
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-[#E8EAF0]">
              <button className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all cursor-pointer" onClick={() => setEditing(null)}>Cancel</button>
              <button className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] shadow-xs transition-all cursor-pointer" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Year'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -- Terms Section --
function TermsSection() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Term> | null>(null)
  const [saving, setSaving] = useState(false)
  const defaultTermId = localStorage.getItem('termcat_default_term_id')

  const load = () => {
    setLoading(true)
    fetchTerms(false).then(terms => {
      setItems(terms)
      const hasDbDefault = terms.some(t => t.is_default)
      if (hasDbDefault) {
        const dbDefault = terms.find(t => t.is_default)
        if (dbDefault) localStorage.setItem('termcat_default_term_id', dbDefault.id)
      } else if (!localStorage.getItem('termcat_default_term_id') && terms.length > 0) {
        const firstActive = terms.find(t => t.is_active) || terms[0]
        localStorage.setItem('termcat_default_term_id', firstActive.id)
      }
    }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleMakeDefault = async (term: Term) => {
    try {
      await setDefaultTerm(term.id)
      await insertAuditLog({
        admin_id: admin!.id,
        admin_name: admin!.full_name,
        action: 'set_default_term',
        entity_label: term.name,
      })
      toast(`${term.name} is now set as default active submission term.`, 'success')
      load()
    } catch {
      toast('Failed to set default term.', 'error')
    }
  }

  const handleSave = async () => {
    if (!editing?.name?.trim()) return
    setSaving(true)
    try {
      const savedTerm = await upsertTerm(editing)
      if (editing.is_default && savedTerm.id) {
        await setDefaultTerm(savedTerm.id)
      }
      await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: editing.id ? 'edit_term' : 'add_term', entity_label: editing.name })
      toast(editing.id ? 'Term updated.' : 'Term added.', 'success')
      setEditing(null); load()
    } catch { toast('Failed to save.', 'error') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-xs overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAF0] bg-[#F8FAFC]">
        <div>
          <h2 className="text-sm font-black text-[#1F2937] flex items-center gap-2">
            <Clock size={18} className="text-[#3B49B8]" />
            Evaluation Terms & Quarters
          </h2>
          <p className="text-[11px] text-[#64748B]">Configure submission quarters and default portal evaluation period</p>
        </div>
        <button
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#3B49B8] hover:bg-[#2F3BA3] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:animate-button-sparkle"
          onClick={(e) => { captureGenieOrigin(e); setEditing({ name: '', sort_order: items.length + 1, is_active: true, is_default: false }) }}
        >
          <Plus size={14} /> Add Term / Quarter
        </button>
      </div>

      <div className="divide-y divide-[#E8EAF0]">
        {loading ? (
          <div className="p-6"><DepEdSpinner size="md" label="Loading Terms..." /></div>
        ) : (
          items.map(t => {
            const isDefault = t.is_default || t.id === defaultTermId
            return (
              <div key={t.id} className={`flex items-center justify-between px-6 py-4 transition-colors ${isDefault ? 'bg-amber-50/60' : 'hover:bg-[#F8FAFC]/70'}`}>
                <div className="flex items-center gap-3">
                  {isDefault ? (
                    <span className="p-1.5 rounded-xl bg-amber-100 text-amber-600 border border-amber-200" title="Default System Term">
                      <Star size={16} className="fill-amber-500" />
                    </span>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-[#F8FAFC] border border-[#E8EAF0] flex items-center justify-center text-xs font-bold text-[#64748B]">
                      Q{t.sort_order}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold ${t.is_active ? 'text-[#1F2937]' : 'text-[#94A3B8] line-through'}`}>{t.name}</p>
                      {isDefault && (
                        <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          DEFAULT PORTAL TERM
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold ${t.is_active ? 'text-[#1E6B48]' : 'text-[#94A3B8]'}`}>
                      {t.is_active ? 'Active' : 'Inactive'} &bull; Sort Order: {t.sort_order}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isDefault && t.is_active && (
                    <button
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100/70 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                      onClick={() => handleMakeDefault(t)}
                    >
                      <Check size={12} /> Set Default
                    </button>
                  )}
                  <button
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#3B49B8] hover:bg-[#EEF0FF] transition-colors cursor-pointer active:animate-button-sparkle"
                    onClick={(e) => { captureGenieOrigin(e); setEditing(t) }}
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      t.is_active
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                    onClick={() => { upsertTerm({ ...t, is_active: !t.is_active }).then(load) }}
                  >
                    {t.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="absolute inset-0" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 sm:p-7 border border-[#E8EAF0] shadow-2xl space-y-4 animate-genie-expand z-10">
            <h3 className="text-base font-black text-[#1F2937] tracking-tight">{editing.id ? 'Edit Term' : 'Add Term'}</h3>
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Term / Quarter Title *</label>
              <input className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E8EAF0] focus:outline-none focus:border-[#3B49B8]" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="e.g., Q1 - First Quarter" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">Sort Order Index</label>
              <input type="number" className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#E8EAF0] focus:outline-none focus:border-[#3B49B8]" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p!, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="term-active" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))} className="rounded text-[#3B49B8]" />
                <label htmlFor="term-active" className="text-xs font-bold text-[#1F2937] cursor-pointer">Active Term</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="term-default" checked={editing.is_default ?? (editing.id ? editing.id === defaultTermId : false)} onChange={e => setEditing(p => ({ ...p!, is_default: e.target.checked }))} className="rounded text-amber-600" />
                <label htmlFor="term-default" className="text-xs font-bold text-amber-800 cursor-pointer">Set as Default Submission Term</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-[#E8EAF0]">
              <button className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-all cursor-pointer" onClick={() => setEditing(null)}>Cancel</button>
              <button className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#3B49B8] hover:bg-[#2F3BA3] shadow-xs transition-all cursor-pointer" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Term'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SchoolYearsPage() {
  return (
    <SchoolConnectLayout systemTitle="School Years & Terms">
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#6366F1] text-white rounded-[36px] p-6 sm:p-9 shadow-[0_20px_40px_rgba(59,130,246,0.28)] border-4 border-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold backdrop-blur-md shadow-xs">
                <Calendar size={14} className="text-amber-300" />
                Academic Master Data
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display">School Years & Terms Management</h1>
              <p className="text-xs sm:text-sm text-blue-50 max-w-2xl leading-relaxed font-medium">
                Configure district academic year schedules, manage evaluation quarter terms, and select default active submission quarters for teacher evaluations.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SchoolYearsSection />
          <TermsSection />
        </div>
      </div>
    </SchoolConnectLayout>
  )
}

export const TermsPage = SchoolYearsPage
