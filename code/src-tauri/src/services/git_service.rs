use crate::models::{CreateWorktreeParams, Worktree, WorktreeListResponse, WorktreeResult, WorktreeStatus};
use git2::Repository;
use std::path::Path;
use std::process::Command;

/// 获取 Worktree 列表
pub fn list_worktrees(repo_path: &str) -> anyhow::Result<WorktreeListResponse> {
    let repo = Repository::open(repo_path)?;
    
    let mut worktrees = Vec::new();
    
    // 主 worktree
    let main_worktree = get_main_worktree(&repo)?;
    worktrees.push(main_worktree);
    
    // 链接 worktrees
    let linked_worktrees = repo.worktrees()?;
    for name in linked_worktrees.iter().flatten() {
        if let Some(wt) = get_linked_worktree(&repo, name)? {
            worktrees.push(wt);
        }
    }
    
    Ok(WorktreeListResponse {
        worktrees,
        repo_path: repo_path.to_string(),
        is_valid_repo: true,
    })
}

/// 获取主 worktree 信息
fn get_main_worktree(repo: &Repository) -> anyhow::Result<Worktree> {
    let path = repo
        .path()
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Invalid repository path"))?
        .to_path_buf();
    
    let head = repo.head()?;
    let branch = head.shorthand().map(String::from).unwrap_or_default();
    let commit = head.peel_to_commit()?;
    let status = get_worktree_status(repo)?;
    
    Ok(Worktree {
        id: commit.id().to_string(),
        name: branch.clone(),
        branch,
        path: path.to_string_lossy().to_string(),
        status,
        last_active_at: None,
        is_main: true,
        remote: None,
    })
}

/// 获取链接 worktree 信息
fn get_linked_worktree(repo: &Repository, name: &str) -> anyhow::Result<Option<Worktree>> {
    let wt = repo.find_worktree(name)?;
    let path = wt.path().to_string_lossy().to_string();
    
    // 打开 worktree 的仓库
    let wt_repo = Repository::open(&path)?;
    let head = wt_repo.head()?;
    let branch = head.shorthand().map(String::from).unwrap_or_else(|| name.to_string());
    let commit = head.peel_to_commit()?;
    let status = get_worktree_status(&wt_repo)?;
    
    Ok(Some(Worktree {
        id: commit.id().to_string(),
        name: name.to_string(),
        branch,
        path,
        status,
        last_active_at: None,
        is_main: false,
        remote: None,
    }))
}

/// 获取 worktree 状态
fn get_worktree_status(repo: &Repository) -> anyhow::Result<WorktreeStatus> {
    let statuses = repo.statuses(None)?;
    
    // 检查冲突
    let has_conflicts = statuses.iter().any(|s| {
        s.status().contains(git2::Status::CONFLICTED)
    });
    
    if has_conflicts {
        return Ok(WorktreeStatus::Conflicted);
    }
    
    // 检查是否有更改
    let has_changes = statuses.iter().any(|s| {
        !s.status().is_empty() && !s.status().contains(git2::Status::IGNORED)
    });
    
    if has_changes {
        return Ok(WorktreeStatus::Dirty);
    }
    
    Ok(WorktreeStatus::Clean)
}

/// 创建 Worktree
pub fn create_worktree(
    repo_path: &str,
    params: CreateWorktreeParams,
) -> anyhow::Result<WorktreeResult> {
    // 确定目标路径
    let target_path = params.custom_path.unwrap_or_else(|| {
        format!("{}/{}", repo_path, params.name)
    });
    
    // 检查路径是否存在
    if Path::new(&target_path).exists() {
        return Ok(WorktreeResult {
            success: false,
            message: format!("Path already exists: {}", target_path),
            worktree: None,
        });
    }
    
    // 创建 worktree
    let branch_name = params.new_branch.unwrap_or(params.name.clone());
    
    // 使用 git worktree add 命令（更可靠）
    let output = Command::new("git")
        .args(["worktree", "add", "-b", &branch_name, &target_path, &params.base_branch])
        .current_dir(repo_path)
        .output()?;
    
    if !output.status.success() {
        return Ok(WorktreeResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
            worktree: None,
        });
    }
    
    // 刷新并获取新 worktree
    let worktrees = list_worktrees(repo_path)?;
    let new_worktree = worktrees.worktrees.into_iter()
        .find(|w| w.path == target_path);
    
    Ok(WorktreeResult {
        success: true,
        message: format!("Worktree created at {}", target_path),
        worktree: new_worktree,
    })
}

/// 删除 Worktree
pub fn delete_worktree(
    repo_path: &str,
    worktree_path: &str,
    force: bool,
) -> anyhow::Result<WorktreeResult> {
    // 检查状态
    if !force {
        let repo = Repository::open(worktree_path)?;
        let status = get_worktree_status(&repo)?;
        
        if status != WorktreeStatus::Clean {
            return Ok(WorktreeResult {
                success: false,
                message: "Worktree has uncommitted changes. Use force=true to delete anyway.".to_string(),
                worktree: None,
            });
        }
    }
    
    // 使用 git worktree remove 命令
    let mut args = vec!["worktree", "remove", worktree_path];
    if force {
        args.push("--force");
    }
    
    let output = Command::new("git")
        .args(&args)
        .current_dir(repo_path)
        .output()?;
    
    if !output.status.success() {
        return Ok(WorktreeResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
            worktree: None,
        });
    }
    
    Ok(WorktreeResult {
        success: true,
        message: format!("Worktree deleted: {}", worktree_path),
        worktree: None,
    })
}

/// 清理已删除的 Worktree 引用
pub fn prune_worktrees(repo_path: &str) -> anyhow::Result<()> {
    let output = Command::new("git")
        .args(["worktree", "prune"])
        .current_dir(repo_path)
        .output()?;
    
    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "Failed to prune worktrees: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    
    Ok(())
}

/// 在终端中打开
pub fn open_in_terminal(path: &str) -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-a", "Terminal", path])
            .spawn()?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "cmd", "/K", &format!("cd {}", path)])
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("gnome-terminal")
            .args(["--working-directory", path])
            .spawn()?;
    }
    
    Ok(())
}

/// 在编辑器中打开
pub fn open_in_editor(path: &str, editor: Option<String>) -> anyhow::Result<()> {
    let editor_cmd = editor.unwrap_or_else(|| "code".to_string());
    
    Command::new(&editor_cmd)
        .arg(path)
        .spawn()?;
    
    Ok(())
}

/// 检查是否为 Git 仓库
pub fn is_git_repo(path: &str) -> anyhow::Result<bool> {
    let full_path = Path::new(path).join(".git");
    Ok(full_path.exists())
}