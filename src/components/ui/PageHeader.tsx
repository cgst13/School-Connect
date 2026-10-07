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
 * Standardized Super Minimal Page Header Component
 * Strictly matching clean SaaS reference UI
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
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs font-sans ${className}`}>
      <div className="min-w-0 flex-1">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#2563EB] text-[11px] font-bold mb-1.5 border border-blue-100">
            {badgeIcon || <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />}
            <span>{badge}</span>
          </div>
        )}
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 flex-wrap sm:flex-nowrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
