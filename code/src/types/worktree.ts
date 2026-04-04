/**
 * Git Worktree 状态枚举
 */
export enum WorktreeStatus {
  /** 干净状态，无未提交更改 */
  Clean = 'clean',
  /** 有未提交的更改 */
  Dirty = 'dirty',
  /** 有未推送的提交 */
  Unpushed = 'unpushed',
  /** 有冲突 */
  Conflicted = 'conflicted',
  /** Detached HEAD 状态 */
  Detached = 'detached',
  /** 未知状态 */
  Unknown = 'unknown',
}

/**
 * 远程同步状态
 */
export interface SyncStatus {
  /** 领先远程的提交数 */
  ahead: number
  /** 落后远程的提交数 */
  behind: number
  /** 是否有远程分支 */
  hasRemote: boolean
}

/**
 * 最后提交信息
 */
export interface LastCommit {
  /** 提交 hash (短) */
  hash: string
  /** 提交消息 (第一行) */
  message: string
  /** 作者 */
  author: string
  /** 相对时间 */
  relativeTime: string
}

/**
 * Worktree 元数据类型
 */
export interface WorktreeMetadata {
  /** 标签列表 */
  tags?: string[]
  /** 备注 */
  notes?: string
  /** 优先级 */
  priority?: 'high' | 'medium' | 'low'
  /** 自定义字段 */
  [key: string]: unknown
}

/**
 * Worktree 信息
 */
export interface Worktree {
  /** Worktree 唯一标识符 */
  id: string
  /** Worktree 名称 */
  name: string
  /** 所在分支名 */
  branch: string
  /** 文件系统路径 */
  path: string
  /** 当前状态 */
  status: WorktreeStatus
  /** 最后提交信息 */
  lastCommit: LastCommit
  /** 最后活跃时间 */
  lastActiveAt: string | null
  /** 是否为主 Worktree */
  isMain: boolean
  /** 关联的远程仓库名 */
  remote?: string
  /** 额外元数据 */
  metadata?: WorktreeMetadata
  /** 远程同步状态 */
  syncStatus: SyncStatus
}

/**
 * 创建 Worktree 请求参数
 */
export interface CreateWorktreeParams {
  /** Worktree 名称 */
  name: string
  /** 基于的分支名 */
  baseBranch: string
  /** 新分支名（可选，不提供则自动生成） */
  newBranch?: string
  /** 自定义路径（可选） */
  customPath?: string
}

/**
 * Worktree 操作结果
 */
export interface WorktreeResult {
  /** 是否成功 */
  success: boolean
  /** 结果消息 */
  message: string
  /** 操作后的 Worktree 信息（可选） */
  worktree?: Worktree
}

/**
 * Worktree 列表响应
 */
export interface WorktreeListResponse {
  /** Worktree 列表 */
  worktrees: Worktree[]
  /** 当前仓库路径 */
  repoPath: string
  /** 是否是有效的 Git 仓库 */
  isValidRepo: boolean
}

/**
 * 分支信息
 */
export interface Branch {
  /** 分支名 */
  name: string
  /** 是否为当前分支 */
  isCurrent: boolean
  /** 最后提交信息 */
  lastCommit?: string
  /** 最后提交时间 */
  lastCommitDate?: string
  /** 关联的远程分支 */
  upstream?: string
}

/**
 * 分支列表响应
 */
export interface BranchListResponse {
  /** 分支列表 */
  branches: Branch[]
  /** 当前分支名 */
  currentBranch: string
}

/**
 * Diff 统计信息
 */
export interface DiffStats {
  /** 文件路径 */
  path: string
  /** 新增行数 */
  additions: number
  /** 删除行数 */
  deletions: number
  /** 状态 (added, modified, deleted, renamed) */
  status: string
}

/**
 * Diff 响应
 */
export interface DiffResponse {
  /** 源分支 */
  sourceBranch: string
  /** 目标分支 */
  targetBranch: string
  /** 文件变更统计 */
  files: DiffStats[]
  /** 总新增行数 */
  totalAdditions: number
  /** 总删除行数 */
  totalDeletions: number
  /** 变更文件数 */
  filesChanged: number
}

/**
 * Diff 行
 */
export interface DiffLine {
  /** 行类型: "context" | "addition" | "deletion" */
  lineType: string
  /** 旧文件行号 */
  oldLine: number | null
  /** 新文件行号 */
  newLine: number | null
  /** 行内容 */
  content: string
}

/**
 * Diff Hunk (代码块)
 */
export interface DiffHunk {
  /** 旧文件起始行 */
  oldStart: number
  /** 旧文件行数 */
  oldLines: number
  /** 新文件起始行 */
  newStart: number
  /** 新文件行数 */
  newLines: number
  /** 行内容 */
  lines: DiffLine[]
}

/**
 * 文件详细 Diff
 */
export interface FileDiff {
  /** 文件路径 */
  path: string
  /** 旧文件路径 (重命名时) */
  oldPath: string | null
  /** 状态 */
  status: string
  /** Hunks */
  hunks: DiffHunk[]
  /** 新增行数 */
  additions: number
  /** 删除行数 */
  deletions: number
  /** 变更来源: committed(分支差异), unstaged(工作区修改), untracked(未跟踪文件) */
  source: 'committed' | 'unstaged' | 'untracked'
}

/**
 * 详细 Diff 响应
 */
export interface DetailedDiffResponse {
  /** 源分支 */
  sourceBranch: string
  /** 目标分支 */
  targetBranch: string
  /** 文件列表 */
  files: FileDiff[]
  /** 总新增行数 */
  totalAdditions: number
  /** 总删除行数 */
  totalDeletions: number
}

/**
 * 仓库基础信息
 */
export interface RepositoryInfo {
  /** 仓库 ID (路径) */
  id: string
  /** 仓库名称 */
  name: string
  /** 路径 */
  path: string
  /** 当前分支 */
  currentBranch: string
  /** Worktree 数量 */
  worktreeCount: number
  /** 最后活跃时间 */
  lastActive: string | null
  /** 路径是否有效 */
  isPathValid?: boolean
}

/**
 * 仓库详细信息（包含 worktrees 和 branches）
 */
export interface Repository extends RepositoryInfo {
  /** 主 Worktree 路径 */
  mainWorktreePath: string
  /** Worktree 列表 */
  worktrees: Worktree[]
  /** 分支列表 */
  branches: { name: string; isCurrent: boolean }[]
  /** 默认分支 */
  defaultBranch: string
}

/**
 * 切换分支结果
 */
export interface SwitchBranchResult {
  success: boolean
  message: string
}

/**
 * 批量删除结果
 */
export interface BatchDeleteResult {
  successCount: number
  failedCount: number
  results: WorktreeResult[]
}

/**
 * Worktree 提示信息
 */
export interface WorktreeHint {
  /** Worktree ID */
  worktreeId: string
  /** 分支名 */
  branch: string
  /** 提示类型: "merged" | "stale" */
  hintType: string
  /** 提示消息 */
  message: string
  /** 是否已合并 */
  isMerged: boolean
  /** 最后活跃天数 */
  inactiveDays: number | null
}

/**
 * 提交信息
 */
export interface CommitInfo {
  /** 提交 hash */
  hash: string
  /** 提交消息 */
  message: string
  /** 作者 */
  author: string
  /** 提交时间 (ISO 8601) */
  date: string
  /** 相对时间 */
  relativeTime: string
  /** Worktree 名称 */
  worktreeName: string
  /** 分支名 */
  branch: string
}

/**
 * 时间线响应
 */
export interface TimelineResponse {
  commits: CommitInfo[]
  totalCount: number
}

export interface RemoteBranch {
  name: string
  remote: string
  fullName: string
  lastCommit?: string
  lastCommitDate?: string
}

export interface RemoteBranchListResponse {
  remoteBranches: RemoteBranch[]
  remotes: string[]
}

export interface FetchResult {
  success: boolean
  message: string
  updatedRemotes: string[]
}

// ============ Hotfix 类型 ============

/**
 * Hotfix 状态
 */
export enum HotfixStatus {
  /** 空闲 */
  Idle = 'idle',
  /** 进行中 */
  InProgress = 'inProgress',
  /** 已完成 */
  Completed = 'completed',
  /** 已取消 */
  Aborted = 'aborted',
}

/**
 * Hotfix 信息
 */
export interface HotfixInfo {
  /** 分支名 */
  branchName: string
  /** Worktree 路径 */
  worktreePath: string
  /** 开始时间 */
  startedAt: string
  /** 基准分支 */
  baseBranch: string
  /** 状态 */
  status: HotfixStatus
  /** 描述 */
  description?: string
}

/**
 * 开始 Hotfix 参数
 */
export interface StartHotfixParams {
  /** 描述 */
  description: string
  /** 基准分支 */
  baseBranch?: string
  /** 自定义分支名 */
  branchName?: string
}

/**
 * 开始 Hotfix 结果
 */
export interface StartHotfixResult {
  success: boolean
  message: string
  hotfix?: HotfixInfo
}

/**
 * 完成 Hotfix 结果
 */
export interface FinishHotfixResult {
  success: boolean
  message: string
  merged: boolean
  cleanedUp: boolean
}

// ============ 合并相关类型 ============

/**
 * 合并参数
 */
export interface MergeParams {
  /** 仓库路径 */
  repoPath: string
  /** 目标 worktree 路径 */
  targetWorktreePath: string
  /** 源分支名 */
  sourceBranch: string
  /** 是否自动推送 */
  autoPush: boolean
  /** 是否删除源 worktree */
  autoDeleteSource: boolean
}

/**
 * 合并状态
 */
export enum MergeStatus {
  /** 合并完成 */
  Completed = 'completed',
  /** 存在冲突 */
  HasConflicts = 'hasConflicts',
  /** 失败 */
  Failed = 'failed',
  /** 已中止 */
  Aborted = 'aborted',
}

/**
 * 冲突文件信息
 */
export interface ConflictFile {
  /** 文件路径 */
  path: string
  /** 本地版本 OID */
  ourOid?: string
  /** 远程版本 OID */
  theirOid?: string
}

/**
 * 合并结果
 */
export interface MergeResult {
  /** 是否成功 */
  success: boolean
  /** 合并状态 */
  status: MergeStatus
  /** 结果消息 */
  message: string
  /** 提交 ID（合并成功时） */
  commitId?: string
  /** 冲突文件列表 */
  conflicts: ConflictFile[]
  /** 目标分支名 */
  targetBranch: string
}

// ============ Worktree 冲突检测类型 ============

/**
 * Worktree 冲突风险等级
 */
export enum WorktreeConflictRiskLevel {
  /** 高风险 */
  High = 'high',
  /** 中风险 */
  Medium = 'medium',
  /** 低风险 */
  Low = 'low',
}

/**
 * Worktree 文件变更信息
 */
export interface WorktreeFileChange {
  /** Worktree 名称 */
  worktreeName: string
  /** 分支名 */
  branch: string
  /** Worktree 路径 */
  worktreePath: string
  /** 文件状态 */
  status: string
  /** 新增行数 */
  additions: number
  /** 删除行数 */
  deletions: number
}

/**
 * Worktree 冲突文件信息
 */
export interface WorktreeConflictFile {
  /** 文件路径 */
  path: string
  /** 风险等级 */
  riskLevel: WorktreeConflictRiskLevel
  /** 在哪些 worktree 中被修改 */
  worktreeChanges: WorktreeFileChange[]
  /** 冲突描述 */
  description: string
}

/**
 * Worktree 冲突检测结果响应
 */
export interface WorktreeConflictDetectionResponse {
  /** 是否有冲突 */
  hasConflicts: boolean
  /** 高风险冲突数 */
  highRiskCount: number
  /** 中风险冲突数 */
  mediumRiskCount: number
  /** 低风险冲突数 */
  lowRiskCount: number
  /** 冲突文件列表 */
  conflictFiles: WorktreeConflictFile[]
  /** 检测时间 */
  detectedAt: string
}