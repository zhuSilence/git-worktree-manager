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
- **Diff Comparison** - PR-style diff comparison (committed/unstaged/untracked sources, unified/split/three-way views)
  - **Three-Way View** - Show Base/Ours/Theirs simultaneously for conflict resolution
  - **Image Diff** - Support image file comparison
  - **Search** - Quick search within diff content
  - **Performance** - Lazy loading, syntax highlighting cache
- **Keyboard Shortcuts** - Full keyboard operation support for efficiency

### 🚀 Enhanced Features (P1)

- **Multi-Repository Management** - Sidebar repo list, quick switching, persistent storage
- **Branch Management** - Switch, create, and checkout remote branches
- **Branch Merge** - Merge source branch to target worktree, with conflict detection and abort/complete operations
- **Merge from Main** - One-click merge latest main branch code into current worktree, auto-handle uncommitted changes
- **Worktree Grouping** - Create groups to manage worktrees, preset colors, quick categorization
- **Settings Center** - Customize default IDE and terminal

### 🔮 Advanced Features (P2)

- **Smart Hints** - Merged branch alerts, stale branch reminders
- **Batch Operations** - Bulk delete, one-click cleanup
- **Timeline View** - View commit history timeline
- **Auto Update** - Detect new versions, auto download and install updates, show red dot badge on startup
- **Tags & Notes** - Add custom tags and notes to worktrees
- **Idle Detection** - Automatically detect long-unused worktrees
- **Smart Naming** - Suggest branch naming based on conventions
- **Operation Logs & Delete Protection** - Record operation history, auto backup before deletion, support recovery
- **Hotfix Workflow** - One-click start/complete/cancel hotfix workflow
- **Theme Switching** - Support Light / Dark / System theme modes

### 🤖 AI Features (P3)

- **AI Code Review** - Support multiple AI providers (OpenAI/Claude/Ollama/Custom), automatically review code changes, identify potential issues and improvement suggestions
- **AI Naming Suggestions** - Intelligently generate branch/worktree naming suggestions based on repo commit history and user input

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

## 📦 Installation

### macOS / Linux (One-line Install)

```bash
curl -fsSL https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.ps1 | iex
```

### Manual Download

Visit the [Releases](https://github.com/zhuSilence/git-worktree-manager/releases) page to download the installer for your platform:

| Platform | File Format | Notes |
|----------|-------------|-------|
| **macOS (Apple Silicon)** | `.dmg` | M1/M2/M3 chips |
| **macOS (Intel)** | `.dmg` | Intel chips |
| **Windows** | `.msi` / `.exe` | Installer |
| **Linux** | `.deb` / `.AppImage` | Debian/Ubuntu or generic |

### Homebrew (macOS)

```bash
brew tap zhuSilence/git-worktree-manager
brew install git-worktree-manager
```

### ⚠️ macOS Security Note

On first launch, macOS may show a **"Cannot verify developer"** warning because the app is not notarized by Apple.

**Solutions:**

**Method 1: Right-click to Open (Recommended)**
1. Find **Git Worktree Manager.app** in Finder
2. **Right-click** → Select **Open**
3. Click **Open** in the popup dialog to confirm

**Method 2: System Settings Allow**
1. Open **System Settings** → **Privacy & Security**
2. Find **Open Anyway** button at the bottom and click to allow

**Method 3: Remove Quarantine Attribute via Terminal**
```bash
xattr -cr "/Applications/Git Worktree Manager.app"
```

---

## 🛠️ Build from Source

### Requirements

- **Node.js** >= 18
- **Rust** >= 1.70
- **Git** >= 2.5 (2.17+ recommended)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/zhuSilence/git-worktree-manager.git
cd git-worktree-manager/code

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

### 4. Diff Comparison

Click the **compare icon** on the worktree card to view differences against the main branch in the right sidebar:

- 🔼 **Previous Change** - Jump to previous modified line
- 🔽 **Next Change** - Jump to next modified line
- **Unified View** - Merge display of old and new code
- **Split View** - Side-by-side comparison
- **Three-Way View** - Show Base (baseline), Ours (current), Theirs (target) for conflict resolution
- **Image Diff** - Auto-detect image files and display side-by-side comparison
- 🔍 **Search** - Quick search within diff content to locate key changes

> 💡 **Performance**: Diff module uses lazy loading and caching technology for smooth browsing even with large files

### 4. Branch Management

Click the **branch icon** on the worktree card:

- **Switch Branch** - Switch to an existing branch
- **Create Branch** - Create and switch to a new branch
- **Pull Remote** - Fetch and checkout remote branch

### 5. Branch Merge

Click the **merge icon** on the worktree card:

- **Select Target Branch** - Choose which worktree/branch to merge into
- **Execute Merge** - Merge current branch into target branch
- **Handle Conflicts** - Display conflict file list when conflicts occur, support abort or complete after resolution

### 6. Merge from Main

Click the **merge icon** in the toolbar to quickly merge the latest main branch code into current worktree:

- **Auto Stash** - Automatically save uncommitted changes before merging
- **Conflict Detection** - Detect conflicts during merge, show conflict file list
- **One-click Resolution** - Support abort merge or continue after resolving conflicts

### 7. Worktree Grouping

Manage worktrees through grouping:

- **Preset Groups** - Feature development, Bug fixes, Release, Others
- **Custom Groups** - Create new groups, set colors and descriptions
- **Quick Categorization** - Drag worktrees into corresponding groups

### 8. Smart Hints

Click the **warning icon** in the toolbar to view:

- **Merged Branches** - Safe to delete
- **Stale Branches** - Branches not updated for a long time

### 9. Hotfix Workflow

Click the **Hotfix icon** in the toolbar to start emergency fix workflow:

- **Start Hotfix** - Automatically create hotfix branch and worktree
- **Complete Hotfix** - Merge back to main branch and cleanup
- **Cancel Hotfix** - Abort current hotfix workflow

### 10. Theme Switching

Switch theme in the settings panel:

- **Light** - Light mode
- **Dark** - Dark mode
- **System** - Auto-follow system theme

> 💡 **Tip**: When selecting System mode, the app will automatically follow macOS/Windows theme settings

### 11. AI Features

Click the **AI icon** in the toolbar to configure and use AI features:

- **Configure AI** - Select provider (OpenAI/Claude/Ollama), set API Key
- **Code Review** - AI review of current diff, get improvement suggestions
- **Naming Suggestions** - Get AI-generated naming suggestions when creating worktree

### 12. Keyboard Shortcuts

Global keyboard shortcuts are supported for common operations without a mouse:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl + N` | Create Worktree | Open the Create Worktree dialog |
| `Cmd/Ctrl + R` | Refresh List | Refresh the current repository's worktree list |
| `Cmd/Ctrl + F` | Focus Search | Move focus to the search box |
| `Cmd/Ctrl + ,` | Open Settings | Open the settings panel |
| `Escape` | Close Dialog | Close the current open dialog or panel |

> 💡 **Tip**: Use `Cmd` on macOS, `Ctrl` on Windows/Linux

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
│   │   │   ├── DiffSidebar/    # Diff panel (DiffAlgorithm/DiffViews/FileTree/SyntaxHighlighter)
│   │   │   ├── BranchManager/  # Branch management
│   │   │   ├── MergePanel/     # Branch merge panel
│   │   │   ├── GroupPanel/     # Worktree grouping
│   │   │   ├── AIConfigPanel/  # AI config panel
│   │   │   ├── HotfixPanel/    # Hotfix workflow panel
│   │   │   ├── Timeline/       # Commit history timeline
│   │   │   ├── HintsPanel/     # Smart hints
│   │   │   ├── BatchActions/   # Batch operations
│   │   │   └── SettingsPanel/  # Settings panel
│   │   ├── stores/             # Zustand state (worktreeStore/repositoryStore/settingsStore/groupsStore)
│   │   ├── services/           # API services (git.ts/ai.ts/shell.ts)
│   │   ├── types/              # TypeScript types (worktree/ai/group/log/config)
│   │   ├── hooks/              # Custom hooks (useKeyboardShortcuts/useErrorHandler)
│   │   └── i18n/               # Internationalization
│   │
│   └── src-tauri/              # Tauri backend
│       ├── src/
│       │   ├── commands/       # Tauri commands
│       │   │   ├── worktree.rs # Worktree CRUD, branch ops, diff, push/pull
│       │   │   ├── merge.rs    # Branch merge (merge/abort/complete)
│       │   │   ├── log.rs      # Operation logs, delete protection, backup management
│       │   │   └── ai_review.rs # AI review, naming suggestions, config management
│       │   ├── models/         # Data models
│       │   ├── services/       # Business logic (git_service/ai_service/conflict_service/diff_service/merge_service/shell_service)
│       │   └── utils/          # Utility functions (validation)
│       └── tauri.conf.json     # Tauri config
│
├── docs/                       # Documentation
│   ├── 02-PRD.md              # Product requirements
│   ├── 03-技术方案.md          # Technical design
│   ├── 04-测试用例.md          # Test cases
│   ├── 05-测试报告.md          # Test report
│   ├── 06-回归测试报告.md       # Regression test report
│   ├── 07-自动更新方案.md       # Auto-update design
│   ├── 08-AI评审PRD.md        # AI review feature requirements
│   ├── 09-AI评审技术方案.md     # AI review technical design
│   ├── RELEASE-GUIDE.md       # Release guide
│   └── RELEASE.md             # Release notes
├── CHANGELOG.md               # Changelog
└── README.md                  # Project description
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
