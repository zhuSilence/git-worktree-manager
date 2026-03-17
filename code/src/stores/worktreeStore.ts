import { create } from 'zustand'
import type { Worktree, WorktreeListResponse, CreateWorktreeParams, WorktreeResult, BranchListResponse } from '@/types/worktree'
import { gitService } from '@/services/git'

interface Repository {
  id: string
  name: string
  mainWorktreePath: string
  worktrees: Worktree[]
  branches: { name: string; isCurrent: boolean }[]
  defaultBranch: string
}

interface WorktreeState {
  // 状态
  worktrees: Worktree[]
  currentRepo: Repository | null
  currentRepoPath: string | null
  isLoading: boolean
  error: string | null

  // 操作
  loadRepository: (path: string) => Promise<void>
  refreshWorktrees: () => Promise<void>
  createWorktree: (params: CreateWorktreeParams) => Promise<WorktreeResult>
  deleteWorktree: (worktreePath: string, force?: boolean) => Promise<WorktreeResult>
  clearError: () => void
}

export const useWorktreeStore = create<WorktreeState>((set, get) => ({
  // 初始状态
  worktrees: [],
  currentRepo: null,
  currentRepoPath: null,
  isLoading: false,
  error: null,

  // 加载仓库
  loadRepository: async (path: string) => {
    set({ isLoading: true, error: null })
    
    try {
      // 检查是否是 Git 仓库
      const isRepo = await gitService.isGitRepo(path)
      if (!isRepo) {
        set({ 
          error: '选择的目录不是 Git 仓库', 
          isLoading: false,
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
        mainWorktreePath: path,
        worktrees: response.worktrees,
        branches,
        defaultBranch
      }
      
      set({ 
        currentRepo: repo, 
        currentRepoPath: path,
        worktrees: response.worktrees,
        isLoading: false 
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载仓库失败'
      set({ 
        error: message, 
        isLoading: false,
        currentRepo: null,
        worktrees: []
      })
    }
  },
  
  // 刷新 worktrees
  refreshWorktrees: async () => {
    const { currentRepoPath } = get()
    if (!currentRepoPath) return
    
    set({ isLoading: true })
    
    try {
      const response: WorktreeListResponse = await gitService.listWorktrees(currentRepoPath)
      
      set({ 
        worktrees: response.worktrees, 
        isLoading: false,
        error: null
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '刷新失败'
      set({ 
        error: message, 
        isLoading: false 
      })
    }
  },
  
  // 创建 worktree
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
        await get().refreshWorktrees()
      }
      
      set({ isLoading: false })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建失败'
      set({ error: message, isLoading: false })
      return { success: false, message }
    }
  },
  
  // 删除 worktree
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
        await get().refreshWorktrees()
      }
      
      set({ isLoading: false })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败'
      set({ error: message, isLoading: false })
      return { success: false, message }
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))