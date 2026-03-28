import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatRelativeTime } from '../format';

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
  it('should format Date object to zh-CN locale string', () => {
    const date = new Date('2024-03-15');
    const result = formatDate(date);
    // zh-CN format: YYYY/MM/DD or YYYY-MM-DD depending on locale
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
    const now = new Date();
    const result = formatRelativeTime(now);
    expect(result).toBe('刚刚');
  });

  it('should return minutes ago for times within an hour', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    const result = formatRelativeTime(date);
    expect(result).toBe('5 分钟前');
  });

  it('should return hours ago for times within a day', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
    const result = formatRelativeTime(date);
    expect(result).toBe('3 小时前');
  });

  it('should return days ago for older times', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const result = formatRelativeTime(date);
    expect(result).toBe('2 天前');
  });

  it('should handle date string input', () => {
    const dateStr = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
    const result = formatRelativeTime(dateStr);
    expect(result).toBe('30 分钟前');
  });

  it('should handle future dates', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future
    const result = formatRelativeTime(futureDate);
    // Future dates have negative diff, so seconds will be negative
    expect(result).toBe('刚刚');
  });
});
