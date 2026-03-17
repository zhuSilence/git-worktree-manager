mod commands;
mod models;
mod services;
mod utils;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::worktree::list_worktrees,
            commands::worktree::create_worktree,
            commands::worktree::delete_worktree,
            commands::worktree::prune_worktrees,
            commands::worktree::open_in_terminal,
            commands::worktree::open_in_editor,
            commands::worktree::open_worktree,
            commands::worktree::is_git_repo,
            commands::worktree::list_branches,
            commands::worktree::get_diff,
            commands::worktree::get_detailed_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}