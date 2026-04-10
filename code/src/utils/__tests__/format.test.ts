import { describe, it, expect, vi } from 'vitest';
import { cn, formatDate, formatRelativeTime } from '../format';

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    language: 'zh-CN',
    t: (key: string, options?: { count?: number }) => {
      const translations: Record<string, string> = {
        'time.justNow': '刚刚',
        'time.minutesAgo': `${options?.count || 0} 分钟前`,
        'time.hoursAgo': `${options?.count || 0} 小时前`,
        'time.daysAgo': `${options?.count || 0} 天前`,
        'time.weeksAgo': `${options?.count || 0} 周前`,
        'time.monthsAgo': `${options?.count || 0} 个月前`,
        'time.yearsAgo': `${options?.count || 0} 年前`,
        'time.inFuture': '未来',
      };
      return translations[key] || key;
    },
  },
}));

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should merge tailwind classes correctly', () => {
    // tailwind-merge should dedupe conflicting classes
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle undefined and null values', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('should handle object notation', () => {
    expect(cn({ foo: true, bar: false })).toBe('foo');
  });

  it('should handle array notation', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate', () => {
  it('should format Date object to locale string', () => {
    const date = new Date('2024-03-15');
    const result = formatDate(date);
    // format depends on locale, but should contain year/month/day
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/15/);
  });

  it('should format ISO date string', () => {
    const result = formatDate('2024-03-15T10:30:00.000Z');
    expect(result).toMatch(/2024/);
  });

  it('should handle invalid date string gracefully', () => {
    // Invalid date strings create Invalid Date objects
    const result = formatDate('invalid-date');
    expect(result).toBe('Invalid Date');
  });

  it('should handle empty string', () => {
    const result = formatDate('');
    expect(result).toBe('Invalid Date');
  });
});

describe('formatRelativeTime', () => {
  it('should return "刚刚" for recent times', () => {
    const now = Math.floor(Date.now() / 1000);
    const result = formatRelativeTime(now);
    expect(result).toBe('刚刚');
  });

  it('should return minutes ago for times within an hour', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 5 * 60; // 5 minutes ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('5 分钟前');
  });

  it('should return hours ago for times within a day', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 3 * 60 * 60; // 3 hours ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('3 小时前');
  });

  it('should return days ago for older times', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60; // 2 days ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('2 天前');
  });

  it('should return weeks ago for times within a month', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 2 * 7 * 24 * 60 * 60; // 2 weeks ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('2 周前');
  });

  it('should return months ago for times within a year', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60; // ~2 months ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('2 个月前');
  });

  it('should return years ago for very old times', () => {
    const timestamp = Math.floor(Date.now() / 1000) - 400 * 24 * 60 * 60; // ~1 year ago
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('1 年前');
  });

  it('should handle future dates', () => {
    const timestamp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour in future
    const result = formatRelativeTime(timestamp);
    expect(result).toBe('未来');
  });
});
