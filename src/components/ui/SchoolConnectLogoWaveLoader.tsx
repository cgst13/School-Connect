import { ReactNode } from 'react'

export interface SchoolConnectLogoWaveLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  subtitle?: string
  className?: string
  showMultiWaveLogos?: boolean
}

export function SchoolConnectLogoWaveLoader({
  size = 'md',
  label = 'Fetching data...',
  subtitle = 'School Connect Data Engine',
  className = '',
  showMultiWaveLogos = true
}: SchoolConnectLogoWaveLoaderProps) {
  const sizeMap = {
    sm: {
      container: 'p-3',
      centerBadge: 'w-12 h-12 rounded-2xl',
      logo: 'w-7 h-7',
      miniLogo: 'w-4 h-4',
      waveGap: 'gap-1.5',
      titleText: 'text-xs font-bold',
      subText: 'text-[10px]',
    },
    md: {
      container: 'p-6',
      centerBadge: 'w-20 h-20 rounded-3xl',
      logo: 'w-12 h-12',
      miniLogo: 'w-6 h-6',
      waveGap: 'gap-3',
      titleText: 'text-sm font-extrabold',
      subText: 'text-xs',
    },
    lg: {
      container: 'p-8',
      centerBadge: 'w-28 h-28 rounded-[32px]',
      logo: 'w-18 h-18',
      miniLogo: 'w-8 h-8',
      waveGap: 'gap-4',
      titleText: 'text-base font-black',
      subText: 'text-xs font-semibold',
    },
    xl: {
      container: 'p-10',
      centerBadge: 'w-36 h-36 rounded-[40px]',
      logo: 'w-24 h-24',
      miniLogo: 'w-10 h-10',
      waveGap: 'gap-5',
      titleText: 'text-lg font-black',
      subText: 'text-sm font-semibold',
    },
  }

  const s = sizeMap[size] || sizeMap.md

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${s.container} ${className}`}>
      
      {/* 1. Cascading Wave Logos (5 Logos Undulating in Sine Wave Rhythm) */}
      {showMultiWaveLogos && (
        <div className={`flex items-center justify-center ${s.waveGap} mb-3`}>
          {[0, 1, 2, 3, 4].map((index) => {
            // Stagger delays for ocean wave motion
            const delayMs = index * 180
            const opacity = index === 2 ? 1 : index === 1 || index === 3 ? 0.8 : 0.55
            const scale = index === 2 ? 'scale-110' : index === 1 || index === 3 ? 'scale-100' : 'scale-90'

            return (
              <div
                key={index}
                className={`transition-all duration-300 transform ${scale}`}
                style={{
                  animation: `scLogoWaveBounce 2.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite`,
                  animationDelay: `${delayMs}ms`,
                  opacity,
                }}
              >
                <div className="relative p-1.5 rounded-2xl bg-white/90 border border-white shadow-[0_6px_16px_rgba(139,114,244,0.18)]">
                  <img
                    src="/images/school_connect_logo.png"
                    alt="School Connect Wave Logo"
                    className={`${s.miniLogo} object-contain`}
                  />
                  {/* Subtle Pastel Aura under each logo */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#8B72F4]/20 to-[#BAE6FD]/20 blur-xs -z-10" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 2. Main Central Wave Badge with Liquid Ocean Ripple & Glowing Rings */}
      <div className="relative flex items-center justify-center my-2">
        {/* Ring 1: Expanding Soft Purple Ripple */}
        <div className={`absolute ${s.centerBadge} rounded-[36px] bg-gradient-to-r from-[#A88BEB]/30 via-[#8B72F4]/20 to-[#BAE6FD]/30 animate-sc-pulse-ring pointer-events-none`} />

        {/* Ring 2: Rotating Pastel Wave Orbit */}
        <div className={`absolute ${s.centerBadge} scale-110 rounded-[38px] border-2 border-dashed border-[#8B72F4]/40 animate-spin-slow pointer-events-none`} />

        {/* Main 3D Clay Center Badge */}
        <div className={`relative ${s.centerBadge} bg-white border-4 border-white shadow-[0_18px_40px_rgba(139,114,244,0.22)] flex items-center justify-center p-2 overflow-hidden z-10`}>
          
          {/* Liquid Wave Animation Fill in Background of Badge */}
          <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <svg
              className="absolute bottom-0 left-0 w-[200%] h-full text-[#F3EFFF] fill-current animate-sc-wave-ripple opacity-80"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,60 L1200,120 L0,120 Z" />
            </svg>
            <svg
              className="absolute bottom-0 left-0 w-[200%] h-full text-[#EBF3FE] fill-current animate-sc-wave-ripple opacity-60"
              style={{ animationDuration: '3.8s', animationDirection: 'reverse' }}
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path d="M0,30 C200,100 400,-20 600,50 C800,110 1000,20 1200,70 L1200,120 L0,120 Z" />
            </svg>
          </div>

          {/* School Connect Logo in Center */}
          <img
            src="/images/school_connect_logo.png"
            alt="School Connect Official Logo"
            className={`${s.logo} object-contain relative z-10 drop-shadow-md transform hover:scale-105 transition-transform duration-300`}
          />

          {/* Shimmer Wave Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer pointer-events-none z-20" />
        </div>
      </div>

      {/* 3. Text Labels with Bouncing Wave Dots */}
      {(label || subtitle) && (
        <div className="mt-4 space-y-1 font-sans max-w-sm animate-fade-in">
          {label && (
            <p className={`${s.titleText} text-[#2D2638] tracking-tight flex items-center justify-center gap-2 font-display`}>
              <span>{label}</span>
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B72F4] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#A88BEB] animate-bounce" style={{ animationDelay: '160ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#BAE6FD] animate-bounce" style={{ animationDelay: '320ms' }} />
              </span>
            </p>
          )}
          {subtitle && (
            <p className={`${s.subText} text-[#7A7289] font-medium`}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Full Page Wave Loader for navigation between heavy data screens
 */
export function SchoolConnectPageWaveLoader({
  label = 'Loading School Connect Data...',
  subtitle = 'Fetching and processing records'
}: {
  label?: string
  subtitle?: string
}) {
  return (
    <div className="w-full min-h-[420px] py-16 flex items-center justify-center font-sans">
      <SchoolConnectLogoWaveLoader size="lg" label={label} subtitle={subtitle} />
    </div>
  )
}

/**
 * Table Wave Skeleton Overlay specifically designed for tables with a lot of data
 */
export function SchoolConnectTableWaveSkeleton({
  rows = 6,
  label = 'Loading Table Records...'
}: {
  rows?: number
  label?: string
}) {
  return (
    <div className="w-full bg-white rounded-[28px] border-2 border-white shadow-[0_12px_30px_rgba(185,170,210,0.16)] p-6 space-y-6 font-sans relative overflow-hidden">
      {/* Top Loader Banner */}
      <div className="flex items-center justify-center border-b border-[#F0E8F5] pb-4">
        <SchoolConnectLogoWaveLoader size="sm" label={label} showMultiWaveLogos={true} />
      </div>

      {/* Skeleton Rows with Shimmer Wave */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#FAF5F0]/70 border border-white shadow-2xs relative overflow-hidden"
            style={{ opacity: 1 - i * 0.12 }}
          >
            {/* Shimmer wave effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer" />

            <div className="w-9 h-9 rounded-full bg-[#EFE6FA] shrink-0 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-[#EFE6FA] rounded-full w-2/5 animate-pulse" />
              <div className="h-2.5 bg-[#F6EFFF] rounded-full w-4/5 animate-pulse" />
            </div>
            <div className="w-20 h-6 rounded-full bg-[#F3EFFF] shrink-0 animate-pulse" />
            <div className="w-16 h-6 rounded-full bg-[#EDFAF3] shrink-0 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
