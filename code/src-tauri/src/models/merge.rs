use serde::{Deserialize, Serialize};

/// 自动处理未提交变更的策略
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AutoHandleUncommitted {
    /// 暂存变更，合并后恢复
    Stash,
    /// 创建临时提交
    Commit,
}

/// 自动处理结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoHandleResult {
    /// 使用的策略
    pub strategy: AutoHandleUncommitted,
    /// 暂存引用（如 "stash@{0}"）
    pub stash_ref: Option<String>,
    /// 临时提交 ID
    pub temp_commit_id: Option<String>,
    /// 暂存是否已恢复
    pub stash_popped: Option<bool>,
}

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
    /// 自动处理未提交变更的策略
    pub auto_handle_uncommitted: Option<AutoHandleUncommitted>,
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
    /// 存在未提交的更改
    HasUncommittedChanges,
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
    /// 自动处理未提交变更的结果
    pub auto_handle_result: Option<AutoHandleResult>,
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

/// 合并冲突预检测结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeConflictCheckResult {
    /// 是否存在冲突
    pub has_conflicts: bool,
    /// 冲突文件列表
    pub conflict_files: Vec<ConflictFile>,
}
