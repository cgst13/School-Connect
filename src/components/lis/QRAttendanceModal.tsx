import { useState, useEffect, useRef } from 'react'
import {
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Clock,
  Calendar,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Check
} from 'lucide-react'
import type { Learner } from '@/types'
import { parseScannedQRCode } from '@/utils/qrCodeGenerator'
import { useToast } from '@/hooks/useToast'

interface QRAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
  learners: Learner[]
  onMarkAttendance?: (learnerId: string, status: 'present' | 'tardy' | 'absent') => void
}

interface ScannedEntry {
  learner: Learner
  timestamp: string
  status: 'present' | 'tardy'
  matchType: string
}

export function QRAttendanceModal({ isOpen, onClose, learners, onMarkAttendance }: QRAttendanceModalProps) {
  const { toast } = useToast()
  const [scanInput, setScanInput] = useState('')
  const [lastScanned, setLastScanned] = useState<ScannedEntry | null>(null)
  const [scanHistory, setScanHistory] = useState<ScannedEntry[]>([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep focus on input for barcode/QR scanner guns
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, lastScanned])

  if (!isOpen) return null

  const playChime = () => {
    if (!soundEnabled) return
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime) // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1) // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.3)
    } catch {
      // Audio context might be restricted before interaction
    }
  }

  const handleProcessScan = (codeToProcess: string) => {
    const raw = codeToProcess.trim()
    if (!raw) return

    setErrorMsg(null)
    const { lrn, id, raw: rawCode, isValidDepEdQR } = parseScannedQRCode(raw)

    // Match learner from pool
    const matched = learners.find(l => {
      if (l.qr_code && l.qr_code === rawCode) return true
      if (lrn && l.lrn && l.lrn.trim() === lrn.trim()) return true
      if (id && l.id === id) return true
      if (rawCode && l.lrn && l.lrn.includes(rawCode)) return true
      return false
    })

    if (!matched) {
      setErrorMsg(`No learner found matching QR payload: "${raw}"`)
      toast(`Learner not found for: ${raw}`, 'error')
      setScanInput('')
      return
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const entry: ScannedEntry = {
      learner: matched,
      timestamp: nowTime,
      status: 'present',
      matchType: isValidDepEdQR ? 'DepEd QR Code' : 'LRN Barcode'
    }

    setLastScanned(entry)
    setScanHistory(prev => [entry, ...prev.filter(h => h.learner.id !== matched.id)])
    playChime()

    if (onMarkAttendance) {
      onMarkAttendance(matched.id, 'present')
    }

    toast(`Attendance logged: ${matched.last_name}, ${matched.first_name} (Present)`, 'success')
    setScanInput('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleProcessScan(scanInput)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                QR Code Attendance Scanner
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  SF2 Ready
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Scan DepEd School ID QR code or barcode gun for instant attendance recording
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                soundEnabled ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
              title={soundEnabled ? 'Chime Sound Enabled' : 'Sound Muted'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Input & Instructions */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Scan ID Card or Type QR Token / LRN:
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                placeholder="Ready to scan... (Point barcode/QR scanner here)"
                className="w-full pl-11 pr-24 py-3.5 bg-slate-50 border-2 border-blue-500 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                autoFocus
              />
              <QrCode className="w-5 h-5 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
              >
                Log Scan
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Tip: Compatible with standard handheld 2D QR scanners, smartphones, and keyboard wedge inputs.
            </p>
          </form>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Last Scanned Result Card */}
          {lastScanned && (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 border-2 border-emerald-500/80 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">
                      Attendance Recorded: Present
                    </h4>
                    <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Time-In: {lastScanned.timestamp} • {lastScanned.matchType}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                  PRESENT
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {lastScanned.learner.last_name}, {lastScanned.learner.first_name} {lastScanned.learner.middle_name || ''}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      LRN: {lastScanned.learner.lrn} • {lastScanned.learner.grade_level_name || 'Grade'} - {lastScanned.learner.section_name || 'Section'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scanned History List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Scanned Learners Today ({scanHistory.length})
              </h4>
              {scanHistory.length > 0 && (
                <button
                  onClick={() => setScanHistory([])}
                  className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear List
                </button>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-2xl text-center text-xs text-slate-400">
                No learners scanned yet during this session.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {scanHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {item.learner.last_name}, {item.learner.first_name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          LRN: {item.learner.lrn}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-emerald-700">Present</span>
                      <p className="text-[10px] text-slate-400">{item.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  )
}
