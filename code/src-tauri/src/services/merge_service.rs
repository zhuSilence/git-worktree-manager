use git2::Repository;
use log::{error, info};
use std::process::Command;

use crate::models::{
    AutoHandleResult, AutoHandleUncommitted, ConflictFile, MergeConflictCheckResult, MergeParams,
    MergeResult, MergeStatus,
};
use crate::services::backup_service::{pop_stash, quick_stash};
use crate::services::worktree_service::get_worktree_status;

/// 在目标 worktree 中合并源分支
pub fn merge_branch_in_worktree(params: &MergeParams) -> anyhow::Result<MergeResult> {
    info!(
        "[merge] Starting merge of '{}' into '{}'",
        params.source_branch, params.target_worktree_path
    );

    // 1. 打开目标仓库
    let target_repo = Repository::open(&params.target_worktree_path)?;

    // 2. 获取当前分支名
    let target_branch_name = target_repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());

    // 3. 获取目标分支的当前提交
    let target_commit = target_repo.head()?.peel_to_commit()?;

    // 4. 查找源分支（本地或远程）
    let source_commit = match find_source_commit(&target_repo, &params.source_branch) {
        Ok(commit) => commit,
        Err(e) => {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: format!("找不到源分支 '{}': {}", params.source_branch, e),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name.clone(),
                auto_handle_result: None,
            });
        }
    };

    // 5. 检查是否有未提交的更改并自动处理
    let mut auto_handle_result: Option<AutoHandleResult> = None;

    if let Ok(status) = get_worktree_status(&target_repo) {
        use crate::models::WorktreeStatus;
        if status == WorktreeStatus::Dirty || status == WorktreeStatus::Conflicted {
            match &params.auto_handle_uncommitted {
                None => {
                    // 无处理策略，返回状态让前端展示选项
                    return Ok(MergeResult {
                        success: false,
                        status: MergeStatus::HasUncommittedChanges,
                        message: "目标 worktree 有未提交的更改".to_string(),
                        commit_id: None,
                        conflicts: vec![],
                        target_branch: target_branch_name.clone(),
                        auto_handle_result: None,
                    });
                }
                Some(AutoHandleUncommitted::Stash) => {
                    // 暂存变更
                    let marker = format!("merge-autostash-{}", chrono::Utc::now().timestamp());
                    let stash_ref =
                        quick_stash(&params.target_worktree_path, &marker).map_err(|e| {
                            anyhow::anyhow!("暂存变更失败: {}", e)
                        })?;

                    if stash_ref != "no-stash" {
                        info!(
                            "[merge] Stashed uncommitted changes at {}",
                            stash_ref
                        );
                        auto_handle_result = Some(AutoHandleResult {
                            strategy: AutoHandleUncommitted::Stash,
                            stash_ref: Some(stash_ref.clone()),
                            temp_commit_id: None,
                            stash_popped: None,
                        });
                    } else {
                        // 实际上没有变更可暂存
                        auto_handle_result = Some(AutoHandleResult {
                            strategy: AutoHandleUncommitted::Stash,
                            stash_ref: None,
                            temp_commit_id: None,
                            stash_popped: Some(true),
                        });
                    }
                }
                Some(AutoHandleUncommitted::Commit) => {
                    // 创建临时提交
                    let temp_commit_id = create_temp_commit(&target_repo)?;
                    info!(
                        "[merge] Created temporary commit: {}",
                        temp_commit_id
                    );
                    auto_handle_result = Some(AutoHandleResult {
                        strategy: AutoHandleUncommitted::Commit,
                        stash_ref: None,
                        temp_commit_id: Some(temp_commit_id),
                        stash_popped: None,
                    });
                }
            }
        }
    }

    // 6. 执行合并
    let merge_opts = git2::MergeOptions::new();
    let mut merge_index =
        match target_repo.merge_commits(&target_commit, &source_commit, Some(&merge_opts)) {
            Ok(index) => index,
            Err(e) => {
                return Ok(MergeResult {
                    success: false,
                    status: MergeStatus::Failed,
                    message: format!("合并失败: {}", e),
                    commit_id: None,
                    conflicts: vec![],
                    target_branch: target_branch_name.clone(),
                    auto_handle_result,
                });
            }
        };

    // 7. 检查是否有冲突
    if merge_index.has_conflicts() {
        // 写入 index 以保留冲突状态
        let _ = target_repo.set_index(&mut merge_index);

        let conflicts = extract_conflicts(&merge_index).unwrap_or_default();
        let conflict_paths: Vec<String> = conflicts.iter().map(|c| c.path.clone()).collect();

        info!("[merge] Conflicts detected: {:?}", conflict_paths);

        return Ok(MergeResult {
            success: false,
            status: MergeStatus::HasConflicts,
            message: format!("合并存在 {} 个冲突文件，请手动解决", conflicts.len()),
            commit_id: None,
            conflicts,
            target_branch: target_branch_name.clone(),
            auto_handle_result,
        });
    }

    // 8. 无冲突，完成合并提交
    let tree_id = match merge_index.write_tree_to(&target_repo) {
        Ok(id) => id,
        Err(e) => {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: format!("写入合并树失败: {}", e),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name.clone(),
                auto_handle_result,
            });
        }
    };

    let tree_obj = match target_repo.find_tree(tree_id) {
        Ok(tree) => tree,
        Err(e) => {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: format!("查找合并树失败: {}", e),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name.clone(),
                auto_handle_result,
            });
        }
    };

    let sig = match target_repo.signature() {
        Ok(sig) => sig,
        Err(_) => {
            // 如果仓库没有配置 user.name/user.email，使用系统 git config 或默认值
            let name = get_git_config(&target_repo, "user.name")
                .or_else(|| std::env::var("GIT_AUTHOR_NAME").ok())
                .unwrap_or_else(|| "Git Worktree Manager".to_string());

            let email = get_git_config(&target_repo, "user.email")
                .or_else(|| std::env::var("GIT_AUTHOR_EMAIL").ok())
                .unwrap_or_else(|| "git@worktree.manager".to_string());

            match git2::Signature::now(&name, &email) {
                Ok(sig) => sig,
                Err(e) => {
                    return Ok(MergeResult {
                        success: false,
                        status: MergeStatus::Failed,
                        message: format!("创建签名失败: {}", e),
                        commit_id: None,
                        conflicts: vec![],
                        target_branch: target_branch_name.clone(),
                        auto_handle_result,
                    });
                }
            }
        }
    };

    // 创建合并提交
    let commit_id = match target_repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &format!(
            "Merge branch '{}' into {}",
            params.source_branch, target_branch_name
        ),
        &tree_obj,
        &[&target_commit, &source_commit],
    ) {
        Ok(id) => id,
        Err(e) => {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: format!("创建合并提交失败: {}", e),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name.clone(),
                auto_handle_result,
            });
        }
    };

    info!("[merge] Successfully merged into commit {}", commit_id);

    // 9. 如果是 stash 策略，尝试恢复暂存
    if let Some(ref mut result) = auto_handle_result {
        if result.strategy == AutoHandleUncommitted::Stash {
            if let Some(ref stash_ref) = result.stash_ref {
                match pop_stash(&params.target_worktree_path, stash_ref) {
                    Ok(popped) => {
                        result.stash_popped = Some(popped);
                        if popped {
                            info!("[merge] Stash {} restored after merge", stash_ref);
                        } else {
                            error!("[merge] Failed to pop stash {} after merge", stash_ref);
                        }
                    }
                    Err(e) => {
                        error!("[merge] Failed to pop stash: {}", e);
                        result.stash_popped = Some(false);
                    }
                }
            }
        }
    }

    // 10. 可选：推送
    if params.auto_push {
        info!("[merge] Auto-pushing to remote...");
        match push_branch(&params.target_worktree_path, &target_branch_name) {
            Ok(_) => info!("[merge] Push successful"),
            Err(e) => {
                error!("[merge] Push failed: {}", e);
                return Ok(MergeResult {
                    success: true, // 本地合并成功
                    status: MergeStatus::Completed,
                    message: format!("合并成功但推送失败: {}", e),
                    commit_id: Some(commit_id.to_string()),
                    conflicts: vec![],
                    target_branch: target_branch_name.clone(),
                    auto_handle_result,
                });
            }
        }
    }

    Ok(MergeResult {
        success: true,
        status: MergeStatus::Completed,
        message: format!(
            "成功合并 '{}' 到 '{}'",
            params.source_branch, target_branch_name
        ),
        commit_id: Some(commit_id.to_string()),
        conflicts: vec![],
        target_branch: target_branch_name,
        auto_handle_result,
    })
}

/// 查找源分支的提交（本地或远程）
fn find_source_commit<'a>(
    repo: &'a Repository,
    branch_name: &str,
) -> anyhow::Result<git2::Commit<'a>> {
    // 先尝试本地分支
    if let Ok(branch) = repo.find_branch(branch_name, git2::BranchType::Local) {
        return Ok(branch.get().peel_to_commit()?);
    }

    // 再尝试远程分支 origin/xxx
    let remote_branch = format!("origin/{}", branch_name);
    if let Ok(branch) = repo.find_branch(&remote_branch, git2::BranchType::Remote) {
        return Ok(branch.get().peel_to_commit()?);
    }

    Err(anyhow::anyhow!(
        "找不到分支 '{}'（本地或远程）",
        branch_name
    ))
}

/// 提取冲突文件列表
fn extract_conflicts(index: &git2::Index) -> anyhow::Result<Vec<ConflictFile>> {
    let mut conflicts = Vec::new();

    for conflict in index.conflicts()? {
        let conflict = conflict?;
        let path = conflict
            .our
            .as_ref()
            .map(|e| String::from_utf8_lossy(&e.path).to_string())
            .or_else(|| {
                conflict
                    .their
                    .as_ref()
                    .map(|e| String::from_utf8_lossy(&e.path).to_string())
            })
            .unwrap_or_default();

        conflicts.push(ConflictFile {
            path,
            our_oid: conflict.our.map(|e| e.id.to_string()),
            their_oid: conflict.their.map(|e| e.id.to_string()),
        });
    }

    Ok(conflicts)
}

/// 推送分支到远程
fn push_branch(worktree_path: &str, branch_name: &str) -> anyhow::Result<()> {
    let output = Command::new("git")
        .args(["push", "origin", branch_name])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Err(anyhow::anyhow!(
            "推送失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// 中止合并（git merge --abort）
pub fn abort_merge(worktree_path: &str) -> anyhow::Result<bool> {
    info!("[merge] Aborting merge in {}", worktree_path);

    let output = Command::new("git")
        .args(["merge", "--abort"])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        info!("[merge] Merge aborted successfully");
        Ok(true)
    } else {
        error!(
            "[merge] Failed to abort merge: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        Ok(false)
    }
}

/// 完成合并（冲突解决后提交）
pub fn complete_merge(worktree_path: &str, message: Option<String>) -> anyhow::Result<MergeResult> {
    info!("[merge] Completing merge in {}", worktree_path);

    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let target_branch_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD".to_string());

    // 获取 index
    let mut index = repo.index()?;

    // 检查是否还有冲突
    if index.has_conflicts() {
        return Ok(MergeResult {
            success: false,
            status: MergeStatus::HasConflicts,
            message: "仍存在冲突文件，请先解决所有冲突".to_string(),
            commit_id: None,
            conflicts: extract_conflicts(&index).unwrap_or_default(),
            target_branch: target_branch_name.clone(),
            auto_handle_result: None,
        });
    }

    // 写入 tree
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    // 获取 HEAD 提交
    let head = repo.head()?;
    let parent_commit = head.peel_to_commit()?;

    // 获取合并的父提交（从 MERGE_HEAD）
    let merge_head_path = repo.path().join("MERGE_HEAD");
    let merge_head_content = std::fs::read_to_string(&merge_head_path)
        .map_err(|e| anyhow::anyhow!("读取 MERGE_HEAD 失败: {}", e))?;
    let merge_head_oid = merge_head_content.trim();
    let merge_commit = repo.find_commit(git2::Oid::from_str(merge_head_oid)?)?;

    // 提交消息
    let commit_msg = message.unwrap_or_else(|| format!("Merge branch into {}", target_branch_name));

    let sig = match repo.signature() {
        Ok(sig) => sig,
        Err(_) => {
            // 如果仓库没有配置 user.name/user.email，使用系统 git config 或默认值
            let name = get_git_config(&repo, "user.name")
                .or_else(|| std::env::var("GIT_AUTHOR_NAME").ok())
                .unwrap_or_else(|| "Git Worktree Manager".to_string());

            let email = get_git_config(&repo, "user.email")
                .or_else(|| std::env::var("GIT_AUTHOR_EMAIL").ok())
                .unwrap_or_else(|| "git@worktree.manager".to_string());

            git2::Signature::now(&name, &email)
                .map_err(|e| anyhow::anyhow!("创建签名失败: {}", e))?
        }
    };

    let commit_id = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &commit_msg,
        &tree,
        &[&parent_commit, &merge_commit],
    )?;

    // 清理 MERGE_* 文件
    let _ = std::fs::remove_file(merge_head_path);
    let _ = std::fs::remove_file(repo.path().join("MERGE_MSG"));
    let _ = std::fs::remove_file(repo.path().join("MERGE_MODE"));

    info!("[merge] Merge completed successfully: {}", commit_id);

    Ok(MergeResult {
        success: true,
        status: MergeStatus::Completed,
        message: "合并完成".to_string(),
        commit_id: Some(commit_id.to_string()),
        conflicts: vec![],
        target_branch: target_branch_name,
        auto_handle_result: None,
    })
}

/// 获取 git 配置值
fn get_git_config(repo: &Repository, key: &str) -> Option<String> {
    repo.config().ok()?.get_string(key).ok()
}

/// 创建临时提交（将所有未提交变更提交到 HEAD）
fn create_temp_commit(repo: &Repository) -> anyhow::Result<String> {
    let mut index = repo.index()?;
    index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;
    let head = repo.head()?.peel_to_commit()?;

    let sig = match repo.signature() {
        Ok(sig) => sig,
        Err(_) => {
            let name = get_git_config(repo, "user.name")
                .or_else(|| std::env::var("GIT_AUTHOR_NAME").ok())
                .unwrap_or_else(|| "Git Worktree Manager".to_string());
            let email = get_git_config(repo, "user.email")
                .or_else(|| std::env::var("GIT_AUTHOR_EMAIL").ok())
                .unwrap_or_else(|| "git@worktree.manager".to_string());
            git2::Signature::now(&name, &email)?
        }
    };

    let commit_id = repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        "WIP: temporary commit before merge",
        &tree,
        &[&head],
    )?;

    Ok(commit_id.to_string())
}

/// 预检测合并是否会产生冲突（不实际执行合并）
pub fn check_merge_conflicts(
    worktree_path: &str,
    main_repo_path: &str,
    source_branch: &str,
) -> anyhow::Result<MergeConflictCheckResult> {
    info!(
        "[merge] Pre-checking conflicts for merging '{}' into '{}'",
        source_branch, worktree_path
    );

    let repo = Repository::open(worktree_path)?;
    let target_commit = repo.head()?.peel_to_commit()?;

    // 打开主仓库（用于查找源分支）
    let main_repo = Repository::open(main_repo_path)?;

    // 先在 worktree repo 中查找源分支，如果找不到则从主仓库查找
    let source_commit = find_source_commit(&repo, source_branch)
        .or_else(|_| find_source_commit(&main_repo, source_branch))
        .map_err(|e| anyhow::anyhow!("找不到源分支 '{}': {}", source_branch, e))?;

    let merge_opts = git2::MergeOptions::new();
    let merge_index = repo.merge_commits(&target_commit, &source_commit, Some(&merge_opts))?;

    if merge_index.has_conflicts() {
        let conflicts = extract_conflicts(&merge_index).unwrap_or_default();
        Ok(MergeConflictCheckResult {
            has_conflicts: true,
            conflict_files: conflicts,
        })
    } else {
        Ok(MergeConflictCheckResult {
            has_conflicts: false,
            conflict_files: vec![],
        })
    }
}
