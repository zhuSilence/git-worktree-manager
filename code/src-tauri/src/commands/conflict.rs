use crate::models::{ConflictDetectionResponse, ConflictPreviewRequest, ConflictPreviewResponse};
use crate::services::{detect_conflicts, get_conflict_preview};
use crate::utils::validation::validate_path;

/// 检测 worktree 之间的冲突风险
#[tauri::command]
pub async fn detect_conflicts_cmd(repo_path: String) -> Result<ConflictDetectionResponse, String> {
    let path = validate_path(&repo_path).map_err(|e| e.to_string())?;

    run_blocking(|| detect_conflicts(path.to_str().unwrap_or(""))).await
}

/// 获取冲突文件预览
#[tauri::command]
pub async fn get_conflict_preview_cmd(
    repo_path: String,
    file_path: String,
) -> Result<ConflictPreviewResponse, String> {
    let path = validate_path(&repo_path).map_err(|e| e.to_string())?;

    let request = ConflictPreviewRequest {
        repo_path: path.to_str().unwrap_or_default().to_string(),
        file_path,
    };

    run_blocking(|| get_conflict_preview(&request)).await
}

/// Helper: 在阻塞上下文中运行 git 操作
async fn run_blocking<T, F>(f: F) -> Result<T, String>
where
    F: FnOnce() -> anyhow::Result<T> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}