use super::worktree_service::list_worktrees;
use crate::models::{
    CommitInfo, DetailedDiffResponse, DiffHunk, DiffLine, DiffResponse, DiffStats, FileDiff,
    FileStatus, LineType, ThreeWayDiff, TimelineResponse,
};
use crate::utils::validation::sanitize_branch_name;
use encoding_rs::GBK;
use git2::Repository;
use regex::Regex;
use std::process::Command;
use std::sync::LazyLock;

/// 最大文件大小限制（5MB）
const MAX_FILE_SIZE_BYTES: u64 = 5 * 1024 * 1024;
/// 单文件最大 diff 行数
const MAX_DIFF_LINES: usize = 10000;
/// 支持的图片文件扩展名
const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico", "avif",
];

/// 检测文件是否为图片
fn is_image_file(path: &str) -> bool {
    if let Some(ext) = path.rsplit('.').next() {
        IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str())
    } else {
        false
    }
}

#[allow(clippy::unwrap_used)]
static HUNK_HEADER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@").unwrap());

/// 解码字节数组为字符串，支持多种编码
///
/// 编码检测顺序：
/// 1. UTF-8（优先）
/// 2. UTF-8 with BOM
/// 3. GBK/GB18030（中文 Windows 常见）
/// 4. 最后 fallback 到 lossy UTF-8
fn decode_bytes_to_string(bytes: &[u8]) -> String {
    // 先尝试 UTF-8
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    // 尝试检测编码 - UTF-8 BOM
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        if let Ok(s) = std::str::from_utf8(&bytes[3..]) {
            return s.to_string();
        }
    }

    // 尝试 GBK (GB18030) - 中文 Windows 常用编码
    let (decoded, _, had_errors) = GBK.decode(bytes);
    if !had_errors {
        return decoded.into_owned();
    }

    // 最后 fallback 到 lossy UTF-8
    String::from_utf8_lossy(bytes).into_owned()
}

/// 查找目标分支的 commit
fn find_target_commit<'a>(
    repo: &'a Repository,
    target_branch: &str,
) -> anyhow::Result<git2::Commit<'a>> {
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
pub fn get_diff(
    worktree_path: &str,
    target_branch: &str,
    ignore_whitespace: &str,
) -> anyhow::Result<DiffResponse> {
    // 验证 target_branch 参数，防止注入攻击
    sanitize_branch_name(target_branch).map_err(|e| anyhow::anyhow!("{}", e))?;

    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let head = repo.head()?;
    let source_branch = head.shorthand().unwrap_or("HEAD").to_string();

    // 查找目标分支的 commit
    let _target_commit = find_target_commit(&repo, target_branch)?;

    // 获取当前 HEAD commit
    let _source_commit = head.peel_to_commit()?;

    // 使用 HashMap 合并文件变更
    let mut files_map: std::collections::HashMap<String, DiffStats> =
        std::collections::HashMap::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 1. 获取分支间的提交差异（三点语法）
    let mut cmd = Command::new("git");
    cmd.args(["-c", "core.quotepath=false", "diff", "--numstat"]);
    // 根据参数添加空白过滤选项
    match ignore_whitespace {
        "all" => {
            cmd.arg("--ignore-all-space");
        }
        "change" => {
            cmd.arg("--ignore-space-change");
        }
        _ => {} // "none" - 不添加参数
    }
    cmd.arg(format!("{}...HEAD", target_branch));
    let output = cmd.current_dir(worktree_path).output()?;

    if output.status.success() {
        let stdout = decode_bytes_to_string(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                let additions = parts[0].parse::<usize>().unwrap_or(0);
                let deletions = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();

                let status = if additions > 0 && deletions == 0 {
                    FileStatus::Added
                } else if additions == 0 && deletions > 0 {
                    FileStatus::Deleted
                } else {
                    FileStatus::Modified
                };

                files_map.insert(
                    path.clone(),
                    DiffStats {
                        path,
                        additions,
                        deletions,
                        status,
                    },
                );

                total_additions += additions;
                total_deletions += deletions;
            }
        }
    }

    // 2. 获取工作区未提交的变更（包含已跟踪文件的修改）
    let mut worktree_cmd = Command::new("git");
    worktree_cmd.args(["-c", "core.quotepath=false", "diff", "--numstat"]);
    // 根据参数添加空白过滤选项
    match ignore_whitespace {
        "all" => {
            worktree_cmd.arg("--ignore-all-space");
        }
        "change" => {
            worktree_cmd.arg("--ignore-space-change");
        }
        _ => {} // "none" - 不添加参数
    }
    worktree_cmd.arg("HEAD");
    let worktree_output = worktree_cmd.current_dir(worktree_path).output()?;

    if worktree_output.status.success() {
        let stdout = decode_bytes_to_string(&worktree_output.stdout);
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
                        FileStatus::Added
                    } else if additions == 0 && deletions > 0 {
                        FileStatus::Deleted
                    } else {
                        FileStatus::Modified
                    };

                    files_map.insert(
                        path.clone(),
                        DiffStats {
                            path,
                            additions,
                            deletions,
                            status,
                        },
                    );
                }

                total_additions += additions;
                total_deletions += deletions;
            }
        }
    }

    // 3. 获取未跟踪的新文件（Untracked files）
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
        let stdout = decode_bytes_to_string(&untracked_output.stdout);
        for path in stdout.lines() {
            if path.is_empty() || files_map.contains_key(path) {
                continue;
            }
            // 获取未跟踪文件的行数作为 additions（使用二进制读取+编码检测）
            let file_path = std::path::Path::new(worktree_path).join(path);
            let line_count = std::fs::read(&file_path)
                .map(|bytes| decode_bytes_to_string(&bytes).lines().count())
                .unwrap_or(0);

            files_map.insert(
                path.to_string(),
                DiffStats {
                    path: path.to_string(),
                    additions: line_count,
                    deletions: 0,
                    status: FileStatus::Added,
                },
            );
            total_additions += line_count;
        }
    }

    // 转换为 Vec 并排序
    let mut files: Vec<DiffStats> = files_map.into_values().collect();
    files.sort_by(|a, b| (b.additions + b.deletions).cmp(&(a.additions + a.deletions)));

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
pub fn get_detailed_diff(
    worktree_path: &str,
    target_branch: &str,
    ignore_whitespace: &str,
) -> anyhow::Result<DetailedDiffResponse> {
    // 验证 target_branch 参数，防止注入攻击
    sanitize_branch_name(target_branch).map_err(|e| anyhow::anyhow!("{}", e))?;

    let repo = Repository::open(worktree_path)?;

    // 获取当前分支名
    let head = repo.head()?;
    let source_branch = head.shorthand().unwrap_or("HEAD").to_string();

    // 查找目标分支的 commit
    let _target_commit = find_target_commit(&repo, target_branch)?;

    let _source_commit = head.peel_to_commit()?;

    // 使用 HashMap 合并文件变更
    let mut files_map: std::collections::HashMap<String, FileDiff> =
        std::collections::HashMap::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // 辅助函数：解析 diff 输出
    let parse_diff_output = |stdout: &str,
                             files_map: &mut std::collections::HashMap<String, FileDiff>,
                             total_additions: &mut usize,
                             total_deletions: &mut usize,
                             source: &str| {
        let mut current_file: Option<FileDiff> = None;
        let mut current_hunk: Option<DiffHunk> = None;
        // 增量计数器：用于 O(n) 复杂度的行号计算
        let mut current_old_line: usize = 0;
        let mut current_new_line: usize = 0;
        // 单文件行数计数器
        let mut current_file_line_count: usize = 0;

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
                        status: FileStatus::Modified,
                        hunks: Vec::new(),
                        additions: 0,
                        deletions: 0,
                        source: source.to_string(),
                        is_binary: false,
                        is_too_large: false,
                        is_image: false,
                        old_image_base64: None,
                        new_image_base64: None,
                    });
                }
                current_hunk = None;
                current_file_line_count = 0;
            }
            // 新文件标记
            else if line.starts_with("new file mode ") {
                if let Some(ref mut file) = current_file {
                    file.status = FileStatus::Added;
                }
            }
            // 删除文件标记
            else if line.starts_with("deleted file mode ") {
                if let Some(ref mut file) = current_file {
                    file.status = FileStatus::Deleted;
                }
            }
            // 重命名
            else if line.starts_with("rename from ") {
                if let Some(ref mut file) = current_file {
                    file.old_path =
                        Some(line.strip_prefix("rename from ").unwrap_or("").to_string());
                    file.status = FileStatus::Renamed;
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
                    let old_lines = caps
                        .get(2)
                        .map(|m| m.as_str().parse::<usize>().unwrap_or(1))
                        .unwrap_or(1);
                    let new_start = caps[3].parse::<usize>().unwrap_or(1);
                    let new_lines = caps
                        .get(4)
                        .map(|m| m.as_str().parse::<usize>().unwrap_or(1))
                        .unwrap_or(1);

                    current_hunk = Some(DiffHunk {
                        old_start,
                        old_lines,
                        new_start,
                        new_lines,
                        lines: Vec::new(),
                    });
                    // 初始化增量计数器
                    current_old_line = old_start;
                    current_new_line = new_start;
                }
            }
            // 二进制文件检测
            else if line.starts_with("Binary files") && line.contains("differ") {
                if let Some(ref mut file) = current_file {
                    file.is_binary = true;
                }
            }
            // Diff 行
            else if line.starts_with('+') && !line.starts_with("+++") {
                if let Some(ref mut file) = current_file {
                    // 检查行数限制
                    if current_file_line_count >= MAX_DIFF_LINES {
                        file.is_too_large = true;
                        continue;
                    }
                    if let Some(ref mut hunk) = current_hunk {
                        hunk.lines.push(DiffLine {
                            line_type: LineType::Addition,
                            old_line: None,
                            new_line: Some(current_new_line),
                            content: line[1..].to_string(),
                        });
                        current_new_line += 1;
                        file.additions += 1;
                        *total_additions += 1;
                        current_file_line_count += 1;
                    }
                }
            } else if line.starts_with('-') && !line.starts_with("---") {
                if let Some(ref mut file) = current_file {
                    // 检查行数限制
                    if current_file_line_count >= MAX_DIFF_LINES {
                        file.is_too_large = true;
                        continue;
                    }
                    if let Some(ref mut hunk) = current_hunk {
                        hunk.lines.push(DiffLine {
                            line_type: LineType::Deletion,
                            old_line: Some(current_old_line),
                            new_line: None,
                            content: line[1..].to_string(),
                        });
                        current_old_line += 1;
                        file.deletions += 1;
                        *total_deletions += 1;
                        current_file_line_count += 1;
                    }
                }
            } else if let Some(stripped) = line.strip_prefix(' ') {
                if let Some(ref mut file) = current_file {
                    // 检查行数限制
                    if current_file_line_count >= MAX_DIFF_LINES {
                        file.is_too_large = true;
                        continue;
                    }
                    if let Some(ref mut hunk) = current_hunk {
                        hunk.lines.push(DiffLine {
                            line_type: LineType::Context,
                            old_line: Some(current_old_line),
                            new_line: Some(current_new_line),
                            content: stripped.to_string(),
                        });
                        current_old_line += 1;
                        current_new_line += 1;
                        current_file_line_count += 1;
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
    let mut cmd = Command::new("git");
    cmd.args(["-c", "core.quotepath=false", "diff"]);
    // 根据参数添加空白过滤选项
    match ignore_whitespace {
        "all" => {
            cmd.arg("--ignore-all-space");
        }
        "change" => {
            cmd.arg("--ignore-space-change");
        }
        _ => {} // "none" - 不添加参数
    }
    cmd.arg(format!("{}...HEAD", target_branch));
    let output = cmd.current_dir(worktree_path).output()?;

    if output.status.success() {
        let stdout = decode_bytes_to_string(&output.stdout);
        parse_diff_output(
            &stdout,
            &mut files_map,
            &mut total_additions,
            &mut total_deletions,
            "committed",
        );
    }

    // 2. 获取工作区未提交的变更（已跟踪文件）- unstaged
    let mut worktree_cmd = Command::new("git");
    worktree_cmd.args(["-c", "core.quotepath=false", "diff"]);
    // 根据参数添加空白过滤选项
    match ignore_whitespace {
        "all" => {
            worktree_cmd.arg("--ignore-all-space");
        }
        "change" => {
            worktree_cmd.arg("--ignore-space-change");
        }
        _ => {} // "none" - 不添加参数
    }
    worktree_cmd.arg("HEAD");
    let worktree_output = worktree_cmd.current_dir(worktree_path).output()?;

    if worktree_output.status.success() {
        let stdout = decode_bytes_to_string(&worktree_output.stdout);
        parse_diff_output(
            &stdout,
            &mut files_map,
            &mut total_additions,
            &mut total_deletions,
            "unstaged",
        );
    }

    // 3. 获取未跟踪的新文件（Untracked files）
    let untracked_output = Command::new("git")
        .args([
            "-c",
            "core.quotepath=false",
            "status",
            "--porcelain",
            "--untracked-files=all",
        ])
        .current_dir(worktree_path)
        .output()?;

    if untracked_output.status.success() {
        let stdout = decode_bytes_to_string(&untracked_output.stdout);
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

                // 检查文件大小
                let metadata = std::fs::metadata(&file_path);
                if let Ok(meta) = metadata {
                    if meta.len() > MAX_FILE_SIZE_BYTES {
                        // 文件过大，标记为 too_large 但不读取内容
                        let file_diff = FileDiff {
                            path: path.clone(),
                            old_path: None,
                            status: FileStatus::Added,
                            hunks: Vec::new(),
                            additions: 0,
                            deletions: 0,
                            source: "untracked".to_string(),
                            is_binary: false,
                            is_too_large: true,
                            is_image: false,
                            old_image_base64: None,
                            new_image_base64: None,
                        };
                        files_map.insert(path, file_diff);
                        continue;
                    }
                }

                // 读取文件内容创建 diff（使用二进制读取+编码检测）
                if let Ok(bytes) = std::fs::read(&file_path) {
                    let content = decode_bytes_to_string(&bytes);
                    let lines: Vec<&str> = content.lines().collect();
                    let line_count = lines.len();

                    // 检查行数限制
                    if line_count > MAX_DIFF_LINES {
                        // 行数过多，截断并标记
                        let mut diff_lines: Vec<DiffLine> = Vec::new();
                        for (idx, line_content) in lines.iter().enumerate().take(MAX_DIFF_LINES) {
                            diff_lines.push(DiffLine {
                                line_type: LineType::Addition,
                                old_line: None,
                                new_line: Some(idx + 1),
                                content: line_content.to_string(),
                            });
                        }

                        let hunk = DiffHunk {
                            old_start: 0,
                            old_lines: 0,
                            new_start: 1,
                            new_lines: MAX_DIFF_LINES,
                            lines: diff_lines,
                        };

                        let file_diff = FileDiff {
                            path: path.clone(),
                            old_path: None,
                            status: FileStatus::Added,
                            hunks: vec![hunk],
                            additions: MAX_DIFF_LINES,
                            deletions: 0,
                            source: "untracked".to_string(),
                            is_binary: false,
                            is_too_large: true,
                            is_image: false,
                            old_image_base64: None,
                            new_image_base64: None,
                        };

                        files_map.insert(path, file_diff);
                        total_additions += MAX_DIFF_LINES;
                    } else {
                        // 创建一个新的 hunk 包含所有行
                        let mut diff_lines: Vec<DiffLine> = Vec::new();
                        for (idx, line_content) in lines.iter().enumerate() {
                            diff_lines.push(DiffLine {
                                line_type: LineType::Addition,
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
                            status: FileStatus::Added,
                            hunks: vec![hunk],
                            additions: line_count,
                            deletions: 0,
                            source: "untracked".to_string(),
                            is_binary: false,
                            is_too_large: false,
                            is_image: false,
                            old_image_base64: None,
                            new_image_base64: None,
                        };

                        files_map.insert(path, file_diff);
                        total_additions += line_count;
                    }
                }
            }
        }
    }

    // 处理图片文件：添加 base64 编码
    for file in files_map.values_mut() {
        if is_image_file(&file.path) {
            file.is_image = true;

            // 检查文件大小，超过限制则跳过 base64 编码
            let file_size_ok = if file.status == FileStatus::Deleted {
                // 删除的文件只需检查旧版本大小（通过 git show 获取）
                true // 稍后在获取时检查
            } else {
                let new_path = std::path::Path::new(worktree_path).join(&file.path);
                new_path.exists()
                    && std::fs::metadata(&new_path)
                        .map(|m| m.len() <= MAX_FILE_SIZE_BYTES)
                        .unwrap_or(false)
            };

            if !file_size_ok && file.status != FileStatus::Deleted {
                continue; // 文件过大，跳过 base64 编码
            }

            // 获取旧版本图片（目标分支中的版本）
            if file.status != FileStatus::Added {
                let sanitized_branch = sanitize_branch_name(target_branch);
                if sanitized_branch.is_ok() {
                    let old_output = Command::new("git")
                        .args([
                            "-c",
                            "core.quotepath=false",
                            "show",
                            &format!("{}:{}", target_branch, &file.path),
                        ])
                        .current_dir(worktree_path)
                        .output();
                    if let Ok(output) = old_output {
                        if output.status.success() && !output.stdout.is_empty() {
                            // 检查大小
                            if output.stdout.len() as u64 <= MAX_FILE_SIZE_BYTES {
                                use base64::Engine;
                                file.old_image_base64 = Some(
                                    base64::engine::general_purpose::STANDARD
                                        .encode(&output.stdout),
                                );
                            }
                        }
                    }
                }
            }

            // 获取新版本图片（工作区中的版本）
            if file.status != FileStatus::Deleted {
                let new_path = std::path::Path::new(worktree_path).join(&file.path);
                if new_path.exists() {
                    if let Ok(bytes) = std::fs::read(&new_path) {
                        if bytes.len() as u64 <= MAX_FILE_SIZE_BYTES {
                            use base64::Engine;
                            file.new_image_base64 =
                                Some(base64::engine::general_purpose::STANDARD.encode(&bytes));
                        }
                    }
                }
            }
        }
    }

    // 转换为 Vec 并过滤
    let mut files: Vec<FileDiff> = files_map
        .into_values()
        .filter(|f| {
            !f.hunks.is_empty()
                || f.status == FileStatus::Added
                || f.status == FileStatus::Deleted
                || f.is_binary
                || f.is_too_large
                || f.is_image
        })
        .collect();

    // 按变更量排序
    files.sort_by(|a, b| (b.additions + b.deletions).cmp(&(a.additions + a.deletions)));

    Ok(DetailedDiffResponse {
        source_branch,
        target_branch: target_branch.to_string(),
        files,
        total_additions,
        total_deletions,
    })
}

/// 获取时间线数据（所有 worktree 的提交历史）
pub fn get_timeline(
    repo_path: &str,
    since: Option<i64>,
    until: Option<i64>,
) -> anyhow::Result<TimelineResponse> {
    let _repo = Repository::open(repo_path)?;
    let mut commits: Vec<CommitInfo> = Vec::new();

    // 获取所有 worktree
    let worktrees_response = list_worktrees(repo_path)?;

    for worktree in worktrees_response.worktrees {
        // 打开每个 worktree 的仓库
        if let Ok(wt_repo) = Repository::open(&worktree.path) {
            // 获取提交历史
            if let Ok(revwalk) = get_commit_revwalk(&wt_repo, since, until) {
                for oid in revwalk.flatten() {
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

                        let commit_time = commit.time().seconds();

                        // 格式化 ISO 8601 日期
                        let datetime = chrono::DateTime::from_timestamp(commit_time, 0)
                            .unwrap_or_else(chrono::Utc::now);
                        let date = datetime.to_rfc3339();

                        commits.push(CommitInfo {
                            hash: commit.id().to_string()[..7.min(commit.id().to_string().len())]
                                .to_string(),
                            message: commit.summary().unwrap_or("No message").to_string(),
                            author: commit.author().name().unwrap_or("Unknown").to_string(),
                            date,
                            timestamp: commit_time,
                            worktree_name: worktree.name.clone(),
                            branch: worktree.branch.clone(),
                        });
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
fn get_commit_revwalk(
    repo: &Repository,
    _since: Option<i64>,
    _until: Option<i64>,
) -> anyhow::Result<git2::Revwalk<'_>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;

    Ok(revwalk)
}

/// 获取三方合并 Diff（用于合并冲突场景）
///
/// 在合并冲突状态下，Git 会在 index 中存储三个版本：
/// - Stage 1: base 版本（共同祖先）
/// - Stage 2: ours 版本（当前分支）
/// - Stage 3: theirs 版本（要合并的分支）
pub fn get_three_way_diff(worktree_path: &str, file_path: &str) -> anyhow::Result<ThreeWayDiff> {
    // 验证文件路径不包含危险字符
    if file_path.contains("..") || file_path.contains('\0') {
        anyhow::bail!("Invalid file path: {}", file_path);
    }

    // 获取 base 版本 (stage 1)
    let base_output = Command::new("git")
        .args(["show", &format!(":1:{}", file_path)])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to get base content: {}", e))?;

    // 获取 ours 版本 (stage 2)
    let ours_output = Command::new("git")
        .args(["show", &format!(":2:{}", file_path)])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to get ours content: {}", e))?;

    // 获取 theirs 版本 (stage 3)
    let theirs_output = Command::new("git")
        .args(["show", &format!(":3:{}", file_path)])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to get theirs content: {}", e))?;

    // 解码内容
    let base_content = if base_output.status.success() && !base_output.stdout.is_empty() {
        Some(decode_bytes_to_string(&base_output.stdout))
    } else {
        None
    };

    let ours_content = if ours_output.status.success() && !ours_output.stdout.is_empty() {
        Some(decode_bytes_to_string(&ours_output.stdout))
    } else {
        None
    };

    let theirs_content = if theirs_output.status.success() && !theirs_output.stdout.is_empty() {
        Some(decode_bytes_to_string(&theirs_output.stdout))
    } else {
        None
    };

    Ok(ThreeWayDiff {
        file_path: file_path.to_string(),
        base_content,
        ours_content,
        theirs_content,
    })
}
