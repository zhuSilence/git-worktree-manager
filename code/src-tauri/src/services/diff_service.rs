use crate::models::{DiffStats, DiffResponse, DiffLine, DiffHunk, FileDiff, DetailedDiffResponse, CommitInfo, TimelineResponse};
use git2::Repository;
use std::process::Command;
use std::sync::LazyLock;
use regex::Regex;
use super::worktree_service::list_worktrees;

static HUNK_HEADER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@").expect("valid hunk header regex pattern")
});

/// 查找目标分支的 commit
fn find_target_commit<'a>(repo: &'a Repository, target_branch: &str) -> anyhow::Result<git2::Commit<'a>> {
    if target_branch == "main" || target_branch == "master" {
        repo.find_reference("refs/heads/main")
            .and_then(|r| r.peel_to_commit())
            .or_else(|_| {
                repo.find_reference("refs/heads/master")
                    .and_then(|r| r.peel_to_commit())
            })
            .map_err(|_| anyhow::anyhow!("Neither 'main' nor 'master' branch found"))
    } else {
        let branch_ref = format!("refs/heads/{}", target_branch);
        Ok(repo.find_reference(&branch_ref)?.peel_to_commit()?)
    }
}

/// 获取 worktree 与目标分支的 diff
pub fn get_diff(worktree_path: &str, target_branch: &str) -> anyhow::Result<DiffResponse> {
    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let head = repo.head()?;
    let source_branch = head.shorthand().unwrap_or("HEAD").to_string();

    // 查找目标分支的 commit
    let _target_commit = find_target_commit(&repo, target_branch)?;

    // 获取当前 HEAD commit
    let _source_commit = head.peel_to_commit()?;

    // 使用 HashMap 合并文件变更
    let mut files_map: std::collections::HashMap<String, DiffStats> = std::collections::HashMap::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 1. 获取分支间的提交差异（三点语法）
    let output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", "--numstat", &format!("{}...HEAD", target_branch)])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();

                let status = if additions > 0 && deletions == 0 {
                    "added"
                } else if additions == 0 && deletions > 0 {
                    "deleted"
                } else {
                    "modified"
                };

                files_map.insert(path.clone(), DiffStats {
                    path,
                    additions,
                    deletions,
                    status: status.to_string(),
                });

                total_additions += additions;
                total_deletions += deletions;
            }
        }
    }

    // 2. 获取工作区未提交的变更（包含已跟踪文件的修改）
    let worktree_output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", "--numstat", "HEAD"])
        .current_dir(worktree_path)
        .output()?;

    if worktree_output.status.success() {
        let stdout = String::from_utf8_lossy(&worktree_output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();

                // 合并到现有文件或新增
                if let Some(existing) = files_map.get_mut(&path) {
                    existing.additions += additions;
                    existing.deletions += deletions;
                } else {
                    let status = if additions > 0 && deletions == 0 {
                        "added"
                    } else if additions == 0 && deletions > 0 {
                        "deleted"
                    } else {
                        "modified"
                    };

                    files_map.insert(path.clone(), DiffStats {
                        path,
                        additions,
                        deletions,
                        status: status.to_string(),
                    });
                }

                total_additions += additions;
                total_deletions += deletions;
            }
        }
    }

    // 3. 获取未跟踪的新文件（Untracked files）
    let untracked_output = Command::new("git")
        .args(["-c", "core.quotepath=false", "ls-files", "--others", "--exclude-standard"])
        .current_dir(worktree_path)
        .output()?;

    if untracked_output.status.success() {
        let stdout = String::from_utf8_lossy(&untracked_output.stdout);
        for path in stdout.lines() {
            if path.is_empty() || files_map.contains_key(path) {
                continue;
            }
            // 获取未跟踪文件的行数作为 additions
            let line_count = std::fs::read_to_string(std::path::Path::new(worktree_path).join(path))
                .map(|content| content.lines().count())
                .unwrap_or(0);

            files_map.insert(path.to_string(), DiffStats {
                path: path.to_string(),
                additions: line_count,
                deletions: 0,
                status: "added".to_string(),
            });
            total_additions += line_count;
        }
    }

    // 转换为 Vec 并排序
    let mut files: Vec<DiffStats> = files_map.into_values().collect();
    files.sort_by(|a, b| {
        (b.additions + b.deletions).cmp(&(a.additions + a.deletions))
    });

    Ok(DiffResponse {
        source_branch,
        target_branch: target_branch.to_string(),
        files_changed: files.len(),
        total_additions,
        total_deletions,
        files,
    })
}

/// 获取详细的 diff 内容（包含代码行）
pub fn get_detailed_diff(worktree_path: &str, target_branch: &str) -> anyhow::Result<DetailedDiffResponse> {
    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let head = repo.head()?;
    let source_branch = head.shorthand().unwrap_or("HEAD").to_string();

    // 查找目标分支的 commit
    let _target_commit = find_target_commit(&repo, target_branch)?;

    let _source_commit = head.peel_to_commit()?;

    // 使用 HashMap 合并文件变更
    let mut files_map: std::collections::HashMap<String, FileDiff> = std::collections::HashMap::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 辅助函数：解析 diff 输出
    let parse_diff_output = |stdout: &str, files_map: &mut std::collections::HashMap<String, FileDiff>, total_additions: &mut usize, total_deletions: &mut usize, source: &str| {
        let mut current_file: Option<FileDiff> = None;
        let mut current_hunk: Option<DiffHunk> = None;

        for line in stdout.lines() {
            // 文件头
            if line.starts_with("diff --git ") {
                // 保存上一个文件
                if let Some(mut file) = current_file.take() {
                    if let Some(hunk) = current_hunk.take() {
                        file.hunks.push(hunk);
                    }
                    // 合并到 files_map
                    if let Some(existing) = files_map.get_mut(&file.path) {
                        existing.hunks.extend(file.hunks);
                        existing.additions += file.additions;
                        existing.deletions += file.deletions;
                        // 如果已存在，更新 source 为优先级更高的（committed > unstaged > untracked）
                        if existing.source == "untracked" || existing.source == "unstaged" {
                            existing.source = file.source;
                        }
                    } else {
                        files_map.insert(file.path.clone(), file);
                    }
                }

                // 解析新文件
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 {
                    let path = parts[3].strip_prefix("b/").unwrap_or(parts[3]).to_string();
                    current_file = Some(FileDiff {
                        path,
                        old_path: None,
                        status: "modified".to_string(),
                        hunks: Vec::new(),
                        additions: 0,
                        deletions: 0,
                        source: source.to_string(),
                    });
                }
                current_hunk = None;
            }
            // 新文件标记
            else if line.starts_with("new file mode ") {
                if let Some(ref mut file) = current_file {
                    file.status = "added".to_string();
                }
            }
            // 删除文件标记
            else if line.starts_with("deleted file mode ") {
                if let Some(ref mut file) = current_file {
                    file.status = "deleted".to_string();
                }
            }
            // 重命名
            else if line.starts_with("rename from ") {
                if let Some(ref mut file) = current_file {
                    file.old_path = Some(line.strip_prefix("rename from ").unwrap_or("").to_string());
                    file.status = "renamed".to_string();
                }
            }
            // Hunk 头
            else if line.starts_with("@@ ") {
                // 保存上一个 hunk
                if let Some(ref mut file) = current_file {
                    if let Some(hunk) = current_hunk.take() {
                        file.hunks.push(hunk);
                    }
                }

                // 解析 hunk 信息
                let re = &*HUNK_HEADER_RE;
                if let Some(caps) = re.captures(line) {
                    let old_start = caps[1].parse::<usize>().unwrap_or(1);
                    let old_lines = caps.get(2).map(|m| m.as_str().parse::<usize>().unwrap_or(1)).unwrap_or(1);
                    let new_start = caps[3].parse::<usize>().unwrap_or(1);
                    let new_lines = caps.get(4).map(|m| m.as_str().parse::<usize>().unwrap_or(1)).unwrap_or(1);

                    current_hunk = Some(DiffHunk {
                        old_start,
                        old_lines,
                        new_start,
                        new_lines,
                        lines: Vec::new(),
                    });
                }
            }
            // Diff 行
            else if line.starts_with('+') && !line.starts_with("+++") {
                if let Some(ref mut file) = current_file {
                    if let Some(ref mut hunk) = current_hunk {
                        hunk.lines.push(DiffLine {
                            line_type: "addition".to_string(),
                            old_line: None,
                            new_line: Some(hunk.new_start + hunk.lines.iter().filter(|l| l.line_type == "addition" || l.line_type == "context").count()),
                            content: line[1..].to_string(),
                        });
                        file.additions += 1;
                        *total_additions += 1;
                    }
                }
            }
            else if line.starts_with('-') && !line.starts_with("---") {
                if let Some(ref mut file) = current_file {
                    if let Some(ref mut hunk) = current_hunk {
                        hunk.lines.push(DiffLine {
                            line_type: "deletion".to_string(),
                            old_line: Some(hunk.old_start + hunk.lines.iter().filter(|l| l.line_type == "deletion" || l.line_type == "context").count()),
                            new_line: None,
                            content: line[1..].to_string(),
                        });
                        file.deletions += 1;
                        *total_deletions += 1;
                    }
                }
            }
            else if line.starts_with(' ') {
                if let Some(ref mut _file) = current_file {
                    if let Some(ref mut hunk) = current_hunk {
                        let ctx_count = hunk.lines.iter().filter(|l| l.line_type == "context").count();
                        let add_count = hunk.lines.iter().filter(|l| l.line_type == "addition").count();
                        let del_count = hunk.lines.iter().filter(|l| l.line_type == "deletion").count();
                        hunk.lines.push(DiffLine {
                            line_type: "context".to_string(),
                            old_line: Some(hunk.old_start + ctx_count + del_count),
                            new_line: Some(hunk.new_start + ctx_count + add_count),
                            content: line[1..].to_string(),
                        });
                    }
                }
            }
        }

        // 保存最后一个文件
        if let Some(mut file) = current_file {
            if let Some(hunk) = current_hunk {
                file.hunks.push(hunk);
            }
            if let Some(existing) = files_map.get_mut(&file.path) {
                existing.hunks.extend(file.hunks);
                existing.additions += file.additions;
                existing.deletions += file.deletions;
                // 如果已存在，更新 source 为优先级更高的
                if existing.source == "untracked" || existing.source == "unstaged" {
                    existing.source = file.source;
                }
            } else {
                files_map.insert(file.path.clone(), file);
            }
        }
    };

    // 1. 获取分支间的提交差异（三点语法）- committed
    let output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", &format!("{}...HEAD", target_branch)])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_diff_output(&stdout, &mut files_map, &mut total_additions, &mut total_deletions, "committed");
    }

    // 2. 获取工作区未提交的变更（已跟踪文件）- unstaged
    let worktree_output = Command::new("git")
        .args(["-c", "core.quotepath=false", "diff", "HEAD"])
        .current_dir(worktree_path)
        .output()?;

    if worktree_output.status.success() {
        let stdout = String::from_utf8_lossy(&worktree_output.stdout);
        parse_diff_output(&stdout, &mut files_map, &mut total_additions, &mut total_deletions, "unstaged");
    }

    // 3. 获取未跟踪的新文件（Untracked files）
    let untracked_output = Command::new("git")
        .args(["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=all"])
        .current_dir(worktree_path)
        .output()?;

    if untracked_output.status.success() {
        let stdout = String::from_utf8_lossy(&untracked_output.stdout);
        for line in stdout.lines() {
            // porcelain 格式: XY PATH 或 XY ORIG_PATH -> PATH
            if line.len() < 3 {
                continue;
            }
            let status_code = &line[0..2];
            let path_part = &line[3..];

            // ?? 表示未跟踪文件
            if status_code == "??" {
                let path = path_part.to_string();
                let file_path = std::path::Path::new(worktree_path).join(&path);

                // 读取文件内容创建 diff
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    let lines: Vec<&str> = content.lines().collect();
                    let line_count = lines.len();

                    // 创建一个新的 hunk 包含所有行
                    let mut diff_lines: Vec<DiffLine> = Vec::new();
                    for (idx, line_content) in lines.iter().enumerate() {
                        diff_lines.push(DiffLine {
                            line_type: "addition".to_string(),
                            old_line: None,
                            new_line: Some(idx + 1),
                            content: line_content.to_string(),
                        });
                    }

                    let hunk = DiffHunk {
                        old_start: 0,
                        old_lines: 0,
                        new_start: 1,
                        new_lines: line_count,
                        lines: diff_lines,
                    };

                    let file_diff = FileDiff {
                        path: path.clone(),
                        old_path: None,
                        status: "added".to_string(),
                        hunks: vec![hunk],
                        additions: line_count,
                        deletions: 0,
                        source: "untracked".to_string(),
                    };

                    files_map.insert(path, file_diff);
                    total_additions += line_count;
                }
            }
        }
    }

    // 转换为 Vec 并过滤
    let mut files: Vec<FileDiff> = files_map.into_values()
        .filter(|f| !f.hunks.is_empty() || f.status == "added" || f.status == "deleted")
        .collect();

    // 按变更量排序
    files.sort_by(|a, b| {
        (b.additions + b.deletions).cmp(&(a.additions + a.deletions))
    });

    Ok(DetailedDiffResponse {
        source_branch,
        target_branch: target_branch.to_string(),
        files,
        total_additions,
        total_deletions,
    })
}

/// 获取时间线数据（所有 worktree 的提交历史）
pub fn get_timeline(repo_path: &str, since: Option<i64>, until: Option<i64>) -> anyhow::Result<TimelineResponse> {
    let _repo = Repository::open(repo_path)?;
    let mut commits: Vec<CommitInfo> = Vec::new();

    // 获取所有 worktree
    let worktrees_response = list_worktrees(repo_path)?;

    for worktree in worktrees_response.worktrees {
        // 打开每个 worktree 的仓库
        if let Ok(wt_repo) = Repository::open(&worktree.path) {
            // 获取提交历史
            if let Ok(revwalk) = get_commit_revwalk(&wt_repo, since, until) {
                for commit_result in revwalk {
                    if let Ok(oid) = commit_result {
                        if let Ok(commit) = wt_repo.find_commit(oid) {
                            let time = commit.time();
                            let commit_time = time.seconds();

                            // 时间范围过滤
                            if let Some(s) = since {
                                if commit_time < s {
                                    continue;
                                }
                            }
                            if let Some(u) = until {
                                if commit_time > u {
                                    continue;
                                }
                            }

                            let now = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)?
                                .as_secs() as i64;

                            let relative_time = format_relative_time(now, commit_time);

                            // 格式化 ISO 8601 日期
                            let datetime = chrono::DateTime::from_timestamp(commit_time, 0)
                                .unwrap_or_else(|| chrono::Utc::now());
                            let date = datetime.to_rfc3339();

                            commits.push(CommitInfo {
                                hash: commit.id().to_string()[..7.min(commit.id().to_string().len())].to_string(),
                                message: commit.summary().unwrap_or("No message").to_string(),
                                author: commit.author().name().unwrap_or("Unknown").to_string(),
                                date,
                                relative_time,
                                worktree_name: worktree.name.clone(),
                                branch: worktree.branch.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 按时间排序（最新的在前）
    commits.sort_by(|a, b| b.date.cmp(&a.date));

    let total_count = commits.len();

    Ok(TimelineResponse {
        commits,
        total_count,
    })
}

/// 获取提交的 revwalk
fn get_commit_revwalk(repo: &Repository, _since: Option<i64>, _until: Option<i64>) -> anyhow::Result<git2::Revwalk<'_>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;

    Ok(revwalk)
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
