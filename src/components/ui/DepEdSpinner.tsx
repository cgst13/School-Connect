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
  className = '',
}: DepEdSpinnerProps) {
  const sizeMap = {
    sm: 'w-[400px] h-[400px]',
    md: 'w-[640px] h-[640px]',
    lg: 'w-[960px] h-[960px]',
    xl: 'w-[1280px] h-[1280px]',
  }
  const imgSize = sizeMap[size] || sizeMap.md

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fcfcff] select-none">
      <img
        src="/images/loading.gif"
        alt="Loading..."
        className={`${imgSize} max-w-[90vw] max-h-[90vh] object-contain bg-transparent ${className}`}
      />
    </div>
  )
}

export function DepEdPageLoader(_props?: {
  label?: string
  subtitle?: string
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fcfcff] select-none">
      <img
        src="/images/loading.gif"
        alt="Loading..."
        className="w-[450px] h-[450px] sm:w-[700px] sm:h-[700px] max-w-[90vw] max-h-[90vh] object-contain bg-transparent"
      />
    </div>
  )
}

export function DepEdFullScreenLoader(_props?: {
  label?: string
  subtitle?: string
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#fcfcff] select-none">
      <img
        src="/images/loading.gif"
        alt="Loading..."
        className="w-[500px] h-[500px] sm:w-[800px] sm:h-[800px] max-w-[90vw] max-h-[90vh] object-contain bg-transparent"
      />
    </div>
  )
}

