import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Worktree, WorktreeListResponse, CreateWorktreeParams, WorktreeResult } from '@/types/worktree'
import { gitService } from '@/services/git'

interface WorktreeState {
  // 状态
  worktrees: Worktree[]
  currentRepoPath: string | null
  isValidRepo: boolean
  isLoading: boolean
  error: string | null
  selectedWorktree: Worktree | null

  // 操作
  fetchWorktrees: (repoPath: string) => Promise<void>
  createWorktree: (params: CreateWorktreeParams) => Promise<WorktreeResult>
  deleteWorktree: (worktreePath: string, force?: boolean) => Promise<WorktreeResult>
  pruneWorktrees: () => Promise<void>
  selectWorktree: (worktree: Worktree | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = {
  worktrees: [],
  currentRepoPath: null,
  isValidRepo: false,
  isLoading: false,
  error: null,
  selectedWorktree: null,
}

export const useWorktreeStore = create<WorktreeState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchWorktrees: async (repoPath: string) => {
        set({ isLoading: true, error: null })

        try {
          const response: WorktreeListResponse = await gitService.listWorktrees(repoPath)

          set({
            worktrees: response.worktrees,
            currentRepoPath: response.repoPath,
            isValidRepo: response.isValidRepo,
            isLoading: false,
          })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '获取 Worktree 列表失败',
            isLoading: false,
            isValidRepo: false,
          })
        }
      },

      createWorktree: async (params: CreateWorktreeParams) => {
        const { currentRepoPath } = get()
        if (!currentRepoPath) {
          return { success: false, message: '未选择仓库' }
        }

        set({ isLoading: true, error: null })

        try {
          const result = await gitService.createWorktree(currentRepoPath, params)

          if (result.success) {
            // 刷新列表
            await get().fetchWorktrees(currentRepoPath)
          }

          set({ isLoading: false })
          return result
        } catch (error) {
          const message = error instanceof Error ? error.message : '创建 Worktree 失败'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      deleteWorktree: async (worktreePath: string, force = false) => {
        const { currentRepoPath } = get()
        if (!currentRepoPath) {
          return { success: false, message: '未选择仓库' }
        }

        set({ isLoading: true, error: null })

        try {
          const result = await gitService.deleteWorktree(currentRepoPath, worktreePath, force)

          if (result.success) {
            // 刷新列表
            await get().fetchWorktrees(currentRepoPath)
          }

          set({ isLoading: false })
          return result
        } catch (error) {
          const message = error instanceof Error ? error.message : '删除 Worktree 失败'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      pruneWorktrees: async () => {
        const { currentRepoPath } = get()
        if (!currentRepoPath) return

        set({ isLoading: true, error: null })

        try {
          await gitService.pruneWorktrees(currentRepoPath)
          await get().fetchWorktrees(currentRepoPath)
          set({ isLoading: false })
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '清理 Worktree 失败',
            isLoading: false,
          })
        }
      },

      selectWorktree: (worktree) => {
        set({ selectedWorktree: worktree })
      },

      clearError: () => {
        set({ error: null })
      },

      reset: () => {
        set(initialState)
      },
    }),
    { name: 'worktree-store' }
  )
)