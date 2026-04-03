use serde::{Deserialize, Serialize};

/// 合并参数
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeParams {
    /// 仓库路径（主仓库）
    pub repo_path: String,
    /// 目标 worktree 路径
    pub target_worktree_path: String,
    /// 源分支名
    pub source_branch: String,
    /// 是否自动推送
    pub auto_push: bool,
    /// 是否删除源 worktree
    #[allow(dead_code)]
    pub auto_delete_source: bool,
}

/// 合并状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum MergeStatus {
    /// 合并完成
    Completed,
    /// 存在冲突
    HasConflicts,
    /// 失败
    Failed,
    /// 已中止
    Aborted,
}

/// 冲突文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    /// 文件路径
    pub path: String,
    /// 本地版本 OID
    pub our_oid: Option<String>,
    /// 远程版本 OID
    pub their_oid: Option<String>,
}

/// 合并结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    /// 是否成功
    pub success: bool,
    /// 合并状态
    pub status: MergeStatus,
    /// 结果消息
    pub message: String,
    /// 提交 ID（合并成功时）
    pub commit_id: Option<String>,
    /// 冲突文件列表
    pub conflicts: Vec<ConflictFile>,
    /// 目标分支名
    pub target_branch: String,
}

/// 完成合并参数
#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompleteMergeParams {
    /// worktree 路径
    pub worktree_path: String,
    /// 提交消息（可选）
    pub message: Option<String>,
}
