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

### 修复验证

**修复内容：**
1. 创建了 `utils/validation.rs` 模块
2. 实现了 `sanitize_branch_name` 函数：
   - 检查空值
   - 检查长度限制 (1-250 字符)
   - 检查非法字符 (只允许字母、数字、-、_、/、.)
   - 检查路径遍历 (..)
   - 检查保留名称 (HEAD)
3. 实现了 `validate_path` 函数：
   - 检查空值
   - 检查空字节注入
   - 检查路径长度
   - 检查路径遍历攻击
4. 在 `git_service.rs` 的 `create_worktree` 函数中使用验证

**验证结果：** ✅ 通过
- 单元测试全部通过 (4/4)
- 验证函数被正确调用
- 编译通过

## 回归测试

| 测试项 | 结果 |
|--------|------|
| 前端编译 | ✅ 通过 |
| 后端编译 | ✅ 通过 |
| 单元测试 | ✅ 4/4 通过 |

### 单元测试详情

```
test utils::validation::tests::test_validate_path_invalid ... ok
test utils::validation::tests::test_validate_path_valid ... ok
test utils::validation::tests::test_sanitize_branch_name_invalid ... ok
test utils::validation::tests::test_sanitize_branch_name_valid ... ok
```

---

*修复验证时间: 2026-03-17 09:38*