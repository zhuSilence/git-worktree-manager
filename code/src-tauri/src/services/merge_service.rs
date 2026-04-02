use git2::Repository;
use log::{error, info};
use std::process::Command;

use crate::models::{ConflictFile, MergeParams, MergeResult, MergeStatus};
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
                target_branch: target_branch_name,
            });
        }
    };

    // 5. 检查是否有未提交的更改
    if let Ok(status) = get_worktree_status(&target_repo) {
        use crate::models::WorktreeStatus;
        if status == WorktreeStatus::Dirty || status == WorktreeStatus::Conflicted {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: "目标 worktree 有未提交的更改，请先提交或暂存".to_string(),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name,
            });
        }
    }

    // 6. 执行合并
    let mut merge_opts = git2::MergeOptions::new();
    let mut merge_index = match target_repo.merge_commits(
        &target_commit,
        &source_commit,
        Some(&merge_opts),
    ) {
        Ok(index) => index,
        Err(e) => {
            return Ok(MergeResult {
                success: false,
                status: MergeStatus::Failed,
                message: format!("合并失败: {}", e),
                commit_id: None,
                conflicts: vec![],
                target_branch: target_branch_name,
            });
        }
    };

    // 7. 检查是否有冲突
    if merge_index.has_conflicts() {
        // 写入 index 以保留冲突状态
        let _ = target_repo.set_index(&mut merge_index);

        let conflicts = extract_conflicts(&merge_index).unwrap_or_default();
        let conflict_paths: Vec<String> =
            conflicts.iter().map(|c| c.path.clone()).collect();

        info!("[merge] Conflicts detected: {:?}", conflict_paths);

        return Ok(MergeResult {
            success: false,
            status: MergeStatus::HasConflicts,
            message: format!("合并存在 {} 个冲突文件，请手动解决", conflicts.len()),
            commit_id: None,
            conflicts,
            target_branch: target_branch_name,
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
                target_branch: target_branch_name,
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
                target_branch: target_branch_name,
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
                        target_branch: target_branch_name,
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
        &format!("Merge branch '{}' into {}", params.source_branch, target_branch_name),
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
                target_branch: target_branch_name,
            });
        }
    };

    info!(
        "[merge] Successfully merged into commit {}",
        commit_id.to_string()
    );

    // 9. 可选：推送
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
                    target_branch: target_branch_name,
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
            target_branch: target_branch_name,
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
    let commit_msg = message.unwrap_or_else(|| {
        format!("Merge branch into {}", target_branch_name)
    });

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

    info!(
        "[merge] Merge completed successfully: {}",
        commit_id.to_string()
    );

    Ok(MergeResult {
        success: true,
        status: MergeStatus::Completed,
        message: "合并完成".to_string(),
        commit_id: Some(commit_id.to_string()),
        conflicts: vec![],
        target_branch: target_branch_name,
    })
}

/// 获取 git 配置值
fn get_git_config(repo: &Repository, key: &str) -> Option<String> {
    repo.config()
        .ok()?
        .get_string(key)
        .ok()
}
