import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { EmptyState } from '@/components/ui/EmptyState'
import { fetchLearningAreas, fetchGradeLevels, fetchLearningAreaGrades, upsertLearningArea, setLearningAreaGrades, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import type { LearningArea, GradeLevel } from '@/types'
import { Plus, Pencil, BookOpen, X } from 'lucide-react'

interface LAModalProps {
  la?: LearningArea & { gradeIds?: string[] }
  grades: GradeLevel[]
  onSave: (data: Partial<LearningArea>, gradeIds: string[]) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function LAModal({ la, grades, onSave, onClose, isLoading }: LAModalProps) {
  const [name, setName] = useState(la?.name || '')
  const [active, setActive] = useState(la?.is_active ?? true)
  const [selectedGrades, setSelectedGrades] = useState<string[]>(la?.gradeIds || [])
  const [error, setError] = useState('')

  const toggleGrade = (id: string) => {
    setSelectedGrades(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (name.trim().length < 1) { setError('Name is required.'); return }
    if (selectedGrades.length === 0) { setError('Assign at least one grade.'); return }
    await onSave({ id: la?.id, name: name.trim(), is_active: active }, selectedGrades)
  }

  const elementary = grades.filter(g => g.school_type === 'elementary')
  const secondary = grades.filter(g => g.school_type === 'secondary')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-content-primary/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-md w-full max-w-md p-6 space-y-4 animate-slide-up my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-content-primary">{la ? 'Edit Learning Area' : 'Add Learning Area'}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <div>
          <label className="form-label" htmlFor="la-name">Name *</label>
          <input id="la-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Mathematics" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="la-active" checked={active} onChange={e => setActive(e.target.checked)} />
          <label htmlFor="la-active" className="text-sm">Active</label>
        </div>
        <div>
          <p className="form-label">Assign to Grade Levels *</p>
          {['Elementary (Grades 1–6)', 'Secondary (Grades 7–12)'].map((label, gi) => (
            <div key={label} className="mb-3">
              <p className="text-xs font-semibold text-content-secondary mb-1">{label}</p>
              <div className="flex flex-wrap gap-2">
                {(gi === 0 ? elementary : secondary).map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGrade(g.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                      selectedGrades.includes(g.id)
                        ? 'bg-deped-blue text-white border-deped-blue'
                        : 'bg-white text-content-secondary border-surface-border hover:border-deped-blue'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button className="btn-md btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-md btn-primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LearningAreasPage() {
  const { admin } = useAuth()
  const { toast } = useToast()
  const [learningAreas, setLearningAreas] = useState<LearningArea[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [gradeAssignments, setGradeAssignments] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; la?: LearningArea }>({ open: false })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [las, gs, gradeAssignmentsData] = await Promise.all([
      fetchLearningAreas(false),
      fetchGradeLevels(),
      fetchLearningAreaGrades(),
    ])
    setLearningAreas(las)
    setGrades(gs)
    const assignments: Record<string, string[]> = {}
    for (const row of gradeAssignmentsData) {
      if (!assignments[row.learning_area_id]) assignments[row.learning_area_id] = []
      assignments[row.learning_area_id].push(row.grade_level_id)
    }
    setGradeAssignments(assignments)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: Partial<LearningArea>, gradeIds: string[]) => {
    setSaving(true)
    try {
      const saved = await upsertLearningArea(data)
      await setLearningAreaGrades(saved.id, gradeIds)
      await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: data.id ? 'edit_learning_area' : 'add_learning_area', entity_label: data.name })
      toast(data.id ? 'Learning area updated.' : 'Learning area added.', 'success')
      setModal({ open: false })
      load()
    } catch {
      toast('Failed to save learning area.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (la: LearningArea) => {
    const gradeIds = gradeAssignments[la.id] || []
    await handleSave({ ...la, is_active: !la.is_active }, gradeIds)
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Learning Areas</h1>
          <button className="btn-md btn-primary" onClick={() => setModal({ open: true })}>
            <Plus size={16} /> Add Learning Area
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-content-tertiary">Loading...</div>
          ) : learningAreas.length === 0 ? (
            <EmptyState title="No learning areas" icon={<BookOpen size={28} />} />
          ) : (
            <div className="divide-y divide-surface-border">
              {learningAreas.map(la => {
                const gids = gradeAssignments[la.id] || []
                const assignedGrades = grades.filter(g => gids.includes(g.id)).sort((a, b) => a.grade_number - b.grade_number)
                return (
                  <div key={la.id} className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${la.is_active ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>
                        {la.name}
                      </p>
                      <p className="text-xs text-content-tertiary mt-0.5">
                        {assignedGrades.length > 0
                          ? assignedGrades.map(g => g.name).join(', ')
                          : 'No grades assigned'}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button className="btn-sm btn-secondary" onClick={() => setModal({ open: true, la })}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`btn-sm ${la.is_active ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => handleToggleActive(la)}
                      >
                        {la.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal.open && (
        <LAModal
          la={modal.la ? { ...modal.la, gradeIds: gradeAssignments[modal.la.id] || [] } : undefined}
          grades={grades}
          onSave={handleSave}
          onClose={() => setModal({ open: false })}
          isLoading={saving}
        />
      )}
    </AdminLayout>
  )
}
