/**
 * 冲突检测相关类型定义
 */

/** 文件冲突信息 */
export interface FileConflict {
  /** 文件路径 */
  path: string
  /** 修改此文件的 worktree 列表 */
  worktrees: ConflictWorktree[]
  /** 风险等级: high, medium, low */
  riskLevel: string
  /** 冲突原因描述 */
  description: string
}

/** 冲突相关的 worktree 信息 */
export interface ConflictWorktree {
  /** worktree 名称 */
  name: string
  /** worktree 所在分支 */
  branch: string
  /** worktree 路径 */
  path: string
  /** 变更类型: added, modified, deleted */
  changeType: string
  /** 新增行数 */
  additions: number
  /** 删除行数 */
  deletions: number
}

/** 冲突检测结果响应 */
export interface ConflictDetectionResponse {
  /** 是否有冲突风险 */
  hasConflicts: boolean
  /** 冲突文件列表 */
  conflicts: FileConflict[]
  /** 高风险数量 */
  highRiskCount: number
  /** 中风险数量 */
  mediumRiskCount: number
  /** 低风险数量 */
  lowRiskCount: number
  /** 检测时间 */
  detectedAt: string
  /** 仓库路径 */
  repoPath: string
}

/** 冲突预览响应 */
export interface ConflictPreviewResponse {
  /** 文件路径 */
  filePath: string
  /** 各 worktree 的文件内容差异 */
  diffs: WorktreeFileDiff[]
}

/** Worktree 文件差异 */
export interface WorktreeFileDiff {
  /** worktree 名称 */
  worktreeName: string
  /** 分支名 */
  branch: string
  /** 文件内容（相对于主分支的 diff） */
  diffContent: string
  /** 变更类型 */
  changeType: string
}