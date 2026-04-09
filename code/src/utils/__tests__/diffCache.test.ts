import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { diffCache } from '../diffCache'
import type { DetailedDiffResponse } from '@/types/worktree'

// 辅助函数：创建模拟的 DetailedDiffResponse
function createMockDiffResponse(overrides: Partial<DetailedDiffResponse> = {}): DetailedDiffResponse {
  return {
    sourceBranch: 'main',
    targetBranch: 'develop',
    files: [],
    totalAdditions: 0,
    totalDeletions: 0,
    ...overrides,
  }
}

describe('DiffCache', () => {
  beforeEach(() => {
    // 每个测试前清除缓存
    diffCache.clear()
    // 使用假定时器
    vi.useFakeTimers()
  })

  afterEach(() => {
    // 恢复真实定时器
    vi.useRealTimers()
  })

  it('应缓存和读取数据', () => {
    const data = createMockDiffResponse({ totalAdditions: 10 })

    diffCache.set('/path/to/worktree', 'main', 'default', data)
    const result = diffCache.get('/path/to/worktree', 'main', 'default')

    expect(result).not.toBeNull()
    expect(result?.totalAdditions).toBe(10)
    expect(result?.sourceBranch).toBe('main')
  })

  it('不同 key 应独立缓存', () => {
    const data1 = createMockDiffResponse({ totalAdditions: 10 })
    const data2 = createMockDiffResponse({ totalAdditions: 20 })
    const data3 = createMockDiffResponse({ totalAdditions: 30 })

    diffCache.set('/path/worktree1', 'main', 'default', data1)
    diffCache.set('/path/worktree2', 'main', 'default', data2)
    diffCache.set('/path/worktree1', 'develop', 'default', data3)

    expect(diffCache.get('/path/worktree1', 'main', 'default')?.totalAdditions).toBe(10)
    expect(diffCache.get('/path/worktree2', 'main', 'default')?.totalAdditions).toBe(20)
    expect(diffCache.get('/path/worktree1', 'develop', 'default')?.totalAdditions).toBe(30)
  })

  it('超过 TTL 应返回 null', () => {
    const data = createMockDiffResponse()

    diffCache.set('/path/to/worktree', 'main', 'default', data)

    // 立即获取应该有值
    expect(diffCache.get('/path/to/worktree', 'main', 'default')).not.toBeNull()

    // 前进 31 秒（超过 30 秒 TTL）
    vi.advanceTimersByTime(31 * 1000)

    // 过期后应该返回 null
    expect(diffCache.get('/path/to/worktree', 'main', 'default')).toBeNull()
  })

  it('invalidate 应清除特定缓存', () => {
    const data1 = createMockDiffResponse({ totalAdditions: 10 })
    const data2 = createMockDiffResponse({ totalAdditions: 20 })

    diffCache.set('/path/worktree1', 'main', 'default', data1)
    diffCache.set('/path/worktree2', 'main', 'default', data2)

    // 清除第一个缓存
    diffCache.invalidate('/path/worktree1', 'main', 'default')

    expect(diffCache.get('/path/worktree1', 'main', 'default')).toBeNull()
    expect(diffCache.get('/path/worktree2', 'main', 'default')?.totalAdditions).toBe(20)
  })

  it('clear 应清除所有缓存', () => {
    const data = createMockDiffResponse()

    diffCache.set('/path/worktree1', 'main', 'default', data)
    diffCache.set('/path/worktree2', 'main', 'default', data)
    diffCache.set('/path/worktree3', 'main', 'default', data)

    diffCache.clear()

    expect(diffCache.get('/path/worktree1', 'main', 'default')).toBeNull()
    expect(diffCache.get('/path/worktree2', 'main', 'default')).toBeNull()
    expect(diffCache.get('/path/worktree3', 'main', 'default')).toBeNull()
  })

  it('超过 MAX_CACHE_ENTRIES 应淘汰最早条目', () => {
    // MAX_CACHE_ENTRIES = 10
    // 添加 11 个条目
    for (let i = 0; i < 11; i++) {
      const data = createMockDiffResponse({ totalAdditions: i })
      diffCache.set(`/path/worktree${i}`, 'main', 'default', data)
    }

    // 第一个条目应该被淘汰
    expect(diffCache.get('/path/worktree0', 'main', 'default')).toBeNull()

    // 最后一个条目应该存在
    expect(diffCache.get('/path/worktree10', 'main', 'default')?.totalAdditions).toBe(10)
  })

  it('不同的 whitespaceMode 应独立缓存', () => {
    const data1 = createMockDiffResponse({ totalAdditions: 10 })
    const data2 = createMockDiffResponse({ totalAdditions: 20 })

    diffCache.set('/path/worktree', 'main', 'default', data1)
    diffCache.set('/path/worktree', 'main', 'ignore-all', data2)

    expect(diffCache.get('/path/worktree', 'main', 'default')?.totalAdditions).toBe(10)
    expect(diffCache.get('/path/worktree', 'main', 'ignore-all')?.totalAdditions).toBe(20)
  })

  it('不存在的 key 应返回 null', () => {
    expect(diffCache.get('/nonexistent', 'main', 'default')).toBeNull()
  })

  it('invalidate 不存在的 key 不应报错', () => {
    // 应该不抛出异常
    expect(() => diffCache.invalidate('/nonexistent', 'main', 'default')).not.toThrow()
  })

  it('缓存命中后不应过期', () => {
    const data = createMockDiffResponse()

    diffCache.set('/path/worktree', 'main', 'default', data)

    // 在 TTL 内多次获取
    vi.advanceTimersByTime(10 * 1000) // 10秒
    expect(diffCache.get('/path/worktree', 'main', 'default')).not.toBeNull()

    vi.advanceTimersByTime(15 * 1000) // 再过15秒，总共25秒
    expect(diffCache.get('/path/worktree', 'main', 'default')).not.toBeNull()

    // 再过6秒，超过30秒
    vi.advanceTimersByTime(6 * 1000)
    expect(diffCache.get('/path/worktree', 'main', 'default')).toBeNull()
  })

  it('set 应覆盖已存在的缓存', () => {
    const data1 = createMockDiffResponse({ totalAdditions: 10 })
    const data2 = createMockDiffResponse({ totalAdditions: 20 })

    diffCache.set('/path/worktree', 'main', 'default', data1)
    expect(diffCache.get('/path/worktree', 'main', 'default')?.totalAdditions).toBe(10)

    // 覆盖
    diffCache.set('/path/worktree', 'main', 'default', data2)
    expect(diffCache.get('/path/worktree', 'main', 'default')?.totalAdditions).toBe(20)
  })
})
