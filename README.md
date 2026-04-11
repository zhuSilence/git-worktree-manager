# Git Worktree Manager

<div align="center">

**轻量级、免费、跨平台的 Git Worktree 可视化管理器**

[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75-DEA584?logo=rust)](https://www.rust-lang.org/)

让 Git worktree 像切蛋糕一样简单 🍰

</div>

---

## ✨ 功能特性

### 🎯 核心功能 (P0)

- **Worktree 管理** - 列表展示、创建、删除 worktree
- **快捷操作** - 一键在 IDE、终端、文件管理器中打开
- **状态展示** - Clean/Dirty/Conflict/Detached 状态可视化
- **搜索排序** - 按名称、状态快速筛选
- **Diff 对比** - PR 风格差异对比（显示 committed/unstaged/untracked 三种来源，统一/拆分/三路视图）
  - **三路视图** - 同时显示 Base/Ours/Theirs，方便冲突解决
  - **图片对比** - 支持图片文件的差异展示
  - **搜索功能** - 快速搜索 Diff 内容
  - **性能优化** - 懒加载、语法高亮缓存
- **键盘快捷键** - 全键盘操作支持，提升开发效率

### 🚀 增强功能 (P1)

- **多仓库管理** - 侧边栏仓库列表，快速切换，支持持久化存储
- **分支管理** - 切换、创建、拉取远程分支
- **分支合并** - 将源分支合并到目标 worktree，支持冲突检测和中止/完成操作
- **从主分支合并** - 一键将主分支最新代码合并到当前 worktree，自动处理未提交变更
- **Worktree 分组** - 创建分组管理 worktree，预设颜色，快速分类
- **设置中心** - 自定义默认 IDE 和终端

### 🔮 高级功能 (P2)

- **智能提示** - 已合并分支、陈旧分支提醒
- **批量操作** - 批量删除、一键清理
- **Timeline 视图** - 查看提交历史时间线
- **自动更新** - 检测新版本、自动下载安装更新，启动时显示红点提示
- **标签与备注** - 为 worktree 添加自定义标签和备注
- **空闲检测** - 自动检测长时间未使用的 worktree
- **智能命名** - 基于命名规范给出分支命名建议
- **操作日志与删除保护** - 记录操作历史，删除前自动备份，支持恢复
- **Hotfix 流程** - 一键开始/完成/取消 hotfix 工作流
- **主题切换** - 支持 Light / Dark / System 三种主题模式

### 🤖 AI 功能 (P3)

- **AI 代码评审** - 支持多 AI 提供商（OpenAI/Claude/Ollama/自定义），自动评审代码变更，识别潜在问题和改进建议
- **AI 命名建议** - 基于仓库提交历史和用户输入，智能生成分支/worktree 命名建议

---

## 📸 界面预览

```
┌────────────┬────────────────────────┬──────────────────────────────┐
│            │                        │  feature/auth vs main       │
│  仓库列表   │    Worktree 列表        │  ────────────────────────── │
│            │                        │  📄 3 文件  +45  -12        │
│  🟢 my-app │  ┌──────────────────┐  │  ────────────────────────── │
│   main · 3 │  │ 🟢 main          │  │  ▼ [修改] src/api.ts       │
│            │  │   fix: readme    │  │    10  | function hello() { │
│  📁 other  │  └──────────────────┘  │    11  - |   return 'old'   │
│   dev · 2  │                        │    11  + |   return 'new'   │
│            │  ┌──────────────────┐  │    12  | }                  │
│  [+ 添加]  │  │ 🟡 feature/auth  │  └──────────────────────────────┘
│            │  │   feat: login    │         ← 可拖拽调整宽度 →
│            │  └──────────────────┘
└────────────┴────────────────────────┘
```

---

## 📦 安装

### macOS / Linux (一键安装)

```bash
curl -fsSL https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.ps1 | iex
```

### 手动下载

前往 [Releases](https://github.com/zhuSilence/git-worktree-manager/releases) 页面下载对应平台的安装包：

| 平台 | 文件格式 | 说明 |
|------|----------|------|
| **macOS (Apple Silicon)** | `.dmg` | M1/M2/M3 芯片 |
| **macOS (Intel)** | `.dmg` | Intel 芯片 |
| **Windows** | `.msi` / `.exe` | 安装程序 |
| **Linux** | `.deb` / `.AppImage` | Debian/Ubuntu 或通用 |

### Homebrew (macOS)

```bash
brew tap zhuSilence/git-worktree-manager
brew install git-worktree-manager
```

### ⚠️ macOS 安全提示

首次打开应用时，macOS 可能会提示 **"无法验证开发者"**，这是因为应用未经 Apple 公证。

**解决方法：**

**方法 1：右键打开（推荐）**
1. 在 Finder 中找到 **Git Worktree Manager.app**
2. **右键点击** → 选择 **打开**
3. 点击弹出的 **打开** 按钮确认

**方法 2：系统设置允许**
1. 打开 **系统设置** → **隐私与安全性**
2. 在底部找到 **仍要打开** 按钮，点击允许

**方法 3：命令行移除隔离属性**
```bash
xattr -cr "/Applications/Git Worktree Manager.app"
```

---

## 🛠️ 从源码构建

### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70
- **Git** >= 2.5 (建议 2.17+)

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/zhuSilence/git-worktree-manager.git
cd git-worktree-manager/code

# 安装前端依赖
npm install

# 安装 Rust 依赖（首次运行会自动安装）
cd src-tauri && cargo build && cd ..
```

### 开发模式

```bash
# 启动开发服务器
npm run tauri:dev
```

### 构建发布

```bash
# 构建生产版本
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

---

## 📖 使用指南

### 1. 添加仓库

点击左侧边栏的 **"+ 添加仓库"** 按钮，选择一个 Git 仓库目录。

### 2. 管理 Worktree

- **创建**: 点击顶部 "创建" 按钮，选择分支、设置路径
- **删除**: 悬停 worktree 卡片，点击删除图标
- **打开**: 点击卡片上的快捷按钮（IDE/终端/Finder）

### 4. Diff 对比

点击 worktree 卡片上的 **对比图标**，在右侧边栏查看与主分支的差异：

- 🔼 **上一个变更** - 跳转到上一个修改的代码行
- 🔽 **下一个变更** - 跳转到下一个修改的代码行
- **统一视图** - 合并显示新旧代码
- **拆分视图** - 左右对照显示
- **三路视图** - 同时显示 Base（基准）、Ours（当前）、Theirs（目标），方便冲突解决
- **图片对比** - 自动识别图片文件，并排显示对比
- 🔍 **搜索** - 快速搜索 Diff 内容，定位关键变更

> 💡 **性能优化**: Diff 模块采用懒加载和缓存技术，大文件也能流畅浏览

### 4. 分支管理

点击 worktree 卡片上的 **分支图标**：

- **切换分支** - 切换到已有分支
- **创建分支** - 创建并切换到新分支
- **拉取远程** - Fetch 并 checkout 远程分支

### 5. 分支合并

点击 worktree 卡片上的 **合并图标**：

- **选择目标分支** - 选择要合并到哪个 worktree/分支
- **执行合并** - 将当前分支合并到目标分支
- **处理冲突** - 冲突时显示冲突文件列表，支持中止或解决后完成

### 6. 从主分支合并

点击工具栏的 **合并图标**，快速将主分支的最新代码合并到当前 worktree：

- **自动 Stash** - 合并前自动保存未提交的变更
- **冲突检测** - 合并时检测冲突，显示冲突文件列表
- **一键解决** - 支持中止合并或解决冲突后继续

### 7. Worktree 分组

通过分组功能管理 worktree：

- **预设分组** - 功能开发、Bug 修复、发布、其他
- **自定义分组** - 创建新分组，设置颜色和描述
- **快速分类** - 将 worktree 拖入对应分组

### 8. 智能提示

点击工具栏的 **警告图标**，查看：

- **已合并分支** - 可以安全删除
- **陈旧分支** - 长期未更新的分支

### 9. Hotfix 流程

点击工具栏的 **Hotfix 图标**，启动紧急修复流程：

- **开始 Hotfix** - 自动创建 hotfix 分支和 worktree
- **完成 Hotfix** - 合并回主分支并清理
- **取消 Hotfix** - 中止当前 hotfix 流程

### 10. 主题切换

在设置面板中切换主题：

- **Light** - 浅色模式
- **Dark** - 深色模式
- **System** - 自动跟随系统主题

> 💡 **提示**: 选择 System 模式时，应用会自动跟随 macOS/Windows 的主题设置

### 11. AI 功能

点击工具栏的 **AI 图标**，配置和使用 AI 功能：

- **配置 AI** - 选择提供商（OpenAI/Claude/Ollama），设置 API Key
- **代码评审** - 对当前 Diff 进行 AI 评审，获取改进建议
- **命名建议** - 创建 worktree 时获取 AI 生成的命名建议

### 12. 键盘快捷键

支持全局键盘快捷键，无需鼠标即可完成常用操作：

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Cmd/Ctrl + N` | 创建 Worktree | 打开创建 Worktree 对话框 |
| `Cmd/Ctrl + R` | 刷新列表 | 刷新当前仓库的 Worktree 列表 |
| `Cmd/Ctrl + F` | 聚焦搜索 | 将焦点移至搜索框 |
| `Cmd/Ctrl + ,` | 打开设置 | 打开设置面板 |
| `Escape` | 关闭对话框 | 关闭当前打开的对话框或面板 |

> 💡 **提示**: macOS 使用 `Cmd` 键，Windows/Linux 使用 `Ctrl` 键

---

## 🛠️ 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| [React 18](https://react.dev/) | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全 |
| [Tailwind CSS](https://tailwindcss.com/) | 样式方案 |
| [Zustand](https://zustand-demo.pmnd.rs/) | 状态管理 |
| [Lucide React](https://lucide.dev/) | 图标库 |

### 后端

| 技术 | 用途 |
|------|------|
| [Tauri 2.0](https://tauri.app/) | 桌面应用框架 |
| [Rust](https://www.rust-lang.org/) | 后端语言 |
| [git2](https://github.com/rust-lang/git2-rs) | Git 操作库 |

---

## 📁 项目结构

```
git-worktree-manager/
├── code/
│   ├── src/                    # 前端源码
│   │   ├── components/         # React 组件
│   │   │   ├── Sidebar/        # 左侧仓库列表
│   │   │   ├── WorktreeList/   # Worktree 列表
│   │   │   ├── DiffSidebar/    # Diff 对比面板（含 DiffAlgorithm/DiffViews/FileTree/SyntaxHighlighter）
│   │   │   ├── BranchManager/  # 分支管理
│   │   │   ├── MergePanel/     # 分支合并面板
│   │   │   ├── GroupPanel/     # Worktree 分组管理
│   │   │   ├── AIConfigPanel/  # AI 配置面板
│   │   │   ├── HotfixPanel/    # Hotfix 流程面板
│   │   │   ├── Timeline/       # 提交历史时间线
│   │   │   ├── HintsPanel/     # 智能提示
│   │   │   ├── BatchActions/   # 批量操作
│   │   │   └── SettingsPanel/  # 设置面板
│   │   ├── stores/             # Zustand 状态（worktreeStore/repositoryStore/settingsStore/groupsStore）
│   │   ├── services/           # API 服务（git.ts/ai.ts/shell.ts）
│   │   ├── types/              # TypeScript 类型（worktree/ai/group/log/config）
│   │   ├── hooks/              # 自定义 Hooks（useKeyboardShortcuts/useErrorHandler）
│   │   └── i18n/               # 国际化
│   │
│   └── src-tauri/              # Tauri 后端
│       ├── src/
│       │   ├── commands/       # Tauri 命令
│       │   │   ├── worktree.rs # Worktree CRUD、分支操作、Diff、Push/Pull
│       │   │   ├── merge.rs    # 分支合并（merge/abort/complete）
│       │   │   ├── log.rs      # 操作日志、删除保护、备份管理
│       │   │   └── ai_review.rs # AI 评审、命名建议、配置管理
│       │   ├── models/         # 数据模型
│       │   ├── services/       # 业务逻辑（git_service/ai_service/conflict_service/diff_service/merge_service/shell_service）
│       │   └── utils/          # 工具函数（validation）
│       └── tauri.conf.json     # Tauri 配置
│
├── 02-PRD.md                   # 产品需求文档
├── 03-技术方案.md              # 技术设计文档
├── 04-测试用例.md              # 测试用例
├── 05-测试报告.md              # 测试报告
├── 06-回归测试报告.md          # 回归测试报告
├── 07-自动更新方案.md          # 自动更新方案
├── 08-AI评审PRD.md            # AI 评审功能需求
├── 09-AI评审技术方案.md        # AI 评审技术方案
├── CHANGELOG.md                # 变更日志
└── README.md                   # 项目说明
```

---

## 🔧 配置说明

### 支持的 IDE

- VS Code (`code`)
- VS Code Insiders (`code-insiders`)
- Cursor (`cursor`)
- WebStorm (`webstorm`)
- IntelliJ IDEA (`idea`)

### 支持的终端

**macOS:**
- Terminal (默认)
- iTerm2
- Warp

**Windows:**
- CMD (默认)
- PowerShell
- Windows Terminal

**Linux:**
- GNOME Terminal (默认)
- Alacritty

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档更新
- `style:` 代码格式
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

---

## 📄 License

[MIT License](LICENSE)

---

## 🙏 致谢

- [Tauri](https://tauri.app/) - 现代化的桌面应用框架
- [git2-rs](https://github.com/rust-lang/git2-rs) - 优秀的 Git 绑定库
- [Lucide](https://lucide.dev/) - 精美的开源图标库

---

<div align="center">

**Made with ❤️ by the Git Worktree Manager Team**

</div>