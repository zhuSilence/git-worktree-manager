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
  /** 提交列表 */
  commits: CommitInfo[]
  /** 总数 */
  totalCount: number
}

/**
 * Fetch 远程结果
 */
export interface FetchResult {
  /** 是否成功 */
  success: boolean
  /** Fetch 时间 (ISO 8601) */
  fetchedAt: string
  /** 更新的远程数量 */
  remotesUpdated: number
  /** 更新的分支列表 */
  branchesUpdated: string[]
  /** 错误信息 */
  error?: string
}