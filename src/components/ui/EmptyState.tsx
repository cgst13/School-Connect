import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { DepEdSpinner, DepEdPageLoader } from './DepEdSpinner'
import { SchoolConnectTableWaveSkeleton } from './SchoolConnectLogoWaveLoader'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center font-sans">
      <div className="w-16 h-16 rounded-full bg-[#FAF5F0] border-2 border-white shadow-xs flex items-center justify-center mb-4 text-[#8B72F4]">
        {icon || <Inbox size={28} />}
      </div>
      <h3 className="text-base font-black text-[#2D2638] mb-1 font-display">{title}</h3>
      {description && <p className="text-xs font-semibold text-[#7A7289] max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingSpinner({
  size = 'md',
  label,
  subtitle
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  subtitle?: string
}) {
  return <DepEdSpinner size={size} label={label} subtitle={subtitle} />
}

export function PageLoader({
  label = 'Loading System Data...',
  subtitle = 'Department of Education - School Connect Suite'
}: {
  label?: string
  subtitle?: string
}) {
  return <DepEdPageLoader label={label} subtitle={subtitle} />
}

export function TableSkeleton({ rows = 6, label = 'Loading Table Records...' }: { rows?: number; label?: string; cols?: number }) {
  return <SchoolConnectTableWaveSkeleton rows={rows} label={label} />
}
