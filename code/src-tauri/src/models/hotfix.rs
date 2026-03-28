use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Hotfix 流程状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HotfixStatus {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "inProgress")]
    InProgress,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "aborted")]
    Aborted,
}

/// Hotfix 流程信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotfixInfo {
    /// Hotfix 分支名
    pub branch_name: String,
    /// Worktree 路径
    pub worktree_path: String,
    /// 起始时间 (ISO 8601)
    pub started_at: String,
    /// 基准分支 (通常是 main)
    pub base_branch: String,
    /// 状态
    pub status: HotfixStatus,
    /// 描述/备注
    pub description: Option<String>,
}

/// 开始 Hotfix 参数
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartHotfixParams {
    /// 描述 (用于生成分支名)
    pub description: String,
    /// 基准分支 (默认 main)
    pub base_branch: Option<String>,
    /// 自定义分支名 (可选，不提供则自动生成)
    pub branch_name: Option<String>,
}

/// 开始 Hotfix 结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartHotfixResult {
    pub success: bool,
    pub message: String,
    pub hotfix: Option<HotfixInfo>,
}

/// 完成 Hotfix 结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FinishHotfixResult {
    pub success: bool,
    pub message: String,
    pub merged: bool,
    pub cleaned_up: bool,
}

/// Hotfix 存储位置（基于仓库路径生成唯一文件名，避免多仓库冲突）
pub fn get_hotfix_state_file(repo_path: &str) -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());

    // 使用仓库路径的哈希作为文件名，支持多仓库
    let mut hasher = DefaultHasher::new();
    repo_path.hash(&mut hasher);
    let hash = hasher.finish();

    std::path::PathBuf::from(home)
        .join(".worktree-manager")
        .join(format!("hotfix-{:016x}.json", hash))
}

/// 生成 hotfix 分支名
/// 格式: hotfix/YYYY-MM-DD-描述
pub fn generate_hotfix_branch_name(description: &str) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d");

    let simplified: String = description
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-')
        .collect::<String>()
        .replace(' ', "-")
        .to_lowercase();

    let truncated = if simplified.chars().count() > 30 {
        simplified.chars().take(30).collect::<String>()
    } else {
        simplified.clone()
    };

    let trimmed = truncated.trim_matches('-');

    let safe_name = if trimmed.is_empty() {
        "fix".to_string()
    } else {
        trimmed.to_string()
    };

    format!("hotfix/{}-{}", today, safe_name)
}
