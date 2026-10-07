import { useEffect, useState, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { academicMasterDataNavGroups } from '@/config/navConfigs'
import { PageHeader } from '@/components/ui/PageHeader'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { fetchSchools, upsertSchool, insertAuditLog } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { formatDetailedError } from '@/utils/formatError'
import type { School } from '@/types'
import { Plus, Edit2, Building2, Search, GraduationCap, CheckCircle2, XCircle, MapPin } from 'lucide-react'
import { captureGenieOrigin, useGenieModal } from '@/utils/genieAnimation'

interface SchoolModalProps {
  isOpen: boolean
  school?: School
  onSave: (data: Partial<School>) => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function SchoolModal({ isOpen, school, onSave, onClose, isLoading }: SchoolModalProps) {
  const [name, setName] = useState(school?.name || '')
  const [type, setType] = useState<'elementary' | 'secondary'>(school?.school_type || 'elementary')
  const [active, setActive] = useState(school?.is_active ?? true)
  const [error, setError] = useState('')

  const gradeOptions: Array<{ num: number; label: string }> = useMemo(() => {
    return type === 'elementary'
      ? [
          { num: 0, label: 'Kindergarten' },
          { num: 1, label: 'Grade 1' },
          { num: 2, label: 'Grade 2' },
          { num: 3, label: 'Grade 3' },
          { num: 4, label: 'Grade 4' },
          { num: 5, label: 'Grade 5' },
          { num: 6, label: 'Grade 6' }
        ]
      : [
          { num: 7, label: 'Grade 7' },
          { num: 8, label: 'Grade 8' },
          { num: 9, label: 'Grade 9' },
          { num: 10, label: 'Grade 10' },
          { num: 11, label: 'Grade 11' },
          { num: 12, label: 'Grade 12' }
        ]
  }, [type])

  const [offeredGrades, setOfferedGrades] = useState<number[]>(() => {
    if (school?.offered_grade_numbers && school.offered_grade_numbers.length > 0) {
      return school.offered_grade_numbers
    }
    return (type === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12])
  })

  useEffect(() => {
    if (isOpen) {
      setName(school?.name || '')
      setType(school?.school_type || 'elementary')
      setActive(school?.is_active ?? true)
      setError('')
      const schoolType = school?.school_type || 'elementary'
      if (school?.offered_grade_numbers && school.offered_grade_numbers.length > 0) {
        setOfferedGrades(school.offered_grade_numbers)
      } else {
        setOfferedGrades(schoolType === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12])
      }
    }
  }, [isOpen, school])

  const { shouldRender, triggerClose, containerClass, backdropClass } = useGenieModal(isOpen, onClose)

  if (!shouldRender) return null

  const handleSave = async () => {
    if (name.trim().length < 2) { setError('School name is required (min 2 characters).'); return }
    const isAllOffered = offeredGrades.length === gradeOptions.length && gradeOptions.every(g => offeredGrades.includes(g.num))
    await onSave({
      id: school?.id,
      name: name.trim(),
      school_type: type,
      is_active: active,
      offered_grade_numbers: isAllOffered ? null : offeredGrades
    })
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs ${backdropClass}`}>
      <div className="absolute inset-0" onClick={triggerClose} />
      <div className={`relative w-full max-w-lg bg-white rounded-lg overflow-hidden border border-slate-200 shadow-xl z-10 ${containerClass}`}>
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#2563EB] text-white flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-white" />
            <h2 className="text-sm font-bold tracking-tight">{school ? 'Edit School Profile' : 'Add New School'}</h2>
          </div>
          <button onClick={triggerClose} className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer text-xs">✕</button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">Official School Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Concepcion Central Elementary School"
            />
            {error && <p className="text-xs font-semibold text-rose-600 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">School Level Classification *</label>
            <select
              className="form-select"
              value={type}
              onChange={e => {
                const newType = e.target.value as 'elementary' | 'secondary'
                setType(newType)
                setOfferedGrades(newType === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12])
              }}
            >
              <option value="elementary">Elementary (ES)</option>
              <option value="secondary">Secondary (HS / High School)</option>
            </select>
          </div>

          {/* Grade Level Offering & Enrollee Configuration */}
          <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-900">
                Active Grade Levels & Enrollees
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOfferedGrades(gradeOptions.map(g => g.num))}
                  className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setOfferedGrades([])}
                  className="text-[11px] font-semibold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
              Uncheck grade levels that have <b>no enrollees</b> for this school. Unchecked grades will be <b>exempted from TermCat submission requirements</b>.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {gradeOptions.map(g => {
                const isChecked = offeredGrades.includes(g.num)
                return (
                  <label
                    key={g.num}
                    className={`flex items-center gap-2 p-2 rounded-md border transition-all cursor-pointer select-none text-xs ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-200 text-slate-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400 font-normal'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setOfferedGrades(prev => [...prev, g.num])
                        } else {
                          setOfferedGrades(prev => prev.filter(num => num !== g.num))
                        }
                      }}
                      className="rounded text-[#2563EB] focus:ring-[#2563EB]/20 w-4 h-4 cursor-pointer"
                    />
                    <span>{g.label}</span>
                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isChecked ? 'Active' : 'No Enrollees'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="school-active"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded text-[#2563EB] focus:ring-[#2563EB]/20 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="school-active" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
              Active Status in District Directory
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-200">
            <button
              className="btn btn-secondary text-xs px-4 py-1.5"
              onClick={triggerClose}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary text-xs px-4 py-1.5"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save School Profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SchoolsPage() {
  const { admin, canEditData } = useAuth()
  const { toast } = useToast()
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; school?: School }>({ open: false })
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'elementary' | 'secondary'>('all')

  const load = () => {
    setLoading(true)
    fetchSchools(false).then(setSchools).catch(err => {
      toast(formatDetailedError(err, { action: 'Failed to load schools from Supabase', table: 'sc_schools' }), 'error')
    }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSave = async (data: Partial<School>) => {
    setSaving(true)
    try {
      await upsertSchool(data)
      await insertAuditLog({ admin_id: admin!.id, admin_name: admin!.full_name, action: data.id ? 'edit_school' : 'add_school', entity_type: 'school', entity_label: data.name })
      toast(data.id ? 'School updated successfully.' : 'New school added to directory.', 'success')
      setModal({ open: false })
      load()
    } catch (err) {
      toast(formatDetailedError(err, { action: 'Failed to save school to Supabase', table: 'sc_schools' }), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (school: School) => {
    await handleSave({ ...school, is_active: !school.is_active })
  }

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = selectedTypeFilter === 'all' || s.school_type === selectedTypeFilter
    return matchesSearch && matchesType
  })

  const elementaryCount = schools.filter(s => s.school_type === 'elementary').length
  const secondaryCount = schools.filter(s => s.school_type === 'secondary').length
  const activeCount = schools.filter(s => s.is_active).length

  return (
    <SchoolConnectLayout systemTitle="Schools Directory & Governance" navGroups={academicMasterDataNavGroups}>
      <div className="space-y-5 w-full pb-12 animate-fade-in font-sans">
        {/* Header Banner */}
        <PageHeader
          badge="Academic Master Data"
          title="School Directory & Governance"
          description="Manage elementary & secondary schools across Concepcion District, configure offered grade levels & enrollees, and maintain district governance master data."
          actions={
            canEditData() ? (
              <button
                onClick={(e) => { captureGenieOrigin(e); setModal({ open: true }) }}
                className="btn btn-primary text-xs px-4 py-2"
              >
                <Plus size={15} />
                <span>Add New School</span>
              </button>
            ) : null
          }
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:border-slate-300 hover:shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Schools</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{schools.length}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:border-slate-300 hover:shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ES (Elementary)</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{elementaryCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:border-slate-300 hover:shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0 shadow-2xs">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">HS (High School)</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{secondaryCount}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:border-slate-300 hover:shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Status</span>
              <p className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{activeCount}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search school name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input pl-9"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedTypeFilter === 'all'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Schools ({schools.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter('elementary')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedTypeFilter === 'elementary'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ES ({elementaryCount})
            </button>
            <button
              onClick={() => setSelectedTypeFilter('secondary')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                selectedTypeFilter === 'secondary'
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              HS ({secondaryCount})
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8"><DepEdSpinner size="lg" label="Loading Schools Directory..." /></div>
          ) : filteredSchools.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Building2 size={36} className="mx-auto mb-3 opacity-30 text-[#2563EB]" />
              <p className="text-sm font-bold text-slate-800">No schools found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting search query or filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop Data Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>School Name</th>
                      <th>Classification</th>
                      <th>Enrollee Grade Offering</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchools.map(school => {
                      const defaultNums = school.school_type === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
                      const activeNums = school.offered_grade_numbers && school.offered_grade_numbers.length > 0
                        ? school.offered_grade_numbers
                        : defaultNums
                      const missingNums = defaultNums.filter(n => !activeNums.includes(n))

                      return (
                        <tr key={school.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-md bg-blue-50 text-[#2563EB] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-100">
                                <Building2 size={15} />
                              </div>
                              <span className="font-semibold text-slate-900">{school.name}</span>
                            </div>
                          </td>
                          <td>
                            {school.school_type === 'elementary' ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                ES
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                HS
                              </span>
                            )}
                          </td>
                          <td>
                            {missingNums.length === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                All Grades Active ({school.school_type === 'elementary' ? 'K–6' : 'G7–12'})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title={`Exempt grades without enrollees: ${missingNums.map(n => n === 0 ? 'Kinder' : `Grade ${n}`).join(', ')}`}>
                                No Enrollees: {missingNums.map(n => n === 0 ? 'K' : `G${n}`).join(', ')}
                              </span>
                            )}
                          </td>
                          <td>
                            {school.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {canEditData(school.id) && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => { captureGenieOrigin(e); setModal({ open: true, school }) }}
                                  className="btn btn-secondary btn-sm px-2 py-1"
                                  title="Edit School & Grade Level Offerings"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleToggleActive(school)}
                                  className={`btn btn-sm px-2.5 py-1 ${
                                    school.is_active
                                      ? 'btn-danger'
                                      : 'btn-success'
                                  }`}
                                >
                                  {school.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredSchools.map(school => (
                  <div key={school.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{school.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-medium text-slate-500 capitalize">{school.school_type}</span>
                        <span className={`text-[10px] font-semibold ${school.is_active ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setModal({ open: true, school })} className="btn btn-secondary btn-sm p-1.5">
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <SchoolModal
        isOpen={modal.open}
        school={modal.school}
        onSave={handleSave}
        onClose={() => setModal({ open: false })}
        isLoading={saving}
      />
    </SchoolConnectLayout>
  )
}
