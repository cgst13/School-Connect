import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-soft flex items-center justify-center mb-4 text-content-tertiary">
        {icon || <Inbox size={28} />}
      </div>
      <h3 className="text-base font-semibold text-content-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-content-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

import { DepEdSpinner, DepEdPageLoader } from './DepEdSpinner'

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

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
