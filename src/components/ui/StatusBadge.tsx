import type { SubmissionStatus } from '@/types'

const config: Record<SubmissionStatus, { label: string; className: string; dot: string; pulse?: boolean }> = {
  submitted: {
    label: 'Submitted',
    className: 'badge-submitted',
    dot: 'bg-blue-600',
    pulse: true,
  },
  reviewed: {
    label: 'Reviewed',
    className: 'badge-reviewed',
    dot: 'bg-amber-600',
  },
  returned: {
    label: 'Returned',
    className: 'badge-returned',
    dot: 'bg-red-600',
  },
  finalized: {
    label: 'Finalized',
    className: 'badge-finalized',
    dot: 'bg-emerald-600',
  },
}

interface StatusBadgeProps {
  status: SubmissionStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = config[status]
  return (
    <span className={`${cfg.className} ${size === 'sm' ? 'text-[11px] px-2 py-0.5' : ''}`} aria-label={`Status: ${cfg.label}`}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {cfg.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dot}`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  )
}
