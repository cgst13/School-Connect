import { ReactNode } from 'react'
import { TrendingUp } from 'lucide-react'

interface StatCardProps {
  title: string
  value: number | string
  icon?: ReactNode
  color?: 'blue' | 'gold' | 'green' | 'red' | 'gray'
  subtitle?: string
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50 text-blue-600 border border-blue-100',
    accent: 'bg-blue-500',
    value: 'text-slate-900',
  },
  gold: {
    bg: 'bg-amber-50 text-amber-600 border border-amber-100',
    accent: 'bg-amber-500',
    value: 'text-slate-900',
  },
  green: {
    bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    accent: 'bg-emerald-500',
    value: 'text-slate-900',
  },
  red: {
    bg: 'bg-red-50 text-red-600 border border-red-100',
    accent: 'bg-red-500',
    value: 'text-slate-900',
  },
  gray: {
    bg: 'bg-slate-100 text-slate-600 border border-slate-200/60',
    accent: 'bg-slate-400',
    value: 'text-slate-900',
  },
}

export function StatCard({ title, value, icon, color = 'blue', subtitle }: StatCardProps) {
  const colors = colorMap[color]
  return (
    <div className="card p-4 sm:p-5 card-hover relative overflow-hidden group">
      {/* Accent left line */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${colors.accent} opacity-80 group-hover:w-1.5 transition-all`} />
      
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pl-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-1.5 tracking-tight ${colors.value}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0 ml-3 shadow-xs group-hover:scale-105 transition-transform`}>
          {icon || <TrendingUp size={20} />}
        </div>
      </div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="skeleton h-3 w-20 mb-3" />
          <div className="skeleton h-7 w-16" />
        </div>
        <div className="skeleton w-10 h-10 rounded-xl" />
      </div>
    </div>
  )
}
