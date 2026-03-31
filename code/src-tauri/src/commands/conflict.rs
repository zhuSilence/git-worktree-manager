use crate::models::ConflictDetectionResponse;
use crate::services::conflict_service::{detect_conflicts, get_conflict_preview};
use tauri::State;
use std::sync::Mutex;

/// 冲突检测结果缓存
pub struct ConflictState {
    pub last_detection: Mutex<Option<ConflictDetectionResponse>>,
}

impl Default for ConflictState {
    fn default() -> Self {
        Self {
            last_detection: Mutex::new(None),
        }
    }
}

/// 检测 worktree 之间的文件冲突
#[tauri::command]
pub fn check_conflicts(repo_path: String, main_branch: String) -> ConflictDetectionResponse {
    detect_conflicts(&repo_path, &main_branch)
        .unwrap_or_else(|e| ConflictDetectionResponse {
            success: false,
            message: format!("检测失败: {}", e),
            detected_at: chrono::Utc::now().to_rfc3339(),
            conflicts: vec![],
            high_risk_count: 0,
            medium_risk_count: 0,
            low_risk_count: 0,
            worktree_count: 0,
        })
}

/// 获取文件的冲突预览
#[tauri::command]
pub fn get_file_conflict_preview(worktree_path: String, main_branch: String, file_path: String) -> String {
    get_conflict_preview(&worktree_path, &main_branch, &file_path)
        .unwrap_or_else(|e| format!("获取预览失败: {}", e))
}

/// 获取上次冲突检测结果
#[tauri::command]
pub fn get_last_conflict_detection(state: State<ConflictState>) -> Option<ConflictDetectionResponse> {
    state.last_detection.lock().unwrap().clone()
}