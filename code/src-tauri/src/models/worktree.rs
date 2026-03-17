use serde::{Deserialize, Serialize};

/// Git Worktree 状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorktreeStatus {
    #[serde(rename = "clean")]
    Clean,
    #[serde(rename = "dirty")]
    Dirty,
    #[serde(rename = "unpushed")]
    Unpushed,
    #[serde(rename = "conflicted")]
    Conflicted,
    #[serde(rename = "unknown")]
    Unknown,
}

/// Worktree 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worktree {
    /// 唯一标识符
    pub id: String,
    /// 名称
    pub name: String,
    /// 分支名
    pub branch: String,
    /// 文件路径
    pub path: String,
    /// 状态
    pub status: WorktreeStatus,
    /// 最后活跃时间
    pub last_active_at: Option<String>,
    /// 是否为主 worktree
    pub is_main: bool,
    /// 关联的远程仓库
    pub remote: Option<String>,
}

/// 创建 Worktree 参数
#[derive(Debug, Deserialize)]
pub struct CreateWorktreeParams {
    pub name: String,
    pub base_branch: String,
    pub new_branch: Option<String>,
    pub custom_path: Option<String>,
}

/// Worktree 操作结果
#[derive(Debug, Serialize)]
pub struct WorktreeResult {
    pub success: bool,
    pub message: String,
    pub worktree: Option<Worktree>,
}

/// Worktree 列表响应
#[derive(Debug, Serialize)]
pub struct WorktreeListResponse {
    pub worktrees: Vec<Worktree>,
    pub repo_path: String,
    pub is_valid_repo: bool,
}

/// 分支信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Branch {
    /// 分支名
    pub name: String,
    /// 是否为当前分支
    pub is_current: bool,
}

/// 分支列表响应
#[derive(Debug, Serialize)]
pub struct BranchListResponse {
    pub branches: Vec<Branch>,
    pub current_branch: String,
}