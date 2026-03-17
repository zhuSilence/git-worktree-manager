# Bug 报告 - BUG-004

## 基本信息

| 项目 | 内容 |
|------|------|
| **Bug ID** | BUG-004 |
| **发现日期** | 2026-03-17 |
| **发现者** | 小琦 (QA Lead) |
| **严重程度** | 🟡 中 |
| **优先级** | P1 |
| **状态** | ✅ 已修复 |

## 问题描述

### 简要描述
Content Security Policy (CSP) 未配置

### 详细描述

在 `tauri.conf.json` 中，CSP 被设置为 `null`：

```json
{
  "app": {
    "security": {
      "csp": null
    }
  }
}
```

**风险：**
- 没有内容安全策略保护
- 可能导致 XSS 攻击更易执行
- 不符合安全最佳实践

### 预期行为

应该配置适当的 CSP，例如：

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

## 影响范围

| 影响项 | 说明 |
|--------|------|
| 安全 | XSS 防护 |
| 合规 | 安全最佳实践 |

## 建议修复

在 `tauri.conf.json` 中添加适当的 CSP 配置：

```json
"security": {
  "csp": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
}
```

注意：如果使用了 TailwindCSS 的内联样式，可能需要 `'unsafe-inline'`。

## 附件

- 相关文件: `src-tauri/tauri.conf.json`

---

*创建时间: 2026-03-17 09:22*