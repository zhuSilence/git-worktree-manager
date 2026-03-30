mod commands;
mod models;
mod services;
mod utils;

use log::{error, info};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    env_logger::Builder::new()
        .filter_level(log::LevelFilter::Info)
        .init();
    info!("Git Worktree Manager starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                } else {
                    error!("Could not get main window for DevTools");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::worktree::list_worktrees_cmd,
            commands::worktree::create_worktree_cmd,
            commands::worktree::delete_worktree_cmd,
            commands::worktree::prune_worktrees_cmd,
            commands::worktree::open_in_terminal_cmd,
            commands::worktree::open_in_editor_cmd,
            commands::worktree::open_worktree_cmd,
            commands::worktree::is_git_repo_cmd,
            commands::worktree::list_branches_cmd,
            commands::worktree::get_diff_cmd,
            commands::worktree::get_detailed_diff_cmd,
            commands::worktree::get_repository_info_cmd,
            commands::worktree::switch_branch_cmd,
            commands::worktree::create_branch_cmd,
            commands::worktree::fetch_remote_branch_cmd,
            commands::worktree::batch_delete_worktrees_cmd,
            commands::worktree::get_merged_hints_cmd,
            commands::worktree::get_stale_hints_cmd,
            commands::worktree::get_timeline_cmd,
            commands::worktree::push_cmd,
            commands::worktree::pull_cmd,
            commands::worktree::fetch_all_cmd,
            commands::worktree::list_remote_branches_cmd,
            // AI 评审命令
            commands::ai_review::save_ai_config,
            commands::ai_review::get_ai_config,
            commands::ai_review::test_ai_connection,
            commands::ai_review::ai_review,
            commands::ai_review::ai_naming_suggestion,
            // Hotfix 相关命令
            commands::worktree::start_hotfix_cmd,
            commands::worktree::finish_hotfix_cmd,
            commands::worktree::abort_hotfix_cmd,
            commands::worktree::get_hotfix_status_cmd,
            // 操作日志和删除保护命令
            commands::log::list_operation_logs_cmd,
            commands::log::export_operation_logs_cmd,
            commands::log::cleanup_old_logs_cmd,
            commands::log::check_delete_protection_cmd,
            commands::log::create_backup_cmd,
            commands::log::list_backups_cmd,
            commands::log::restore_backup_cmd,
            commands::log::delete_backup_cmd,
            commands::log::cleanup_expired_backups_cmd,
            commands::log::get_backup_info_cmd,
            commands::log::delete_worktree_with_protection_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
