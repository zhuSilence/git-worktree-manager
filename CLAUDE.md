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
Frontend (WebView)  ←→  Tauri IPC (invoke)  ←→  Backend (Rust)
React 18 + TypeScript                        Tauri 2.0 + git2
State: Zustand    i18n: i18next              Commands → Services → Models
```

详见 [docs/技术方案.md](docs/技术方案.md)

## Adding New Tauri Commands

1. Define TypeScript types in `types/`
2. Add `invoke()` wrapper in `services/git.ts` (or `services/ai.ts`)
3. Implement Rust command in `commands/` calling service functions
4. Add service logic in `services/`
5. Register command in `lib.rs` `generate_handler![]`
6. Update Zustand store if frontend state management is needed

## Testing

- Frontend tests: Vitest + jsdom + React Testing Library
- Test files: `__tests__/` directories alongside source
- Setup: `src/setupTests.ts`
- No Rust tests currently configured

## Pre-commit

Husky + lint-staged runs ESLint fix and Prettier on staged `.ts`/`.tsx`/`.json`/`.css` files.

## Documentation Index

| 文档 | 位置 | 内容 |
|------|------|------|
| PRD | [docs/PRD.md](docs/PRD.md) | 产品需求、功能清单、数据模型、迭代记录 |
| 技术方案 | [docs/技术方案.md](docs/技术方案.md) | 架构设计、IPC 合约、安全设计、自动更新 |
| 发布指南 | [RELEASE-GUIDE.md](RELEASE-GUIDE.md) | 版本管理、CI/CD、Homebrew Tap 维护 |
| 更新日志 | [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |

## Documentation Update Convention

When making code changes, update the corresponding documentation sections:

| 变更类型 | 需更新的文档章节 |
|----------|-----------------|
| 新增/修改功能 | PRD > 功能清单 + 迭代记录 |
| 架构变更（新增模块/命令/Store） | 技术方案 > 目录结构 + IPC 合约 |
| 新增数据模型 | PRD > 数据模型 + 技术方案 > 数据模型 |
| 安全相关变更 | 技术方案 > 安全设计 |
| 版本发布 | CHANGELOG.md + PRD > 迭代记录 |
