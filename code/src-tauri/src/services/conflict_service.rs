use crate::models::{
    ConflictDetectionResponse, ConflictPreviewRequest, ConflictPreviewResponse,
    ConflictWorktree, FileConflict, WorktreeFileDiff,
};
use crate::services::worktree_service::list_worktrees;
use git2::Repository;
use std::collections::HashMap;
use std::process::Command;

/// 检测 worktree 之间的冲突
pub fn detect_conflicts(repo_path: &str) -> anyhow::Result<ConflictDetectionResponse> {
    let repo = Repository::open(repo_path)?;
    let now = chrono::Utc::now().to_rfc3339();

    // 获取所有 worktree
    let worktrees_response = list_worktrees(repo_path)?;
    let worktrees = worktrees_response.worktrees;

    // 获取主分支名（main 或 master）
    let main_branch = get_main_branch(&repo)?;

    // 收集每个 worktree 的文件变更
    let mut file_changes: HashMap<String, Vec<ConflictWorktree>> = HashMap::new();

    for worktree in &worktrees {
        // 获取此 worktree 相对于主分支的变更文件
        let changes = get_worktree_changes(&worktree.path, &main_branch)?;

        for change in changes {
            file_changes
                .entry(change.path.clone())
                .or_insert_with(Vec::new)
                .push(ConflictWorktree {
                    name: worktree.name.clone(),
                    branch: worktree.branch.clone(),
                    path: worktree.path.clone(),
                    change_type: change.change_type,
                    additions: change.additions,
                    deletions: change.deletions,
                });
        }
    }

    // 分析冲突：同一文件在多个 worktree 中被修改
    let mut conflicts: Vec<FileConflict> = Vec::new();

    for (file_path, worktrees_changed) in file_changes.iter() {
        if worktrees_changed.len() > 1 {
            // 多个 worktree 修改了同一文件 -> 潜在冲突
            let (risk_level, description) = analyze_conflict_risk(worktrees_changed);

            conflicts.push(FileConflict {
                path: file_path.clone(),
                worktrees: worktrees_changed.clone(),
                risk_level,
                description,
            });
        }
    }

    // 按风险等级排序（高 -> 中 -> 低）
    conflicts.sort_by(|a, b| {
        let risk_order = |level: &str| match level {
            "high" => 0,
            "medium" => 1,
            "low" => 2,
            _ => 3,
        };
        risk_order(&a.risk_level).cmp(&risk_order(&b.risk_level))
    });

    // 统计各风险等级数量
    let high_risk_count = conflicts.iter().filter(|c| c.risk_level == "high").count();
    let medium_risk_count = conflicts.iter().filter(|c| c.risk_level == "medium").count();
    let low_risk_count = conflicts.iter().filter(|c| c.risk_level == "low").count();

    Ok(ConflictDetectionResponse {
        has_conflicts: !conflicts.is_empty(),
        conflicts,
        high_risk_count,
        medium_risk_count,
        low_risk_count,
        detected_at: now,
        repo_path: repo_path.to_string(),
    })
}

/// 获取冲突预览（显示各 worktree 对同一文件的修改内容）
pub fn get_conflict_preview(
    request: &ConflictPreviewRequest,
) -> anyhow::Result<ConflictPreviewResponse> {
    let repo = Repository::open(&request.repo_path)?;
    let main_branch = get_main_branch(&repo)?;

    // 获取所有 worktree
    let worktrees_response = list_worktrees(&request.repo_path)?;
    let worktrees = worktrees_response.worktrees;

    let mut diffs: Vec<WorktreeFileDiff> = Vec::new();

    for worktree in &worktrees {
        // 获取此文件在该 worktree 中的 diff
        let diff_content = get_file_diff(&worktree.path, &request.file_path, &main_branch)?;

        if !diff_content.is_empty() {
            // 获取变更类型
            let change_type = get_file_change_type(&worktree.path, &request.file_path, &main_branch)?;

            diffs.push(WorktreeFileDiff {
                worktree_name: worktree.name.clone(),
                branch: worktree.branch.clone(),
                diff_content,
                change_type,
            });
        }
    }

    Ok(ConflictPreviewResponse {
        file_path: request.file_path.clone(),
        diffs,
    })
}

/// 获取主分支名
fn get_main_branch(repo: &Repository) -> anyhow::Result<String> {
    // 尝试 main，如果不存在则尝试 master
    if repo.find_reference("refs/heads/main").is_ok() {
        return Ok("main".to_string());
    }
    if repo.find_reference("refs/heads/master").is_ok() {
        return Ok("master".to_string());
    }
    // 默认返回 main
    Ok("main".to_string())
}

/// 文件变更信息
struct FileChangeInfo {
    path: String,
    change_type: String,
    additions: usize,
    deletions: usize,
}

/// 获取 worktree 相对于主分支的文件变更
fn get_worktree_changes(
    worktree_path: &str,
    main_branch: &str,
) -> anyhow::Result<Vec<FileChangeInfo>> {
    // 使用 git diff --numstat 获取变更文件
    let output = Command::new("git")
        .args([
            "-c",
            "core.quotepath=false",
            "diff",
            "--numstat",
            &format!("{}...HEAD", main_branch),
        ])
        .current_dir(worktree_path)
        .output()?;

    let mut changes: Vec<FileChangeInfo> = Vec::new();

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();

                let change_type = if additions > 0 && deletions == 0 {
                    "added"
                } else if additions == 0 && deletions > 0 {
                    "deleted"
                } else {
                    "modified"
                };

                changes.push(FileChangeInfo {
                    path,
                    change_type,
                    additions,
                    deletions,
                });
            }
        }
    }

    // 也检查工作区的未提交变更
    let unstaged_output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", "--numstat", "HEAD"])
        .current_dir(worktree_path)
        .output()?;

    if unstaged_output.status.success() {
        let stdout = String::from_utf8_lossy(&unstaged_output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();

                // 合并到已有变更或新增
                if let Some(existing) = changes.iter_mut().find(|c| c.path == path) {
                    existing.additions += additions;
                    existing.deletions += deletions;
                    existing.change_type = "modified".to_string();
                } else {
                    let change_type = if additions > 0 && deletions == 0 {
                        "added"
                    } else if additions == 0 && deletions > 0 {
                        "deleted"
                    } else {
                        "modified"
                    };

                    changes.push(FileChangeInfo {
                        path,
                        change_type,
                        additions,
                        deletions,
                    });
                }
            }
        }
    }

    // 检查未跟踪文件
    let untracked_output = Command::new("git")
        .args([
            "-c",
            "core.quotepath=false",
            "ls-files",
            "--others",
            "--exclude-standard",
        ])
        .current_dir(worktree_path)
        .output()?;

    if untracked_output.status.success() {
        let stdout = String::from_utf8_lossy(&untracked_output.stdout);
        for path in stdout.lines() {
            if path.is_empty() {
                continue;
            }
            // 获取文件行数
            let line_count = std::fs::read_to_string(std::path::Path::new(worktree_path).join(path))
                .map(|content| content.lines().count())
                .unwrap_or(0);

            changes.push(FileChangeInfo {
                path: path.to_string(),
                change_type: "added".to_string(),
                additions: line_count,
                deletions: 0,
            });
        }
    }

    Ok(changes)
}

/// 分析冲突风险等级
fn analyze_conflict_risk(worktrees: &[ConflictWorktree]) -> (String, String) {
    // 高风险条件：
    // 1. 同一文件在多个 worktree 中都被修改（不是新增）
    // 2. 有删除操作 + 其他修改操作
    // 3. 变更量很大（多个 worktree 都有大量改动）

    let has_delete = worktrees.iter().any(|w| w.change_type == "deleted");
    let has_modify = worktrees.iter().any(|w| w.change_type == "modified");
    let has_add = worktrees.iter().any(|w| w.change_type == "added");

    // 多个 worktree 都修改了同一文件（而非只是新增）
    let multiple_modify = worktrees.iter().filter(|w| w.change_type == "modified").count() > 1;

    // 总变更量
    let total_changes: usize = worktrees.iter().map(|w| w.additions + w.deletions).sum();

    if has_delete && (has_modify || has_add) {
        // 删除 + 修改/新增 = 高风险
        (
            "high".to_string(),
            "文件在某个 worktree 中被删除，但在其他 worktree 中被修改/新增".to_string(),
        )
    } else if multiple_modify {
        // 多个 worktree 都修改了同一文件 = 高风险
        (
            "high".to_string(),
            "同一文件在多个 worktree 中被修改，合并时极可能产生冲突".to_string(),
        )
    } else if total_changes > 100 {
        // 大量变更 = 中风险
        (
            "medium".to_string(),
            format!("文件变更量大（{}行），建议先合并到主分支", total_changes),
        )
    } else if has_add {
        // 多个 worktree 都新增了同一文件（可能是同名新文件）
        (
            "medium".to_string(),
            "多个 worktree 新增了同名文件，需确认是否为同一内容".to_string(),
        )
    } else {
        // 低风险
        (
            "low".to_string(),
            "文件有变更但冲突风险较低，建议保持关注".to_string(),
        )
    }
}

/// 获取文件 diff 内容
fn get_file_diff(
    worktree_path: &str,
    file_path: &str,
    main_branch: &str,
) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args([
            "-c",
            "core.quotepath=false",
            "diff",
            &format!("{}...HEAD", main_branch),
            "--",
            file_path,
        ])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Ok(String::new())
    }
}

/// 获取文件变更类型
fn get_file_change_type(
    worktree_path: &str,
    file_path: &str,
    main_branch: &str,
) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args([
            "-c",
            "core.quotepath=false",
            "diff",
            "--name-status",
            &format!("{}...HEAD", main_branch),
            "--",
            file_path,
        ])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let first_line = stdout.lines().next().unwrap_or("");
        let status = first_line.split_whitespace().next().unwrap_or("");

        let change_type = match status {
            "A" => "added",
            "D" => "deleted",
            "M" => "modified",
            "R" => "renamed",
            _ => "modified",
        };
        Ok(change_type.to_string())
    } else {
        Ok("unknown".to_string())
    }
}