pub mod ai_service;
pub mod backup_service;
pub mod diff_service;
pub mod editor_service;
pub mod git_service;
pub mod hotfix_service;
pub mod log_service;
pub mod worktree_service;

// Re-export commonly used functions for backward compatibility
pub use backup_service::{
    check_delete_protection, create_backup, list_backups, restore_backup, 
    delete_backup, cleanup_expired_backups, get_backup_info,
};
pub use diff_service::{get_diff, get_detailed_diff, get_timeline};
pub use editor_service::{open_in_editor, open_in_file_manager, open_in_terminal};
pub use git_service::{
    create_and_switch_branch, fetch_and_checkout, is_git_repo, list_branches,
    pull, push, switch_branch, get_repository_info, fetch_all, list_remote_branches,
};
pub use hotfix_service::{
    start_hotfix, finish_hotfix, abort_hotfix, get_hotfix_status,
};
pub use log_service::{
    record_operation, list_operations, export_operations, cleanup_old_logs,
};
pub use worktree_service::{
    batch_delete_worktrees, create_worktree, delete_worktree, get_merged_hints, get_stale_hints,
    list_worktrees, prune_worktrees, get_worktree_status,
};