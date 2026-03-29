# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git Worktree Manager is a cross-platform desktop application for visually managing Git worktrees. Built with Tauri 2.0 (Rust backend) and React 18 (TypeScript frontend).

## Development Commands

All commands run from the `code/` directory:

```bash
npm install              # Install dependencies
npm run tauri:dev        # Start full Tauri app in dev mode (frontend + backend)
npm run dev              # Start frontend dev server only (Vite, port 5173)
npm run build            # Build frontend (tsc + vite build)
npm run tauri:build      # Build production Tauri application

npm run lint             # ESLint (zero warnings enforced)
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check

npm run test             # Vitest in watch mode
npm run test:run         # Vitest single run
npm run test:coverage    # Vitest with v8 coverage
```

Run a single test file: `npx vitest run src/path/to/file.test.ts` (from `code/`)

Rust backend builds are handled by Tauri; no separate `cargo` commands needed for typical development.

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (WebView)                     │
│  React 18 + TypeScript + TailwindCSS    │
│  State: Zustand    i18n: i18next        │
└───────────────┬─────────────────────────┘
                │ Tauri IPC (invoke)
┌───────────────▼─────────────────────────┐
│  Backend (Rust)                         │
│  Tauri 2.0 Commands + git2 (libgit2)   │
└─────────────────────────────────────────┘
```

### Frontend (`code/src/`)

- **IPC layer**: `services/git.ts` and `services/ai.ts` wrap all `invoke()` calls to Rust. Every Tauri command has a corresponding typed wrapper here.
- **State**: Zustand stores in `stores/` — `worktreeStore` (worktree CRUD, loading state with transaction pattern), `repositoryStore` (multi-repo management), `settingsStore` (user preferences, persisted to localStorage), `aiReviewStore`, `updateStore`.
- **Components**: Feature-based folders (`WorktreeList/`, `DiffSidebar/`, `HotfixPanel/`, `Sidebar/`, etc.). Common UI primitives in `components/common/` (Button, Dialog, Toast, etc.) using Radix UI.
- **i18n**: `i18n/` directory with i18next + browser language detection.
- **Path alias**: `@/` maps to `code/src/` (configured in vite, vitest, and tsconfig).

### Backend (`code/src-tauri/src/`)

- **Commands** (`commands/`): Tauri `#[command]` handlers. `worktree.rs` handles all git/worktree/hotfix commands; `ai_review.rs` handles AI review. Commands use a `run_blocking` helper to wrap synchronous git2 operations as async. All path inputs go through `utils::validation::validate_path`.
- **Services** (`services/`): Core business logic — `worktree_service` (CRUD), `git_service` (branch ops, push/pull/fetch), `diff_service` (diff/timeline), `hotfix_service` (hotfix workflow), `editor_service` (open in terminal/editor/file manager), `ai_service` (AI code review via HTTP).
- **Models** (`models/`): Rust structs with serde for IPC serialization, matching TypeScript types in `types/`.
- **Re-exports**: `services/mod.rs` re-exports all public functions so commands import from `crate::services::*`.

### IPC Contract

Frontend `invoke('command_name_cmd', { camelCaseParams })` maps to Rust `#[command] pub async fn command_name_cmd(snake_case_params)`. Tauri auto-converts between camelCase (JS) and snake_case (Rust). All commands are registered in `lib.rs` via `generate_handler![]`.

### Key Features

- **Multi-repo**: Sidebar manages multiple repositories; `repositoryStore` tracks the active repo.
- **Diff viewer**: Split/unified diff views with syntax highlighting, implemented in `DiffSidebar/`.
- **Hotfix workflow**: Start/finish/abort hotfix via dedicated panel and backend service.
- **AI code review**: Configurable AI provider integration for reviewing diffs.
- **Auto-update**: Tauri updater plugin with GitHub releases endpoint.

## Adding New Tauri Commands

1. Define TypeScript types in `types/`
2. Add `invoke()` wrapper in `services/git.ts` (or `services/ai.ts`)
3. Implement Rust command in `commands/` calling service functions
4. Add service logic in `services/`
5. Register command in `lib.rs` `generate_handler![]`
6. Update Zustand store if frontend state management is needed

## Testing

- Frontend tests use Vitest + jsdom + React Testing Library
- Test files live next to source: `__tests__/` directories (e.g., `stores/__tests__/`, `i18n/__tests__/`, `utils/__tests__/`)
- Setup file: `src/setupTests.ts`
- No Rust tests currently configured

## Pre-commit

Husky + lint-staged runs ESLint fix and Prettier on staged `.ts`/`.tsx`/`.json`/`.css` files.
