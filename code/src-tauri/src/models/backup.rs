use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 备份信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    /// 唯一标识符
    pub id: String,
    /// 原分支名
    pub branch: String,
    /// 原 worktree 路径
    pub worktree_path: String,
    /// 备份时间 (ISO 8601)
    pub created_at: String,
    /// Stash 引用 (如 stash@{0})
    pub stash_ref: Option<String>,
    /// 是否有未提交更改
    pub has_changes: bool,
    /// 备份类型
    pub backup_type: BackupType,
}

/// 备份类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BackupType {
    #[serde(rename = "preDelete")]
    PreDelete,
    #[serde(rename = "manual")]
    Manual,
}

/// 备份列表响应
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupListResponse {
    pub backups: Vec<BackupInfo>,
    pub total: usize,
}

/// 创建备份结果
#[derive(Debug, Serialize)]
pub struct BackupResult {
    pub success: bool,
    pub message: String,
    pub backup: Option<BackupInfo>,
}

/// 恢复备份结果
#[derive(Debug, Serialize)]
pub struct RestoreResult {
    pub success: bool,
    pub message: String,
}

/// 备份存储位置
pub fn get_backup_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".worktree-manager").join("backups")
}

/// 生成备份 ID
pub fn generate_backup_id() -> String {
    let timestamp = chrono::Local::now().format("%Y%m%d%H%M%S%3f");
    format!("backup-{}", timestamp)
}