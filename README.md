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
- **Diff 对比** - 与主分支的代码差异对比（统一/拆分双视图）

### 🚀 增强功能 (P1)

- **多仓库管理** - 侧边栏仓库列表，快速切换
- **分支管理** - 切换、创建、拉取远程分支
- **设置中心** - 自定义默认 IDE 和终端

### 🔮 高级功能 (P2)

- **智能提示** - 已合并分支、陈旧分支提醒
- **批量操作** - 批量删除、一键清理

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

## 🚀 快速开始

### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70
- **Git** >= 2.5 (建议 2.17+)
- **操作系统**: macOS 10.15+ / Windows 10+ / Ubuntu 18.04+

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/zhuSilence/git-worktree-manager.git
cd git-git-worktree-manager/code

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

### 3. Diff 对比

点击 worktree 卡片上的 **对比图标**，在右侧边栏查看与主分支的差异：

- 🔼 **上一个变更** - 跳转到上一个修改的代码行
- 🔽 **下一个变更** - 跳转到下一个修改的代码行
- **统一视图** - 合并显示新旧代码
- **拆分视图** - 左右对照显示

### 4. 分支管理

点击 worktree 卡片上的 **分支图标**：

- **切换分支** - 切换到已有分支
- **创建分支** - 创建并切换到新分支
- **拉取远程** - Fetch 并 checkout 远程分支

### 5. 智能提示

点击工具栏的 **警告图标**，查看：

- **已合并分支** - 可以安全删除
- **陈旧分支** - 长期未更新的分支

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
│   │   │   ├── DiffSidebar/    # Diff 对比面板
│   │   │   ├── BranchManager/  # 分支管理
│   │   │   ├── HintsPanel/     # 智能提示
│   │   │   ├── BatchActions/   # 批量操作
│   │   │   └── SettingsPanel/  # 设置面板
│   │   ├── stores/             # Zustand 状态
│   │   ├── services/           # API 服务
│   │   └── types/              # TypeScript 类型
│   │
│   └── src-tauri/              # Tauri 后端
│       ├── src/
│       │   ├── commands/       # Tauri 命令
│       │   ├── models/         # 数据模型
│       │   ├── services/       # 业务逻辑
│       │   └── utils/          # 工具函数
│       └── tauri.conf.json     # Tauri 配置
│
├── 01-市场分析.md
├── 02-PRD.md                   # 产品需求文档
├── 03-技术方案.md              # 技术设计文档
├── 04-测试用例.md              # 测试用例
└── 05-测试报告.md              # 测试报告
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