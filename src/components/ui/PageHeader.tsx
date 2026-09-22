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
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-[#EAECEF] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)] font-sans ${className}`}>
      <div className="min-w-0 flex-1">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFEBEB] text-[#FA6B6B] text-[11px] font-extrabold mb-1.5 border border-[#FFCCD4]/60 font-display">
            {badgeIcon || <Sparkles className="w-3.5 h-3.5 text-[#FA6B6B]" />}
            <span>{badge}</span>
          </div>
        )}
        <h1 className="text-lg sm:text-xl md:text-2xl font-black text-[#1E202A] tracking-tight font-display truncate">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 bg-[#F8F9FD] p-1.5 rounded-xl border border-[#EAECEF] flex-wrap sm:flex-nowrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
