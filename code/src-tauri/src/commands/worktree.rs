use crate::models::{CreateWorktreeParams, WorktreeListResponse, WorktreeResult, StartHotfixParams, StartHotfixResult, FinishHotfixResult, HotfixInfo};
use crate::services::{
    list_worktrees, create_worktree, delete_worktree, prune_worktrees,
    open_in_terminal, open_in_editor, open_in_file_manager,
    is_git_repo, list_branches, get_repository_info,
    switch_branch, create_and_switch_branch, fetch_and_checkout,
    batch_delete_worktrees, get_merged_hints, get_stale_hints,
    get_diff, get_detailed_diff, get_timeline, push, pull,
    fetch_all, list_remote_branches,
    start_hotfix, finish_hotfix, abort_hotfix, get_hotfix_status,
};
use crate::utils::validation::validate_path;
use tauri::command;
use tauri::async_runtime::spawn_blocking;

/// 辅助函数：包装同步操作为异步，统一处理错误转换
async fn run_blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> anyhow::Result<T> + Send + 'static,
    T: Send + 'static,
{
    spawn_blocking(f)
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| e.to_string())
}

/// 获取 Worktree 列表
#[command]
pub async fn list_worktrees_cmd(repo_path: String) -> Result<WorktreeListResponse, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || list_worktrees(&repo_path)).await
}

/// 创建 Worktree
#[command]
pub async fn create_worktree_cmd(
    repo_path: String,
    name: String,
    base_branch: String,
    new_branch: Option<String>,
    custom_path: Option<String>,
) -> Result<WorktreeResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    if let Some(ref path) = custom_path {
        validate_path(path).map_err(|e| e.to_string())?;
    }
    let params = CreateWorktreeParams {
        name,
        base_branch,
        new_branch,
        custom_path,
    };
    run_blocking(move || create_worktree(&repo_path, params)).await
}

/// 删除 Worktree
#[command]
pub async fn delete_worktree_cmd(
    repo_path: String,
    worktree_path: String,
    force: bool,
) -> Result<WorktreeResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || delete_worktree(&repo_path, &worktree_path, force)).await
}

/// 清理已删除的 Worktree 引用
#[command]
pub async fn prune_worktrees_cmd(repo_path: String) -> Result<(), String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || prune_worktrees(&repo_path)).await
}

/// 在终端中打开
#[command]
pub async fn open_in_terminal_cmd(worktree_path: String, terminal: Option<String>, custom_path: Option<String>) -> Result<(), String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || open_in_terminal(&worktree_path, terminal, custom_path)).await
}

/// 在编辑器中打开
#[command]
pub async fn open_in_editor_cmd(worktree_path: String, editor: Option<String>, custom_path: Option<String>) -> Result<(), String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || open_in_editor(&worktree_path, editor, custom_path)).await
}

/// 检查是否为 Git 仓库
#[command]
pub async fn is_git_repo_cmd(path: String) -> Result<bool, String> {
    validate_path(&path).map_err(|e| e.to_string())?;
    run_blocking(move || is_git_repo(&path)).await
}

/// 获取分支列表
#[command]
pub async fn list_branches_cmd(repo_path: String) -> Result<crate::models::BranchListResponse, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || list_branches(&repo_path)).await
}

/// 在文件管理器中打开 Worktree 目录
#[command]
pub async fn open_worktree_cmd(worktree_path: String) -> Result<(), String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || open_in_file_manager(&worktree_path)).await
}

/// 获取 worktree 与目标分支的 diff
#[command]
pub async fn get_diff_cmd(worktree_path: String, target_branch: String) -> Result<crate::models::DiffResponse, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_diff(&worktree_path, &target_branch)).await
}

/// 获取详细的 diff 内容（包含代码行）
#[command]
pub async fn get_detailed_diff_cmd(worktree_path: String, target_branch: String) -> Result<crate::models::DetailedDiffResponse, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_detailed_diff(&worktree_path, &target_branch)).await
}

/// 获取仓库基本信息
#[command]
pub async fn get_repository_info_cmd(repo_path: String) -> Result<crate::models::RepositoryInfo, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_repository_info(&repo_path)).await
}

/// 切换分支
#[command]
pub async fn switch_branch_cmd(worktree_path: String, branch_name: String) -> Result<crate::models::SwitchBranchResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || switch_branch(&worktree_path, &branch_name)).await
}

/// 创建并切换到新分支
#[command]
pub async fn create_branch_cmd(worktree_path: String, branch_name: String, base_branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || create_and_switch_branch(&worktree_path, &branch_name, base_branch.as_deref())).await
}

/// 拉取远程分支
#[command]
pub async fn fetch_remote_branch_cmd(repo_path: String, remote_branch: String, local_branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || fetch_and_checkout(&repo_path, &remote_branch, local_branch.as_deref())).await
}

/// 批量删除 worktree
#[command]
pub async fn batch_delete_worktrees_cmd(repo_path: String, worktree_paths: Vec<String>, force: bool) -> Result<crate::models::BatchDeleteResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    for path in &worktree_paths {
        validate_path(path).map_err(|e| e.to_string())?;
    }
    run_blocking(move || batch_delete_worktrees(&repo_path, worktree_paths, force)).await
}

/// 获取已合并提示
#[command]
pub async fn get_merged_hints_cmd(repo_path: String, main_branch: String) -> Result<Vec<crate::models::WorktreeHint>, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_merged_hints(&repo_path, &main_branch)).await
}

/// 获取陈旧提示
#[command]
pub async fn get_stale_hints_cmd(repo_path: String, days: i64) -> Result<Vec<crate::models::WorktreeHint>, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_stale_hints(&repo_path, days)).await
}

/// 获取时间线数据
#[command]
pub async fn get_timeline_cmd(repo_path: String, since: Option<i64>, until: Option<i64>) -> Result<crate::models::TimelineResponse, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || get_timeline(&repo_path, since, until)).await
}

/// Push 本地提交到远程
#[command]
pub async fn push_cmd(worktree_path: String, branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || push(&worktree_path, branch.as_deref())).await
}

/// Pull 远程提交到本地
#[command]
pub async fn pull_cmd(worktree_path: String, branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || pull(&worktree_path, branch.as_deref())).await
}

/// Fetch 所有远程分支
#[command]
pub async fn fetch_all_cmd(repo_path: String) -> Result<crate::models::FetchResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || fetch_all(&repo_path)).await
}

/// 获取远程分支列表
#[command]
pub async fn list_remote_branches_cmd(repo_path: String) -> Result<crate::models::RemoteBranchListResponse, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    run_blocking(move || list_remote_branches(&repo_path)).await
}

// ============ Hotfix 相关命令 ============

/// 开始 Hotfix 流程
#[command]
pub async fn start_hotfix_cmd(
    repo_path: String,
    description: String,
    base_branch: Option<String>,
    branch_name: Option<String>,
) -> Result<StartHotfixResult, String> {
    let params = StartHotfixParams {
        description,
        base_branch,
        branch_name,
    };
    run_blocking(move || start_hotfix(&repo_path, params)).await
}

/// 完成 Hotfix 流程
#[command]
pub async fn finish_hotfix_cmd(repo_path: String, push: bool) -> Result<FinishHotfixResult, String> {
    run_blocking(move || finish_hotfix(&repo_path, push)).await
}

/// 取消 Hotfix 流程
#[command]
pub async fn abort_hotfix_cmd(repo_path: String) -> Result<FinishHotfixResult, String> {
    run_blocking(move || abort_hotfix(&repo_path)).await
}

/// 获取 Hotfix 状态
#[command]
pub async fn get_hotfix_status_cmd(repo_path: String) -> Result<Option<HotfixInfo>, String> {
    run_blocking(move || get_hotfix_status(&repo_path)).await
}
