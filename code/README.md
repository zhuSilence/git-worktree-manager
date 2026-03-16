# Worktree Manager

🚀 轻量级、免费、跨平台的 Git Worktree 可视化管理工具

## 功能特性

- 📋 **Worktree 列表** — 查看所有 worktree 及其状态
- ➕ **创建 Worktree** — 快速创建新的 worktree
- 🗑️ **删除 Worktree** — 安全删除，自动检查状态
- 🔗 **快捷打开** — 一键在 IDE 或终端中打开
- 🎨 **现代 UI** — TailwindCSS + shadcn/ui

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript |
| 样式 | TailwindCSS + shadcn/ui |
| 状态 | Zustand |
| 桌面框架 | Tauri 2.0 |
| 后端 | Rust + git2 |

## 开发

### 前置要求

- Node.js 18+
- Rust 1.70+
- Git 2.5+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri:dev
```

### 构建

```bash
npm run tauri:build
```

## 项目结构

```
code/
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── stores/            # Zustand 状态管理
│   ├── services/          # Tauri API 封装
│   ├── types/             # TypeScript 类型定义
│   └── utils/             # 工具函数
├── src-tauri/             # Rust 后端
│   ├── src/
│   │   ├── commands/      # Tauri 命令
│   │   ├── services/      # 业务服务
│   │   └── models/        # 数据模型
│   └── tauri.conf.json    # Tauri 配置
└── package.json
```

## License

MIT