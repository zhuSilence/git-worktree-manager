use crate::models::{CreateWorktreeParams, Worktree, WorktreeListResponse, WorktreeResult, WorktreeStatus, Branch, BranchListResponse, LastCommit};
use crate::utils::validation::{sanitize_branch_name, validate_path};
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
    let last_commit = get_last_commit(&commit)?;
    
    Ok(Worktree {
        id: commit.id().to_string(),
        name: branch.clone(),
        branch,
        path: path.to_string_lossy().to_string(),
        status,
        last_commit,
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
    let last_commit = get_last_commit(&commit)?;
    
    Ok(Some(Worktree {
        id: commit.id().to_string(),
        name: name.to_string(),
        branch,
        path,
        status,
        last_commit,
        last_active_at: None,
        is_main: false,
        remote: None,
    }))
}

/// 获取最后提交信息
fn get_last_commit(commit: &git2::Commit) -> anyhow::Result<LastCommit> {
    let time = commit.time();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    
    let relative_time = format_relative_time(now, time.seconds());
    
    Ok(LastCommit {
        hash: commit.id().to_string()[..7.min(commit.id().to_string().len())].to_string(),
        message: commit.summary()
            .unwrap_or("No message")
            .to_string(),
        author: commit.author().name()
            .unwrap_or("Unknown")
            .to_string(),
        relative_time,
    })
}

/// 格式化相对时间
fn format_relative_time(now: i64, commit_time: i64) -> String {
    let diff = now - commit_time;
    
    if diff < 0 {
        "in the future".to_string()
    } else if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        format!("{} 分钟前", diff / 60)
    } else if diff < 86400 {
        format!("{} 小时前", diff / 3600)
    } else if diff < 604800 {
        format!("{} 天前", diff / 86400)
    } else if diff < 2592000 {
        format!("{} 周前", diff / 604800)
    } else if diff < 31536000 {
        format!("{} 月前", diff / 2592000)
    } else {
        format!("{} 年前", diff / 31536000)
    }
}

/// 获取 worktree 状态
fn get_worktree_status(repo: &Repository) -> anyhow::Result<WorktreeStatus> {
    // 检查是否为 detached HEAD 状态
    if repo.head_detached()? {
        return Ok(WorktreeStatus::Detached);
    }
    
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
    // 验证分支名
    let branch_name = sanitize_branch_name(&params.name)
        .map_err(|e| anyhow::anyhow!("Invalid branch name: {}", e))?;
    
    // 如果提供了新分支名，也要验证
    if let Some(ref new_branch) = params.new_branch {
        sanitize_branch_name(new_branch)
            .map_err(|e| anyhow::anyhow!("Invalid new branch name: {}", e))?;
    }
    
    // 验证 base_branch
    sanitize_branch_name(&params.base_branch)
        .map_err(|e| anyhow::anyhow!("Invalid base branch name: {}", e))?;
    
    // 确定目标路径
    let target_path = params.custom_path.clone().unwrap_or_else(|| {
        format!("{}/{}", repo_path, params.name)
    });
    
    // 验证路径
    let validated_path = validate_path(&target_path)
        .map_err(|e| anyhow::anyhow!("Invalid path: {}", e))?;
    
    // 检查路径是否存在
    if validated_path.exists() {
        return Ok(WorktreeResult {
            success: false,
            message: format!("Path already exists: {}", target_path),
            worktree: None,
        });
    }
    
    // 创建 worktree
    let branch_name = params.new_branch.clone().unwrap_or(branch_name);
    
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
pub fn open_in_terminal(path: &str, terminal: Option<String>) -> anyhow::Result<()> {
    let terminal_type = terminal.unwrap_or_else(|| "terminal".to_string());
    
    #[cfg(target_os = "macos")]
    {
        match terminal_type.as_str() {
            "iterm2" => {
                Command::new("open")
                    .args(["-a", "iTerm", path])
                    .spawn()?;
            }
            "warp" => {
                Command::new("open")
                    .args(["-a", "Warp", path])
                    .spawn()?;
            }
            _ => {
                // 默认 Terminal
                Command::new("open")
                    .args(["-a", "Terminal", path])
                    .spawn()?;
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        match terminal_type.as_str() {
            "powershell" => {
                Command::new("powershell")
                    .args(["-Command", &format!("Start-Process powershell -ArgumentList '-NoExit', '-Command', \"cd '{}'\"", path)])
                    .spawn()?;
            }
            "wt" => {
                Command::new("wt")
                    .args(["-d", path])
                    .spawn()?;
            }
            _ => {
                // 默认 CMD
                Command::new("cmd")
                    .args(["/C", "start", "cmd", "/K", &format!("cd {}", path)])
                    .spawn()?;
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        match terminal_type.as_str() {
            "alacritty" => {
                Command::new("alacritty")
                    .args(["--working-directory", path])
                    .spawn()?;
            }
            _ => {
                // 默认 gnome-terminal
                Command::new("gnome-terminal")
                    .args(["--working-directory", path])
                    .spawn()?;
            }
        }
    }
    
    Ok(())
}

/// 在编辑器中打开
pub fn open_in_editor(path: &str, editor: Option<String>) -> anyhow::Result<()> {
    let editor_cmd = editor.unwrap_or_else(|| "code".to_string());
    
    match editor_cmd.as_str() {
        "vscode" => {
            Command::new("code").arg(path).spawn()?;
        }
        "vscode-insiders" => {
            Command::new("code-insiders").arg(path).spawn()?;
        }
        "cursor" => {
            Command::new("cursor").arg(path).spawn()?;
        }
        "webstorm" => {
            Command::new("webstorm").arg(path).spawn()?;
        }
        "intellij" => {
            Command::new("idea").arg(path).spawn()?;
        }
        _ => {
            // 自定义编辑器命令
            Command::new(&editor_cmd).arg(path).spawn()?;
        }
    }
    
    Ok(())
}

/// 在文件管理器中打开
pub fn open_in_file_manager(path: &str) -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", path])
            .spawn()?;
    }
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", path])
            .spawn()?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()?;
    }
    
    Ok(())
}

/// 检查是否为 Git 仓库
pub fn is_git_repo(path: &str) -> anyhow::Result<bool> {
    let full_path = Path::new(path).join(".git");
    Ok(full_path.exists())
}

/// 获取分支列表
pub fn list_branches(repo_path: &str) -> anyhow::Result<BranchListResponse> {
    let repo = Repository::open(repo_path)?;
    
    let mut branches = Vec::new();
    let mut current_branch = String::new();
    
    // 获取当前分支
    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            current_branch = name.to_string();
        }
    }
    
    // 获取所有本地分支
    let local_branches = repo.branches(Some(git2::BranchType::Local))?;
    
    for branch_result in local_branches {
        if let Ok((branch, _)) = branch_result {
            if let Some(name) = branch.name()? {
                let is_current = name == current_branch;
                branches.push(Branch {
                    name: name.to_string(),
                    is_current,
                });
            }
        }
    }
    
    Ok(BranchListResponse {
        branches,
        current_branch,
    })
}