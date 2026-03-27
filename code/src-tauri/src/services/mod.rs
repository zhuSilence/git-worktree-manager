pub mod ai_service;
pub mod diff_service;
pub mod editor_service;
pub mod git_service;
pub mod worktree_service;

// Re-export commonly used functions for backward compatibility
pub use diff_service::{get_diff, get_detailed_diff, get_timeline};
pub use editor_service::{open_in_editor, open_in_file_manager, open_in_terminal};
pub use git_service::{
    create_and_switch_branch, fetch_and_checkout, is_git_repo, list_branches,
    pull, push, switch_branch, get_repository_info,
};
pub use worktree_service::{
    batch_delete_worktrees, create_worktree, delete_worktree, get_merged_hints, get_stale_hints,
    list_worktrees, prune_worktrees,
};