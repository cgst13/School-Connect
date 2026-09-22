import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  User,
  ShieldAlert,
  KeyRound,
  UserX
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { insertAuditLog } from '@/lib/supabase/queries'
import { DepEdFullScreenLoader } from '@/components/ui/DepEdSpinner'

interface AuthErrorState {
  type: 'disabled' | 'wrong_credentials' | 'missing_fields' | 'general'
  title: string
  message: string
  detail?: string
}

export function SchoolConnectLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [authError, setAuthError] = useState<AuthErrorState | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn, admin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'School Connect - Official Portal'
    if (!loading && admin) {
      navigate('/portal', { replace: true })
    }
  }, [admin, loading, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setAuthError(null)

    if (!email || !password) {
      setAuthError({
        type: 'missing_fields',
        title: '',
        message: 'Please enter both email and password.'
      })
      return
    }

    setIsLoading(true)

    try {
      const loggedUser = await signIn(email.trim(), password)
      if (loggedUser) {
        insertAuditLog({
          admin_id: loggedUser.id,
          admin_name: loggedUser.full_name,
          action: 'login',
          details: { method: 'school_connect_portal' },
        }).catch(() => {})
      }
      navigate('/portal')
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('ACCOUNT_DISABLED') || msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('inactive')) {
        setAuthError({
          type: 'disabled',
          title: '',
          message: 'Account is currently disabled or inactive.'
        })
      } else if (msg.includes('WRONG_CREDENTIALS') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password')) {
        setAuthError({
          type: 'wrong_credentials',
          title: '',
          message: 'Invalid email or password.'
        })
      } else {
        setAuthError({
          type: 'general',
          title: '',
          message: msg.replace(/^(ACCOUNT_DISABLED|WRONG_CREDENTIALS):\s*/, '') || 'Sign in failed. Please try again.'
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between font-sans relative bg-gradient-to-br from-[#F4EFFC] via-[#EBF3FE] to-[#FFF1F6] text-[#1E293B] select-none overflow-x-hidden">
      {(isLoading || loading) && (
        <DepEdFullScreenLoader
          label="Signing in to School Connect..."
          subtitle="Authenticating user credentials with DepEd security server"
        />
      )}
      
      {/* Responsive Fixed Non-Scrollable Background Wallpaper */}
      <picture className="fixed inset-0 w-screen h-[100dvh] min-h-[100dvh] overflow-hidden pointer-events-none z-0">
        <source media="(max-width: 768px)" srcSet="/images/bg-mobile.png" />
        <img
          src="/images/bg-desktop.png"
          alt="Background Wallpaper"
          className="w-screen h-[100dvh] min-h-[100dvh] object-cover object-center opacity-40 mix-blend-multiply transition-opacity duration-700 pointer-events-none"
        />
      </picture>

      {/* Dynamic Pastel Ambient Glow Orbs (Fixed Position for Mobile & Desktop) */}
      <div className="fixed top-[-12%] left-[-8%] w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-[#DDD6FE]/50 to-[#C4B5FD]/30 blur-3xl pointer-events-none animate-float-slow z-0" />
      <div className="fixed top-[15%] right-[-8%] w-[580px] h-[580px] rounded-full bg-gradient-to-br from-[#BAE6FD]/50 to-[#93C5FD]/30 blur-3xl pointer-events-none animate-float-reverse z-0" />
      <div className="fixed bottom-[-10%] left-[10%] w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-[#A7F3D0]/35 to-[#6EE7B7]/25 blur-3xl pointer-events-none animate-float-horizontal z-0" />
      <div className="fixed bottom-[5%] right-[12%] w-[480px] h-[480px] rounded-full bg-gradient-to-tl from-[#FECDD3]/40 to-[#FEF3C7]/45 blur-3xl pointer-events-none animate-pastel-pulse z-0" />

      {/* Subtle Micro-Grid Texture (Fixed Position) */}
      <div 
        className="fixed inset-0 w-screen h-[100dvh] opacity-[0.035] pointer-events-none z-0" 
        style={{ backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`, backgroundSize: '28px 28px' }} 
      />

      {/* Main Container - Split View on Desktop */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12 w-full max-w-6xl mx-auto">
        
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column (Desktop Showcase & Logo Display) */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 lg:pr-4 text-center lg:text-left">
            
            {/* Big Official Logo Display (Raw Image Only - No Box or Card Wrapper) */}
            <div className="flex justify-center lg:justify-start pt-2 pb-1">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-24 sm:h-32 lg:h-36 w-auto object-contain drop-shadow-md hover:scale-[1.02] transition-transform duration-500"
              />
            </div>

            {/* Hero Headline & Subtitle */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-purple-500/10 border border-indigo-200/80 shadow-2xs text-xs font-black text-[#4F46E5] mx-auto lg:mx-0">
                <span className="w-2 h-2 rounded-full bg-[#4F46E5] animate-pulse" />
                <span>DepEd Concepcion District &bull; Concepcion, Romblon</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E293B] tracking-tight leading-[1.15]">
                Unified Educational <br className="hidden sm:inline" />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#0284C7]">
                  Management System
                </span>
              </h1>
              <p className="text-sm sm:text-base text-[#475569] font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
                Seamlessly connecting DepEd schools, administrative personnel, and educators of Concepcion District under one secure, streamlined digital platform.
              </p>
            </div>

          </div>

          {/* Right Column (Executive Login Form Card) */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[36px] border-4 border-white shadow-[0_25px_65px_rgba(150,130,200,0.18)] p-8 sm:p-10 space-y-6 relative overflow-hidden transition-all">
              
              {/* Gradient Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#818CF8] via-[#6366F1] to-[#38BDF8]" />

              {/* Mobile View Logo Header (Visible only on smaller screens) */}
              <div className="lg:hidden text-center pt-1 pb-1">
                <img
                  src="/images/school_connect_logo.png"
                  alt="School Connect Official Logo"
                  className="h-16 w-auto object-contain mx-auto drop-shadow-sm"
                />
              </div>

              {/* Form Title & Subtitle */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] tracking-tight font-display">
                  Official Sign In
                </h2>
                <p className="text-xs text-[#64748B] font-semibold">
                  Concepcion District Portal &bull; Concepcion, Romblon
                </p>
              </div>

              {/* Simple Modern Pastel Error Alert Banner */}
              {authError && (
                <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-3 shadow-xs animate-shake ${
                  authError.type === 'disabled'
                    ? 'bg-[#FFF0F3] border-[#FBCFE8] text-[#9F1239]'
                    : authError.type === 'wrong_credentials'
                    ? 'bg-[#FAF5FF] border-[#E9D5FF] text-[#6B21A8]'
                    : 'bg-[#F0F9FF] border-[#BAE6FD] text-[#075985]'
                }`}>
                  {authError.type === 'disabled' ? (
                    <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0 text-[#E11D48]" />
                  ) : authError.type === 'wrong_credentials' ? (
                    <KeyRound className="w-4.5 h-4.5 flex-shrink-0 text-[#9333EA]" />
                  ) : (
                    <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-[#0284C7]" />
                  )}
                  <span>{authError.message}</span>
                </div>
              )}

              {/* Sign In Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Email / Username */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider px-1">
                    DepEd Username / Email
                  </label>
                  <div className="relative">
                    <User className="w-4.5 h-4.5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@deped.gov.ph"
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-xs text-[#1E293B] placeholder-[#94A3B8] font-bold focus:outline-none focus:ring-4 focus:ring-[#6366F1]/20 focus:bg-white focus:border-[#818CF8] transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider">
                      Password
                    </label>
                    <a
                      href="mailto:admin@deped.gov.ph"
                      className="text-[11px] font-bold text-[#4F46E5] hover:underline"
                    >
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4.5 h-4.5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-xs text-[#1E293B] placeholder-[#94A3B8] font-bold focus:outline-none focus:ring-4 focus:ring-[#6366F1]/20 focus:bg-white focus:border-[#818CF8] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#4F46E5] transition-colors p-1 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between px-1 pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#475569]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#4F46E5] focus:ring-[#6366F1]"
                    />
                    <span>Keep me signed in</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 px-6 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-[#818CF8] via-[#6366F1] to-[#4F46E5] shadow-[0_10px_25px_rgba(99,102,241,0.35)] hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Authenticating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4.5 h-4.5 text-white" />
                        <span>Sign In to School Connect</span>
                        <ArrowRight className="w-3.5 h-3.5 opacity-90" />
                      </span>
                    )}
                  </button>
                </div>
              </form>

              {/* Direct link to Teacher Public Submission Form */}
              <div className="text-center pt-2 border-t border-slate-100">
                <Link
                  to="/submit"
                  className="text-xs font-extrabold text-[#4F46E5] hover:text-[#3730A3] hover:underline inline-flex items-center gap-1.5"
                >
                  <span>Go to Teacher Public Submission Form</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer Bar */}
      <footer className="relative z-20 py-4 px-6 text-center text-xs text-[#64748B] bg-white/75 backdrop-blur-xl border-t border-white/80 flex flex-col sm:flex-row items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <img src="/images/school_connect_logo.png" alt="School Connect Logo" className="w-5 h-5 object-contain" />
          <span className="font-semibold">School Connect &copy; {new Date().getFullYear()} &bull; Concepcion District, Concepcion, Romblon</span>
        </div>
        <span className="hidden sm:inline">&bull;</span>
        <span>Department of Education &bull; Republic of the Philippines</span>
      </footer>
    </div>
  )
}





