import { ReactNode } from 'react'

export interface DepEdSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  subtitle?: string
  className?: string
  showLogo?: boolean
}

export function DepEdSpinner({
  size = 'md',
  label,
  subtitle,
  className = '',
  showLogo = true
}: DepEdSpinnerProps) {
  const sizeMap = {
    sm: {
      outer: 'w-10 h-10',
      middle: 'w-8 h-8',
      center: 'w-6 h-6',
      logo: 'w-4 h-4',
      borderWidth: 'border-2',
      textSize: 'text-xs',
      subTextSize: 'text-[10px]',
    },
    md: {
      outer: 'w-16 h-16',
      middle: 'w-12 h-12',
      center: 'w-9 h-9',
      logo: 'w-6 h-6',
      borderWidth: 'border-3',
      textSize: 'text-xs font-bold',
      subTextSize: 'text-[11px]',
    },
    lg: {
      outer: 'w-24 h-24',
      middle: 'w-18 h-18',
      center: 'w-14 h-14',
      logo: 'w-9 h-9',
      borderWidth: 'border-4',
      textSize: 'text-sm font-extrabold',
      subTextSize: 'text-xs',
    },
    xl: {
      outer: 'w-32 h-32',
      middle: 'w-24 h-24',
      center: 'w-18 h-18',
      logo: 'w-12 h-12',
      borderWidth: 'border-4',
      textSize: 'text-base font-black',
      subTextSize: 'text-xs font-medium',
    },
  }

  const s = sizeMap[size] || sizeMap.md

  return (
    <div className={`flex flex-col items-center justify-center p-4 text-center select-none ${className}`}>
      {/* Spinner Graphic Container */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing Outer Glow Aura */}
        <div className={`absolute ${s.outer} rounded-full bg-gradient-to-tr from-blue-600/30 via-amber-400/20 to-indigo-600/30 blur-lg animate-pulse`} />

        {/* Outer Ring: DepEd Blue & Gold Gradient Spin */}
        <div
          className={`${s.outer} ${s.borderWidth} rounded-full border-transparent border-t-blue-700 border-r-indigo-600 border-b-amber-500 border-l-blue-400 animate-spin shadow-sm`}
        />

        {/* Middle Ring: Dashed Counter-Rotation */}
        <div
          className={`absolute ${s.middle} border-2 border-dashed border-blue-400/60 rounded-full animate-spin-reverse`}
        />

        {/* Center Badge with DepEd Logo */}
        <div
          className={`absolute ${s.center} rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center animate-deped-glow p-1 overflow-hidden`}
        >
          {showLogo ? (
            <img
              src="/images/school_connect_logo.png"
              alt="School Connect Logo"
              className={`${s.logo} object-contain`}
            />
          ) : (
            <div className={`${s.logo} rounded-full bg-blue-600`} />
          )}
        </div>
      </div>

      {/* Text Labels */}
      {(label || subtitle) && (
        <div className="mt-4 space-y-1 max-w-xs animate-fade-in">
          {label && (
            <p className={`${s.textSize} text-slate-800 tracking-tight flex items-center justify-center gap-1.5`}>
              <span>{label}</span>
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </p>
          )}
          {subtitle && (
            <p className={`${s.subTextSize} text-slate-500`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function DepEdPageLoader({
  label = 'Loading System Data...',
  subtitle = 'Department of Education - School Connect Suite'
}: {
  label?: string
  subtitle?: string
}) {
  return (
    <div className="min-h-[360px] w-full flex items-center justify-center py-12">
      <DepEdSpinner size="lg" label={label} subtitle={subtitle} />
    </div>
  )
}

export function DepEdFullScreenLoader({
  label = 'Initializing School Connect...',
  subtitle = 'Authenticating and fetching secure database records'
}: {
  label?: string
  subtitle?: string
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl max-w-sm w-full text-center space-y-2">
        <DepEdSpinner size="xl" label={label} subtitle={subtitle} />
      </div>
    </div>
  )
}
