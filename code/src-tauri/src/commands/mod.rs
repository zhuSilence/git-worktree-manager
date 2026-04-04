pub mod ai_review;
pub mod log;
pub mod merge;
pub mod worktree;

use tauri::async_runtime::spawn_blocking;

/// 辅助函数：包装同步操作为异步，统一处理错误转换
pub async fn run_blocking<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce() -> anyhow::Result<T> + Send + 'static,
    T: Send + 'static,
{
    spawn_blocking(f)
        .await
        .map_err(|e| format!("Task join error: {}", e))?
        .map_err(|e| e.to_string())
}
