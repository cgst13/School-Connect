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
    <div className="min-h-screen flex flex-col justify-between font-sans relative bg-[#F4F6F9] text-slate-800 select-none overflow-x-hidden">
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
      
      {/* Subtle Micro-Grid Texture */}
      <div 
        className="fixed inset-0 w-screen h-[100dvh] opacity-[0.035] pointer-events-none z-0" 
        style={{ backgroundImage: `radial-gradient(#475569 1px, transparent 1px)`, backgroundSize: '28px 28px' }} 
      />

      {/* Main Container - Split View on Desktop */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-8 sm:py-12 w-full max-w-6xl mx-auto">
        
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column (Desktop Showcase & Logo Display) */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 lg:pr-4 text-center lg:text-left">
            
            {/* Big Official Logo Display */}
            <div className="flex justify-center lg:justify-start pt-2 pb-1">
              <img
                src="/images/school_connect_logo.png"
                alt="School Connect Official Logo"
                className="h-24 sm:h-28 lg:h-32 w-auto object-contain drop-shadow-xs hover:scale-[1.01] transition-transform duration-300"
              />
            </div>

            {/* Hero Headline & Subtitle */}
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-100 text-xs font-semibold text-[#2563EB] mx-auto lg:mx-0">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span>DepEd Concepcion District &bull; Concepcion, Romblon</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Unified Educational <br className="hidden sm:inline" />
                <span className="text-[#2563EB]">Management System</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed max-w-lg mx-auto lg:mx-0">
                Seamlessly connecting DepEd schools, administrative personnel, and educators of Concepcion District under one secure, streamlined digital platform.
              </p>
            </div>

          </div>

          {/* Right Column (Executive Login Form Card) */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6 relative overflow-hidden">
              
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#2563EB]" />

              {/* Mobile View Logo Header */}
              <div className="lg:hidden text-center pt-1 pb-1">
                <img
                  src="/images/school_connect_logo.png"
                  alt="School Connect Official Logo"
                  className="h-14 w-auto object-contain mx-auto"
                />
              </div>

              {/* Form Title & Subtitle */}
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Official Sign In
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Concepcion District Portal &bull; Concepcion, Romblon
                </p>
              </div>

              {/* Modern Alert Banner */}
              {authError && (
                <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                  authError.type === 'disabled'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : authError.type === 'wrong_credentials'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  {authError.type === 'disabled' ? (
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  ) : authError.type === 'wrong_credentials' ? (
                    <KeyRound className="w-4 h-4 flex-shrink-0 text-amber-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#2563EB]" />
                  )}
                  <span>{authError.message}</span>
                </div>
              )}

              {/* Sign In Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Email / Username */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    DepEd Username / Email
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@deped.gov.ph"
                      className="form-input pl-9"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <a
                      href="mailto:admin@deped.gov.ph"
                      className="text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="form-input pl-9 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span>Keep me signed in</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        Authenticating...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-white" />
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
                  className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1.5"
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
      <footer className="relative z-20 py-3 px-6 text-center text-xs text-slate-500 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <img src="/images/school_connect_logo.png" alt="School Connect Logo" className="w-4 h-4 object-contain" />
          <span className="font-medium">School Connect &copy; {new Date().getFullYear()} &bull; Concepcion District, Concepcion, Romblon</span>
        </div>
        <span className="hidden sm:inline">&bull;</span>
        <span>Department of Education &bull; Republic of the Philippines</span>
      </footer>
    </div>
  )
}





