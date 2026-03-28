use crate::models::{BackupInfo, BackupListResponse, RestoreBackupResult, DeleteProtectionCheck};
use crate::services::get_worktree_status;
use crate::models::WorktreeStatus;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::PathBuf;
use std::process::Command;
use chrono::{DateTime, Utc, Duration};
use uuid::Uuid;
use git2::Repository;

/// 备份存储目录
fn get_backup_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".worktree-manager").join("backups")
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
        .filter_map(|line| line.ok())
        .filter_map(|line| serde_json::from_str(&line).ok())
        .collect();

    Ok(backups)
}

/// 写入备份元数据
fn write_backups(backups: &[BackupInfo]) -> anyhow::Result<()> {
    ensure_backup_dir()?;
    let meta_file = get_backup_meta_file();
    let file = File::create(&meta_file)?;
    let mut writer = BufWriter::new(file);

    for backup in backups {
        let json = serde_json::to_string(backup)?;
        writer.write_all(json.as_bytes())?;
        writer.write_all(b"\n")?;
    }
    writer.flush()?;
    Ok(())
}

/// 检查删除保护（检查是否有未提交更改）
pub fn check_delete_protection(worktree_path: &str, branch: &str) -> anyhow::Result<DeleteProtectionCheck> {
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

/// 创建备份
pub fn create_backup(worktree_path: &str, branch: &str) -> anyhow::Result<BackupInfo> {
    ensure_backup_dir()?;

    // 创建 git stash
    let output = Command::new("git")
        .args(["stash", "push", "-m", &format!("backup-{}", branch)])
        .current_dir(worktree_path)
        .output()?;

    // 获取 stash ref
    let stash_ref = if output.status.success() {
        // stash 输出格式: "Saved working directory and index state On branch: backup-xxx"
        // 我们需要获取 stash@{0} 这样的 ref
        "stash@{0}".to_string()
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
        stash_ref: stash_ref,
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
pub fn restore_backup(backup_id: &str, target_path: Option<&str>) -> anyhow::Result<RestoreBackupResult> {
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

    let idx = backup_index.unwrap();
    let backup = &backups[idx];

    if backup.stash_ref == "no-stash" {
        return Ok(RestoreBackupResult {
            success: false,
            message: "此备份没有 stash 数据".to_string(),
            restored_path: None,
        });
    }

    // 确定恢复目标路径
    let restore_path = target_path.unwrap_or(&backup.original_path);

    // 检查目标路径是否存在
    if !PathBuf::from(restore_path).exists() {
        return Ok(RestoreBackupResult {
            success: false,
            message: format!("目标路径不存在: {}", restore_path),
            restored_path: None,
        });
    }

    // 应用 stash
    let output = Command::new("git")
        .args(["stash", "pop", &backup.stash_ref])
        .current_dir(restore_path)
        .output()?;

    if !output.status.success() {
        return Ok(RestoreBackupResult {
            success: false,
            message: format!("恢复失败: {}", String::from_utf8_lossy(&output.stderr)),
            restored_path: None,
        });
    }

    // 保存恢复路径用于返回消息
    let restored_path_str = restore_path.to_string();

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
        message: format!("成功恢复备份到 {}", restored_path_str),
        restored_path: Some(restored_path_str),
    })
}

/// 删除单个备份
pub fn delete_backup(backup_id: &str) -> anyhow::Result<bool> {
    let backups = read_all_backups()?;
    let original_len = backups.len();
    let updated: Vec<BackupInfo> = backups
        .into_iter()
        .filter(|b| b.id != backup_id)
        .collect();

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