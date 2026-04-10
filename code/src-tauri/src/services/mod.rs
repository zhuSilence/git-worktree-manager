pub mod ai_service;
pub mod backup_service;
pub mod conflict_service;
pub mod diff_service;
pub mod editor_service;
pub mod git_service;
pub mod hotfix_service;
pub mod log_service;
pub mod merge_service;
pub mod worktree_service;

// Re-export commonly used functions for backward compatibility
pub use backup_service::{
    check_delete_protection, cleanup_expired_backups, create_backup, delete_backup,
    get_backup_info, list_backups, restore_backup,
};
pub use conflict_service::detect_conflicts;
pub use diff_service::{get_detailed_diff, get_diff, get_three_way_diff, get_timeline};
pub use editor_service::{open_in_editor, open_in_file_manager, open_in_terminal};
pub use git_service::{
    create_and_switch_branch, fetch_all, fetch_and_checkout, get_recent_commits,
    get_repository_info, is_git_repo, list_branches, list_remote_branches, pull, push,
    switch_branch,
};
pub use hotfix_service::{abort_hotfix, finish_hotfix, get_hotfix_status, start_hotfix};
pub use log_service::{cleanup_old_logs, export_operations, list_operations, record_operation};
pub use merge_service::{abort_merge, complete_merge, merge_branch_in_worktree};
pub use worktree_service::{
    batch_delete_worktrees, create_worktree, delete_worktree, get_merged_hints, get_stale_hints,
    get_worktree_status, list_worktrees, prune_worktrees,
};
