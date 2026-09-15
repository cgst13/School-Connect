import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { fetchSchoolYears, fetchTerms, upsertSchoolYear, upsertTerm, setDefaultTerm, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { SchoolYear, Term } from '@/types'
import { Plus, Pencil, Star, Check } from 'lucide-react'

// -- School Years --
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
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-soft">
        <h2 className="section-title">School Years</h2>
        <button className="btn-sm btn-primary" onClick={() => setEditing({ name: '', is_active: true })}>
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="divide-y divide-surface-border">
        {loading && <div className="p-4 text-center text-content-tertiary text-sm">Loading...</div>}
        {items.map(sy => (
          <div key={sy.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className={`text-sm font-medium ${sy.is_active ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>{sy.name}</p>
              <span className={`text-xs ${sy.is_active ? 'text-deped-green' : 'text-content-tertiary'}`}>{sy.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-sm btn-secondary" onClick={() => setEditing(sy)}><Pencil size={14} /></button>
              <button className={`btn-sm ${sy.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => { upsertSchoolYear({ ...sy, is_active: !sy.is_active }).then(load) }}>
                {sy.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* Inline editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative card-md w-full max-w-xs p-6 space-y-4 animate-slide-up">
            <h3 className="font-semibold text-content-primary">{editing.id ? 'Edit School Year' : 'Add School Year'}</h3>
            <div>
              <label className="form-label" htmlFor="sy-name">School Year *</label>
              <input id="sy-name" className="form-input" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="e.g., 2026-2027" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sy-active" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))} />
              <label htmlFor="sy-active" className="text-sm">Active</label>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-md btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-md btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -- Terms --
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
      // If no default is saved in localStorage or found in db, fallback to first active
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
      toast(`${term.name} is now set as the default term for teacher submissions.`, 'success')
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
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-soft">
        <div>
          <h2 className="section-title">Terms & Quarters</h2>
          <p className="text-xs text-content-tertiary">Select the default term pre-selected in Teacher Submission Forms.</p>
        </div>
        <button className="btn-sm btn-primary" onClick={() => setEditing({ name: '', sort_order: items.length + 1, is_active: true })}>
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="divide-y divide-surface-border">
        {loading && <div className="p-4 text-center text-content-tertiary text-sm">Loading...</div>}
        {items.map(t => {
          const isDefault = t.is_default || t.id === defaultTermId || (!defaultTermId && t.sort_order === 1)
          return (
            <div key={t.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${t.is_active ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>{t.name}</p>
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full shadow-xs">
                        <Star size={12} className="fill-amber-500 text-amber-500" /> Default for Teachers
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-content-tertiary">Order: {t.sort_order}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isDefault && t.is_active && (
                  <button
                    className="btn-sm btn-secondary text-amber-700 hover:bg-amber-50 border-amber-200"
                    onClick={() => handleMakeDefault(t)}
                    title="Set as default term for teacher submission form"
                  >
                    <Star size={14} /> Set Default
                  </button>
                )}
                <button className="btn-sm btn-secondary" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                <button className={`btn-sm ${t.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => { upsertTerm({ ...t, is_active: !t.is_active }).then(load) }}>
                  {t.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative card-md w-full max-w-xs p-6 space-y-4 animate-slide-up">
            <h3 className="font-semibold text-content-primary">{editing.id ? 'Edit Term' : 'Add Term'}</h3>
            <div>
              <label className="form-label" htmlFor="term-name">Term Name *</label>
              <input id="term-name" className="form-input" value={editing.name || ''} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="e.g., Term 1" />
            </div>
            <div>
              <label className="form-label" htmlFor="term-order">Sort Order</label>
              <input id="term-order" type="number" className="form-input" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p!, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="term-active" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))} />
                <label htmlFor="term-active" className="text-sm">Active</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="term-default" checked={editing.is_default ?? (editing.id ? editing.id === defaultTermId : false)} onChange={e => setEditing(p => ({ ...p!, is_default: e.target.checked }))} />
                <label htmlFor="term-default" className="text-sm font-semibold text-amber-700">Set as Default Term for Teachers</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button className="btn-md btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-md btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SchoolYearsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="page-title">Settings</h1>
        <SchoolYearsSection />
        <TermsSection />
      </div>
    </AdminLayout>
  )
}

// Terms page re-exports SchoolYearsPage (combined settings)
export function TermsPage() { return <SchoolYearsPage /> }
