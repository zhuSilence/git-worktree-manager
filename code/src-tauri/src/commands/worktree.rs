use crate::models::{CreateWorktreeParams, WorktreeListResponse, WorktreeResult, StartHotfixParams, StartHotfixResult, FinishHotfixResult, HotfixInfo};
use crate::services::git_service;
use tauri::command;
use tauri::async_runtime::spawn_blocking;

/// 获取 Worktree 列表
#[command]
pub async fn list_worktrees(repo_path: String) -> Result<WorktreeListResponse, String> {
    spawn_blocking(move || {
        git_service::list_worktrees(&repo_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 创建 Worktree
#[command]
pub async fn create_worktree(
    repo_path: String,
    name: String,
    base_branch: String,
    new_branch: Option<String>,
    custom_path: Option<String>,
) -> Result<WorktreeResult, String> {
    let params = CreateWorktreeParams {
        name,
        base_branch,
        new_branch,
        custom_path,
    };
    spawn_blocking(move || {
        git_service::create_worktree(&repo_path, params)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 删除 Worktree
#[command]
pub async fn delete_worktree(
    repo_path: String,
    worktree_path: String,
    force: bool,
) -> Result<WorktreeResult, String> {
    spawn_blocking(move || {
        git_service::delete_worktree(&repo_path, &worktree_path, force)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 清理已删除的 Worktree 引用
#[command]
pub async fn prune_worktrees(repo_path: String) -> Result<(), String> {
    spawn_blocking(move || {
        git_service::prune_worktrees(&repo_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 在终端中打开
#[command]
pub async fn open_in_terminal(worktree_path: String, terminal: Option<String>) -> Result<(), String> {
    spawn_blocking(move || {
        git_service::open_in_terminal(&worktree_path, terminal)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 在编辑器中打开
#[command]
pub async fn open_in_editor(worktree_path: String, editor: Option<String>) -> Result<(), String> {
    spawn_blocking(move || {
        git_service::open_in_editor(&worktree_path, editor)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 检查是否为 Git 仓库
#[command]
pub async fn is_git_repo(path: String) -> Result<bool, String> {
    spawn_blocking(move || {
        git_service::is_git_repo(&path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取分支列表
#[command]
pub async fn list_branches(repo_path: String) -> Result<crate::models::BranchListResponse, String> {
    spawn_blocking(move || {
        git_service::list_branches(&repo_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 在文件管理器中打开 Worktree 目录
#[command]
pub async fn open_worktree(worktree_path: String) -> Result<(), String> {
    spawn_blocking(move || {
        git_service::open_in_file_manager(&worktree_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取 worktree 与目标分支的 diff
#[command]
pub async fn get_diff(worktree_path: String, target_branch: String) -> Result<crate::models::DiffResponse, String> {
    spawn_blocking(move || {
        git_service::get_diff(&worktree_path, &target_branch)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取详细的 diff 内容（包含代码行）
#[command]
pub async fn get_detailed_diff(worktree_path: String, target_branch: String) -> Result<crate::models::DetailedDiffResponse, String> {
    spawn_blocking(move || {
        git_service::get_detailed_diff(&worktree_path, &target_branch)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取仓库基本信息
#[command]
pub async fn get_repository_info(repo_path: String) -> Result<crate::models::RepositoryInfo, String> {
    spawn_blocking(move || {
        git_service::get_repository_info(&repo_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 切换分支
#[command]
pub async fn switch_branch(worktree_path: String, branch_name: String) -> Result<crate::models::SwitchBranchResult, String> {
    spawn_blocking(move || {
        git_service::switch_branch(&worktree_path, &branch_name)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 创建并切换到新分支
#[command]
pub async fn create_branch(worktree_path: String, branch_name: String, base_branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    spawn_blocking(move || {
        git_service::create_and_switch_branch(&worktree_path, &branch_name, base_branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 拉取远程分支
#[command]
pub async fn fetch_remote_branch(repo_path: String, remote_branch: String, local_branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    spawn_blocking(move || {
        git_service::fetch_and_checkout(&repo_path, &remote_branch, local_branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 批量删除 worktree
#[command]
pub async fn batch_delete_worktrees(repo_path: String, worktree_paths: Vec<String>, force: bool) -> Result<crate::models::BatchDeleteResult, String> {
    spawn_blocking(move || {
        git_service::batch_delete_worktrees(&repo_path, worktree_paths, force)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取已合并提示
#[command]
pub async fn get_merged_hints(repo_path: String, main_branch: String) -> Result<Vec<crate::models::WorktreeHint>, String> {
    spawn_blocking(move || {
        git_service::get_merged_hints(&repo_path, &main_branch)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取陈旧提示
#[command]
pub async fn get_stale_hints(repo_path: String, days: i64) -> Result<Vec<crate::models::WorktreeHint>, String> {
    spawn_blocking(move || {
        git_service::get_stale_hints(&repo_path, days)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取时间线数据
#[command]
pub async fn get_timeline(repo_path: String, since: Option<i64>, until: Option<i64>) -> Result<crate::models::TimelineResponse, String> {
    spawn_blocking(move || {
        git_service::get_timeline(&repo_path, since, until)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Push 本地提交到远程
#[command]
pub async fn push(worktree_path: String, branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    spawn_blocking(move || {
        git_service::push(&worktree_path, branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Pull 远程提交到本地
#[command]
pub async fn pull(worktree_path: String, branch: Option<String>) -> Result<crate::models::SwitchBranchResult, String> {
    spawn_blocking(move || {
        git_service::pull(&worktree_path, branch.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

// ============ Hotfix 相关命令 ============

/// 开始 Hotfix 流程
#[command]
pub async fn start_hotfix(
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
    spawn_blocking(move || {
        git_service::start_hotfix(&repo_path, params)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 完成 Hotfix 流程
#[command]
pub async fn finish_hotfix(repo_path: String, push: bool) -> Result<FinishHotfixResult, String> {
    spawn_blocking(move || {
        git_service::finish_hotfix(&repo_path, push)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 取消 Hotfix 流程
#[command]
pub async fn abort_hotfix(repo_path: String) -> Result<FinishHotfixResult, String> {
    spawn_blocking(move || {
        git_service::abort_hotfix(&repo_path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// 获取 Hotfix 状态
#[command]
pub async fn get_hotfix_status(repo_path: String) -> Result<Option<HotfixInfo>, String> {
    spawn_blocking(move || git_service::get_hotfix_status(&repo_path))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}
