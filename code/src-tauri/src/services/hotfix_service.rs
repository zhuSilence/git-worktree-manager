use crate::models::{
    generate_hotfix_branch_name, get_hotfix_state_file, CreateWorktreeParams, FinishHotfixResult,
    HotfixInfo, HotfixStatus, StartHotfixParams, StartHotfixResult, WorktreeResult,
};
use crate::services::worktree_service::{create_worktree, delete_worktree};
use git2::Repository;
use log::error;
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::process::Command;
use std::sync::{LazyLock, Mutex};

/// Hotfix 操作锁，防止并发操作
static HOTFIX_LOCK: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

/// 开始 Hotfix 流程
pub fn start_hotfix(
    repo_path: &str,
    params: StartHotfixParams,
) -> anyhow::Result<StartHotfixResult> {
    let repo_path_key = repo_path.to_string();

    let mut lock = HOTFIX_LOCK
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if lock.contains(&repo_path_key) {
        return Ok(StartHotfixResult {
            success: false,
            message: "Hotfix 操作正在进行中，请稍后重试".to_string(),
            hotfix: None,
        });
    }
    lock.insert(repo_path_key.clone());
    drop(lock);

    let _guard = scopeguard::guard((), |_| {
        let mut lock = HOTFIX_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        lock.remove(&repo_path_key);
    });

    if let Some(state) = load_hotfix_state(repo_path)? {
        if state.status == HotfixStatus::InProgress {
            return Ok(StartHotfixResult {
                success: false,
                message: format!("已有进行中的 Hotfix: {}", state.branch_name),
                hotfix: Some(state),
            });
        }
    }

    // 确定分支名
    let branch_name = params
        .branch_name
        .unwrap_or_else(|| generate_hotfix_branch_name(&params.description));

    // 确定基准分支
    let base_branch = params.base_branch.unwrap_or_else(|| "main".to_string());

    // 检查本地分支（O(1) 哈希查找）
    let repo = Repository::open(repo_path)?;
    if repo
        .find_branch(&branch_name, git2::BranchType::Local)
        .is_ok()
    {
        return Ok(StartHotfixResult {
            success: false,
            message: format!("本地分支 {} 已存在", branch_name),
            hotfix: None,
        });
    }

    // 检查远程分支（检查所有 remote 是否有同名分支）
    let remotes = repo.remotes()?;
    for remote_name in &remotes {
        if let Some(remote) = remote_name {
            let full_branch_name = format!("{}/{}", remote, branch_name);
            if repo
                .find_branch(&full_branch_name, git2::BranchType::Remote)
                .is_ok()
            {
                return Ok(StartHotfixResult {
                    success: false,
                    message: format!("远程分支 {} 已存在", branch_name),
                    hotfix: None,
                });
            }
        }
    }

    // 创建 hotfix worktree
    let create_params = CreateWorktreeParams {
        name: branch_name.clone(),
        base_branch: base_branch.clone(),
        new_branch: Some(branch_name.clone()),
        custom_path: None,
    };

    let result = create_worktree(repo_path, create_params)?;

    if !result.success {
        return Ok(StartHotfixResult {
            success: false,
            message: result.message,
            hotfix: None,
        });
    }

    // 保存 hotfix 状态
    let hotfix = HotfixInfo {
        branch_name: branch_name.clone(),
        worktree_path: result
            .worktree
            .as_ref()
            .map(|w| w.path.clone())
            .unwrap_or_default(),
        started_at: chrono::Local::now().to_rfc3339(),
        base_branch,
        status: HotfixStatus::InProgress,
        description: Some(params.description),
    };

    save_hotfix_state(repo_path, &hotfix)?;

    Ok(StartHotfixResult {
        success: true,
        message: format!("Hotfix {} 创建成功", branch_name),
        hotfix: Some(hotfix),
    })
}

/// 完成 Hotfix 流程
pub fn finish_hotfix(repo_path: &str, push: bool) -> anyhow::Result<FinishHotfixResult> {
    // 加载 hotfix 状态
    let hotfix = match load_hotfix_state(repo_path)? {
        Some(h) if h.status == HotfixStatus::InProgress => h,
        _ => {
            return Ok(FinishHotfixResult {
                success: false,
                message: "没有进行中的 Hotfix".to_string(),
                merged: false,
                cleaned_up: false,
            });
        }
    };

    // 检查 worktree 是否有未提交更改
    let wt_repo = Repository::open(&hotfix.worktree_path)?;
    let statuses = wt_repo.statuses(None)?;
    let has_changes = statuses
        .iter()
        .any(|s| !s.status().is_empty() && !s.status().contains(git2::Status::IGNORED));

    if has_changes {
        return Ok(FinishHotfixResult {
            success: false,
            message: "Hotfix worktree 有未提交的更改，请先提交或暂存".to_string(),
            merged: false,
            cleaned_up: false,
        });
    }

    // 切换到主仓库
    let repo = Repository::open(repo_path)?;

    // 合并 hotfix 分支到 main
    let main_branch = repo.find_branch(&hotfix.base_branch, git2::BranchType::Local)?;
    let main_ref = main_branch.get();
    let main_commit = main_ref.peel_to_commit()?;

    // 设置 HEAD 到 main
    repo.set_head(&format!("refs/heads/{}", hotfix.base_branch))?;
    repo.checkout_head(None)?;

    // 获取 hotfix 分支的提交
    let hotfix_branch = repo.find_branch(&hotfix.branch_name, git2::BranchType::Local)?;
    let hotfix_commit = hotfix_branch.get().peel_to_commit()?;

    // 执行合并
    let mut merge_index = repo.merge_commits(&main_commit, &hotfix_commit, None)?;

    // 检查是否有冲突
    if merge_index.has_conflicts() {
        return Ok(FinishHotfixResult {
            success: false,
            message: "合并存在冲突，请手动解决".to_string(),
            merged: false,
            cleaned_up: false,
        });
    }

    // 写入合并结果
    let tree = merge_index.write_tree_to(&repo)?;
    let tree_obj = repo.find_tree(tree)?;

    // 提交合并（合并提交需要两个父提交：main 和 hotfix）
    let sig = repo.signature()?;
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &format!("Merge hotfix: {}", hotfix.branch_name),
        &tree_obj,
        &[&main_commit, &hotfix_commit],
    )?;

    // 推送（如果需要）
    if push {
        let base_branch = &hotfix.base_branch;
        if !is_valid_git_ref_name(base_branch) {
            return Err(anyhow::anyhow!(
                "Invalid branch name for push: '{}'. Branch names cannot contain special characters like ~, ^, :, ?, *, [, \\, or start with . or -",
                base_branch
            ));
        }

        let output = Command::new("git")
            .args(["push", "origin", base_branch])
            .current_dir(repo_path)
            .output()?;

        if !output.status.success() {
            return Ok(FinishHotfixResult {
                success: false,
                message: format!(
                    "合并成功但推送失败: {}",
                    String::from_utf8_lossy(&output.stderr)
                ),
                merged: true,
                cleaned_up: false,
            });
        }
    }

    // 删除 hotfix worktree
    let delete_result = delete_worktree(repo_path, &hotfix.worktree_path, false);

    // 删除 hotfix 分支
    if let Ok(mut branch) = repo.find_branch(&hotfix.branch_name, git2::BranchType::Local) {
        if let Err(e) = branch.delete() {
            error!("Failed to delete branch '{}': {}", hotfix.branch_name, e);
        }
    }

    // 更新状态
    let mut completed = hotfix;
    completed.status = HotfixStatus::Completed;
    clear_hotfix_state(repo_path)?;

    Ok(FinishHotfixResult {
        success: true,
        message: format!(
            "Hotfix {} 已合并到 {}",
            completed.branch_name, completed.base_branch
        ),
        merged: true,
        cleaned_up: delete_result.is_ok(),
    })
}

/// 取消 Hotfix 流程
pub fn abort_hotfix(repo_path: &str) -> anyhow::Result<FinishHotfixResult> {
    // 加载 hotfix 状态
    let hotfix = match load_hotfix_state(repo_path)? {
        Some(h) if h.status == HotfixStatus::InProgress => h,
        _ => {
            return Ok(FinishHotfixResult {
                success: false,
                message: "没有进行中的 Hotfix".to_string(),
                merged: false,
                cleaned_up: false,
            });
        }
    };

    if let Err(e) = delete_worktree(repo_path, &hotfix.worktree_path, true) {
        return Err(anyhow::anyhow!(
            "Failed to delete worktree '{}': {}. Abort operation cancelled to preserve state.",
            hotfix.worktree_path,
            e
        ));
    }

    // 删除 hotfix 分支
    if let Ok(repo) = Repository::open(repo_path) {
        if let Ok(mut branch) = repo.find_branch(&hotfix.branch_name, git2::BranchType::Local) {
            if let Err(e) = branch.delete() {
                eprintln!(
                    "[Hotfix] Failed to delete branch '{}': {}",
                    hotfix.branch_name, e
                );
            }
        }
    }

    // 清除状态
    clear_hotfix_state(repo_path)?;

    Ok(FinishHotfixResult {
        success: true,
        message: format!("Hotfix {} 已取消", hotfix.branch_name),
        merged: false,
        cleaned_up: true,
    })
}

/// 获取当前 Hotfix 状态
pub fn get_hotfix_status(repo_path: &str) -> anyhow::Result<Option<HotfixInfo>> {
    load_hotfix_state(repo_path)
}

// ============ Hotfix 状态持久化 ============

fn load_hotfix_state(repo_path: &str) -> anyhow::Result<Option<HotfixInfo>> {
    let path = get_hotfix_state_file(repo_path);
    if !path.exists() {
        return Ok(None);
    }

    let mut file = fs::File::open(&path)?;
    let mut content = String::new();
    file.read_to_string(&mut content)?;

    let state: HotfixInfo = serde_json::from_str(&content)?;
    Ok(Some(state))
}

fn save_hotfix_state(repo_path: &str, hotfix: &HotfixInfo) -> anyhow::Result<()> {
    let path = get_hotfix_state_file(repo_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(hotfix)?;
    fs::write(&path, content.as_bytes())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = fs::metadata(&path)?;
        let mut permissions = metadata.permissions();
        permissions.set_mode(0o600);
        fs::set_permissions(&path, permissions)?;
    }

    #[cfg(windows)]
    {
        use log::warn;
        warn!("File permission restrictions (0o600) are not supported on Windows. Ensure the file system ACL is properly configured.");
    }

    Ok(())
}

fn clear_hotfix_state(repo_path: &str) -> anyhow::Result<()> {
    let path = get_hotfix_state_file(repo_path);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

fn is_valid_git_ref_name(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if name.starts_with('.') || name.starts_with('-') {
        return false;
    }
    if name.contains("..") || name.contains('~') || name.contains('^') || name.contains(':') {
        return false;
    }
    if name.contains('?') || name.contains('*') || name.contains('[') || name.contains('\\') {
        return false;
    }
    if name.ends_with('/') || name.ends_with('.') {
        return false;
    }
    if name.contains("//") {
        return false;
    }
    if name.contains(char::is_control) {
        return false;
    }
    true
}
