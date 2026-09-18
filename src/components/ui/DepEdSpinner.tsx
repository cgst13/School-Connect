import { SchoolConnectLogoWaveLoader } from './SchoolConnectLogoWaveLoader'

export interface DepEdSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  subtitle?: string
  className?: string
  showLogo?: boolean
}

export function DepEdSpinner({
  size = 'md',
  label = 'Loading System Data...',
  subtitle = 'Department of Education - School Connect Suite',
  className = '',
}: DepEdSpinnerProps) {
  return (
    <SchoolConnectLogoWaveLoader
      size={size}
      label={label}
      subtitle={subtitle}
      className={className}
      showMultiWaveLogos={size === 'lg' || size === 'xl'}
    />
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
    <div className="min-h-[380px] w-full flex items-center justify-center py-12">
      <SchoolConnectLogoWaveLoader size="lg" label={label} subtitle={subtitle} />
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
    <div className="fixed inset-0 z-50 bg-[#1E1B29]/50 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in font-sans">
      <div className="bg-white/95 rounded-[36px] p-8 border-4 border-white shadow-[0_24px_60px_rgba(139,114,244,0.3)] max-w-md w-full text-center space-y-2">
        <SchoolConnectLogoWaveLoader size="xl" label={label} subtitle={subtitle} />
      </div>
    </div>
  )
}
