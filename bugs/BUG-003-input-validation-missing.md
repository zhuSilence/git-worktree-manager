# Bug 报告 - BUG-003

## 基本信息

| 项目 | 内容 |
|------|------|
| **Bug ID** | BUG-003 |
| **发现日期** | 2026-03-17 |
| **发现者** | 小琦 (QA Lead) |
| **严重程度** | 🟡 中 |
| **优先级** | P0 |
| **状态** | ✅ 已修复 |

## 问题描述

### 简要描述
缺少分支名和路径的输入验证，存在潜在命令注入风险

### 详细描述

在 `git_service.rs` 中，创建 worktree 时直接使用用户输入的分支名和路径，未进行安全验证：

```rust
pub fn create_worktree(
    repo_path: &str,
    params: CreateWorktreeParams,
) -> anyhow::Result<WorktreeResult> {
    // ...
    let branch_name = params.new_branch.unwrap_or(params.name.clone());
    
    // 直接使用用户输入！
    let output = Command::new("git")
        .args(["worktree", "add", "-b", &branch_name, &target_path, &params.base_branch])
        .current_dir(repo_path)
        .output()?;
    // ...
}
```

**潜在风险：**
1. 分支名包含特殊字符可能导致命令注入
2. 路径包含 `../` 可能导致目录遍历
3. 恶意分支名如 `; rm -rf /` 可能在某些情况下造成危害

### 安全测试场景

| 输入类型 | 测试值 | 预期结果 |
|----------|--------|----------|
| 路径遍历 | `../../../etc/passwd` | 拒绝 |
| 命令注入 | `feature;ls` | 拒绝 |
| 特殊字符 | `feature$(whoami)` | 拒绝 |
| 空字节 | `feature\x00test` | 拒绝 |

### 复现步骤
1. 打开应用
2. 点击创建 Worktree
3. 输入恶意分支名如 `test;echo hacked`
4. 尝试创建

### 预期结果
应该验证输入并拒绝恶意值

### 实际结果
输入被直接传递给 Git 命令

## 影响范围

| 影响项 | 说明 |
|--------|------|
| 功能 | 创建 Worktree |
| 安全 | 命令注入 / 路径遍历 |
| 用例 | TC-SEC-001, TC-SEC-002 |

## 根本原因

技术方案中设计的安全验证函数未实现：
- `validate_path` 函数
- `sanitize_branch_name` 函数

## 建议修复

### 添加输入验证工具模块

创建 `src-tauri/src/utils/validation.rs`:

```rust
use std::path::{Path, PathBuf};
use regex::Regex;

/// 验证路径是否安全
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    
    // 检查路径遍历
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Path cannot contain '..'".to_string());
    }
    
    // 检查路径是否在用户目录下（可选）
    // ...
    
    Ok(path)
}

/// 清理分支名，防止注入
pub fn sanitize_branch_name(name: &str) -> Result<String, String> {
    // Git 分支名规则：字母、数字、-、_、/
    let re = Regex::new(r"^[a-zA-Z0-9_\-/.]+$").unwrap();
    
    if name.is_empty() || name.len() > 250 {
        return Err("Invalid branch name length".to_string());
    }
    
    if !re.is_match(name) {
        return Err("Branch name contains invalid characters".to_string());
    }
    
    // 防止路径遍历
    if name.contains("..") {
        return Err("Branch name cannot contain '..'".to_string());
    }
    
    Ok(name.to_string())
}
```

### 在 create_worktree 中使用验证

```rust
pub fn create_worktree(...) -> anyhow::Result<WorktreeResult> {
    // 验证分支名
    let branch_name = sanitize_branch_name(&params.name)
        .map_err(|e| anyhow::anyhow!(e))?;
    
    // 验证路径
    let target_path = validate_path(&target_path)
        .map_err(|e| anyhow::anyhow!(e))?;
    
    // ... 然后才执行命令
}
```

## 附件

- 相关文件: `src-tauri/src/services/git_service.rs`
- PRD 章节: 四、安全设计
- 技术方案: 七、安全设计

---

*创建时间: 2026-03-17 09:20*