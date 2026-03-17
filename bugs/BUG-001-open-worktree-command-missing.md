# Bug 报告 - BUG-001

## 基本信息

| 项目 | 内容 |
|------|------|
| **Bug ID** | BUG-001 |
| **发现日期** | 2026-03-17 |
| **发现者** | 小琦 (QA Lead) |
| **严重程度** | 🔴 高 |
| **优先级** | P0 |
| **状态** | ✅ 已修复 |

## 问题描述

### 简要描述
前端调用了不存在的后端命令 `open_worktree`

### 详细描述
在 `src/services/git.ts` 中定义了 `openWorktree` 方法，该方法调用 Tauri 命令 `open_worktree`：

```typescript
async openWorktree(worktree: Worktree): Promise<void> {
  return invoke('open_worktree', { worktreePath: worktree.path })
}
```

但在 Rust 后端 (`src-tauri/src/lib.rs`) 的 `invoke_handler` 中没有注册此命令。

### 复现步骤
1. 打开应用
2. 选择一个 Git 仓库
3. 点击 Worktree 列表项中的 "在 Finder 中打开" 按钮

### 预期结果
Finder 应该打开对应的 Worktree 目录

### 实际结果
命令调用失败，因为后端没有实现该命令

## 影响范围

| 影响项 | 说明 |
|--------|------|
| 功能 | 快捷操作 - 打开目录 |
| 用例 | TC-AC-005, TC-AC-006 |

## 根本原因

后端缺少 `open_worktree` 命令的实现。应该复用已有的 `open_in_terminal` 或创建专门的文件管理器打开命令。

## 建议修复

### 方案 1: 添加缺失的命令

在 `src-tauri/src/commands/worktree.rs` 中添加：

```rust
#[command]
pub async fn open_worktree(worktree_path: String) -> Result<(), String> {
    git_service::open_in_file_manager(&worktree_path).map_err(|e| e.to_string())
}
```

并在 `git_service.rs` 中添加 `open_in_file_manager` 函数（或复用现有逻辑）。

### 方案 2: 修改前端调用

在 `WorktreeItem.tsx` 中直接使用已有的功能，或者调用系统命令打开目录。

## 附件

- 相关文件: `src/services/git.ts`
- 相关文件: `src/components/WorktreeList/WorktreeItem.tsx`
- 相关文件: `src-tauri/src/lib.rs`

---

*创建时间: 2026-03-17 09:10*