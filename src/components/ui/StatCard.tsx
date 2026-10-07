import { ReactNode } from 'react'

export type StatCardVariant = 'purple' | 'blue' | 'green' | 'yellow' | 'pink' | 'lavender' | 'peach' | 'mint'

export interface StatCardProps {
  title: string
  value: string | number
  icon?: ReactNode
  description?: string
  trend?: {
    value: string
    isUpward?: boolean
  }
  variant?: StatCardVariant
  onClick?: () => void
  className?: string
}

const variantStyles: Record<StatCardVariant, { bg: string; iconBg: string; iconColor: string; trendBg: string; trendColor: string }> = {
  purple: {
    bg: 'bg-white',
    iconBg: 'bg-[#F3E8FF] border border-[#DDD6FE]',
    iconColor: 'text-[#8B5CF6]',
    trendBg: 'bg-[#F3E8FF]',
    trendColor: 'text-[#8B5CF6]',
  },
  blue: {
    bg: 'bg-white',
    iconBg: 'bg-[#EFF6FF] border border-[#BFDBFE]',
    iconColor: 'text-[#2563EB]',
    trendBg: 'bg-[#EFF6FF]',
    trendColor: 'text-[#2563EB]',
  },
  green: {
    bg: 'bg-white',
    iconBg: 'bg-[#ECFDF5] border border-[#A7F3D0]',
    iconColor: 'text-[#10B981]',
    trendBg: 'bg-[#ECFDF5]',
    trendColor: 'text-[#10B981]',
  },
  yellow: {
    bg: 'bg-white',
    iconBg: 'bg-[#FEF3C7] border border-[#FDE68A]',
    iconColor: 'text-[#D97706]',
    trendBg: 'bg-[#FEF3C7]',
    trendColor: 'text-[#D97706]',
  },
  pink: {
    bg: 'bg-white',
    iconBg: 'bg-[#FFE4E6] border border-[#FECDD3]',
    iconColor: 'text-[#E11D48]',
    trendBg: 'bg-[#FFE4E6]',
    trendColor: 'text-[#E11D48]',
  },
  lavender: {
    bg: 'bg-white',
    iconBg: 'bg-[#F3E8FF] border border-[#DDD6FE]',
    iconColor: 'text-[#8B5CF6]',
    trendBg: 'bg-[#F3E8FF]',
    trendColor: 'text-[#8B5CF6]',
  },
  peach: {
    bg: 'bg-white',
    iconBg: 'bg-[#FFEDD5] border border-[#FED7AA]',
    iconColor: 'text-[#EA580C]',
    trendBg: 'bg-[#FFEDD5]',
    trendColor: 'text-[#EA580C]',
  },
  mint: {
    bg: 'bg-white',
    iconBg: 'bg-[#ECFDF5] border border-[#A7F3D0]',
    iconColor: 'text-[#10B981]',
    trendBg: 'bg-[#ECFDF5]',
    trendColor: 'text-[#10B981]',
  },
}

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  variant = 'blue',
  onClick,
  className = '',
}: StatCardProps) {
  const style = variantStyles[variant] || variantStyles.blue

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl bg-white p-5 border border-slate-200/80 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm font-sans ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className={`w-11 h-11 rounded-xl ${style.iconBg} ${style.iconColor} flex items-center justify-center shrink-0 shadow-2xs`}>
            {icon}
          </div>
        )}

        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none">{value}</p>
        </div>
      </div>

      {(description || trend) && (
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          {description && <span className="text-slate-500 font-medium text-xs truncate">{description}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full ${
                trend.isUpward ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60' : 'text-rose-700 bg-rose-50 border border-rose-200/60'
              }`}
            >
              {trend.isUpward ? '↑' : '↓'} {trend.value} <span className="text-slate-400 font-normal ml-0.5">vs last month</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
