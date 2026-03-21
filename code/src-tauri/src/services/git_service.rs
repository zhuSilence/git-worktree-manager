use crate::models::{CreateWorktreeParams, Worktree, WorktreeListResponse, WorktreeResult, WorktreeStatus, Branch, BranchListResponse, LastCommit, DiffStats, DiffResponse, DiffLine, DiffHunk, FileDiff, DetailedDiffResponse, RepositoryInfo, SwitchBranchResult, BatchDeleteResult, WorktreeHint, SyncStatus};
use crate::utils::validation::{sanitize_branch_name, validate_path};
use git2::Repository;
use std::path::Path;
use std::process::Command;
use std::sync::LazyLock;
use regex::Regex;

static HUNK_HEADER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@").unwrap()
});

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
        id: commit.id().to_string(),
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
    let branch = head.shorthand().map(String::from).unwrap_or_else(|| name.to_string());
    let commit = head.peel_to_commit()?;
    let status = get_worktree_status(&wt_repo)?;
    let last_commit = get_last_commit(&commit)?;
    let sync_status = get_sync_status(&wt_repo, &branch)?;

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

    // 检查是否有未推送的提交
    if let Ok(head) = repo.head() {
        if let Some(branch_name) = head.shorthand() {
            let upstream_name = format!("origin/{}", branch_name);
            if let Ok(upstream_ref) = repo.find_reference(&format!("refs/remotes/{}", upstream_name)) {
                if let (Ok(local_commit), Ok(upstream_commit)) = (
                    head.peel_to_commit(),
                    upstream_ref.peel_to_commit(),
                ) {
                    if local_commit.id() != upstream_commit.id() {
                        // 检查本地是否领先远程
                        if let Ok((ahead, _)) = repo.graph_ahead_behind(local_commit.id(), upstream_commit.id()) {
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
    Ok(Repository::open(path).is_ok())
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

    // 统计文件变更
    let mut files: Vec<DiffStats> = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 使用 git diff 三点语法，只显示当前分支相对于目标分支的变更（与 GitHub PR 视角一致）
    let output = Command::new("git")
        .args(["diff", "--numstat", &format!("{}...HEAD", target_branch)])
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

                // 判断文件状态
                let status = if additions > 0 && deletions == 0 {
                    "added"
                } else if additions == 0 && deletions > 0 {
                    "deleted"
                } else {
                    "modified"
                };

                files.push(DiffStats {
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

    // 按变更量排序
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
    let target_commit = find_target_commit(&repo, target_branch)?;

    let source_commit = head.peel_to_commit()?;

    // 执行 diff
    let _diff = repo.diff_tree_to_tree(
        Some(&target_commit.as_object().peel_to_tree()?),
        Some(&source_commit.as_object().peel_to_tree()?),
        None,
    )?;

    let mut files: Vec<FileDiff> = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 使用 git diff 三点语法，只显示当前分支相对于目标分支的变更（与 GitHub PR 视角一致）
    let output = Command::new("git")
        .args(["diff", &format!("{}...HEAD", target_branch)])
        .current_dir(worktree_path)
        .output()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
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
                    files.push(file);
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
                // @@ -old_start,old_lines +new_start,new_lines @@
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
                        total_additions += 1;
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
                        total_deletions += 1;
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
            files.push(file);
        }
    }

    // 过滤掉没有内容的文件
    files.retain(|f| !f.hunks.is_empty() || f.status == "added" || f.status == "deleted");

    Ok(DetailedDiffResponse {
        source_branch,
        target_branch: target_branch.to_string(),
        files,
        total_additions,
        total_deletions,
    })
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

/// 批量删除 worktree
pub fn batch_delete_worktrees(repo_path: &str, worktree_paths: Vec<String>, force: bool) -> anyhow::Result<BatchDeleteResult> {
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

    // 检查每个 worktree
    let worktrees_response = list_worktrees(repo_path)?;
    for worktree in worktrees_response.worktrees {
        if worktree.is_main {
            continue;
        }

        // 检查分支是否已合并
        let branch_ref = format!("refs/heads/{}", worktree.branch);
        if let Ok(branch_ref_obj) = repo.find_reference(&branch_ref) {
            if let Ok(branch_commit) = branch_ref_obj.peel_to_commit() {
                // 检查是否已合并到主分支
                let is_merged = repo.merge_base(main_commit.id(), branch_commit.id())
                    .map(|base| base == branch_commit.id())
                    .unwrap_or(false);

                if is_merged {
                    hints.push(WorktreeHint {
                        worktree_id: worktree.id.clone(),
                        branch: worktree.branch.clone(),
                        hint_type: "merged".to_string(),
                        message: format!("分支 '{}' 已合并到 {}，可以删除", worktree.branch, main_branch),
                        is_merged: true,
                        inactive_days: None,
                    });
                }
            }
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
                            message: format!("分支 '{}' 已 {} 天未更新", worktree.branch, inactive_days),
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