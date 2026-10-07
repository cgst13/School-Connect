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
  className = '',
}: SchoolConnectLogoWaveLoaderProps) {
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

export function SchoolConnectPageWaveLoader(_props?: {
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

export function SchoolConnectTableWaveSkeleton(_props?: {
  rows?: number
  label?: string
}) {
  return (
    <div className="w-full py-8 flex items-center justify-center bg-transparent select-none">
      <img
        src="/images/loading.gif"
        alt="Loading..."
        className="w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] max-w-[80vw] max-h-[50vh] object-contain bg-transparent"
      />
    </div>
  )
}

