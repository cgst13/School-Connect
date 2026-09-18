import { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export interface PageHeaderProps {
  badge?: string
  badgeIcon?: ReactNode
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

/**
 * Standardized Simple Clean Page Header Component
 * Matches the signature Termcat Header design card:
 * - White claymorphic card with rounded-[28px] squircle border
 * - Top soft purple pill badge
 * - Bold black title and medium muted subtitle
 * - Right-aligned optional action controls / filters in pill container
 */
export function PageHeader({
  badge,
  badgeIcon,
  title,
  description,
  actions,
  className = ''
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-[28px] border border-white shadow-xs font-sans ${className}`}>
      <div className="min-w-0 flex-1">
        {badge && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F3EFFF] text-[#6D28D9] text-xs font-black mb-1.5 border border-[#E2D5FE] font-display">
            {badgeIcon || <Sparkles className="w-3.5 h-3.5 text-[#8B72F4]" />}
            <span>{badge}</span>
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-black text-[#2D2638] tracking-tight font-display truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-[#7A7289] font-medium mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 bg-[#FAF5F0] p-2 rounded-full border border-white flex-wrap sm:flex-nowrap shadow-2xs shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
