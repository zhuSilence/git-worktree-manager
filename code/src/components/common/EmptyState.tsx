import { type ReactNode, type ComponentType } from 'react'
import { clsx } from 'clsx'

export interface EmptyStateProps {
  /** 图标组件 */
  icon: ComponentType<{ className?: string }>
  /** 主标题 */
  title: string
  /** 副标题/描述 */
  description?: string
  /** 操作按钮 */
  action?: ReactNode
  /** 自定义类名 */
  className?: string
  /** 图标是否显示动画 */
  animateIcon?: boolean
  /** 尺寸变体 */
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: {
    container: 'py-8',
    icon: 'w-8 h-8 mb-2',
    title: 'text-sm',
    description: 'text-xs mt-0.5',
    action: 'mt-2',
  },
  md: {
    container: 'py-12',
    icon: 'w-10 h-10 mb-3',
    title: 'text-base',
    description: 'text-sm mt-1',
    action: 'mt-3',
  },
  lg: {
    container: 'py-16',
    icon: 'w-12 h-12 mb-4',
    title: 'text-lg',
    description: 'text-sm mt-1',
    action: 'mt-4',
  },
}

/**
 * 可复用的空状态组件
 *
 * @example
 * <EmptyState
 *   icon={GitBranch}
 *   title="No worktrees found"
 *   description="Create a worktree to get started"
 *   action={<Button>Create Worktree</Button>}
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  animateIcon = false,
  size = 'lg',
}: EmptyStateProps) {
  const styles = sizeStyles[size]

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400',
        styles.container,
        className
      )}
    >
      <Icon
        className={clsx(
          'opacity-50',
          styles.icon,
          animateIcon && 'animate-pulse'
        )}
      />
      <p className={clsx('font-medium text-gray-600 dark:text-gray-300', styles.title)}>
        {title}
      </p>
      {description && (
        <p className={clsx('text-gray-400 dark:text-gray-500', styles.description)}>
          {description}
        </p>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
