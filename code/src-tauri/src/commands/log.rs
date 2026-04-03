use crate::models::{OperationLogListResponse, OperationLogFilter, BackupListResponse, CreateBackupRequest, RestoreBackupResult, DeleteProtectionCheck, BackupInfo};
use crate::services::{
    record_operation, list_operations, export_operations, cleanup_old_logs,
    check_delete_protection, create_backup, list_backups, restore_backup,
    delete_backup, cleanup_expired_backups, get_backup_info,
};
use crate::models::{OperationType, OperationResult};
use crate::utils::validation::validate_path;
use super::run_blocking;
use tauri::command;

// ============ 操作日志命令 ============

/// 获取操作日志列表
#[command]
pub async fn list_operation_logs_cmd(filter: Option<OperationLogFilter>) -> Result<OperationLogListResponse, String> {
    run_blocking(move || list_operations(filter)).await
}

/// 导出操作日志
#[command]
pub async fn export_operation_logs_cmd(output_path: String) -> Result<String, String> {
    validate_path(&output_path).map_err(|e| e.to_string())?;
    run_blocking(move || export_operations(&output_path)).await
}

/// 清理过期日志
#[command]
pub async fn cleanup_old_logs_cmd() -> Result<usize, String> {
    run_blocking(cleanup_old_logs).await
}

// ============ 删除保护命令 ============

/// 检查删除保护
#[command]
pub async fn check_delete_protection_cmd(worktree_path: String, branch: String) -> Result<DeleteProtectionCheck, String> {
    validate_path(&worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || check_delete_protection(&worktree_path, &branch)).await
}

/// 创建备份
#[command]
pub async fn create_backup_cmd(request: CreateBackupRequest) -> Result<BackupInfo, String> {
    validate_path(&request.worktree_path).map_err(|e| e.to_string())?;
    run_blocking(move || create_backup(&request.worktree_path, &request.branch)).await
}

/// 获取备份列表
#[command]
pub async fn list_backups_cmd() -> Result<BackupListResponse, String> {
    run_blocking(list_backups).await
}

/// 恢复备份
#[command]
pub async fn restore_backup_cmd(backup_id: String, target_path: Option<String>) -> Result<RestoreBackupResult, String> {
    if let Some(ref path) = target_path {
        validate_path(path).map_err(|e| e.to_string())?;
    }
    run_blocking(move || restore_backup(&backup_id, target_path.as_deref())).await
}

/// 删除备份
#[command]
pub async fn delete_backup_cmd(backup_id: String) -> Result<bool, String> {
    run_blocking(move || delete_backup(&backup_id)).await
}

/// 清理过期备份
#[command]
pub async fn cleanup_expired_backups_cmd() -> Result<usize, String> {
    run_blocking(cleanup_expired_backups).await
}

/// 获取备份详情
#[command]
pub async fn get_backup_info_cmd(backup_id: String) -> Result<Option<BackupInfo>, String> {
    run_blocking(move || get_backup_info(&backup_id)).await
}

// ============ 增强的删除命令（带日志和保护） ============

/// 删除 Worktree（带日志记录和删除保护）
#[command]
pub async fn delete_worktree_with_protection_cmd(
    repo_path: String,
    worktree_path: String,
    branch: String,
    force: bool,
) -> Result<crate::models::WorktreeResult, String> {
    validate_path(&repo_path).map_err(|e| e.to_string())?;
    validate_path(&worktree_path).map_err(|e| e.to_string())?;

    // 1. 检查删除保护
    let protection_result = check_delete_protection(&worktree_path, &branch)
        .map_err(|e| e.to_string())?;

    // 2. 执行删除
    let delete_result = crate::services::delete_worktree(&repo_path, &worktree_path, force)
        .map_err(|e| e.to_string())?;

    // 3. 记录操作日志
    let (op_result, error_msg) = if delete_result.success {
        (OperationResult::Success, None)
    } else {
        (OperationResult::Failed, Some(delete_result.message.clone()))
    };

    let details = if protection_result.backup_created {
        Some(format!("backup_id={}", protection_result.backup_id.unwrap_or_default()))
    } else {
        None
    };

    record_operation(
        &repo_path,
        OperationType::Delete,
        &branch,
        details,
        op_result,
        error_msg,
    ).map_err(|e| e.to_string())?;

    Ok(delete_result)
}