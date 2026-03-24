/**
 * 空闲检测工具函数
 */

/**
 * 解析日期字符串或返回 null
 */
export function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

/**
 * 计算距离现在的天数
 */
export function daysSince(date: Date): number {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * 格式化空闲时间为可读字符串
 */
export function formatIdleTime(days: number): string {
  if (days < 1) return '今天活跃'
  if (days === 1) return '1 天未活跃'
  if (days < 7) return `${days} 天未活跃`
  if (days < 30) return `${Math.floor(days / 7)} 周未活跃`
  return `${Math.floor(days / 30)} 个月未活跃`
}

/**
 * 获取空闲级别
 */
export function getIdleLevel(days: number, threshold: number): 'active' | 'warning' | 'critical' {
  if (days < threshold * 0.5) return 'active'
  if (days < threshold) return 'warning'
  return 'critical'
}

/**
 * 检查 worktree 是否空闲
 */
export function checkIdleStatus(
  lastActiveAt: string | null,
  thresholdDays: number
): {
  isIdle: boolean
  idleDays: number
  level: 'active' | 'warning' | 'critical'
  message: string
} | null {
  const date = parseDate(lastActiveAt)
  if (!date) return null

  const days = daysSince(date)
  const level = getIdleLevel(days, thresholdDays)
  const message = formatIdleTime(days)

  return {
    isIdle: days >= thresholdDays,
    idleDays: days,
    level,
    message,
  }
}