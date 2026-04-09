import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import i18n from '@/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN'
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 格式化相对时间（支持多语言）
 * @param timestamp Unix 时间戳（秒）
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 0) {
    return i18n.t('time.inFuture')
  }
  if (diff < 60) {
    return i18n.t('time.justNow')
  }

  const minutes = Math.floor(diff / 60)
  if (minutes < 60) {
    return i18n.t('time.minutesAgo', { count: minutes })
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return i18n.t('time.hoursAgo', { count: hours })
  }

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return i18n.t('time.daysAgo', { count: days })
  }

  const weeks = Math.floor(days / 7)
  if (weeks < 4) {
    return i18n.t('time.weeksAgo', { count: weeks })
  }

  const months = Math.floor(days / 30)
  if (months < 12) {
    return i18n.t('time.monthsAgo', { count: months })
  }

  const years = Math.floor(days / 365)
  return i18n.t('time.yearsAgo', { count: years })
}