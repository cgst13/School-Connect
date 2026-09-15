import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/hooks/useToast'
import { Eye, EyeOff, Lock, Mail, Shield, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

export function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginForm) => {
    setIsLoading(true)
    try {
      await signIn(values.email, values.password)
      toast('Welcome back!', 'success')
      navigate('/admin')
    } catch (err: any) {
      const is500 = err?.status === 500 || err?.message?.includes('500') || err?.message?.includes('Internal Server Error') || err?.code === '500'
      const msg = is500
        ? 'Database Auth Error (500). Please run supabase/migrations/003_create_default_admin.sql in your Supabase SQL Editor.'
        : err?.message?.includes('Invalid login credentials')
        ? 'Invalid email or password. Please try again.'
        : err?.message?.includes('Email not confirmed')
        ? 'Please confirm your email address before logging in.'
        : err?.message || 'Login failed. Please check your credentials.'
      toast(msg, 'error', 8000)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex flex-col lg:flex-row font-sans">
      {/* DepEd Brand Header Stripe for Mobile */}
      <div className="h-1.5 flex lg:hidden" aria-hidden="true">
        <div className="flex-1 bg-blue-600" />
        <div className="w-16 bg-amber-500" />
        <div className="w-8 bg-red-600" />
      </div>

      {/* Left Branding Hero Section (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0f1f3e] relative overflow-hidden flex-col justify-between p-12 text-white border-r border-white/10">
        {/* Background Subtle Gradient & Glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full filter blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full filter blur-[100px] pointer-events-none" />

        {/* Top Branding Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white text-sm font-black shadow-lg border border-white/20">
            TC
          </div>
          <div>
            <span className="font-extrabold text-white text-lg tracking-tight">TERMCAT</span>
            <span className="block text-slate-400 text-xs font-medium">Department of Education · District of Concepcion</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-md my-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold">
            <Shield size={14} />
            Official Administrative Portal
          </div>

          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Consolidated Teacher Performance & Ratings System
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            Secure centralized dashboard for managing quarterly school submissions, learning area performance, and automated district consolidation.
          </p>

          {/* Value Props */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <span>Real-time school performance analytics and summaries</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <span>End-to-end submission workflow & review management</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <span>Automated PDF report export with institutional standards</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
          <span>DepEd Concepcion, Romblon</span>
          <span>Terms & Data Protection Compliant</span>
        </div>
      </div>

      {/* Right Login Form Section */}
      <div className="flex-1 bg-slate-50 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Brand Header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0f1f3e] text-white font-extrabold text-xl flex items-center justify-center mx-auto shadow-md border border-slate-700">
              TC
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">TERMCAT</h1>
            <p className="text-xs text-slate-500">Administrative Portal · DepEd Concepcion</p>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Administrator Sign In</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your credentials to access the administrative dashboard.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card-md">
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              {/* Email Input */}
              <div>
                <label className="form-label" htmlFor="admin-email">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="admin-email"
                    type="email"
                    className="form-input pl-10"
                    placeholder="admin@termcat.edu.ph"
                    autoComplete="email"
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              {/* Password Input */}
              <div>
                <label className="form-label" htmlFor="admin-password">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input pl-10 pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              {/* Submit Button */}
              <button
                id="admin-signin-btn"
                type="submit"
                className="btn-lg btn-primary w-full mt-2 flex items-center justify-center gap-2 group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <a
                href="mailto:admin@termcat.edu.ph"
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                Forgot your password? Contact System Administrator.
              </a>
            </div>
          </div>

          {/* Public Portal Switch Link */}
          <div className="text-center pt-2">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
              <BookOpen size={14} />
              <span>Go to Teacher Submission Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
