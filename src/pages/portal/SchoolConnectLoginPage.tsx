import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Grid,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  KeyRound,
  Building2,
  CheckCircle2
} from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { insertAuditLog } from '@/lib/supabase/queries'

export function SchoolConnectLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn, admin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && admin) {
      navigate('/portal', { replace: true })
    }
  }, [admin, loading, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setIsLoading(true)

    try {
      await signIn(email.trim(), password)
      if (admin) {
        await insertAuditLog({
          admin_id: admin.id,
          admin_name: admin.full_name,
          action: 'login',
          details: { method: 'school_connect_portal' },
        })
      }
      navigate('/portal')
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please check your email and password.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between font-sans relative overflow-hidden bg-slate-900 select-none">
      {/* Responsive Background Images */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Mobile Background (< md) */}
        <div 
          className="block md:hidden absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('/images/bg-mobile.png')` }}
        />
        {/* Desktop Background (>= md) */}
        <div 
          className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('/images/bg-desktop.png')` }}
        />
      </div>

      {/* Top Header Navbar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between bg-white/75 backdrop-blur-lg border-b border-white/40 shadow-xs">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B1F3A] to-blue-700 p-0.5 shadow-md shadow-blue-900/10 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Grid className="w-5 h-5 text-[#0B1F3A]" />
            </div>
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-[#0B1F3A] font-display">
              SCHOOL CONNECT
            </span>
            <span className="block text-[10px] text-[#64748B] font-semibold tracking-wide uppercase">
              Unified Educational Systems
            </span>
          </div>
        </Link>
      </header>

      {/* Main Login Card Section */}
      <main className="relative z-10 flex-1 flex items-center justify-center md:justify-end px-4 sm:px-8 md:px-14 lg:px-24 py-8 sm:py-12 w-full">
        <div className="w-full max-w-md space-y-4">
          
          {/* Glassmorphic Login Card */}
          <div className="rounded-3xl bg-white/88 backdrop-blur-xl border border-white/80 p-6 sm:p-9 shadow-[0_20px_50px_rgba(11,31,58,0.18)] space-y-6">
            
            {/* Card Header & Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/90 border border-blue-200/80 text-[#0B1F3A] text-[11px] font-extrabold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-[#0B1F3A]" /> Single Sign-On Authentication
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight">
                Sign In to School Connect
              </h1>

              <p className="text-xs text-[#64748B] font-medium leading-relaxed">
                Enter your official administrator or teacher credentials to access your modules.
              </p>
            </div>

            {/* Error Notification Alert */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50/90 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5 shadow-xs animate-shake">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email / Username Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#0B1F3A]">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors group-focus-within:text-[#0B1F3A]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@school.edu.ph"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-xs bg-slate-50/90 border border-slate-200/90 text-[#111827] placeholder-slate-400 font-medium focus:outline-none focus:border-[#0B1F3A] focus:bg-white focus:ring-4 focus:ring-[#0B1F3A]/10 transition-all shadow-2xs"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-[#0B1F3A]">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 rounded-2xl text-xs bg-slate-50/90 border border-slate-200/90 text-[#111827] placeholder-slate-400 font-medium focus:outline-none focus:border-[#0B1F3A] focus:bg-white focus:ring-4 focus:ring-[#0B1F3A]/10 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0B1F3A] transition-colors p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#0B1F3A] via-[#0E284B] to-[#07152A] hover:from-[#07152A] hover:to-[#0B1F3A] shadow-lg shadow-[#0B1F3A]/25 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Sign In to Hub Portal</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Modules Pill Footer */}
            <div className="pt-4 border-t border-slate-200/80 space-y-2">
              <div className="text-center">
                <span className="text-[11px] text-[#64748B] font-semibold">
                  Unified Single Sign-On Portal
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-bold text-[#0B1F3A]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> TERMCAT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">SIS</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">HRIS</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">GRADING</span>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-3.5 text-center text-xs text-slate-600 bg-white/80 backdrop-blur-md border-t border-white/40">
        School Connect &copy; {new Date().getFullYear()} DepEd Systems Portal &bull; Department of Education
      </footer>
    </div>
  )
}
