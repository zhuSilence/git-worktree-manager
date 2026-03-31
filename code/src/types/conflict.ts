/** 冲突风险等级 */
export type ConflictRiskLevel = 'high' | 'medium' | 'low'

/** 文件变更信息 */
export interface FileChangeInfo {
  worktreeName: string
  branch: string
  additions: number
  deletions: number
  status: string
}

/** 文件冲突信息 */
export interface FileConflict {
  path: string
  riskLevel: ConflictRiskLevel
  worktrees: string[]
  branches: string[]
  changes: FileChangeInfo[]
  conflictPreview?: string
}

/** 冲突检测结果 */
export interface ConflictDetectionResponse {
  success: boolean
  message: string
  detectedAt: string
  conflicts: FileConflict[]
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  worktreeCount: number
}

/** Worktree 间的文件变更对比 */
export interface WorktreeFileDiff {
  worktreeName: string
  branch: string
  changedFiles: string[]
}