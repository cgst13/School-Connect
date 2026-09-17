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

const variantStyles: Record<StatCardVariant, { bg: string; iconGradient: string; iconColor: string; trendBg: string; trendColor: string }> = {
  purple: {
    bg: 'bg-[#F4F1FD]',
    iconGradient: 'from-[#DDD6FE] to-[#C4B5FD]',
    iconColor: 'text-[#6D28D9]',
    trendBg: 'bg-[#EDE9FE]',
    trendColor: 'text-[#6D28D9]',
  },
  blue: {
    bg: 'bg-[#F0F5FF]',
    iconGradient: 'from-[#BFDBFE] to-[#93C5FD]',
    iconColor: 'text-[#1D4ED8]',
    trendBg: 'bg-[#DBEAFE]',
    trendColor: 'text-[#1D4ED8]',
  },
  green: {
    bg: 'bg-[#ECFDF5]',
    iconGradient: 'from-[#A7F3D0] to-[#6EE7B7]',
    iconColor: 'text-[#047857]',
    trendBg: 'bg-[#D1FAE5]',
    trendColor: 'text-[#047857]',
  },
  yellow: {
    bg: 'bg-[#FFFBEB]',
    iconGradient: 'from-[#FDE68A] to-[#FCD34D]',
    iconColor: 'text-[#B45309]',
    trendBg: 'bg-[#FEF3C7]',
    trendColor: 'text-[#B45309]',
  },
  pink: {
    bg: 'bg-[#FEF2F2]',
    iconGradient: 'from-[#FECACA] to-[#FCA5A5]',
    iconColor: 'text-[#B91C1C]',
    trendBg: 'bg-[#FEE2E2]',
    trendColor: 'text-[#B91C1C]',
  },
  lavender: {
    bg: 'bg-[#F5F3FF]',
    iconGradient: 'from-[#EDE9FE] to-[#DDD6FE]',
    iconColor: 'text-[#6D28D9]',
    trendBg: 'bg-[#EDE9FE]',
    trendColor: 'text-[#6D28D9]',
  },
  peach: {
    bg: 'bg-[#FFF7ED]',
    iconGradient: 'from-[#FFEDD5] to-[#FDBA74]',
    iconColor: 'text-[#C2410C]',
    trendBg: 'bg-[#FFEDD5]',
    trendColor: 'text-[#C2410C]',
  },
  mint: {
    bg: 'bg-[#F0FDF4]',
    iconGradient: 'from-[#DCFCE7] to-[#86EFAC]',
    iconColor: 'text-[#15803D]',
    trendBg: 'bg-[#DCFCE7]',
    trendColor: 'text-[#15803D]',
  },
}

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  variant = 'purple',
  onClick,
  className = '',
}: StatCardProps) {
  const style = variantStyles[variant] || variantStyles.purple

  return (
    <div
      onClick={onClick}
      className={`rounded-[24px] ${style.bg} p-5 shadow-neu-out border border-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-neu-out-lg ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.iconGradient} ${style.iconColor} shadow-md flex items-center justify-center shrink-0 border border-white/80`}>
            {icon}
          </div>
        )}

        <div className="space-y-0.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">{title}</p>
          <p className="text-2xl font-black text-[#2D3748] tracking-tight">{value}</p>
        </div>
      </div>

      {(description || trend) && (
        <div className="mt-3 pt-2.5 border-t border-black/5 flex items-center justify-between text-xs">
          {description && <span className="text-[#64748B] font-semibold text-[11px]">{description}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${
                trend.isUpward ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {trend.isUpward ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
