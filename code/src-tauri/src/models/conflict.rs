use serde::{Deserialize, Serialize};

/// 文件冲突信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileConflict {
    /// 文件路径
    pub path: String,
    /// 修改此文件的 worktree 列表
    pub worktrees: Vec<ConflictWorktree>,
    /// 风险等级: high, medium, low
    pub risk_level: String,
    /// 冲突原因描述
    pub description: String,
}

/// 冲突相关的 worktree 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictWorktree {
    /// worktree 名称
    pub name: String,
    /// worktree 所在分支
    pub branch: String,
    /// worktree 路径
    pub path: String,
    /// 变更类型: added, modified, deleted
    pub change_type: String,
    /// 新增行数
    pub additions: usize,
    /// 删除行数
    pub deletions: usize,
}

/// 冲突检测结果响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictDetectionResponse {
    /// 是否有冲突风险
    pub has_conflicts: bool,
    /// 冲突文件列表
    pub conflicts: Vec<FileConflict>,
    /// 高风险数量
    pub high_risk_count: usize,
    /// 中风险数量
    pub medium_risk_count: usize,
    /// 低风险数量
    pub low_risk_count: usize,
    /// 检测时间
    pub detected_at: String,
    /// 仓库路径
    pub repo_path: String,
}

/// 冲突预览请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictPreviewRequest {
    /// 仓库路径
    pub repo_path: String,
    /// 文件路径
    pub file_path: String,
}

/// 冲突预览响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictPreviewResponse {
    /// 文件路径
    pub file_path: String,
    /// 各 worktree 的文件内容差异
    pub diffs: Vec<WorktreeFileDiff>,
}

/// Worktree 文件差异
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeFileDiff {
    /// worktree 名称
    pub worktree_name: String,
    /// 分支名
    pub branch: String,
    /// 文件内容（相对于主分支的 diff）
    pub diff_content: String,
    /// 变更类型
    pub change_type: String,
}