use crate::models::{ConflictDetectionResponse, ConflictRiskLevel, FileConflict, FileChangeInfo, WorktreeFileDiff};
use crate::services::worktree_service::list_worktrees;
use git2::Repository;
use std::collections::{HashMap, HashSet};
use std::process::Command;
use chrono::Utc;

/// 检测 worktree 之间的文件冲突
pub fn detect_conflicts(repo_path: &str, main_branch: &str) -> anyhow::Result<ConflictDetectionResponse> {
    let worktrees = list_worktrees(repo_path)?;
    let non_main_worktrees: Vec<_> = worktrees.worktrees.iter()
        .filter(|w| !w.is_main)
        .collect();

    if non_main_worktrees.is_empty() {
        return Ok(ConflictDetectionResponse {
            success: true,
            message: "没有额外的 worktree 需要检测".to_string(),
            detected_at: Utc::now().to_rfc3339(),
            conflicts: vec![],
            high_risk_count: 0,
            medium_risk_count: 0,
            low_risk_count: 0,
            worktree_count: worktrees.worktrees.len(),
        });
    }

    // 1. 收集每个 worktree 相对于 main 的变更文件
    let worktree_diffs = collect_worktree_diffs(&non_main_worktrees, main_branch)?;

    // 2. 找出在多个 worktree 中被修改的相同文件
    let file_worktree_map = build_file_worktree_map(&worktree_diffs);

    // 3. 对冲突文件进行风险评估
    let conflicts = analyze_conflicts(&file_worktree_map, &worktree_diffs, main_branch)?;

    // 统计风险等级
    let high_risk_count = conflicts.iter().filter(|c| c.risk_level == ConflictRiskLevel::High).count();
    let medium_risk_count = conflicts.iter().filter(|c| c.risk_level == ConflictRiskLevel::Medium).count();
    let low_risk_count = conflicts.iter().filter(|c| c.risk_level == ConflictRiskLevel::Low).count();

    let message = if conflicts.is_empty() {
        "未检测到潜在的文件冲突".to_string()
    } else {
        format!("检测到 {} 个潜在冲突文件", conflicts.len())
    };

    Ok(ConflictDetectionResponse {
        success: true,
        message,
        detected_at: Utc::now().to_rfc3339(),
        conflicts,
        high_risk_count,
        medium_risk_count,
        low_risk_count,
        worktree_count: worktrees.worktrees.len(),
    })
}

/// 收集每个 worktree 的变更文件
fn collect_worktree_diffs(worktrees: &[&crate::models::Worktree], main_branch: &str) -> anyhow::Result<Vec<WorktreeFileDiff>> {
    let mut diffs = Vec::new();

    for worktree in worktrees {
        // 使用 git diff 获取相对于 main 的变更文件
        let output = Command::new("git")
            .args([
                "-c", "core.quotepath=false",
                "diff",
                "--name-only",
                &format!("{}...HEAD", main_branch),
            ])
            .current_dir(&worktree.path)
            .output()?;

        let changed_files: Vec<String> = if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| l.to_string())
                .collect()
        } else {
            vec![]
        };

        diffs.push(WorktreeFileDiff {
            worktree_name: worktree.name.clone(),
            branch: worktree.branch.clone(),
            changed_files,
        });
    }

    Ok(diffs)
}

/// 构建文件 -> worktree 的映射
fn build_file_worktree_map(diffs: &[WorktreeFileDiff]) -> HashMap<String, Vec<String>> {
    let mut map: HashMap<String, Vec<String>> = HashMap::new();

    for diff in diffs {
        for file in &diff.changed_files {
            map.entry(file.clone())
                .or_default()
                .push(diff.worktree_name.clone());
        }
    }

    // 只保留在多个 worktree 中被修改的文件
    map.retain(|_, worktrees| worktrees.len() > 1);

    map
}

/// 分析冲突风险
fn analyze_conflicts(
    file_worktree_map: &HashMap<String, Vec<String>>,
    diffs: &[WorktreeFileDiff],
    _main_branch: &str,
) -> anyhow::Result<Vec<FileConflict>> {
    let mut conflicts = Vec::new();

    for (file_path, worktree_names) in file_worktree_map {
        // 收集各 worktree 对该文件的变更信息
        let changes: Vec<FileChangeInfo> = worktree_names.iter()
            .filter_map(|wt_name| {
                diffs.iter()
                    .find(|d| d.worktree_name == *wt_name)
                    .map(|diff| {
                        // 获取文件变更统计
                        let (additions, deletions, status) = get_file_change_stats(&diff.worktree_name, &file_path, diff)
                            .unwrap_or((0, 0, "modified".to_string()));

                        FileChangeInfo {
                            worktree_name: diff.worktree_name.clone(),
                            branch: diff.branch.clone(),
                            additions,
                            deletions,
                            status,
                        }
                    })
            })
            .collect();

        // 评估风险等级
        let risk_level = evaluate_risk_level(&changes);

        // 获取涉及的分支
        let branches: Vec<String> = changes.iter()
            .map(|c| c.branch.clone())
            .collect();

        // 尝试生成冲突预览（可选）
        let conflict_preview = None; // TODO: 实现实际的冲突模拟

        conflicts.push(FileConflict {
            path: file_path.clone(),
            risk_level,
            worktrees: worktree_names.clone(),
            branches,
            changes,
            conflict_preview,
        });
    }

    // 按风险等级排序（高风险在前）
    conflicts.sort_by(|a, b| {
        match (&a.risk_level, &b.risk_level) {
            (ConflictRiskLevel::High, ConflictRiskLevel::High) => std::cmp::Ordering::Equal,
            (ConflictRiskLevel::High, _) => std::cmp::Ordering::Less,
            (_, ConflictRiskLevel::High) => std::cmp::Ordering::Greater,
            (ConflictRiskLevel::Medium, ConflictRiskLevel::Medium) => std::cmp::Ordering::Equal,
            (ConflictRiskLevel::Medium, _) => std::cmp::Ordering::Less,
            (_, ConflictRiskLevel::Medium) => std::cmp::Ordering::Greater,
            (ConflictRiskLevel::Low, ConflictRiskLevel::Low) => std::cmp::Ordering::Equal,
        }
    });

    Ok(conflicts)
}

/// 获取文件变更统计
fn get_file_change_stats(worktree_name: &str, file_path: &str, diff: &WorktreeFileDiff) -> anyhow::Result<(usize, usize, String)> {
    // 简化实现：返回默认值
    // TODO: 实现精确的统计
    Ok((10, 5, "modified".to_string()))
}

/// 评估冲突风险等级
fn evaluate_risk_level(changes: &[FileChangeInfo]) -> ConflictRiskLevel {
    // 风险评估逻辑：
    // - 高风险：同一文件的相同区域被多个 worktree 修改（目前简化为：总变更量大）
    // - 中风险：同一文件被修改，但变更区域可能不同
    // - 低风险：轻微修改

    let total_changes: usize = changes.iter().map(|c| c.additions + c.deletions).sum();
    let worktree_count = changes.len();

    // 简化的风险评估
    if total_changes > 100 || worktree_count >= 3 {
        ConflictRiskLevel::High
    } else if total_changes > 30 || worktree_count == 2 {
        ConflictRiskLevel::Medium
    } else {
        ConflictRiskLevel::Low
    }
}

/// 对单个文件尝试模拟合并，检测是否会产生冲突
pub fn simulate_merge_conflict(repo_path: &str, source_branch: &str, target_branch: &str, file_path: &str) -> anyhow::Result<Option<String>> {
    let repo = Repository::open(repo_path)?;

    // 获取两个分支的 commit
    let source_ref = format!("refs/heads/{}", source_branch);
    let target_ref = format!("refs/heads/{}", target_branch);

    let source_commit = repo.find_reference(&source_ref)?.peel_to_commit()?;
    let target_commit = repo.find_reference(&target_ref)?.peel_to_commit()?;

    // 检查是否有 merge base
    let merge_base = repo.merge_base(source_commit.id(), target_commit.id())?;

    // 如果 merge base 存在，尝试模拟合并
    // 注意：这里只是检测是否存在共同祖先，真正的冲突检测需要更复杂的逻辑

    Ok(None) // 简化实现
}

/// 获取详细的冲突预览
pub fn get_conflict_preview(worktree_path: &str, main_branch: &str, file_path: &str) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args([
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
        Ok("无法获取 diff 内容".to_string())
    }
}