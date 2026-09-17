import { Link } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { Wifi, WifiOff, ShieldCheck } from 'lucide-react'
import { AppLauncher } from '@/components/ui/AppLauncher'

function TermcatLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-white text-xs font-black shadow-md border border-white/20">
      TC
    </div>
  )
}

export function PublicHeader() {
  const isOnline = useOnlineStatus()

  return (
    <>
      {!isOnline && (
        <div className="offline-bar flex items-center justify-center gap-2" role="alert">
          <WifiOff size={14} aria-hidden="true" />
          You are offline. Submission draft will be stored locally.
        </div>
      )}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 no-print shadow-xs">
        <div className="w-full max-w-full px-4 sm:px-8 py-3 flex items-center justify-between">
          <Link to="/termcat" className="flex items-center gap-3 group" aria-label="School Connect TERMCAT Home">
            <div className="h-10 px-2 py-1 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-7 object-contain"
              />
            </div>
            <div>
              <div className="text-slate-900 font-extrabold text-base sm:text-lg leading-tight tracking-tight flex items-center gap-2">
                TERMCAT
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full hidden sm:inline-block">
                  School Connect System
                </span>
              </div>
              <div className="text-slate-500 text-xs leading-tight hidden sm:block">
                Teacher Data Collection & Consolidation System
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <AppLauncher currentAppId="termcat" />
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online System
              </span>
            ) : null}
            <Link
              to="/login"
              className="btn-sm btn-secondary font-semibold"
              aria-label="Administrative Login"
            >
              <ShieldCheck size={14} />
              Portal Access
            </Link>
          </div>
        </div>

        {/* DepEd-inspired subtle color accent line */}
        <div className="h-1 flex" aria-hidden="true">
          <div className="flex-1 bg-blue-600" />
          <div className="w-16 bg-amber-500" />
          <div className="w-8 bg-red-600" />
        </div>
      </header>
    </>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto py-8 no-print">
      <div className="w-full max-w-full px-4 text-center space-y-2">
        <p className="text-xs font-semibold text-slate-700">
          TERMCAT — Teacher Data Collection & Consolidation System
        </p>
        <p className="text-xs text-slate-400">
          Department of Education · Division of Romblon · Concepcion District
        </p>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-slate-50/60 font-sans">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}
