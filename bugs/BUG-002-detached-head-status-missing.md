# Bug 报告 - BUG-002

## 基本信息

| 项目 | 内容 |
|------|------|
| **Bug ID** | BUG-002 |
| **发现日期** | 2026-03-17 |
| **发现者** | 小琦 (QA Lead) |
| **严重程度** | 🟡 中 |
| **优先级** | P1 |
| **状态** | ✅ 已修复 |

## 问题描述

### 简要描述
PRD 中定义的 Detached HEAD 状态未被正确实现

### 详细描述

**PRD 定义的状态：**
| 状态 | 颜色 | 说明 |
|------|------|------|
| Clean | 🟢 绿色 | 工作区干净 |
| Dirty | 🟡 黄色 | 有未提交的更改 |
| Conflict | 🔴 红色 | 存在冲突 |
| Detached | ⚪ 灰色 | HEAD detached 状态 |

**当前实现问题：**

1. **TypeScript 类型定义** (`src/types/worktree.ts`):
```typescript
export enum WorktreeStatus {
  Clean = 'clean',
  Dirty = 'dirty',
  Unpushed = 'unpushed',      // PRD 中未定义
  Conflicted = 'conflicted',
  Unknown = 'unknown',        // PRD 中未定义
  // 缺少 Detached 状态!
}
```

2. **Rust 枚举定义** (`src-tauri/src/models/worktree.rs`):
```rust
pub enum WorktreeStatus {
    Clean,
    Dirty,
    Unpushed,    // PRD 中未定义
    Conflicted,
    Unknown,     // PRD 中未定义
    // 缺少 Detached 状态!
}
```

3. **git_service.rs** 中 `get_worktree_status` 函数：
   - 检查了 `Detached` 状态但将其作为正常状态处理
   - 没有专门返回 Detached 状态

### 复现步骤
1. 创建一个处于 detached HEAD 状态的 worktree
2. 查看应用中的状态显示

### 预期结果
应该显示灰色圆点和 "Detached" 标签

### 实际结果
可能显示为 "Unknown" 或 "Clean"

## 影响范围

| 影响项 | 说明 |
|--------|------|
| 功能 | 状态展示 |
| 用例 | TC-WT-006 |
| PRD 要求 | 2.2 状态指示 |

## 根本原因

1. 开发时未严格按照 PRD 定义的枚举值实现
2. `Unpushed` 状态被添加但 PRD 未定义
3. `Detached` 状态被遗漏

## 建议修复

### 1. 更新 TypeScript 类型

```typescript
export enum WorktreeStatus {
  Clean = 'clean',
  Dirty = 'dirty',
  Conflicted = 'conflicted',
  Detached = 'detached',  // 添加
  Unknown = 'unknown',    // 保留作为 fallback
}
```

### 2. 更新 Rust 枚举

```rust
pub enum WorktreeStatus {
    #[serde(rename = "clean")]
    Clean,
    #[serde(rename = "dirty")]
    Dirty,
    #[serde(rename = "conflicted")]
    Conflicted,
    #[serde(rename = "detached")]
    Detached,  // 添加
    #[serde(rename = "unknown")]
    Unknown,
}
```

### 3. 更新 StatusBadge 组件

添加 Detached 状态的配置：
```typescript
[WorktreeStatus.Detached]: {
  color: 'bg-gray-400',
  label: 'Detached',
}
```

### 4. 更新 git_service.rs

```rust
fn get_worktree_status(repo: &Repository) -> anyhow::Result<WorktreeStatus> {
    // ... existing checks ...
    
    // 检查 detached HEAD
    if repo.head_detached()? {
        return Ok(WorktreeStatus::Detached);
    }
    
    Ok(WorktreeStatus::Clean)
}
```

## 附件

- 相关文件: `src/types/worktree.ts`
- 相关文件: `src/components/WorktreeList/StatusBadge.tsx`
- 相关文件: `src-tauri/src/models/worktree.rs`
- 相关文件: `src-tauri/src/services/git_service.rs`

---

*创建时间: 2026-03-17 09:15*