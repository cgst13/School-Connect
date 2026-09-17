import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Grid,
  FileCheck,
  Users,
  GraduationCap,
  ClipboardList,
  FileSpreadsheet,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Home
} from 'lucide-react'

import { REGISTERED_SYSTEMS } from '@/config/systems'

export function AppLauncher({ currentAppId = 'termcat' }: { currentAppId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
          isOpen
            ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-md ring-2 ring-blue-500/20'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
        }`}
        title="School Connect Application Switcher"
      >
        <img src="/images/school_connect_logo.png" alt="School Connect Logo" className="w-4 h-4 object-contain" />
        <span className="hidden sm:inline font-semibold">School Connect Hub</span>
        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
          Suite
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden text-slate-800 ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <img src="/images/school_connect_logo.png" alt="School Connect Logo" className="w-5 h-5 object-contain" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">School Connect Ecosystem</h4>
                <p className="text-[10px] text-slate-500">Select system module</p>
              </div>
            </div>
          </div>

          {/* Applications Grid */}
          <div className="p-3 space-y-2 max-h-[380px] overflow-y-auto">
            {REGISTERED_SYSTEMS.map((sys) => {
              const Icon = sys.icon
              const isCurrent = sys.id === currentAppId
              const isActive = sys.enabled

              return (
                <div
                  key={sys.id}
                  onClick={() => {
                    if (isActive && !isCurrent) {
                      setIsOpen(false)
                      navigate(sys.route)
                    }
                  }}
                  className={`group relative p-2.5 rounded-lg border transition-all duration-150 flex items-start gap-3 ${
                    isCurrent
                      ? 'bg-slate-100 border-[#0B1F3A]/30 shadow-xs'
                      : isActive
                      ? 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer'
                      : 'bg-slate-50/50 border-slate-200/60 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-[#0B1F3A] text-white shadow-xs flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 group-hover:text-[#0B1F3A] truncate">
                        {sys.name}
                      </span>
                      {isCurrent ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0B1F3A] text-white flex-shrink-0">
                          Active Now
                        </span>
                      ) : (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        } flex-shrink-0`}>
                          {sys.badgeText || (isActive ? 'Operational' : 'Coming Soon')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{sys.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              School Connect Ecosystem v2.5
            </span>
            <Link
              to="/portal"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
            >
              All Systems <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
