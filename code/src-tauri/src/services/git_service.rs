use crate::models::{
    Branch, BranchListResponse, FetchResult, RemoteBranch, RemoteBranchListResponse,
    RepositoryInfo, SwitchBranchResult,
};
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
    let current_branch = repo
        .head()
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
pub fn create_and_switch_branch(
    worktree_path: &str,
    branch_name: &str,
    base_branch: Option<&str>,
) -> anyhow::Result<SwitchBranchResult> {
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
pub fn fetch_and_checkout(
    repo_path: &str,
    remote_branch: &str,
    local_branch: Option<&str>,
) -> anyhow::Result<SwitchBranchResult> {
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
        .args([
            "checkout",
            "-b",
            local,
            &format!("origin/{}", remote_branch),
        ])
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

/// Fetch 所有远程分支
pub fn fetch_all(repo_path: &str) -> anyhow::Result<FetchResult> {
    // 先获取当前远程列表
    let remote_list_output = Command::new("git")
        .args(["remote"])
        .current_dir(repo_path)
        .output()?;

    let remotes: Vec<String> = if remote_list_output.status.success() {
        String::from_utf8_lossy(&remote_list_output.stdout)
            .lines()
            .filter(|l| !l.is_empty())
            .map(String::from)
            .collect()
    } else {
        vec!["origin".to_string()]
    };

    // 执行 git fetch --all
    let output = Command::new("git")
        .args(["fetch", "--all"])
        .current_dir(repo_path)
        .output()?;

    if !output.status.success() {
        return Ok(FetchResult {
            success: false,
            message: String::from_utf8_lossy(&output.stderr).to_string(),
            updated_remotes: vec![],
        });
    }

    Ok(FetchResult {
        success: true,
        message: "Successfully fetched all remotes".to_string(),
        updated_remotes: remotes,
    })
}

/// 获取远程分支列表
pub fn list_remote_branches(repo_path: &str) -> anyhow::Result<RemoteBranchListResponse> {
    let repo = Repository::open(repo_path)?;

    let mut remote_branches = Vec::new();
    let mut remotes = Vec::new();

    // 获取所有远程名
    let remote_names = repo.remotes()?;
    for remote_name in remote_names.iter().flatten() {
        remotes.push(remote_name.to_string());
    }

    // 获取所有远程分支引用
    let branches = repo.branches(Some(git2::BranchType::Remote))?;

    for branch_result in branches {
        if let Ok((branch, _)) = branch_result {
            if let Some(full_name) = branch.name()? {
                // 跳过 HEAD 引用
                if full_name.ends_with("/HEAD") {
                    continue;
                }

                // 解析远程名和分支名
                // 格式: refs/remotes/remote/branch/name 或 refs/heads/branch
                let (remote, name) = if full_name.starts_with("refs/remotes/") {
                    // 远程分支: refs/remotes/origin/feature/test
                    // 提取 remote_name 和 branch_name
                    let without_prefix = full_name.trim_start_matches("refs/remotes/");
                    if let Some(pos) = without_prefix.find('/') {
                        let remote = without_prefix[..pos].to_string();
                        let branch_name = without_prefix[pos + 1..].to_string();
                        (remote, branch_name)
                    } else {
                        ("".to_string(), full_name.to_string())
                    }
                } else if full_name.starts_with("refs/heads/") {
                    // 本地分支
                    let name = full_name.trim_start_matches("refs/heads/").to_string();
                    ("".to_string(), name)
                } else {
                    ("".to_string(), full_name.to_string())
                };

                // 获取最后提交信息
                let reference = branch.get();
                let (last_commit, last_commit_date) = if let Ok(commit) = reference.peel_to_commit()
                {
                    let hash = commit.id().to_string();
                    let short_hash = &hash[..7.min(hash.len())];
                    let time = commit.time();
                    let datetime = chrono::DateTime::from_timestamp(time.seconds(), 0)
                        .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string());
                    (Some(short_hash.to_string()), datetime)
                } else {
                    (None, None)
                };

                remote_branches.push(RemoteBranch {
                    name,
                    remote,
                    full_name: full_name.to_string(),
                    last_commit,
                    last_commit_date,
                });
            }
        }
    }

    // 按名称排序
    remote_branches.sort_by(|a, b| a.full_name.cmp(&b.full_name));

    Ok(RemoteBranchListResponse {
        remote_branches,
        remotes,
    })
}
