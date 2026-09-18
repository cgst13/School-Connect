import { useEffect, useState, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
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
    if (school?.offered_grade_numbers && school.offered_grade_numbers.length > 0) {
      setOfferedGrades(school.offered_grade_numbers)
    } else {
      setOfferedGrades(type === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12])
    }
  }, [type, school])

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
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2638]/40 backdrop-blur-md ${backdropClass}`}>
      <div className="absolute inset-0" onClick={triggerClose} />
      <div className={`relative w-full max-w-lg bg-[#FAF5F0] rounded-[36px] overflow-hidden border-4 border-white shadow-[0_25px_60px_rgba(139,114,244,0.22)] z-10 ${containerClass}`}>
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-amber-300" />
            <h2 className="text-base font-black tracking-tight font-display">{school ? 'Edit School Profile' : 'Add New School'}</h2>
          </div>
          <button onClick={triggerClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all cursor-pointer border border-white/30 active:scale-95 text-xs font-bold w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">Official School Name *</label>
            <input
              className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] placeholder-[#A39BAF] focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20 font-semibold transition-all"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Concepcion Central Elementary School"
            />
            {error && <p className="text-[11px] font-bold text-rose-600 mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-black text-[#2D2638] mb-1.5 font-display">School Level Classification *</label>
            <select
              className="w-full px-4 py-3 text-xs rounded-2xl bg-white border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] text-[#2D2638] font-bold focus:outline-none focus:ring-4 focus:ring-[#8B72F4]/20"
              value={type}
              onChange={e => setType(e.target.value as any)}
            >
              <option value="elementary">Elementary School</option>
              <option value="secondary">Secondary School (High School / Senior High)</option>
            </select>
          </div>

          {/* Grade Level Offering & Enrollee Configuration */}
          <div className="p-4 rounded-2xl bg-white border border-[#E8EAF0] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-[#2D2638] font-display">
                Active Grade Levels & Enrollees
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOfferedGrades(gradeOptions.map(g => g.num))}
                  className="text-[10px] font-bold text-[#8B72F4] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setOfferedGrades([])}
                  className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[#7A7289] font-medium leading-relaxed">
              Uncheck grade levels that have <b>no enrollees</b> for this school. Unchecked grades will be <b>exempted from TermCat submission requirements</b>.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {gradeOptions.map(g => {
                const isChecked = offeredGrades.includes(g.num)
                return (
                  <label
                    key={g.num}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-purple-50/60 border-purple-200 text-purple-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-400 font-semibold'
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
                      className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs">{g.label}</span>
                    <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                      isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {isChecked ? 'Active' : 'No Enrollees'}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="school-active"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded text-[#8B72F4] focus:ring-[#8B72F4]/20 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="school-active" className="text-xs font-black text-[#2D2638] cursor-pointer select-none">
              Active Status in District Directory
            </label>
          </div>

          <div className="flex gap-2.5 justify-end pt-4 border-t border-[#F0E6DD]">
            <button
              className="px-5 py-2.5 rounded-full text-xs font-black text-[#7A7289] bg-white hover:bg-[#F6EFFF] hover:text-[#2D2638] shadow-2xs border border-white transition-all cursor-pointer active:scale-95"
              onClick={triggerClose}
            >
              Cancel
            </button>
            <button
              className="px-6 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#A88BEB] via-[#8B72F4] to-[#795CEE] shadow-md hover:brightness-105 transition-all cursor-pointer active:animate-button-sparkle border border-white/50"
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
  const { admin } = useAuth()
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
    <SchoolConnectLayout systemTitle="Schools Directory & Governance">
      <div className="space-y-6 w-full pb-12 animate-fade-in">
        {/* Header Banner */}
        <PageHeader
          badge="Academic Master Data"
          title="School Directory & Governance"
          description="Manage elementary & secondary schools across Concepcion District, configure offered grade levels & enrollees, and maintain district governance master data."
          actions={
            <button
              onClick={(e) => { captureGenieOrigin(e); setModal({ open: true }) }}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#A88BEB] to-[#8B72F4] text-white font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:animate-button-sparkle"
            >
              <Plus size={16} />
              <span>Add New School</span>
            </button>
          }
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E8EAF0] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF0FF] text-[#3B49B8] border border-[#BFD7FF] flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Total Schools</span>
              <p className="text-lg font-black text-[#1F2937]">{schools.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8EAF0] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EBF8FF] text-[#0284C7] border border-[#BAE6FD] flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Elementary</span>
              <p className="text-lg font-black text-[#1F2937]">{elementaryCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8EAF0] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3E8FF] text-[#9333EA] border border-[#E9D5FF] flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Secondary</span>
              <p className="text-lg font-black text-[#1F2937]">{secondaryCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E8EAF0] shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FAF5] text-[#1E6B48] border border-[#BFE8D5] flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Active Status</span>
              <p className="text-lg font-black text-[#1F2937]">{activeCount}</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#E8EAF0] shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search school name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-[#E8EAF0] bg-[#F7F8FC] focus:bg-white focus:outline-none focus:border-[#6675E8] transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTypeFilter === 'all'
                  ? 'bg-[#6675E8] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#EEF0FF]'
              }`}
            >
              All Schools ({schools.length})
            </button>
            <button
              onClick={() => setSelectedTypeFilter('elementary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTypeFilter === 'elementary'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#EBF8FF]'
              }`}
            >
              Elementary ({elementaryCount})
            </button>
            <button
              onClick={() => setSelectedTypeFilter('secondary')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTypeFilter === 'secondary'
                  ? 'bg-[#9333EA] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#F3E8FF]'
              }`}
            >
              Secondary ({secondaryCount})
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-8"><DepEdSpinner size="lg" label="Loading Schools Directory..." /></div>
          ) : filteredSchools.length === 0 ? (
            <div className="p-12 text-center text-[#64748B]">
              <Building2 size={36} className="mx-auto mb-3 opacity-30 text-[#6675E8]" />
              <p className="text-sm font-bold text-[#1F2937]">No schools found</p>
              <p className="text-xs text-[#94A3B8] mt-1">Try adjusting search query or filters.</p>
            </div>
          ) : (
            <>
              {/* Desktop Data Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E8EAF0] text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider">
                      <th className="py-3.5 px-6">School Name</th>
                      <th className="py-3.5 px-6">Classification</th>
                      <th className="py-3.5 px-6">Enrollee Grade Offering</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAF0]">
                    {filteredSchools.map(school => {
                      const defaultNums = school.school_type === 'elementary' ? [0, 1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
                      const activeNums = school.offered_grade_numbers && school.offered_grade_numbers.length > 0
                        ? school.offered_grade_numbers
                        : defaultNums
                      const missingNums = defaultNums.filter(n => !activeNums.includes(n))

                      return (
                        <tr key={school.id} className="hover:bg-[#F8FAFC]/70 transition-colors text-xs">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] text-[#3B49B8] font-bold text-xs flex items-center justify-center shrink-0 border border-[#BFD7FF]">
                                <Building2 size={16} />
                              </div>
                              <span className="font-bold text-[#1F2937]">{school.name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {school.school_type === 'elementary' ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                Elementary
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                Secondary
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {missingNums.length === 0 ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                All Grades Active ({school.school_type === 'elementary' ? 'K–6' : 'G7–12'})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200" title={`Exempt grades without enrollees: ${missingNums.map(n => n === 0 ? 'Kinder' : `Grade ${n}`).join(', ')}`}>
                                No Enrollees: {missingNums.map(n => n === 0 ? 'K' : `G${n}`).join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {school.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F0FAF5] text-[#1E6B48] border border-[#BFE8D5]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1E6B48]" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { captureGenieOrigin(e); setModal({ open: true, school }) }}
                                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#3B49B8] hover:bg-[#EEF0FF] transition-colors cursor-pointer active:animate-button-sparkle"
                                title="Edit School & Grade Level Offerings"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleToggleActive(school)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  school.is_active
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                              >
                                {school.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden divide-y divide-[#E8EAF0]">
                {filteredSchools.map(school => (
                  <div key={school.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#1F2937]">{school.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold text-[#64748B] capitalize">{school.school_type}</span>
                        <span className={`text-[10px] font-bold ${school.is_active ? 'text-[#1E6B48]' : 'text-slate-400'}`}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setModal({ open: true, school })} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                        <Edit2 size={15} />
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
