import { invoke } from '@tauri-apps/api/core'
import type {
  Worktree,
  WorktreeListResponse,
  CreateWorktreeParams,
  WorktreeResult,
  BranchListResponse,
  DiffResponse,
} from '@/types/worktree'
import type { IdeType, TerminalType } from '@/stores/settingsStore'

/**
 * Git 服务 - 封装 Tauri 命令调用
 */
export const gitService = {
  /**
   * 获取 Worktree 列表
   */
  async listWorktrees(repoPath: string): Promise<WorktreeListResponse> {
    return invoke<WorktreeListResponse>('list_worktrees', { repoPath })
  },

  /**
   * 创建 Worktree
   */
  async createWorktree(
    repoPath: string,
    params: CreateWorktreeParams
  ): Promise<WorktreeResult> {
    return invoke<WorktreeResult>('create_worktree', {
      repoPath,
      name: params.name,
      baseBranch: params.baseBranch,
      newBranch: params.newBranch,
      customPath: params.customPath,
    })
  },

  /**
   * 删除 Worktree
   */
  async deleteWorktree(
    repoPath: string,
    worktreePath: string,
    force: boolean = false
  ): Promise<WorktreeResult> {
    return invoke<WorktreeResult>('delete_worktree', {
      repoPath,
      worktreePath,
      force,
    })
  },

  /**
   * 清理已删除的 Worktree 引用
   */
  async pruneWorktrees(repoPath: string): Promise<void> {
    return invoke('prune_worktrees', { repoPath })
  },

  /**
   * 获取分支列表
   */
  async listBranches(repoPath: string): Promise<BranchListResponse> {
    return invoke<BranchListResponse>('list_branches', { repoPath })
  },

  /**
   * 检查是否为有效的 Git 仓库
   */
  async isGitRepo(path: string): Promise<boolean> {
    return invoke<boolean>('is_git_repo', { path })
  },

  /**
   * 打开 Worktree 目录
   */
  async openWorktree(worktree: Worktree): Promise<void> {
    return invoke('open_worktree', { worktreePath: worktree.path })
  },

  /**
   * 获取 Worktree 状态
   */
  async getWorktreeStatus(repoPath: string, worktreePath: string): Promise<string> {
    return invoke<string>('get_worktree_status', { repoPath, worktreePath })
  },

  /**
   * 切换到 Worktree 目录（在终端中）
   */
  async openInTerminal(worktreePath: string, terminal?: TerminalType): Promise<void> {
    return invoke('open_in_terminal', { worktreePath, terminal })
  },

  /**
   * 在编辑器中打开 Worktree
   */
  async openInEditor(worktreePath: string, editor?: IdeType): Promise<void> {
    return invoke('open_in_editor', { worktreePath, editor })
  },

  /**
   * 获取 worktree 与目标分支的 diff
   */
  async getDiff(worktreePath: string, targetBranch: string): Promise<DiffResponse> {
    return invoke<DiffResponse>('get_diff', { worktreePath, targetBranch })
  },
}