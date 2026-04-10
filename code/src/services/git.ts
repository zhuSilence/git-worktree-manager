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
  RemoteBranchListResponse,
  FetchResult,
  HotfixInfo,
  StartHotfixResult,
  FinishHotfixResult,
  MergeParams,
  MergeResult,
  MergeConflictCheckResult,
  WorktreeConflictDetectionResponse,
  ThreeWayDiff,
} from '@/types/worktree'
import type {
  OperationLogListResponse,
  OperationLogFilter,
  BackupListResponse,
  BackupInfo,
  RestoreBackupResult,
  DeleteProtectionCheck,
} from '@/types/log'
import type { IdeType, TerminalType } from '@/stores/settingsStore'

/**
 * Git 服务 - 封装 Tauri 命令调用
 */
export const gitService = {
  /**
   * 获取 Worktree 列表
   */
  async listWorktrees(repoPath: string): Promise<WorktreeListResponse> {
    return invoke<WorktreeListResponse>('list_worktrees_cmd', { repoPath })
  },

  /**
   * 创建 Worktree
   */
  async createWorktree(
    repoPath: string,
    params: CreateWorktreeParams
  ): Promise<WorktreeResult> {
    return invoke<WorktreeResult>('create_worktree_cmd', {
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
    return invoke<WorktreeResult>('delete_worktree_cmd', {
      repoPath,
      worktreePath,
      force,
    })
  },

  /**
   * 清理已删除的 Worktree 引用
   */
  async pruneWorktrees(repoPath: string): Promise<void> {
    return invoke('prune_worktrees_cmd', { repoPath })
  },

  /**
   * 获取分支列表
   */
  async listBranches(repoPath: string): Promise<BranchListResponse> {
    return invoke<BranchListResponse>('list_branches_cmd', { repoPath })
  },

  /**
   * 检查是否为有效的 Git 仓库
   */
  async isGitRepo(path: string): Promise<boolean> {
    return invoke<boolean>('is_git_repo_cmd', { path })
  },

  /**
   * 打开 Worktree 目录
   */
  async openWorktree(worktree: Worktree): Promise<void> {
    return invoke('open_worktree_cmd', { worktreePath: worktree.path })
  },

  /**
   * 切换到 Worktree 目录（在终端中）
   */
  async openInTerminal(worktreePath: string, terminal?: TerminalType, customPath?: string): Promise<void> {
    return invoke('open_in_terminal_cmd', { worktreePath, terminal, customPath })
  },

  /**
   * 在编辑器中打开 Worktree
   */
  async openInEditor(worktreePath: string, editor?: IdeType, customPath?: string): Promise<void> {
    return invoke('open_in_editor_cmd', { worktreePath, editor, customPath })
  },

  /**
   * 获取 worktree 与目标分支的 diff
   */
  async getDiff(worktreePath: string, targetBranch: string, ignoreWhitespace?: string): Promise<DiffResponse> {
    return invoke<DiffResponse>('get_diff_cmd', { worktreePath, targetBranch, ignoreWhitespace })
  },

  /**
   * 获取详细的 diff 内容（包含代码行）
   */
  async getDetailedDiff(worktreePath: string, targetBranch: string, ignoreWhitespace?: string): Promise<DetailedDiffResponse> {
    return invoke<DetailedDiffResponse>('get_detailed_diff_cmd', { worktreePath, targetBranch, ignoreWhitespace })
  },

  /**
   * 获取仓库基本信息
   */
  async getRepositoryInfo(repoPath: string): Promise<RepositoryInfo> {
    return invoke<RepositoryInfo>('get_repository_info_cmd', { repoPath })
  },

  /**
   * 切换分支
   */
  async switchBranch(worktreePath: string, branchName: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('switch_branch_cmd', { worktreePath, branchName })
  },

  /**
   * 创建并切换到新分支
   */
  async createBranch(worktreePath: string, branchName: string, baseBranch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('create_branch_cmd', { worktreePath, branchName, baseBranch })
  },

  /**
   * 拉取远程分支
   */
  async fetchRemoteBranch(repoPath: string, remoteBranch: string, localBranch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('fetch_remote_branch_cmd', { repoPath, remoteBranch, localBranch })
  },

  /**
   * 批量删除 worktree
   */
  async batchDeleteWorktrees(repoPath: string, worktreePaths: string[], force: boolean): Promise<BatchDeleteResult> {
    return invoke<BatchDeleteResult>('batch_delete_worktrees_cmd', { repoPath, worktreePaths, force })
  },

  /**
   * 获取已合并提示
   */
  async getMergedHints(repoPath: string, mainBranch: string): Promise<WorktreeHint[]> {
    return invoke<WorktreeHint[]>('get_merged_hints_cmd', { repoPath, mainBranch })
  },

  /**
   * 获取陈旧提示
   */
  async getStaleHints(repoPath: string, days: number): Promise<WorktreeHint[]> {
    return invoke<WorktreeHint[]>('get_stale_hints_cmd', { repoPath, days })
  },

  /**
   * 获取时间线数据
   */
  async getTimeline(repoPath: string, since?: number, until?: number): Promise<TimelineResponse> {
    return invoke<TimelineResponse>('get_timeline_cmd', { repoPath, since, until })
  },

  /**
   * Push 本地提交到远程
   */
  async push(worktreePath: string, branch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('push_cmd', { worktreePath, branch })
  },

  /**
   * Pull 远程提交到本地
   */
  async pull(worktreePath: string, branch?: string): Promise<SwitchBranchResult> {
    return invoke<SwitchBranchResult>('pull_cmd', { worktreePath, branch })
  },

  async fetchAll(repoPath: string): Promise<FetchResult> {
    return invoke<FetchResult>('fetch_all_cmd', { repoPath })
  },

  async listRemoteBranches(repoPath: string): Promise<RemoteBranchListResponse> {
    return invoke<RemoteBranchListResponse>('list_remote_branches_cmd', { repoPath })
  },

  // ============ Hotfix 相关 ============

  /**
   * 开始 Hotfix 流程
   */
  async startHotfix(
    repoPath: string,
    description: string,
    baseBranch?: string,
    branchName?: string
  ): Promise<StartHotfixResult> {
    return invoke<StartHotfixResult>('start_hotfix_cmd', {
      repoPath,
      description,
      baseBranch,
      branchName,
    })
  },

  /**
   * 完成 Hotfix 流程
   */
  async finishHotfix(repoPath: string, push: boolean = false): Promise<FinishHotfixResult> {
    return invoke<FinishHotfixResult>('finish_hotfix_cmd', { repoPath, push })
  },

  /**
   * 取消 Hotfix 流程
   */
  async abortHotfix(repoPath: string): Promise<FinishHotfixResult> {
    return invoke<FinishHotfixResult>('abort_hotfix_cmd', { repoPath })
  },

  /**
   * 获取 Hotfix 状态
   */
  async getHotfixStatus(repoPath: string): Promise<HotfixInfo | null> {
    return invoke<HotfixInfo | null>('get_hotfix_status_cmd', { repoPath })
  },

  // ============ 合并相关 ============

  /**
   * 在目标 worktree 中合并源分支
   */
  async mergeBranch(params: MergeParams): Promise<MergeResult> {
    return invoke<MergeResult>('merge_branch_cmd', { params })
  },

  /**
   * 中止合并
   */
  async abortMerge(worktreePath: string): Promise<boolean> {
    return invoke<boolean>('abort_merge_cmd', { worktreePath })
  },

  /**
   * 完成合并（冲突解决后）
   */
  async completeMerge(worktreePath: string, message?: string): Promise<MergeResult> {
    return invoke<MergeResult>('complete_merge_cmd', { worktreePath, message })
  },

  /**
   * 预检测合并冲突（不实际执行合并）
   */
  async checkMergeConflicts(
    worktreePath: string,
    mainRepoPath: string,
    sourceBranch: string
  ): Promise<MergeConflictCheckResult> {
    return invoke<MergeConflictCheckResult>('check_merge_conflicts_cmd', {
      worktreePath,
      mainRepoPath,
      sourceBranch,
    })
  },

  /**
   * 合并后弹出暂存的变更
   */
  async popStashAfterMerge(worktreePath: string, stashRef: string): Promise<boolean> {
    return invoke<boolean>('pop_stash_after_merge_cmd', { worktreePath, stashRef })
  },

  // ============ 操作日志相关 ============

  /**
   * 获取操作日志列表
   */
  async listOperationLogs(filter?: OperationLogFilter): Promise<OperationLogListResponse> {
    return invoke<OperationLogListResponse>('list_operation_logs_cmd', { filter })
  },

  /**
   * 导出操作日志
   */
  async exportOperationLogs(outputPath: string): Promise<string> {
    return invoke<string>('export_operation_logs_cmd', { outputPath })
  },

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(): Promise<number> {
    return invoke<number>('cleanup_old_logs_cmd')
  },

  // ============ 删除保护相关 ============

  /**
   * 检查删除保护
   */
  async checkDeleteProtection(worktreePath: string, branch: string): Promise<DeleteProtectionCheck> {
    return invoke<DeleteProtectionCheck>('check_delete_protection_cmd', { worktreePath, branch })
  },

  /**
   * 创建备份
   */
  async createBackup(worktreePath: string, branch: string): Promise<BackupInfo> {
    return invoke<BackupInfo>('create_backup_cmd', { request: { worktreePath, branch } })
  },

  /**
   * 获取备份列表
   */
  async listBackups(): Promise<BackupListResponse> {
    return invoke<BackupListResponse>('list_backups_cmd')
  },

  /**
   * 恢复备份
   */
  async restoreBackup(backupId: string, targetPath?: string): Promise<RestoreBackupResult> {
    return invoke<RestoreBackupResult>('restore_backup_cmd', { backupId, targetPath })
  },

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    return invoke<boolean>('delete_backup_cmd', { backupId })
  },

  /**
   * 清理过期备份
   */
  async cleanupExpiredBackups(): Promise<number> {
    return invoke<number>('cleanup_expired_backups_cmd')
  },

  /**
   * 获取备份详情
   */
  async getBackupInfo(backupId: string): Promise<BackupInfo | null> {
    return invoke<BackupInfo | null>('get_backup_info_cmd', { backupId })
  },

  /**
   * 删除 Worktree（带日志记录和删除保护）
   */
  async deleteWorktreeWithProtection(
    repoPath: string,
    worktreePath: string,
    branch: string,
    force: boolean = false
  ): Promise<WorktreeResult> {
    return invoke<WorktreeResult>('delete_worktree_with_protection_cmd', {
      repoPath,
      worktreePath,
      branch,
      force,
    })
  },

  // ============ 冲突检测相关 ============

  /**
   * 检测 worktree 之间的潜在冲突
   */
  async detectConflicts(repoPath: string): Promise<WorktreeConflictDetectionResponse> {
    return invoke<WorktreeConflictDetectionResponse>('detect_conflicts_cmd', { repoPath })
  },

  // ============ 三方合并 Diff 相关 ============

  /**
   * 获取三方合并 Diff（用于合并冲突场景）
   */
  async getThreeWayDiff(worktreePath: string, filePath: string): Promise<ThreeWayDiff> {
    return invoke<ThreeWayDiff>('get_three_way_diff_cmd', { worktreePath, filePath })
  },
}
