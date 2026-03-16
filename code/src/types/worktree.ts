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
  /** 未知状态 */
  Unknown = 'unknown',
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
  /** 最后活跃时间 */
  lastActiveAt: string | null
  /** 是否为主 Worktree */
  isMain: boolean
  /** 关联的远程仓库名 */
  remote?: string
  /** 额外元数据 */
  metadata?: Record<string, unknown>
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