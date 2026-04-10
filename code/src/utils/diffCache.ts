import type { DetailedDiffResponse } from '../types/worktree'

interface CacheEntry {
  data: DetailedDiffResponse
  timestamp: number
  key: string
}

const MAX_CACHE_ENTRIES = 10
const CACHE_TTL_MS = 30 * 1000 // 30秒缓存有效期

class DiffCache {
  private cache = new Map<string, CacheEntry>()

  private buildKey(worktreePath: string, targetBranch: string, whitespaceMode: string): string {
    return `${worktreePath}::${targetBranch}::${whitespaceMode}`
  }

  get(worktreePath: string, targetBranch: string, whitespaceMode: string): DetailedDiffResponse | null {
    const key = this.buildKey(worktreePath, targetBranch, whitespaceMode)
    const entry = this.cache.get(key)

    if (!entry) return null

    // 检查是否过期
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  set(worktreePath: string, targetBranch: string, whitespaceMode: string, data: DetailedDiffResponse): void {
    const key = this.buildKey(worktreePath, targetBranch, whitespaceMode)

    // 缓存大小限制
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // 删除最早的条目
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key
    })
  }

  // 手动刷新时清除特定缓存
  invalidate(worktreePath: string, targetBranch: string, whitespaceMode: string): void {
    const key = this.buildKey(worktreePath, targetBranch, whitespaceMode)
    this.cache.delete(key)
  }

  // 清除所有缓存
  clear(): void {
    this.cache.clear()
  }
}

export const diffCache = new DiffCache()
