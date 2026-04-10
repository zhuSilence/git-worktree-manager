use super::run_blocking;
use crate::models::{MergeConflictCheckResult, MergeParams, MergeResult};
use crate::services::{
    abort_merge, check_merge_conflicts, complete_merge, merge_branch_in_worktree,
};
use crate::services::backup_service::pop_stash;
use crate::utils::validation::validate_path;
use tauri::command;

/// 在目标 worktree 中合并源分支
#[command]
pub async fn merge_branch_cmd(params: MergeParams) -> Result<MergeResult, String> {
    // 验证路径
    validate_path(&params.repo_path).map_err(|e| e.to_string())?;
    validate_path(&params.target_worktree_path).map_err(|e| e.to_string())?;

    run_blocking(move || merge_branch_in_worktree(&params)).await
}

/// 中止合并（git merge --abort）
#[command]
pub async fn abort_merge_cmd(worktree_path: String) -> Result<bool, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    run_blocking(move || abort_merge(&worktree_path)).await
}

/// 完成合并（冲突解决后提交）
#[command]
pub async fn complete_merge_cmd(
    worktree_path: String,
    message: Option<String>,
) -> Result<MergeResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    run_blocking(move || complete_merge(&worktree_path, message)).await
}

/// 预检测合并冲突（不实际执行合并）
#[command]
pub async fn check_merge_conflicts_cmd(
    worktree_path: String,
    main_repo_path: String,
    source_branch: String,
) -> Result<MergeConflictCheckResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    validate_path(&main_repo_path).map_err(|e| e.to_string())?;

    run_blocking(move || check_merge_conflicts(&worktree_path, &main_repo_path, &source_branch))
        .await
}

/// 合并后弹出暂存的变更
#[command]
pub async fn pop_stash_after_merge_cmd(
    worktree_path: String,
    stash_ref: String,
) -> Result<bool, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    run_blocking(move || pop_stash(&worktree_path, &stash_ref)).await
}
