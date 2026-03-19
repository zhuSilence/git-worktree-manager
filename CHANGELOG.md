# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.5] - 2026-03-19

### ✨ Added

- GitHub Actions workflows
  - `labeler.yml`: Auto-label PRs with size and path-based labels
  - `stale.yml`: Auto-manage stale issues and PRs
  - `update-tap.yml`: Auto-update Homebrew Tap on release
- Homebrew Tap support
  - New tap repository: `zhuSilence/homebrew-git-worktree-manager`
  - Auto-update Cask on release with SHA256
- Documentation
  - `RELEASE-GUIDE.md`: Complete release workflow guide
  - macOS security notice in README

### 🔧 Changed

- Fixed install script download URLs to match release filenames
- Updated Homebrew Cask binary path

---

## [0.0.1] - 2026-03-17

### ✨ Added

First release of Git Worktree Manager!

#### Core Features (P0)
- Worktree management
  - List all worktrees with status
  - Create worktree from existing or new branch
  - Delete worktree with confirmation
  - Prune stale worktree references
- Quick actions
  - Open in IDE (VS Code, Cursor, WebStorm, IntelliJ)
  - Open in Terminal (Terminal, iTerm2, Warp)
  - Open in File Manager (Finder, Explorer)
- Status display
  - Clean/Dirty/Conflict/Detached status visualization
  - Last commit info (hash, message, relative time)
- Search and sort
  - Filter by branch name or path
  - Sort by name or status
- Diff comparison
  - Compare with main branch
  - Unified view and split view
  - Line-by-line diff display
  - Navigate between changes
- Settings center
  - Configure default IDE
  - Configure default terminal

#### Enhanced Features (P1)
- Multi-repository management
  - Sidebar repository list
  - Quick switch between repos
  - Persistent storage
- Branch management
  - Switch to existing branch
  - Create new branch
  - Fetch and checkout remote branch

#### Advanced Features (P2)
- Smart hints
  - Merged branch notification
  - Stale branch notification
  - One-click cleanup
- Batch operations
  - Multi-select worktrees
  - Batch delete with force option

### 🔧 Changed

- UI optimization with collapsible panels
- Diff view moved from modal to sidebar
- Sidebar width adjustable by drag

### 🐛 Fixed

- Text overflow in repository and worktree panels
- Diff view rendering issues
- Input validation for branch names and paths

### 📦 Technical

- Built with Tauri 2.0 + React 18 + TypeScript 5
- Rust backend with git2 library
- Tailwind CSS for styling
- Zustand for state management

---

[Unreleased]: https://github.com/zhuSilence/git-worktree-manager/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/zhuSilence/git-worktree-manager/compare/v0.0.1...v0.0.5
[0.0.1]: https://github.com/zhuSilence/git-worktree-manager/releases/tag/v0.0.1