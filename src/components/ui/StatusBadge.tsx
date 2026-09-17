import { ReactNode } from 'react'

export type StatusType =
  | 'submitted'
  | 'reviewed'
  | 'returned'
  | 'finalized'
  | 'draft'
  | 'active'
  | 'inactive'
  | string

export interface StatusBadgeProps {
  status: StatusType
  label?: string
  icon?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, label, icon, size = 'md', className = '' }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase()

  const styles: Record<string, { bg: string; text: string; border: string; defaultLabel: string }> = {
    submitted: {
      bg: 'bg-[#EFF6FF]',
      text: 'text-[#1D4ED8]',
      border: 'border-[#BFDBFE]',
      defaultLabel: 'Submitted',
    },
    reviewed: {
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#B45309]',
      border: 'border-[#FDE68A]',
      defaultLabel: 'Reviewed',
    },
    returned: {
      bg: 'bg-[#FEF2F2]',
      text: 'text-[#B91C1C]',
      border: 'border-[#FECACA]',
      defaultLabel: 'Returned',
    },
    finalized: {
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#047857]',
      border: 'border-[#A7F3D0]',
      defaultLabel: 'Finalized',
    },
    draft: {
      bg: 'bg-[#F5F3FF]',
      text: 'text-[#6D28D9]',
      border: 'border-[#DDD6FE]',
      defaultLabel: 'Draft',
    },
    active: {
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#047857]',
      border: 'border-[#A7F3D0]',
      defaultLabel: 'Active',
    },
    inactive: {
      bg: 'bg-[#F8FAFC]',
      text: 'text-[#64748B]',
      border: 'border-[#E2E8F0]',
      defaultLabel: 'Inactive',
    },
  }

  const current = styles[norm] || {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#1D4ED8]',
    border: 'border-[#BFDBFE]',
    defaultLabel: status,
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold shadow-xs border ${padding} ${current.bg} ${current.text} ${current.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
      {icon}
      <span>{label || current.defaultLabel}</span>
    </span>
  )
}
