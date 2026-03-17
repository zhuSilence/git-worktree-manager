# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git Worktree Manager is a lightweight, cross-platform desktop application for visually managing Git worktrees. It's built with Tauri 2.0 (Rust backend) and React 18 (TypeScript frontend).

## Development Commands

All commands should be run from the `code/` directory:

```bash
# Install dependencies
npm install

# Start frontend dev server (Vite)
npm run dev

# Start Tauri in development mode (requires Rust toolchain)
npm run tauri:dev

# Build frontend only
npm run build

# Build production Tauri application
npm run tauri:build

# Run ESLint
npm run lint
```

## Architecture

### Two-Layer Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (WebView)                     │
│  React + TypeScript + TailwindCSS       │
│  State: Zustand                         │
└───────────────┬─────────────────────────┘
                │ Tauri IPC (invoke)
┌───────────────▼─────────────────────────┐
│  Backend (Rust)                         │
│  Tauri Commands + git2 (libgit2)        │
└─────────────────────────────────────────┘
```

### Frontend Structure (`code/src/`)

- `components/` - React UI components organized by feature
- `services/git.ts` - Tauri command wrappers for Git operations
- `services/shell.ts` - Tauri command wrappers for shell operations
- `stores/` - Zustand stores (`worktreeStore.ts`, `settingsStore.ts`)
- `types/` - TypeScript interfaces for Worktree, Branch, Config

### Backend Structure (planned `code/src-tauri/src/`)

- `commands/` - Tauri command handlers exposed to frontend
- `services/` - Core business logic (git_service, shell_service)
- `models/` - Rust structs matching TypeScript types

### Key Patterns

1. **Tauri IPC**: Frontend calls Rust via `invoke()` from `@tauri-apps/api/core`
2. **State Management**: Zustand with devtools middleware; stores in `stores/`
3. **Path Alias**: Use `@/` for imports (e.g., `import { Worktree } from '@/types/worktree'`)

## Adding New Features

1. Define TypeScript types in `types/`
2. Add Tauri command wrapper in `services/git.ts` or `services/shell.ts`
3. Update Zustand store if state management needed
4. Implement Rust command in `src-tauri/src/commands/`
5. Register command in `src-tauri/src/lib.rs`

## Notes

- The Rust backend (`src-tauri/`) has not been created yet
- Frontend uses shadcn/ui-style components with Radix UI primitives
- Dark mode is supported via Tailwind's `dark:` variants and class strategy