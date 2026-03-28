import { invoke } from '@tauri-apps/api/core'
import type {
  Worktree,
  WorktreeListResponse,
  CreateWorktreeParams,
  WorktreeResult,
  BranchListResponse,
  DiffResponse,
  DetailedDiffResponse,
  RepositoryInfo,
  SwitchBranchResult,
  BatchDeleteResult,
  WorktreeHint,
  TimelineResponse,
  FetchResult,
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

  /**
   * 获取详细的 diff 内容（包含代码行）
   */
  async getDetailedDiff(worktreePath: string, targetBranch: string): Promise<DetailedDiffResponse> {
    return invoke<DetailedDiffResponse>('get_detailed_diff', { worktreePath, targetBranch })
  },

  /**
   * 获取仓库基本信息
   */
  async getRepositoryInfo(repoPath: string): Promise<RepositoryInfo> {
    return invoke<RepositoryInfo>('get_repository_info', { repoPath })
  },

  /**
   * 切换分支
   */
  async switchBranch(worktreePath: string, branchName: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('switch_branch', { worktreePath, branchName })
  },

  /**
   * 创建并切换到新分支
   */
  async createBranch(worktreePath: string, branchName: string, baseBranch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('create_branch', { worktreePath, branchName, baseBranch })
  },

  /**
   * 拉取远程分支
   */
  async fetchRemoteBranch(repoPath: string, remoteBranch: string, localBranch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('fetch_remote_branch', { repoPath, remoteBranch, localBranch })
  },

  /**
   * 批量删除 worktree
   */
  async batchDeleteWorktrees(repoPath: string, worktreePaths: string[], force: boolean): Promise<BatchDeleteResult> {
    return invoke<BatchDeleteResult>('batch_delete_worktrees', { repoPath, worktreePaths, force })
  },

  /**
   * 获取已合并提示
   */
  async getMergedHints(repoPath: string, mainBranch: string): Promise<WorktreeHint[]> {
    return invoke<WorktreeHint[]>('get_merged_hints', { repoPath, mainBranch })
  },

  /**
   * 获取陈旧提示
   */
  async getStaleHints(repoPath: string, days: number): Promise<WorktreeHint[]> {
    return invoke<WorktreeHint[]>('get_stale_hints', { repoPath, days })
  },

  /**
   * 获取时间线数据
   */
  async getTimeline(repoPath: string, since?: number, until?: number): Promise<TimelineResponse> {
    return invoke<TimelineResponse>('get_timeline', { repoPath, since, until })
  },

  /**
   * Push 本地提交到远程
   */
  async push(worktreePath: string, branch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('push', { worktreePath, branch })
  },

  /**
   * Pull 远程提交到本地
   */
  async pull(worktreePath: string, branch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('pull', { worktreePath, branch })
  },

  /**
   * Fetch 所有远程仓库
   */
  async fetchAllRemotes(repoPath: string): Promise<FetchResult> {
    return invoke<FetchResult>('fetch_all_remotes', { repoPath })
  },
}