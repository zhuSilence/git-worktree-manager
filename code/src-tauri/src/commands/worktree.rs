use crate::models::{CreateWorktreeParams, Worktree, WorktreeListResponse, WorktreeResult};
use crate::services::git_service;
use tauri::command;

/// 获取 Worktree 列表
#[command]
pub async fn list_worktrees(repo_path: String) -> Result<WorktreeListResponse, String> {
    git_service::list_worktrees(&repo_path).map_err(|e| e.to_string())
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
    git_service::create_worktree(&repo_path, params).map_err(|e| e.to_string())
}

/// 删除 Worktree
#[command]
pub async fn delete_worktree(
    repo_path: String,
    worktree_path: String,
    force: bool,
) -> Result<WorktreeResult, String> {
    git_service::delete_worktree(&repo_path, &worktree_path, force).map_err(|e| e.to_string())
}

/// 清理已删除的 Worktree 引用
#[command]
pub async fn prune_worktrees(repo_path: String) -> Result<(), String> {
    git_service::prune_worktrees(&repo_path).map_err(|e| e.to_string())
}

/// 在终端中打开
#[command]
pub async fn open_in_terminal(worktree_path: String) -> Result<(), String> {
    git_service::open_in_terminal(&worktree_path).map_err(|e| e.to_string())
}

/// 在编辑器中打开
#[command]
pub async fn open_in_editor(worktree_path: String, editor: Option<String>) -> Result<(), String> {
    git_service::open_in_editor(&worktree_path, editor).map_err(|e| e.to_string())
}

/// 检查是否为 Git 仓库
#[command]
pub async fn is_git_repo(path: String) -> Result<bool, String> {
    git_service::is_git_repo(&path).map_err(|e| e.to_string())
}

/// 获取分支列表
#[command]
pub async fn list_branches(repo_path: String) -> Result<crate::models::BranchListResponse, String> {
    git_service::list_branches(&repo_path).map_err(|e| e.to_string())
}