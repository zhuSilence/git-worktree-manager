use crate::models::{Branch, BranchListResponse, RepositoryInfo, SwitchBranchResult};
use crate::utils::validation::sanitize_branch_name;
use git2::Repository;
use std::path::Path;
use std::process::Command;

/// 检查是否为 Git 仓库
pub fn is_git_repo(path: &str) -> anyhow::Result<bool> {
    Ok(Repository::open(path).is_ok())
}

/// 获取仓库基本信息
pub fn get_repository_info(repo_path: &str) -> anyhow::Result<RepositoryInfo> {
    let repo = Repository::open(repo_path)?;

    // 获取仓库名称
    let name = Path::new(repo_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| repo_path.to_string());

    // 获取当前分支
    let current_branch = repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "unknown".to_string());

    // 获取 worktree 数量
    let worktrees = repo.worktrees()?;
    let worktree_count = worktrees.len() + 1; // +1 for main worktree

    Ok(RepositoryInfo {
        id: repo_path.to_string(),
        name,
        path: repo_path.to_string(),
        current_branch,
        worktree_count,
        last_active: None,
    })
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

/// 切换分支
pub fn switch_branch(worktree_path: &str, branch_name: &str) -> anyhow::Result<SwitchBranchResult> {
    // 验证分支名
    let branch = sanitize_branch_name(branch_name)
        .map_err(|e| anyhow::anyhow!("Invalid branch name: {}", e))?;

    // 使用 git checkout 命令
    let output = Command::new("git")
        .args(["checkout", &branch])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }

    Ok(SwitchBranchResult {
        success: true,
        message: format!("Switched to branch '{}'", branch),
    })
}

/// 创建并切换到新分支
pub fn create_and_switch_branch(worktree_path: &str, branch_name: &str, base_branch: Option<&str>) -> anyhow::Result<SwitchBranchResult> {
    // 验证分支名
    let branch = sanitize_branch_name(branch_name)
        .map_err(|e| anyhow::anyhow!("Invalid branch name: {}", e))?;

    let mut args = vec!["checkout", "-b", &branch];
    if let Some(base) = base_branch {
        args.push(base);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }

    Ok(SwitchBranchResult {
        success: true,
        message: format!("Created and switched to branch '{}'", branch),
    })
}

/// 拉取远程分支
pub fn fetch_and_checkout(repo_path: &str, remote_branch: &str, local_branch: Option<&str>) -> anyhow::Result<SwitchBranchResult> {
    // 先 fetch
    let fetch_output = Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output()?;

    if !fetch_output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: "Failed to fetch from remote".to_string(),
        });
    }

    // checkout 远程分支
    let local = local_branch.unwrap_or(remote_branch);
    let checkout_output = Command::new("git")
        .args(["checkout", "-b", local, &format!("origin/{}", remote_branch)])
        .current_dir(repo_path)
        .output()?;

    if !checkout_output.status.success() {
        // 尝试直接 checkout
        let retry_output = Command::new("git")
            .args(["checkout", remote_branch])
            .current_dir(repo_path)
            .output()?;

        if !retry_output.status.success() {
            return Ok(SwitchBranchResult {
                success: false,
                message: String::from_utf8_lossy(&retry_output.stderr).to_string(),
            });
        }
    }

    Ok(SwitchBranchResult {
        success: true,
        message: format!("Checked out remote branch '{}'", remote_branch),
    })
}

/// Push 本地提交到远程
pub fn push(worktree_path: &str, branch: Option<&str>) -> anyhow::Result<SwitchBranchResult> {
    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let branch_name = match branch {
        Some(b) => b.to_string(),
        None => {
            let head = repo.head()?;
            head.shorthand().map(String::from).unwrap_or_default()
        }
    };

    if branch_name.is_empty() {
        return Ok(SwitchBranchResult {
            success: false,
            message: "Cannot determine branch name".to_string(),
        });
    }

    // 检查是否有远程
    let remote_ref = format!("refs/remotes/origin/{}", branch_name);
    if repo.find_reference(&remote_ref).is_err() {
        // 没有远程分支，尝试 push -u origin branch
        let output = Command::new("git")
            .args(["push", "-u", "origin", &branch_name])
            .current_dir(worktree_path)
            .output()?;

        if !output.status.success() {
            return Ok(SwitchBranchResult {
                success: false,
                message: String::from_utf8_lossy(&output.stderr).to_string(),
            });
        }

        return Ok(SwitchBranchResult {
            success: true,
            message: format!("Pushed and set upstream for '{}'", branch_name),
        });
    }

    // 有远程分支，直接 push
    let output = Command::new("git")
        .args(["push", "origin", &branch_name])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }

    Ok(SwitchBranchResult {
        success: true,
        message: format!("Pushed '{}' to origin", branch_name),
    })
}

/// Pull 远程提交到本地
pub fn pull(worktree_path: &str, branch: Option<&str>) -> anyhow::Result<SwitchBranchResult> {
    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let branch_name = match branch {
        Some(b) => b.to_string(),
        None => {
            let head = repo.head()?;
            head.shorthand().map(String::from).unwrap_or_default()
        }
    };

    if branch_name.is_empty() {
        return Ok(SwitchBranchResult {
            success: false,
            message: "Cannot determine branch name".to_string(),
        });
    }

    // 先 fetch
    let fetch_output = Command::new("git")
        .args(["fetch", "origin", &branch_name])
        .current_dir(worktree_path)
        .output()?;

    if !fetch_output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: String::from_utf8_lossy(&fetch_output.stderr).to_string(),
        });
    }

    // 检查是否有远程分支
    let remote_ref = format!("refs/remotes/origin/{}", branch_name);
    if repo.find_reference(&remote_ref).is_err() {
        return Ok(SwitchBranchResult {
            success: false,
            message: format!("No remote branch found for '{}'", branch_name),
        });
    }

    // 执行 pull (rebase 模式更安全)
    let output = Command::new("git")
        .args(["pull", "--rebase", "origin", &branch_name])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Ok(SwitchBranchResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }

    Ok(SwitchBranchResult {
        success: true,
        message: format!("Pulled latest changes for '{}'", branch_name),
    })
}
