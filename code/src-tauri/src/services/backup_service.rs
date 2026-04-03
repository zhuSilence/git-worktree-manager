use crate::models::WorktreeStatus;
use crate::models::{BackupInfo, BackupListResponse, DeleteProtectionCheck, RestoreBackupResult};
use crate::services::get_worktree_status;
use chrono::{DateTime, Duration, Utc};
use git2::Repository;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::PathBuf;
use std::process::Command;
use uuid::Uuid;

/// 备份存储目录
fn get_backup_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".worktree-manager")
        .join("backups")
}

/// 备份元数据文件
fn get_backup_meta_file() -> PathBuf {
    get_backup_dir().join("backups.jsonl")
}

/// 确保备份目录存在
fn ensure_backup_dir() -> anyhow::Result<()> {
    let dir = get_backup_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(())
}

/// 生成备份 ID
fn generate_backup_id() -> String {
    Uuid::new_v4().to_string()
}

/// 读取所有备份元数据
fn read_all_backups() -> anyhow::Result<Vec<BackupInfo>> {
    let meta_file = get_backup_meta_file();
    if !meta_file.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&meta_file)?;
    let reader = BufReader::new(file);

    let backups: Vec<BackupInfo> = reader
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect();

    Ok(backups)
}

/// 写入备份元数据（原子写入）
fn write_backups(backups: &[BackupInfo]) -> anyhow::Result<()> {
    ensure_backup_dir()?;
    let meta_file = get_backup_meta_file();

    // 原子写入：先写入临时文件，成功后重命名
    let tmp_file = meta_file.with_extension("jsonl.tmp");
    let file = File::create(&tmp_file)?;
    let mut writer = BufWriter::new(file);

    for backup in backups {
        let json = serde_json::to_string(backup)?;
        writer.write_all(json.as_bytes())?;
        writer.write_all(b"\n")?;
    }
    writer.flush()?;

    // 原子重命名
    std::fs::rename(&tmp_file, &meta_file)?;
    Ok(())
}

/// 检查删除保护（检查是否有未提交更改）
pub fn check_delete_protection(
    worktree_path: &str,
    branch: &str,
) -> anyhow::Result<DeleteProtectionCheck> {
    let repo = Repository::open(worktree_path)?;
    let status = get_worktree_status(&repo)?;

    if status == WorktreeStatus::Clean {
        return Ok(DeleteProtectionCheck {
            needs_protection: false,
            backup_created: false,
            backup_id: None,
            warning_message: None,
        });
    }

    // 有未提交更改，需要创建备份
    let backup = create_backup(worktree_path, branch)?;

    Ok(DeleteProtectionCheck {
        needs_protection: true,
        backup_created: true,
        backup_id: Some(backup.id.clone()),
        warning_message: Some(format!(
            "Worktree 有未提交更改，已自动创建备份。备份 ID: {}，将在 7 天后过期。",
            backup.id
        )),
    })
}

/// 获取 stash 列表（返回 stash ref 和消息的列表）
fn get_stash_list(worktree_path: &str) -> anyhow::Result<Vec<(String, String)>> {
    let output = Command::new("git")
        .args(["stash", "list"])
        .current_dir(worktree_path)
        .output()?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stashes: Vec<(String, String)> = stdout
        .lines()
        .filter_map(|line| {
            // 格式: stash@{0}: On branch: message
            // 或: stash@{0}: WIP on branch: message
            let parts: Vec<&str> = line.splitn(2, ':').collect();
            if parts.len() >= 2 {
                let ref_part = parts[0].trim().to_string();
                let msg_part = parts[1..].join(":").trim().to_string();
                Some((ref_part, msg_part))
            } else {
                None
            }
        })
        .collect();

    Ok(stashes)
}

/// 创建备份
pub fn create_backup(worktree_path: &str, branch: &str) -> anyhow::Result<BackupInfo> {
    ensure_backup_dir()?;

    let backup_marker = format!("backup-{}", branch);

    // 记录 stash 前的 stash 列表
    let stashes_before = get_stash_list(worktree_path)?;
    let stash_count_before = stashes_before.len();

    // 创建 git stash
    let output = Command::new("git")
        .args(["stash", "push", "-m", &backup_marker])
        .current_dir(worktree_path)
        .output()?;

    // 获取正确的 stash ref
    let stash_ref = if output.status.success() {
        // 获取 stash 后的列表，找到新创建的 stash
        let stashes_after = get_stash_list(worktree_path)?;

        if stashes_after.len() > stash_count_before {
            // 新增了 stash，找到匹配我们标记的那个
            let found = stashes_after
                .iter()
                .find(|(_, msg)| msg.contains(&backup_marker));
            if let Some((ref_str, _)) = found {
                ref_str.clone()
            } else {
                // 如果没找到匹配的，取最新的（第一个）
                stashes_after
                    .first()
                    .map(|(ref_str, _)| ref_str.clone())
                    .unwrap_or_else(|| "stash@{0}".to_string())
            }
        } else {
            // stash 数量没变，可能是没有 changes
            "no-stash".to_string()
        }
    } else {
        // 没有 changes 或失败
        "no-stash".to_string()
    };

    let now = Utc::now();
    let expires = now + Duration::days(7);

    let backup = BackupInfo {
        id: generate_backup_id(),
        original_path: worktree_path.to_string(),
        branch: branch.to_string(),
        created_at: now.to_rfc3339(),
        stash_ref,
        restored: false,
        expires_at: expires.to_rfc3339(),
    };

    // 保存元数据
    let backups = read_all_backups()?;
    let mut updated = backups;
    updated.push(backup.clone());
    write_backups(&updated)?;

    Ok(backup)
}

/// 获取备份列表
pub fn list_backups() -> anyhow::Result<BackupListResponse> {
    let backups = read_all_backups()?;

    // 过滤未过期且未恢复的备份
    let now = Utc::now();
    let active: Vec<BackupInfo> = backups
        .into_iter()
        .filter(|b| {
            if b.restored {
                return false;
            }
            let expires = DateTime::parse_from_rfc3339(&b.expires_at).ok();
            if let Some(e) = expires {
                e.with_timezone(&Utc) > now
            } else {
                true
            }
        })
        .collect();

    Ok(BackupListResponse {
        backups: active.clone(),
        total_count: active.len(),
    })
}

/// 恢复备份
pub fn restore_backup(
    backup_id: &str,
    target_path: Option<&str>,
) -> anyhow::Result<RestoreBackupResult> {
    let backups = read_all_backups()?;

    // 先找到备份的索引和克隆数据
    let backup_index = backups.iter().position(|b| b.id == backup_id);

    if backup_index.is_none() {
        return Ok(RestoreBackupResult {
            success: false,
            message: format!("找不到备份: {}", backup_id),
            restored_path: None,
        });
    }

    let idx = backup_index.ok_or_else(|| anyhow::anyhow!("Backup not found: {}", backup_id))?;
    let backup = backups
        .get(idx)
        .ok_or_else(|| anyhow::anyhow!("Invalid backup index: {}", idx))?;

    if backup.stash_ref == "no-stash" {
        return Ok(RestoreBackupResult {
            success: false,
            message: "此备份没有 stash 数据".to_string(),
            restored_path: None,
        });
    }

    // 确定恢复目标路径
    let restore_path = target_path.unwrap_or(&backup.original_path);

    // 路径验证：规范化路径并检查合法性
    let restore_path_buf = PathBuf::from(restore_path);

    // 检查路径是否存在
    if !restore_path_buf.exists() {
        return Ok(RestoreBackupResult {
            success: false,
            message: format!("目标路径不存在: {}", restore_path),
            restored_path: None,
        });
    }

    // 规范化路径，防止路径遍历攻击
    let canonical_path = match std::fs::canonicalize(&restore_path_buf) {
        Ok(p) => p,
        Err(e) => {
            return Ok(RestoreBackupResult {
                success: false,
                message: format!("无效的恢复路径: {}", e),
                restored_path: None,
            });
        }
    };

    // 验证路径是一个目录（worktree 应该是目录）
    if !canonical_path.is_dir() {
        return Ok(RestoreBackupResult {
            success: false,
            message: "目标路径不是一个目录".to_string(),
            restored_path: None,
        });
    }

    // 验证路径是一个 git 仓库
    let git_dir = canonical_path.join(".git");
    if !git_dir.exists() {
        return Ok(RestoreBackupResult {
            success: false,
            message: "目标路径不是一个 git worktree".to_string(),
            restored_path: None,
        });
    }

    let canonical_str = canonical_path.to_string_lossy().to_string();

    // 应用 stash
    let output = Command::new("git")
        .args(["stash", "pop", &backup.stash_ref])
        .current_dir(&canonical_path)
        .output()?;

    if !output.status.success() {
        return Ok(RestoreBackupResult {
            success: false,
            message: format!("恢复失败: {}", String::from_utf8_lossy(&output.stderr)),
            restored_path: None,
        });
    }

    // 更新备份状态
    let updated: Vec<BackupInfo> = backups
        .into_iter()
        .enumerate()
        .map(|(i, b)| {
            if i == idx {
                BackupInfo {
                    restored: true,
                    ..b
                }
            } else {
                b
            }
        })
        .collect();
    write_backups(&updated)?;

    Ok(RestoreBackupResult {
        success: true,
        message: format!("成功恢复备份到 {}", canonical_str),
        restored_path: Some(canonical_str),
    })
}

/// 删除单个备份
pub fn delete_backup(backup_id: &str) -> anyhow::Result<bool> {
    let backups = read_all_backups()?;
    let original_len = backups.len();
    let updated: Vec<BackupInfo> = backups.into_iter().filter(|b| b.id != backup_id).collect();

    if updated.len() == original_len {
        return Ok(false); // 没有找到
    }

    write_backups(&updated)?;
    Ok(true)
}

/// 清理过期备份
pub fn cleanup_expired_backups() -> anyhow::Result<usize> {
    let backups = read_all_backups()?;
    let original_len = backups.len();
    let now = Utc::now();

    let active: Vec<BackupInfo> = backups
        .into_iter()
        .filter(|b| {
            // 保留已恢复的（记录）和未过期的
            if b.restored {
                return true;
            }
            let expires = DateTime::parse_from_rfc3339(&b.expires_at).ok();
            if let Some(e) = expires {
                e.with_timezone(&Utc) > now
            } else {
                true
            }
        })
        .collect();

    let removed_count = original_len - active.len();

    // 也清理超过 100 个备份的情况
    let final_backups: Vec<BackupInfo> = if active.len() > 100 {
        // 保留最新的 100 个
        active.into_iter().rev().take(100).collect()
    } else {
        active
    };

    if removed_count > 0 {
        write_backups(&final_backups)?;
    }

    Ok(removed_count)
}

/// 获取备份详情
pub fn get_backup_info(backup_id: &str) -> anyhow::Result<Option<BackupInfo>> {
    let backups = read_all_backups()?;
    Ok(backups.into_iter().find(|b| b.id == backup_id))
}
