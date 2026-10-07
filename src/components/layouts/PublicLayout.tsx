import { Link } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff, ShieldCheck, Sparkles } from 'lucide-react'
import { AppLauncher } from '@/components/ui/AppLauncher'

export function PublicHeader() {
  const isOnline = useOnlineStatus()

  return (
    <>
      {!isOnline && (
        <div className="bg-rose-50 text-rose-700 text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2 border-b border-rose-200 font-sans">
          <WifiOff size={14} aria-hidden="true" />
          <span>You are offline. Submission drafts will be saved locally on your device.</span>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 no-print shadow-xs font-sans">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <Link to="/termcat" className="flex items-center gap-3 group" aria-label="School Connect TERMCAT Home">
            <div className="h-9 px-2 py-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-7 object-contain"
              />
            </div>
            <div>
              <div className="text-slate-900 font-bold text-sm sm:text-base leading-tight tracking-tight flex items-center gap-2">
                <span>TERMCAT System</span>
                <span className="text-[10px] font-bold bg-blue-50 text-[#2563EB] border border-blue-100 px-2 py-0.5 rounded-full hidden sm:inline-block">
                  School Connect
                </span>
              </div>
              <div className="text-slate-500 text-xs leading-tight font-medium hidden sm:block">
                Teacher Data Collection & Consolidation System
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <AppLauncher currentAppId="termcat" />
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : null}
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              aria-label="Administrative Login"
            >
              <ShieldCheck size={14} />
              Portal Access
            </Link>
          </div>
        </div>
      </header>
    </>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200/80 bg-white mt-auto py-5 no-print font-sans text-slate-500">
      <div className="w-full max-w-7xl mx-auto px-4 text-center space-y-1">
        <p className="text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5">
          <span>TERMCAT System</span>
          <Sparkles size={13} className="text-[#2563EB]" />
          <span>Teacher Data Collection & Consolidation</span>
        </p>
        <p className="text-xs text-slate-500 font-medium">
          Department of Education &bull; Division of Romblon &bull; Concepcion District
        </p>
        <p className="text-[11px] text-slate-400 font-medium">
          School Connect &copy; {new Date().getFullYear()} &bull; Concepcion, Romblon
        </p>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F8FAFC] text-slate-900 font-sans relative">
      <PublicHeader />
      <main className="flex-1 relative z-10">{children}</main>
      <PublicFooter />
    </div>
  )
}
