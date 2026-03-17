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
    #[serde(rename = "detached")]
    Detached,
    #[serde(rename = "unknown")]
    Unknown,
}

/// 最后提交信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastCommit {
    /// 提交 hash (短)
    pub hash: String,
    /// 提交消息 (第一行)
    pub message: String,
    /// 作者
    pub author: String,
    /// 相对时间
    pub relative_time: String,
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
    /// 最后提交信息
    pub last_commit: LastCommit,
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

/// Diff 统计信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffStats {
    /// 文件路径
    pub path: String,
    /// 新增行数
    pub additions: usize,
    /// 删除行数
    pub deletions: usize,
    /// 状态 (added, modified, deleted, renamed)
    pub status: String,
}

/// Diff 响应
#[derive(Debug, Serialize)]
pub struct DiffResponse {
    /// 源分支
    pub source_branch: String,
    /// 目标分支
    pub target_branch: String,
    /// 文件变更统计
    pub files: Vec<DiffStats>,
    /// 总新增行数
    pub total_additions: usize,
    /// 总删除行数
    pub total_deletions: usize,
    /// 变更文件数
    pub files_changed: usize,
}

/// Diff 行
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    /// 行类型: "context" | "addition" | "deletion" | "header"
    pub line_type: String,
    /// 旧文件行号 (删除行和上下文行)
    pub old_line: Option<usize>,
    /// 新文件行号 (新增行和上下文行)
    pub new_line: Option<usize>,
    /// 行内容
    pub content: String,
}

/// Diff Hunk (代码块)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    /// 旧文件起始行
    pub old_start: usize,
    /// 旧文件行数
    pub old_lines: usize,
    /// 新文件起始行
    pub new_start: usize,
    /// 新文件行数
    pub new_lines: usize,
    /// 行内容
    pub lines: Vec<DiffLine>,
}

/// 文件详细 Diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    /// 文件路径
    pub path: String,
    /// 旧文件路径 (重命名时)
    pub old_path: Option<String>,
    /// 状态
    pub status: String,
    /// Hunks
    pub hunks: Vec<DiffHunk>,
    /// 新增行数
    pub additions: usize,
    /// 删除行数
    pub deletions: usize,
}

/// 详细 Diff 响应
#[derive(Debug, Serialize)]
pub struct DetailedDiffResponse {
    /// 源分支
    pub source_branch: String,
    /// 目标分支
    pub target_branch: String,
    /// 文件列表
    pub files: Vec<FileDiff>,
    /// 总新增行数
    pub total_additions: usize,
    /// 总删除行数
    pub total_deletions: usize,
}