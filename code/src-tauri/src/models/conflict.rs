use serde::{Deserialize, Serialize};

/// 冲突风险等级
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictRiskLevel {
    #[serde(rename = "high")]
    High,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "low")]
    Low,
}

/// 文件冲突信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileConflict {
    /// 文件路径
    pub path: String,
    /// 风险等级
    pub risk_level: ConflictRiskLevel,
    /// 涉及的 worktree 列表
    pub worktrees: Vec<String>,
    /// 涉及的分支列表
    pub branches: Vec<String>,
    /// 各 worktree 的变更统计
    pub changes: Vec<FileChangeInfo>,
    /// 冲突详情 (模拟合并后的冲突内容)
    pub conflict_preview: Option<String>,
}

/// 文件变更信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeInfo {
    /// Worktree 名称
    pub worktree_name: String,
    /// 分支名
    pub branch: String,
    /// 新增行数
    pub additions: usize,
    /// 删除行数
    pub deletions: usize,
    /// 变更类型 (added, modified, deleted)
    pub status: String,
}

/// 冲突检测结果响应
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictDetectionResponse {
    /// 检测是否成功
    pub success: bool,
    /// 消息
    pub message: String,
    /// 检测时间 (ISO 8601)
    pub detected_at: String,
    /// 冲突文件列表
    pub conflicts: Vec<FileConflict>,
    /// 高风险数量
    pub high_risk_count: usize,
    /// 中风险数量
    pub medium_risk_count: usize,
    /// 低风险数量
    pub low_risk_count: usize,
    /// 检测的 worktree 数量
    pub worktree_count: usize,
}

/// Worktree 间的文件变更对比
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeFileDiff {
    /// Worktree 名称
    pub worktree_name: String,
    /// 分支名
    pub branch: String,
    /// 变更文件列表
    pub changed_files: Vec<String>,
}