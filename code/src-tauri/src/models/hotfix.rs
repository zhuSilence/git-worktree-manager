use serde::{Deserialize, Serialize};

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

/// Hotfix 存储位置
pub fn get_hotfix_state_file() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(home)
        .join(".worktree-manager")
        .join("hotfix-state.json")
}

/// 生成 hotfix 分支名
/// 格式: hotfix/YYYY-MM-DD-描述
pub fn generate_hotfix_branch_name(description: &str) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d");
    // 简化描述：只保留字母数字和连字符
    let simplified: String = description
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
        .collect::<String>()
        .replace(' ', "-")
        .to_lowercase();
    
    // 限制长度
    let truncated = if simplified.len() > 30 {
        &simplified[..30]
    } else {
        &simplified
    };
    
    format!("hotfix/{}-{}", today, truncated.trim_matches('-'))
}