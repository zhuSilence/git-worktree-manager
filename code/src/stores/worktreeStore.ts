import { create } from 'zustand'
import type { Worktree, WorktreeListResponse, CreateWorktreeParams, WorktreeResult, BranchListResponse, Repository } from '@/types/worktree'
import { gitService } from '@/services/git'

interface WorktreeState {
  // 状态
  worktrees: Worktree[]
  currentRepo: Repository | null
  currentRepoPath: string | null
  isLoading: boolean
  error: string | null
  // 事务状态：跟踪正在进行的操作
  pendingOperations: string[]

  // 操作
  loadRepository: (path: string) => Promise<void>
  refreshWorktrees: () => Promise<void>
  createWorktree: (params: CreateWorktreeParams) => Promise<WorktreeResult>
  deleteWorktree: (worktreePath: string, force?: boolean) => Promise<WorktreeResult>
  clearError: () => void
}

/**
 * 事务式状态更新辅助函数
 * 确保多个状态字段一起更新，避免中间状态
 */
const createTransaction = <T extends Partial<WorktreeState>>(
  set: (partial: T | ((state: WorktreeState) => T)) => void
) => {
  return {
    // 开始操作：设置 loading 并清除错误
    start: (operationId: string) => {
      set((state) => ({
        isLoading: true,
        error: null,
        pendingOperations: [...state.pendingOperations, operationId],
      }) as T)
    },
    // 成功完成：更新状态并清除 loading
    success: (operationId: string, updates: Partial<WorktreeState>) => {
      set((state) => ({
        ...updates,
        isLoading: state.pendingOperations.filter(id => id !== operationId).length > 0,
        error: null,
        pendingOperations: state.pendingOperations.filter(id => id !== operationId),
      }) as T)
    },
    // 失败：设置错误并清除 loading
    error: (operationId: string, error: string, rollbackState?: Partial<WorktreeState>) => {
      set((state) => ({
        ...rollbackState,
        error,
        isLoading: state.pendingOperations.filter(id => id !== operationId).length > 0,
        pendingOperations: state.pendingOperations.filter(id => id !== operationId),
      }) as T)
    },
  }
}

let operationCounter = 0
const generateOperationId = () => `op_${++operationCounter}_${Date.now()}`

export const useWorktreeStore = create<WorktreeState>((set, get) => {
  const tx = createTransaction(set)

  return {
    // 初始状态
    worktrees: [],
    currentRepo: null,
    currentRepoPath: null,
    isLoading: false,
    error: null,
    pendingOperations: [],

    // 加载仓库
    loadRepository: async (path: string) => {
      const opId = generateOperationId()
      tx.start(opId)

      try {
        // 检查是否是 Git 仓库
        const isRepo = await gitService.isGitRepo(path)
        if (!isRepo) {
          tx.error(opId, '选择的目录不是 Git 仓库', {
            currentRepo: null,
            worktrees: []
          })
          return
        }

        // 获取 worktrees
        const response: WorktreeListResponse = await gitService.listWorktrees(path)

        // 获取分支列表
        let branches: { name: string; isCurrent: boolean }[] = []
        try {
          const branchResponse: BranchListResponse = await gitService.listBranches(path)
          branches = branchResponse.branches.map(b => ({
            name: b.name,
            isCurrent: b.isCurrent
          }))
        } catch {
          // 分支列表获取失败不影响主流程
        }

        // 推断默认分支名
        const defaultBranch = branches.find(b => b.name === 'main')?.name
          || branches.find(b => b.name === 'master')?.name
          || 'main'

        const repo: Repository = {
          id: path,
          name: path.split('/').pop() || path,
          path: path,
          currentBranch: branches.find(b => b.isCurrent)?.name || defaultBranch,
          worktreeCount: response.worktrees.length,
          lastActive: null,
          mainWorktreePath: path,
          worktrees: response.worktrees,
          branches,
          defaultBranch
        }

        tx.success(opId, {
          currentRepo: repo,
          currentRepoPath: path,
          worktrees: response.worktrees,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : '加载仓库失败'
        tx.error(opId, message, {
          currentRepo: null,
          worktrees: []
        })
      }
    },

    // 刷新 worktrees
    refreshWorktrees: async () => {
      const { currentRepoPath } = get()
      if (!currentRepoPath) return

      const opId = generateOperationId()
      tx.start(opId)

      try {
        const response: WorktreeListResponse = await gitService.listWorktrees(currentRepoPath)
        tx.success(opId, { worktrees: response.worktrees })
      } catch (error) {
        const message = error instanceof Error ? error.message : '刷新失败'
        tx.error(opId, message)
      }
    },

    // 创建 worktree
    createWorktree: async (params: CreateWorktreeParams) => {
      const { currentRepoPath } = get()
      if (!currentRepoPath) {
        return { success: false, message: '未选择仓库' }
      }

      const opId = generateOperationId()
      tx.start(opId)

      try {
        const result = await gitService.createWorktree(currentRepoPath, params)

        if (result.success) {
          // 刷新列表
          const response: WorktreeListResponse = await gitService.listWorktrees(currentRepoPath)
          tx.success(opId, { worktrees: response.worktrees })
        } else {
          tx.error(opId, result.message || '创建失败')
        }

        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : '创建失败'
        tx.error(opId, message)
        return { success: false, message }
      }
    },

    // 删除 worktree
    deleteWorktree: async (worktreePath: string, force = false) => {
      const { currentRepoPath, worktrees } = get()
      if (!currentRepoPath) {
        return { success: false, message: '未选择仓库' }
      }

      const opId = generateOperationId()
      // 保存当前状态用于回滚
      const previousWorktrees = worktrees

      // 乐观更新：立即从 UI 中移除
      set((state) => ({
        worktrees: state.worktrees.filter(w => w.path !== worktreePath),
        isLoading: true,
        pendingOperations: [...state.pendingOperations, opId],
      }))

      try {
        const result = await gitService.deleteWorktree(currentRepoPath, worktreePath, force)

        if (result.success) {
          // 确认删除成功，刷新列表以确保同步
          const response: WorktreeListResponse = await gitService.listWorktrees(currentRepoPath)
          tx.success(opId, { worktrees: response.worktrees })
        } else {
          // 删除失败，回滚状态
          tx.error(opId, result.message || '删除失败', {
            worktrees: previousWorktrees
          })
        }

        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : '删除失败'
        // 回滚状态
        tx.error(opId, message, { worktrees: previousWorktrees })
        return { success: false, message }
      }
    },

    clearError: () => {
      set({ error: null })
    }
  }
})