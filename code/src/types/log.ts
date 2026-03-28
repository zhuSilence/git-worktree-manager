/**
 * 操作类型枚举
 */
export enum OperationType {
  Create = 'create',
  Delete = 'delete',
  Switch = 'switch',
  Prune = 'prune',
  BatchDelete = 'batchdelete',
}

/**
 * 操作结果枚举
 */
export enum OperationResult {
  Success = 'success',
  Failed = 'failed',
}

/**
 * 操作日志条目
 */
export interface OperationLog {
  /** 日志 ID */
  id: string
  /** 操作类型 */
  operationType: OperationType
  /** 操作时间 (ISO 8601) */
  timestamp: string
  /** 操作对象（分支名或路径） */
  target: string
  /** 操作详情 */
  details: string | null
  /** 操作结果 */
  result: OperationResult
  /** 错误消息（失败时） */
  errorMessage: string | null
  /** 仓库路径 */
  repoPath: string
}

/**
 * 操作日志列表响应
 */
export interface OperationLogListResponse {
  logs: OperationLog[]
  totalCount: number
}

/**
 * 操作日志筛选条件
 */
export interface OperationLogFilter {
  startTime?: string
  endTime?: string
  operationType?: OperationType
  result?: OperationResult
  repoPath?: string
}

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份 ID */
  id: string
  /** 原 worktree 路径 */
  originalPath: string
  /** 分支名 */
  branch: string
  /** 备份时间 (ISO 8601) */
  createdAt: string
  /** Stash ref */
  stashRef: string
  /** 是否已恢复 */
  restored: boolean
  /** 过期时间 (ISO 8601) */
  expiresAt: string
}

/**
 * 备份列表响应
 */
export interface BackupListResponse {
  backups: BackupInfo[]
  totalCount: number
}

/**
 * 创建备份请求
 */
export interface CreateBackupRequest {
  worktreePath: string
  branch: string
}

/**
 * 恢复备份结果
 */
export interface RestoreBackupResult {
  success: boolean
  message: string
  restoredPath: string | null
}

/**
 * 删除保护检查结果
 */
export interface DeleteProtectionCheck {
  needsProtection: boolean
  backupCreated: boolean
  backupId: string | null
  warningMessage: string | null
}