use crate::models::{MergeParams, MergeResult};
use crate::services::{merge_branch_in_worktree, abort_merge, complete_merge};
use crate::utils::validation::validate_path;
use tauri::command;

/// 在目标 worktree 中合并源分支
#[command]
pub async fn merge_branch_cmd(params: MergeParams) -> Result<MergeResult, String> {
    // 验证路径
    validate_path(&params.repo_path).map_err(|e| e.to_string())?;
    validate_path(&params.target_worktree_path).map_err(|e| e.to_string())?;

    // 使用 spawn_blocking 执行同步 git 操作
    tauri::async_runtime::spawn_blocking(move || {
        merge_branch_in_worktree(&params)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

/// 中止合并（git merge --abort）
#[command]
pub async fn abort_merge_cmd(worktree_path: String) -> Result<bool, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        abort_merge(&worktree_path)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}

/// 完成合并（冲突解决后提交）
#[command]
pub async fn complete_merge_cmd(
    worktree_path: String,
    message: Option<String>,
) -> Result<MergeResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        complete_merge(&worktree_path, message)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| e.to_string())
}
