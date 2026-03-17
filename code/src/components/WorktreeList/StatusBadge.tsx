import { WorktreeStatus } from '@/types/worktree'
import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: WorktreeStatus
  className?: string
}

const statusConfig = {
  [WorktreeStatus.Clean]: {
    color: 'bg-green-500',
    label: 'Clean',
  },
  [WorktreeStatus.Dirty]: {
    color: 'bg-yellow-500',
    label: 'Dirty',
  },
  [WorktreeStatus.Unpushed]: {
    color: 'bg-blue-500',
    label: 'Unpushed',
  },
  [WorktreeStatus.Conflicted]: {
    color: 'bg-red-500',
    label: 'Conflicted',
  },
  [WorktreeStatus.Detached]: {
    color: 'bg-gray-400',
    label: 'Detached',
  },
  [WorktreeStatus.Unknown]: {
    color: 'bg-gray-500',
    label: 'Unknown',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        className
      )}
      title={config.label}
    >
      <span className={clsx('w-2 h-2 rounded-full', config.color)} />
      <span className="sr-only">{config.label}</span>
    </span>
  )
}