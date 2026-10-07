import { useState, useEffect, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { lisNavGroups } from './lisNavConfig'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import {
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  Users,
  Search,
  Filter,
  Sparkles
} from 'lucide-react'
import { fetchLearners, fetchSections, fetchSchools, fetchGradeLevels, bulkUpdateLearnerSection } from '@/lib/supabase/queries'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { useLISRealtimeSync } from '@/hooks/useLISRealtimeSync'
import type { Learner, Section, School, GradeLevel } from '@/types'

export function LISEnrollmentPage() {
  const { canEditData, getPermittedSchools } = useAuth()
  const { toast } = useToast()
  const [learners, setLearners] = useState<Learner[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  // Permitted Schools
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [targetSectionId, setTargetSectionId] = useState('')
  const [updating, setUpdating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('all')

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const [lData, sData, schData, gData] = await Promise.all([
        fetchLearners(),
        fetchSections(),
        fetchSchools(true, true),
        fetchGradeLevels(undefined, true)
      ])
      setLearners(lData)
      setSections(sData)
      setSchools(schData)
      setGradeLevels(gData)
      if (sData.length > 0 && !targetSectionId) setTargetSectionId(sData[0].id)
    } catch (err) {
      console.error(err)
      if (showSpinner) toast('Failed to load sectioning data.', 'error')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  const { isLive } = useLISRealtimeSync({ onUpdate: () => loadData(false) })

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    return learners.filter(l => {
      const matchesSearch =
        !searchTerm.trim() ||
        l.lrn.includes(searchTerm) ||
        l.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.last_name.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesSchool = selectedSchoolId === 'all' || l.school_id === selectedSchoolId

      const activeGradeObj = gradeLevels.find(g => g.id === selectedGradeId)
      const matchesGrade =
        selectedGradeId === 'all' ||
        l.grade_level_id === selectedGradeId ||
        (activeGradeObj && (
          (l.grade_level_name && l.grade_level_name.toLowerCase() === activeGradeObj.name.toLowerCase()) ||
          (activeGradeObj.grade_number === 0 && l.grade_level_name && (l.grade_level_name.toLowerCase().includes('kinder') || l.grade_level_name === 'K'))
        ))

      return matchesSearch && matchesSchool && matchesGrade
    })
  }, [learners, searchTerm, selectedSchoolId, selectedGradeId, gradeLevels])

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map(l => l.id))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBatchTransfer = async () => {
    if (selectedIds.length === 0) {
      toast('Please select at least one learner.', 'warning')
      return
    }
    if (!targetSectionId) {
      toast('Please select a target section.', 'warning')
      return
    }

    setUpdating(true)
    try {
      const secObj = sections.find(s => s.id === targetSectionId)
      await bulkUpdateLearnerSection(selectedIds, targetSectionId, secObj?.name)
      toast(`Successfully assigned ${selectedIds.length} learners to section "${secObj?.name || 'Selected Section'}"!`, 'success')
      setSelectedIds([])
      loadData()
    } catch (err) {
      console.error(err)
      toast('Failed to update learner sections.', 'error')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <SchoolConnectLayout
      activeAppId="lis"
      systemTitle="Learner Enrollment & Sectioning"
      systemSubtitle="Class Section Assignment, Batch Transfer & Grade Sectioning"
      navGroups={lisNavGroups}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <DepEdSpinner size="lg" label="Loading Enrollment & Sectioning..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Action Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    Sectioning & Batch Class Assignment
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Assign learners to official school sections or perform batch section transfers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {permittedSchools.length > 1 && (
                  <select
                    value={selectedSchoolId}
                    onChange={e => setSelectedSchoolId(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all">🏫 All Assigned Schools ({permittedSchools.length})</option>
                    {permittedSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}

                {/* Grade Level Filter */}
                <select
                  value={selectedGradeId}
                  onChange={e => setSelectedGradeId(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Grade Levels</option>
                  {gradeLevels.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                {/* Batch Action Toolbar */}
                {canEditData() && (
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700 pl-2">
                      {selectedIds.length} Selected
                    </span>

                    <select
                      value={targetSectionId}
                      onChange={e => setTargetSectionId(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-800"
                    >
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>Move to: {s.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleBatchTransfer}
                      disabled={updating || selectedIds.length === 0}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <ArrowRightLeft size={14} />
                      {updating ? 'Assigning...' : 'Assign Section'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 font-semibold uppercase text-slate-600 text-xs">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                      />
                    </th>
                    <th className="py-3 px-4">LRN</th>
                    <th className="py-3 px-4">Learner Name</th>
                    <th className="py-3 px-4">Sex</th>
                    <th className="py-3 px-4">Current Grade Level</th>
                    <th className="py-3 px-4">Current Section</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(l.id)}
                          onChange={() => toggleSelectOne(l.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">{l.lrn}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{l.last_name}, {l.first_name}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{l.sex}</td>
                      <td className="py-3 px-4 font-medium text-slate-700">{l.grade_level_name || 'Grade 1'}</td>
                      <td className="py-3 px-4 font-semibold text-blue-600">{l.section_name || 'Agoncillo'}</td>
                      <td className="py-3 px-4 uppercase font-semibold text-emerald-600">{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </SchoolConnectLayout>
  )
}
