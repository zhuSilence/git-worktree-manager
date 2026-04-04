use crate::models::{
    BatchDeleteResult, CreateWorktreeParams, LastCommit, SyncStatus, Worktree, WorktreeHint,
    WorktreeListResponse, WorktreeResult, WorktreeStatus,
};
use crate::utils::validation::{sanitize_branch_name, validate_path};
use git2::Repository;
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
    let sync_status = get_sync_status(repo, &branch)?;

    Ok(Worktree {
        id: path.to_string_lossy().to_string(), // 使用路径作为唯一标识符
        name: branch.clone(),
        branch,
        path: path.to_string_lossy().to_string(),
        status,
        last_commit,
        last_active_at: None,
        is_main: true,
        remote: None,
        sync_status,
    })
}

/// 获取链接 worktree 信息
fn get_linked_worktree(repo: &Repository, name: &str) -> anyhow::Result<Option<Worktree>> {
    let wt = repo.find_worktree(name)?;
    let path = wt.path().to_string_lossy().to_string();

    // 打开 worktree 的仓库
    let wt_repo = Repository::open(&path)?;
    let head = wt_repo.head()?;
    let branch = head
        .shorthand()
        .map(String::from)
        .unwrap_or_else(|| name.to_string());
    let commit = head.peel_to_commit()?;
    let status = get_worktree_status(&wt_repo)?;
    let last_commit = get_last_commit(&commit)?;
    let sync_status = get_sync_status(&wt_repo, &branch)?;

    Ok(Some(Worktree {
        id: path.clone(), // 使用路径作为唯一标识符
        name: name.to_string(),
        branch,
        path,
        status,
        last_commit,
        last_active_at: None,
        is_main: false,
        remote: None,
        sync_status,
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
        message: commit.summary().unwrap_or("No message").to_string(),
        author: commit.author().name().unwrap_or("Unknown").to_string(),
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

/// 获取 worktree 与远程分支的同步状态
fn get_sync_status(repo: &Repository, branch_name: &str) -> anyhow::Result<SyncStatus> {
    // 获取本地分支的 HEAD
    let head = repo.head()?;
    let local_commit = head.peel_to_commit()?;

    // 查找远程分支
    let remote_branch_name = format!("origin/{}", branch_name);
    let remote_ref_name = format!("refs/remotes/{}", remote_branch_name);

    match repo.find_reference(&remote_ref_name) {
        Ok(remote_ref) => {
            let remote_commit = remote_ref.peel_to_commit()?;

            // 计算 ahead/behind
            let (ahead, behind) = repo.graph_ahead_behind(local_commit.id(), remote_commit.id())?;

            Ok(SyncStatus {
                ahead,
                behind,
                has_remote: true,
            })
        }
        Err(_) => {
            // 没有远程分支
            Ok(SyncStatus {
                ahead: 0,
                behind: 0,
                has_remote: false,
            })
        }
    }
}

/// 获取 worktree 状态
pub fn get_worktree_status(repo: &Repository) -> anyhow::Result<WorktreeStatus> {
    // 检查是否为 detached HEAD 状态
    if repo.head_detached()? {
        return Ok(WorktreeStatus::Detached);
    }

    let statuses = repo.statuses(None)?;

    // 检查冲突
    let has_conflicts = statuses
        .iter()
        .any(|s| s.status().contains(git2::Status::CONFLICTED));

    if has_conflicts {
        return Ok(WorktreeStatus::Conflicted);
    }

    // 检查是否有更改
    let has_changes = statuses
        .iter()
        .any(|s| !s.status().is_empty() && !s.status().contains(git2::Status::IGNORED));

    if has_changes {
        return Ok(WorktreeStatus::Dirty);
    }

    // 检查是否有未推送的提交
    if let Ok(head) = repo.head() {
        if let Some(branch_name) = head.shorthand() {
            let upstream_name = format!("origin/{}", branch_name);
            if let Ok(upstream_ref) =
                repo.find_reference(&format!("refs/remotes/{}", upstream_name))
            {
                if let (Ok(local_commit), Ok(upstream_commit)) =
                    (head.peel_to_commit(), upstream_ref.peel_to_commit())
                {
                    if local_commit.id() != upstream_commit.id() {
                        // 检查本地是否领先远程
                        if let Ok((ahead, _)) =
                            repo.graph_ahead_behind(local_commit.id(), upstream_commit.id())
                        {
                            if ahead > 0 {
                                return Ok(WorktreeStatus::Unpushed);
                            }
                        }
                    }
                }
            }
        }
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
    let target_path = params
        .custom_path
        .clone()
        .unwrap_or_else(|| format!("{}/{}", repo_path, params.name));

    // 验证路径
    let _validated_path =
        validate_path(&target_path).map_err(|e| anyhow::anyhow!("Invalid path: {}", e))?;

    // 创建 worktree（依赖 git worktree add 命令自身的错误返回来判断路径是否存在）
    let branch_name = params.new_branch.clone().unwrap_or(branch_name);

    // 使用 git worktree add 命令（更可靠）
    let output = Command::new("git")
        .args([
            "worktree",
            "add",
            "-b",
            &branch_name,
            &target_path,
            &params.base_branch,
        ])
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
    let new_worktree = worktrees
        .worktrees
        .into_iter()
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
                message: "Worktree has uncommitted changes. Use force=true to delete anyway."
                    .to_string(),
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

/// 批量删除 worktree
pub fn batch_delete_worktrees(
    repo_path: &str,
    worktree_paths: Vec<String>,
    force: bool,
) -> anyhow::Result<BatchDeleteResult> {
    let mut success_count = 0;
    let mut failed_count = 0;
    let mut results = Vec::new();

    for path in worktree_paths {
        let result = delete_worktree(repo_path, &path, force).unwrap_or_else(|e| WorktreeResult {
            success: false,
            message: e.to_string(),
            worktree: None,
        });

        if result.success {
            success_count += 1;
        } else {
            failed_count += 1;
        }

        results.push(result);
    }

    Ok(BatchDeleteResult {
        success_count,
        failed_count,
        results,
    })
}

/// 获取已合并但未删除的 worktree 提示
pub fn get_merged_hints(repo_path: &str, main_branch: &str) -> anyhow::Result<Vec<WorktreeHint>> {
    let repo = Repository::open(repo_path)?;
    let mut hints = Vec::new();

    // 获取主分支的 commit
    let main_ref = format!("refs/heads/{}", main_branch);
    let main_commit = match repo.find_reference(&main_ref) {
        Ok(r) => r.peel_to_commit()?,
        Err(_) => return Ok(hints), // 主分支不存在，返回空
    };
    let main_commit_id = main_commit.id();

    // 检查每个 worktree
    let worktrees_response = list_worktrees(repo_path)?;
    for worktree in worktrees_response.worktrees {
        if worktree.is_main {
            continue;
        }

        // 打开 worktree 的仓库来获取实际的分支 commit 和工作区状态
        let (branch_commit_id, has_uncommitted_changes) = match Repository::open(&worktree.path) {
            Ok(wt_repo) => {
                // 获取分支 commit
                let commit_id = match wt_repo.head() {
                    Ok(head) => match head.peel_to_commit() {
                        Ok(commit) => commit.id(),
                        Err(_) => continue,
                    },
                    Err(_) => continue,
                };

                // 检查工作区是否有未提交的改动
                let has_changes = match wt_repo.statuses(None) {
                    Ok(statuses) => statuses.iter().any(|s| {
                        !s.status().is_empty() && !s.status().contains(git2::Status::IGNORED)
                    }),
                    Err(_) => false,
                };

                (commit_id, has_changes)
            }
            Err(_) => continue,
        };

        // 如果有未提交的改动，不显示"已合并"提示
        if has_uncommitted_changes {
            continue;
        }

        // 检查分支是否有自己的提交（相对于 main）
        // 如果分支 HEAD 和 main HEAD 相同，说明是新创建的分支，没有自己的提交
        if branch_commit_id == main_commit_id {
            continue;
        }

        // 检查是否已合并到主分支
        let is_merged = repo
            .merge_base(branch_commit_id, main_commit_id)
            .map(|base| base == branch_commit_id)
            .unwrap_or(false);

        if is_merged {
            hints.push(WorktreeHint {
                worktree_id: worktree.id.clone(),
                branch: worktree.branch.clone(),
                hint_type: "merged".to_string(),
                message: format!(
                    "分支 '{}' 已合并到 {}，可以删除",
                    worktree.branch, main_branch
                ),
                is_merged: true,
                inactive_days: None,
            });
        }
    }

    Ok(hints)
}

/// 获取陈旧 worktree 提示
pub fn get_stale_hints(repo_path: &str, days: i64) -> anyhow::Result<Vec<WorktreeHint>> {
    let _repo = Repository::open(repo_path)?;
    let mut hints = Vec::new();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    let threshold_seconds = days * 86400;

    // 检查每个 worktree
    let worktrees_response = list_worktrees(repo_path)?;
    for worktree in worktrees_response.worktrees {
        // 打开 worktree 的仓库获取最后提交时间
        if let Ok(wt_repo) = Repository::open(&worktree.path) {
            if let Ok(head) = wt_repo.head() {
                if let Ok(commit) = head.peel_to_commit() {
                    let commit_time = commit.time().seconds();
                    let inactive_seconds = now - commit_time;

                    if inactive_seconds > threshold_seconds {
                        let inactive_days = inactive_seconds / 86400;
                        hints.push(WorktreeHint {
                            worktree_id: worktree.id.clone(),
                            branch: worktree.branch.clone(),
                            hint_type: "stale".to_string(),
                            message: format!(
                                "分支 '{}' 已 {} 天未更新",
                                worktree.branch, inactive_days
                            ),
                            is_merged: false,
                            inactive_days: Some(inactive_days),
                        });
                    }
                }
            }
        }
    }

    Ok(hints)
}
