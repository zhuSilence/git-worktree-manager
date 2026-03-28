use serde::{Deserialize, Serialize};

/// 操作类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OperationType {
    Create,
    Delete,
    Switch,
    Prune,
    BatchDelete,
}

/// 操作结果状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OperationResult {
    Success,
    Failed,
}

/// 操作日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationLog {
    /// 日志 ID
    pub id: String,
    /// 操作类型
    pub operation_type: OperationType,
    /// 操作时间 (ISO 8601)
    pub timestamp: String,
    /// 操作对象（分支名或路径）
    pub target: String,
    /// 操作详情（如 base_branch, force 等）
    pub details: Option<String>,
    /// 操作结果
    pub result: OperationResult,
    /// 错误消息（失败时）
    pub error_message: Option<String>,
    /// 仓库路径
    pub repo_path: String,
}

/// 操作日志列表响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationLogListResponse {
    /// 日志列表
    pub logs: Vec<OperationLog>,
    /// 总数
    pub total_count: usize,
}

/// 操作日志筛选条件
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationLogFilter {
    /// 开始时间 (ISO 8601)
    pub start_time: Option<String>,
    /// 结束时间 (ISO 8601)
    pub end_time: Option<String>,
    /// 操作类型筛选
    pub operation_type: Option<OperationType>,
    /// 结果筛选
    pub result: Option<OperationResult>,
    /// 仓库路径筛选
    pub repo_path: Option<String>,
}

/// 备份信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    /// 备份 ID
    pub id: String,
    /// 原 worktree 路径
    pub original_path: String,
    /// 分支名
    pub branch: String,
    /// 备份时间 (ISO 8601)
    pub created_at: String,
    /// Stash ref
    pub stash_ref: String,
    /// 是否已恢复
    pub restored: bool,
    /// 过期时间 (ISO 8601)
    pub expires_at: String,
}

/// 备份列表响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupListResponse {
    /// 备份列表
    pub backups: Vec<BackupInfo>,
    /// 总数
    pub total_count: usize,
}

/// 创建备份请求
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupRequest {
    /// Worktree 路径
    pub worktree_path: String,
    /// 分支名
    pub branch: String,
}

/// 恢复备份结果
#[derive(Debug, Serialize)]
pub struct RestoreBackupResult {
    /// 是否成功
    pub success: bool,
    /// 结果消息
    pub message: String,
    /// 恢复到的路径
    pub restored_path: Option<String>,
}

/// 删除保护检查结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProtectionCheck {
    /// 是否需要保护（有未提交更改）
    pub needs_protection: bool,
    /// 是否已创建备份
    pub backup_created: bool,
    /// 备份 ID
    pub backup_id: Option<String>,
    /// 警告消息
    pub warning_message: Option<String>,
}