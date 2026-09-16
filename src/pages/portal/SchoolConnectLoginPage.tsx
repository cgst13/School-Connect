import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Grid,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  ArrowRight,
  AlertCircle,
  Sparkles,
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
    <div className="min-h-screen text-slate-800 flex flex-col justify-between font-sans relative overflow-hidden bg-slate-900">
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

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between bg-white/70 backdrop-blur-md border-b border-white/30 shadow-xs">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0B1F3A] to-blue-700 p-0.5 shadow-md">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Grid className="w-5 h-5 text-[#0B1F3A]" />
            </div>
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-[#0B1F3A]">SCHOOL CONNECT</span>
            <span className="block text-[10px] text-[#64748B] font-semibold">Unified Educational Systems</span>
          </div>
        </Link>
      </header>

      {/* Login Card Form */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 py-8 sm:py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/85 backdrop-blur-md border border-white/60 text-[#0B1F3A] text-xs font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#0B1F3A]" /> Single Sign-On Authentication
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0B1F3A] tracking-tight">Sign In to School Connect</h1>
            <p className="text-xs text-slate-700 font-semibold">
              Enter your official administrator or teacher credentials to access your modules.
            </p>
          </div>

          <div className="rounded-2xl bg-white/95 backdrop-blur-md border border-white/60 p-6 sm:p-8 shadow-2xl space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1.5">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@school.edu.ph"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs bg-slate-50/80 border border-[#E2E8F0] text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0B1F3A] focus:ring-1 focus:ring-[#0B1F3A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs bg-slate-50/80 border border-[#E2E8F0] text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#0B1F3A] focus:ring-1 focus:ring-[#0B1F3A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#111827]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#0B1F3A] hover:bg-[#07152A] shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> Sign In to Hub Portal
                    </span>
                  )}
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-500 font-medium">
                Granting access to TERMCAT, SIS, HRIS & DepEd compliance tools.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-3.5 text-center text-xs text-slate-600 bg-white/80 backdrop-blur-md border-t border-white/40">
        School Connect &copy; {new Date().getFullYear()} DepEd Systems Portal
      </footer>
    </div>
  )
}
