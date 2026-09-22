import { Link } from 'react-router-dom'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { WifiOff, ShieldCheck, Sparkles } from 'lucide-react'
import { AppLauncher } from '@/components/ui/AppLauncher'

export function PublicHeader() {
  const isOnline = useOnlineStatus()

  return (
    <>
      {!isOnline && (
        <div className="bg-[#FFE0E6] text-[#E11D48] text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 border-b border-[#FFCCD4] shadow-2xs font-sans">
          <WifiOff size={14} aria-hidden="true" />
          <span>You are offline. Submission drafts will be saved locally on your device.</span>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/80 shadow-[0_8px_24px_rgba(185,170,210,0.12)] no-print transition-all">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
          <Link to="/termcat" className="flex items-center gap-3 group" aria-label="School Connect TERMCAT Home">
            <div className="h-11 px-2.5 py-1 rounded-2xl bg-white border border-white shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-8 object-contain"
              />
            </div>
            <div>
              <div className="text-[#2D2638] font-black text-base sm:text-xl leading-tight tracking-tight flex items-center gap-2 font-display">
                <span>TERMCAT System</span>
                <span className="text-[10px] font-extrabold bg-[#F2EEFD] text-[#6D4AE4] border border-[#E2D5FE] px-2.5 py-0.5 rounded-full hidden sm:inline-block shadow-2xs">
                  School Connect
                </span>
              </div>
              <div className="text-[#7A7289] text-xs leading-tight font-medium hidden sm:block">
                Teacher Data Collection & Consolidation System
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <AppLauncher currentAppId="termcat" />
            {isOnline ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-[#059669] bg-[#EDFAF3] px-3 py-1.5 rounded-full border border-[#A7F3D0] shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                Online System
              </span>
            ) : null}
            <Link
              to="/login"
              className="px-4 py-2 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#FF7A70] to-[#FA6B6B] hover:from-[#FF6B61] hover:to-[#F05555] shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              aria-label="Administrative Login"
            >
              <ShieldCheck size={15} />
              Portal Access
            </Link>
          </div>
        </div>

        {/* Minimalist Soft Accent Bar */}
        <div className="h-1 flex" aria-hidden="true">
          <div className="flex-1 bg-gradient-to-r from-[#FA6B6B] via-[#28C76F] to-[#7367F0]" />
          <div className="w-20 bg-gradient-to-r from-[#FF9F43] to-[#F59E0B]" />
        </div>
      </header>
    </>
  )
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/80 bg-[#FAF5F0]/90 backdrop-blur-md mt-auto py-8 no-print shadow-xs font-sans">
      <div className="w-full max-w-7xl mx-auto px-4 text-center space-y-2">
        <p className="text-xs font-black text-[#2D2638] font-display flex items-center justify-center gap-1.5">
          <span>TERMCAT System</span>
          <Sparkles size={13} className="text-[#8B72F4]" />
          <span>Teacher Data Collection & Consolidation</span>
        </p>
        <p className="text-xs text-[#7A7289] font-medium">
          Department of Education &bull; Division of Romblon &bull; Concepcion District
        </p>
        <p className="text-[11px] text-[#A39BAF] font-semibold">
          School Connect &copy; {new Date().getFullYear()} &bull; Concepcion, Romblon
        </p>
      </div>
    </footer>
  )
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F6FA] text-slate-900 font-sans relative overflow-hidden">
      {/* Subtle Micro-Grid Texture */}
      <div 
        className="fixed inset-0 w-screen h-[100dvh] opacity-[0.025] pointer-events-none z-0" 
        style={{ backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`, backgroundSize: '24px 24px' }} 
      />

      <PublicHeader />
      <main className="flex-1 relative z-10">{children}</main>
      <PublicFooter />
    </div>
  )
}
