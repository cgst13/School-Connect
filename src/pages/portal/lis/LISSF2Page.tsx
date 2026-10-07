import { useState, useEffect, useMemo } from 'react'
import { SchoolConnectLayout } from '@/components/layouts/SchoolConnectLayout'
import { lisNavGroups } from './lisNavConfig'
import { DepEdSpinner } from '@/components/ui/DepEdSpinner'
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  Search,
  Filter,
  Check,
  Sparkles,
  QrCode,
  UserCheck
} from 'lucide-react'
import { fetchLearners, fetchGradeLevels, fetchSchools } from '@/lib/supabase/queries'
import { isGradeMatch } from '@/utils/gradeUtils'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { useLISRealtimeSync } from '@/hooks/useLISRealtimeSync'
import { QRAttendanceModal } from '@/components/lis/QRAttendanceModal'
import type { Learner, GradeLevel, School } from '@/types'

export function LISSF2Page() {
  const { admin, getPermittedSchools } = useAuth()
  const { toast } = useToast()
  const [learners, setLearners] = useState<Learner[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('October 2026')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all')
  const [selectedGradeId, setSelectedGradeId] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false)

  // Permitted Schools for current user role scope
  const permittedSchools = useMemo(() => getPermittedSchools(schools), [schools, getPermittedSchools])

  // Auto-select school if user only has 1 assigned school
  useEffect(() => {
    if (permittedSchools.length === 1 && selectedSchoolId === 'all') {
      setSelectedSchoolId(permittedSchools[0].id)
    }
  }, [permittedSchools, selectedSchoolId])

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const [lData, gData, schData] = await Promise.all([
        fetchLearners(),
        fetchGradeLevels(undefined, true),
        fetchSchools(true, true),
      ])
      setLearners(lData)
      setGradeLevels(gData)
      setSchools(schData)
    } catch (err) {
      console.error(err)
      if (showSpinner) toast('Failed to load SF2 attendance data.', 'error')
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
        l.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.lrn.includes(searchTerm)

      const matchesSchool = selectedSchoolId === 'all'
        ? (permittedSchools.length > 0 ? permittedSchools.some(ps => ps.id === l.school_id || (l.school_name && ps.name.toLowerCase() === l.school_name.toLowerCase())) : true)
        : (l.school_id === selectedSchoolId || (l.school_name && permittedSchools.find(ps => ps.id === selectedSchoolId)?.name.toLowerCase() === l.school_name.toLowerCase()))

      const matchesGrade = isGradeMatch(l, selectedGradeId, gradeLevels)

      return matchesSearch && matchesGrade && matchesSchool
    })
  }, [learners, searchTerm, selectedSchoolId, permittedSchools, selectedGradeId, gradeLevels])

  return (
    <SchoolConnectLayout
      activeAppId="lis"
      systemTitle="School Form 2 (SF2) Daily Attendance"
      systemSubtitle="Monthly Student Attendance Tracker & DepEd Form 2 Register"
      navGroups={lisNavGroups}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <DepEdSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    School Form 2 (SF2) Daily Attendance Tracker
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Monthly attendance summary, daily absence records, and attendance percentage rate
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsQRScannerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <QrCode size={15} />
                  <span>Scan QR Attendance</span>
                </button>

                {permittedSchools.length > 1 && (
                  <select
                    value={selectedSchoolId}
                    onChange={e => setSelectedSchoolId(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all">🏫 All Assigned Schools ({permittedSchools.length})</option>
                    {permittedSchools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}

                <select
                  value={selectedGradeId}
                  onChange={e => setSelectedGradeId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Grade Levels</option>
                  {gradeLevels.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="October 2026">October 2026</option>
                  <option value="September 2026">September 2026</option>
                  <option value="August 2026">August 2026</option>
                </select>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Printer size={15} />
                  <span>Print SF2</span>
                </button>
              </div>
            </div>

            {/* Attendance Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800">Average Attendance Rate</span>
                  <div className="text-2xl font-black text-emerald-700">96.8%</div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>

              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-800">Total Absences (Month)</span>
                  <div className="text-2xl font-black text-rose-700">14 Days</div>
                </div>
                <XCircle className="w-8 h-8 text-rose-500" />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-800">Tardy / Late Arrivals</span>
                  <div className="text-2xl font-black text-amber-700">6 Instances</div>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto rounded-[24px] border border-purple-100 shadow-xs pt-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6EFFF] border-b border-purple-100 font-black uppercase text-[#2D2638] text-[11px]">
                    <th className="py-3 px-4">LRN</th>
                    <th className="py-3 px-4">Learner Name</th>
                    <th className="py-3 px-4 text-center">Days Present</th>
                    <th className="py-3 px-4 text-center">Days Absent</th>
                    <th className="py-3 px-4 text-center">Tardy</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50 font-medium">
                  {filtered.map(l => {
                    const present = Math.floor(Math.random() * 3) + 19
                    const absent = 22 - present
                    const rate = ((present / 22) * 100).toFixed(1)
                    return (
                      <tr key={l.id} className="hover:bg-[#F6EFFF]/40">
                        <td className="py-3 px-4 font-mono font-bold">{l.lrn}</td>
                        <td className="py-3 px-4 font-black">{l.last_name}, {l.first_name}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{present}</td>
                        <td className="py-3 px-4 text-center font-bold text-rose-600">{absent}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">0</td>
                        <td className="py-3 px-4 text-center font-black">{rate}%</td>
                        <td className="py-3 px-4 text-[#7A7289]">{l.remarks || 'Regular Attendee'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Attendance Scanner Modal */}
      <QRAttendanceModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        learners={learners}
        onMarkAttendance={(learnerId, status) => {
          console.log(`[SF2 QR Scan] Marked ${learnerId} as ${status}`)
        }}
      />
    </SchoolConnectLayout>
  )
}
