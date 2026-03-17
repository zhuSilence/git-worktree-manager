# Git Worktree Manager

<div align="center">

**Lightweight, Free, Cross-platform Git Worktree Visual Manager**

[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75-DEA584?logo=rust)](https://www.rust-lang.org/)

Making Git worktree as easy as slicing a cake 🍰

</div>

---

## ✨ Features

### 🎯 Core Features (P0)

- **Worktree Management** - List, create, and delete worktrees
- **Quick Actions** - One-click open in IDE, terminal, or file manager
- **Status Display** - Visualize Clean/Dirty/Conflict/Detached states
- **Search & Sort** - Quick filtering by name or status
- **Diff Comparison** - Code diff against main branch (unified/split view)

### 🚀 Enhanced Features (P1)

- **Multi-Repository Management** - Sidebar repo list, quick switching
- **Branch Management** - Switch, create, and checkout remote branches
- **Settings Center** - Customize default IDE and terminal

### 🔮 Advanced Features (P2)

- **Smart Hints** - Merged branch alerts, stale branch reminders
- **Batch Operations** - Bulk delete, one-click cleanup

---

## 📸 Interface Preview

```
┌────────────┬────────────────────────┬──────────────────────────────┐
│            │                        │  feature/auth vs main       │
│  Repos     │    Worktree List       │  ────────────────────────── │
│            │                        │  📄 3 files  +45  -12      │
│  🟢 my-app │  ┌──────────────────┐  │  ────────────────────────── │
│   main · 3 │  │ 🟢 main          │  │  ▼ [Modified] src/api.ts   │
│            │  │   fix: readme    │  │    10  | function hello() { │
│  📁 other  │  └──────────────────┘  │    11  - |   return 'old'   │
│   dev · 2  │                        │    11  + |   return 'new'   │
│            │  ┌──────────────────┐  │    12  | }                  │
│  [+ Add]   │  │ 🟡 feature/auth  │  └──────────────────────────────┘
│            │  │   feat: login    │       ← Resizable sidebar →
│            │  └──────────────────┘
└────────────┴────────────────────────┘
```

---

## 🚀 Quick Start

### Requirements

- **Node.js** >= 18
- **Rust** >= 1.70
- **Git** >= 2.5 (2.17+ recommended)
- **OS**: macOS 10.15+ / Windows 10+ / Ubuntu 18.04+

### Installation

```bash
# Clone the repository
git clone https://github.com/zhuSilence/git-worktree-manager.git
cd git-git-worktree-manager/code

# Install frontend dependencies
npm install

# Install Rust dependencies (auto-installed on first run)
cd src-tauri && cargo build && cd ..
```

### Development

```bash
# Start development server
npm run tauri:dev
```

### Build for Production

```bash
# Build production version
npm run tauri:build
```

Build outputs are located in `src-tauri/target/release/bundle/`.

---

## 📖 Usage Guide

### 1. Add Repository

Click the **"+ Add Repository"** button in the left sidebar and select a Git repository directory.

### 2. Manage Worktrees

- **Create**: Click the "Create" button at the top, select branch and set path
- **Delete**: Hover over the worktree card and click the delete icon
- **Open**: Click quick action buttons on the card (IDE/Terminal/Finder)

### 3. Diff Comparison

Click the **compare icon** on the worktree card to view differences against the main branch in the right sidebar:

- 🔼 **Previous Change** - Jump to previous modified line
- 🔼 **Next Change** - Jump to next modified line
- **Unified View** - Merge display of old and new code
- **Split View** - Side-by-side comparison

### 4. Branch Management

Click the **branch icon** on the worktree card:

- **Switch Branch** - Switch to an existing branch
- **Create Branch** - Create and switch to a new branch
- **Pull Remote** - Fetch and checkout remote branch

### 5. Smart Hints

Click the **warning icon** in the toolbar to view:

- **Merged Branches** - Safe to delete
- **Stale Branches** - Branches not updated for a long time

---

## 🛠️ Tech Stack

### Frontend

| Tech | Purpose |
|------|---------|
| [React 18](https://react.dev/) | UI Framework |
| [TypeScript](https://www.typescriptlang.org/) | Type Safety |
| [Tailwind CSS](https://tailwindcss.com/) | Styling |
| [Zustand](https://zustand-demo.pmnd.rs/) | State Management |
| [Lucide React](https://lucide.dev/) | Icon Library |

### Backend

| Tech | Purpose |
|------|---------|
| [Tauri 2.0](https://tauri.app/) | Desktop App Framework |
| [Rust](https://www.rust-lang.org/) | Backend Language |
| [git2](https://github.com/rust-lang/git2-rs) | Git Operations Library |

---

## 📁 Project Structure

```
git-worktree-manager/
├── code/
│   ├── src/                    # Frontend source
│   │   ├── components/         # React components
│   │   │   ├── Sidebar/        # Left repo list
│   │   │   ├── WorktreeList/   # Worktree list
│   │   │   ├── DiffSidebar/    # Diff panel
│   │   │   ├── BranchManager/  # Branch management
│   │   │   ├── HintsPanel/     # Smart hints
│   │   │   ├── BatchActions/   # Batch operations
│   │   │   └── SettingsPanel/  # Settings panel
│   │   ├── stores/             # Zustand state
│   │   ├── services/           # API services
│   │   └── types/              # TypeScript types
│   │
│   └── src-tauri/              # Tauri backend
│       ├── src/
│       │   ├── commands/       # Tauri commands
│       │   ├── models/         # Data models
│       │   ├── services/       # Business logic
│       │   └── utils/          # Utility functions
│       └── tauri.conf.json     # Tauri config
│
├── 01-市场分析.md
├── 02-PRD.md                   # Product requirements
├── 03-技术方案.md              # Technical design
├── 04-测试用例.md              # Test cases
└── 05-测试报告.md              # Test report
```

---

## 🔧 Configuration

### Supported IDEs

- VS Code (`code`)
- VS Code Insiders (`code-insiders`)
- Cursor (`cursor`)
- WebStorm (`webstorm`)
- IntelliJ IDEA (`idea`)

### Supported Terminals

**macOS:**
- Terminal (default)
- iTerm2
- Warp

**Windows:**
- CMD (default)
- PowerShell
- Windows Terminal

**Linux:**
- GNOME Terminal (default)
- Alacritty

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Commit Convention

Using [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation update
- `style:` Code formatting
- `refactor:` Refactoring
- `test:` Testing
- `chore:` Build/tools

---

## 📄 License

[MIT License](LICENSE)

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Modern desktop app framework
- [git2-rs](https://github.com/rust-lang/git2-rs) - Excellent Git bindings
- [Lucide](https://lucide.dev/) - Beautiful open-source icons

---

<div align="center">

**Made with ❤️ by the Git Worktree Manager Team**

</div>