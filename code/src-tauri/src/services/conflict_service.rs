use crate::models::{
    WorktreeConflictDetectionResponse, WorktreeConflictFile, WorktreeConflictRiskLevel,
    WorktreeFileChange,
};
use crate::services::{get_diff, list_worktrees};
use std::collections::HashMap;

/// 检测 worktree 之间的潜在冲突
pub fn detect_conflicts(repo_path: &str) -> anyhow::Result<WorktreeConflictDetectionResponse> {
    // 获取所有 worktree
    let worktrees_response = list_worktrees(repo_path)?;
    let worktrees = worktrees_response.worktrees;

    // 如果只有一个 worktree，没有冲突
    if worktrees.len() <= 1 {
        return Ok(WorktreeConflictDetectionResponse {
            has_conflicts: false,
            high_risk_count: 0,
            medium_risk_count: 0,
            low_risk_count: 0,
            conflict_files: vec![],
            detected_at: chrono_now(),
        });
    }

    // 确定主分支（用于比较）
    let main_branch = find_main_branch(&worktrees);

    // 获取每个 worktree 相对于主分支的文件变更
    let mut all_file_changes: HashMap<String, Vec<WorktreeFileChange>> = HashMap::new();

    for worktree in &worktrees {
        // 跳过主 worktree 本身（它的变更不会产生冲突）
        if worktree.is_main {
            continue;
        }

        // 获取该 worktree 与主分支的 diff
        if let Ok(diff) = get_diff(&worktree.path, &main_branch) {
            for file in &diff.files {
                let change = WorktreeFileChange {
                    worktree_name: worktree.name.clone(),
                    branch: worktree.branch.clone(),
                    worktree_path: worktree.path.clone(),
                    status: file.status.clone(),
                    additions: file.additions,
                    deletions: file.deletions,
                };

                all_file_changes
                    .entry(file.path.clone())
                    .or_insert_with(Vec::new)
                    .push(change);
            }
        }
    }

    // 找出被多个 worktree 修改的文件
    let conflict_files: Vec<WorktreeConflictFile> = all_file_changes
        .into_iter()
        .filter(|(_, changes)| changes.len() > 1)
        .map(|(path, changes)| {
            let risk_level = calculate_risk_level(&changes);
            let description = generate_conflict_description(&path, &changes);

            WorktreeConflictFile {
                path,
                risk_level,
                worktree_changes: changes,
                description,
            }
        })
        .collect();

    // 统计各风险等级的数量
    let high_risk_count = conflict_files
        .iter()
        .filter(|f| f.risk_level == WorktreeConflictRiskLevel::High)
        .count();
    let medium_risk_count = conflict_files
        .iter()
        .filter(|f| f.risk_level == WorktreeConflictRiskLevel::Medium)
        .count();
    let low_risk_count = conflict_files
        .iter()
        .filter(|f| f.risk_level == WorktreeConflictRiskLevel::Low)
        .count();

    Ok(WorktreeConflictDetectionResponse {
        has_conflicts: !conflict_files.is_empty(),
        high_risk_count,
        medium_risk_count,
        low_risk_count,
        conflict_files,
        detected_at: chrono_now(),
    })
}

/// 找出主分支名称
fn find_main_branch(worktrees: &[crate::models::Worktree]) -> String {
    // 首先尝试找 main worktree 的分支
    for wt in worktrees {
        if wt.is_main {
            return wt.branch.clone();
        }
    }

    // 如果没有 main worktree，默认返回 "main" 或 "master"
    "main".to_string()
}

/// 计算冲突风险等级
fn calculate_risk_level(changes: &[WorktreeFileChange]) -> WorktreeConflictRiskLevel {
    // 高风险：同一文件被修改超过 2 个 worktree，或者有大量的行变更
    if changes.len() > 2 {
        return WorktreeConflictRiskLevel::High;
    }

    // 检查变更量
    let total_changes: usize = changes.iter().map(|c| c.additions + c.deletions).sum();
    if total_changes > 100 {
        return WorktreeConflictRiskLevel::High;
    }

    // 中风险：两个 worktree 都有大变更
    if changes.len() == 2 {
        let change1 = changes[0].additions + changes[0].deletions;
        let change2 = changes[1].additions + changes[1].deletions;
        if change1 > 20 && change2 > 20 {
            return WorktreeConflictRiskLevel::Medium;
        }
    }

    // 低风险：小范围的修改
    WorktreeConflictRiskLevel::Low
}

/// 生成冲突描述
fn generate_conflict_description(path: &str, changes: &[WorktreeFileChange]) -> String {
    let branches: Vec<&str> = changes.iter().map(|c| c.branch.as_str()).collect();
    let branches_str = branches.join(", ");

    format!(
        "文件 '{}' 在以下分支中被修改: {}。合并时可能产生冲突。",
        path, branches_str
    )
}

/// 获取当前时间的 ISO 8601 格式
fn chrono_now() -> String {
    // 使用 chrono 格式化当前时间
    let now = std::time::SystemTime::now();
    let datetime: chrono::DateTime<chrono::Utc> = now.into();
    datetime.to_rfc3339()
}