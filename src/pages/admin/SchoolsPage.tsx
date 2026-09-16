import { useEffect, useState } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { fetchSchools, upsertSchool, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { School } from '@/types'
import { Plus, Pencil, Building2 } from 'lucide-react'

interface SchoolModalProps {
  school?: School
  onSave: (data: Partial<School>) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function SchoolModal({ school, onSave, onClose, isLoading }: SchoolModalProps) {
  const [name, setName] = useState(school?.name || '')
  const [type, setType] = useState<'elementary' | 'secondary'>(school?.school_type || 'elementary')
  const [active, setActive] = useState(school?.is_active ?? true)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (name.trim().length < 2) { setError('School name is required (min 2 characters).'); return }
    await onSave({ id: school?.id, name: name.trim(), school_type: type, is_active: active })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-md w-full max-w-sm p-6 space-y-4 animate-slide-up">
        <h2 className="text-base font-semibold text-content-primary">{school ? 'Edit School' : 'Add School'}</h2>
        <div>
          <label className="form-label" htmlFor="school-name">School Name *</label>
          <input id="school-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Concepcion Central Elementary School" />
          {error && <p className="form-error">{error}</p>}
        </div>
        <div>
          <label className="form-label" htmlFor="school-type">School Type *</label>
          <select id="school-type" className="form-select" value={type} onChange={e => setType(e.target.value as any)}>
            <option value="elementary">Elementary</option>
            <option value="secondary">Secondary</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="school-active" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
          <label htmlFor="school-active" className="text-sm text-content-primary">Active</label>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn-md btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-md btn-primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save School'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SchoolsPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; school?: School }>({ open: false })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetchSchools(false).then(setSchools).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSave = async (data: Partial<School>) => {
    setSaving(true)
    try {
      await upsertSchool(data)
      await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: data.id ? 'edit_school' : 'add_school', entity_type: 'school', entity_label: data.name })
      toast(data.id ? 'School updated.' : 'School added.', 'success')
      setModal({ open: false })
      load()
    } catch {
      toast('Failed to save school.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (school: School) => {
    await handleSave({ ...school, is_active: !school.is_active })
  }

  const elementary = schools.filter(s => s.school_type === 'elementary')
  const secondary = schools.filter(s => s.school_type === 'secondary')

  return (
    <SchoolConnectLayout systemTitle="Schools Directory & Master Data">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Schools</h1>
          <button className="btn-md btn-primary" onClick={() => setModal({ open: true })}>
            <Plus size={16} /> Add School
          </button>
        </div>

        {loading ? (
          <DepEdSpinner size="lg" label="Loading Schools Directory..." subtitle="Fetching active elementary & secondary school master data" />
        ) : schools.length === 0 ? (
          <div className="card"><EmptyState title="No schools found" icon={<Building2 size={28} />} /></div>
        ) : (
          <>
            {[{ label: 'Elementary Schools', items: elementary }, { label: 'Secondary Schools', items: secondary }].map(({ label, items }) => (
              items.length > 0 && (
                <div key={label} className="card overflow-hidden">
                  <div className="px-4 py-3 bg-surface-soft border-b border-surface-border">
                    <h2 className="section-title">{label}</h2>
                  </div>
                  <div className="divide-y divide-surface-border">
                    {items.map(school => (
                      <div key={school.id} className="flex items-center justify-between px-4 py-3 gap-3">
                        <div>
                          <p className={`text-sm font-medium ${school.is_active ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>
                            {school.name}
                          </p>
                          <span className={`text-xs ${school.is_active ? 'text-deped-green' : 'text-content-tertiary'}`}>
                            {school.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-sm btn-secondary" onClick={() => setModal({ open: true, school })}>
                            <Pencil size={14} />
                          </button>
                          <button
                            className={`btn-sm ${school.is_active ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleToggleActive(school)}
                          >
                            {school.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </>
        )}
      </div>

      {modal.open && (
        <SchoolModal
          school={modal.school}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          isLoading={saving}
        />
      )}
    </SchoolConnectLayout>
  )
}
