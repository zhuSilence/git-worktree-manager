# Git Worktree Manager - Warp Style Design System

> 参考 Warp 终端风格：现代终端美学，深色 IDE 感，区块式命令 UI

---

## 1. Visual Theme & Atmosphere

**设计哲学：** 终端原生、高效、现代化

- **风格定位：** 深色终端风格，代码编辑器美学
- **视觉密度：** 高密度信息展示，区块式布局
- **情感基调：** 极客、高效、专注
- **设计语言：** 圆润区块 + 渐变高亮 + 等宽字体优先

---

## 2. Color Palette

### 核心色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Background | `#0d0d0d` | 深黑背景 |
| Surface | `#1a1a1a` | 区块背景 |
| Surface Elevated | `#242424` | 悬浮区块 |
| Border | `#2a2a2a` | 微妙边框 |
| Foreground | `#e5e5e5` | 主文字 |
| Muted | `#737373` | 次要文字 |
| Accent | `#01a4ff` (Electric Blue) | 强调色 |

### 语义色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Success | `#00d26a` | 成功、干净 |
| Warning | `#ffb800` | 警告 |
| Error | `#ff5f56` | 错误 |
| Info | `#01a4ff` | 信息 |

### 终端色彩扩展

| 名称 | 色值 | 用途 |
|------|------|------|
| Cyan | `#00d9ff` | 链接、高亮 |
| Magenta | `#ff6b9d` | 特殊标记 |
| Green | `#00ff9d` | 成功输出 |
| Yellow | `#ffeb3b` | 命令提示 |

---

## 3. Typography

### 字体家族

```css
/* 主字体 */
font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', monospace;

/* UI 字体 */
font-family: 'SF Pro Display', -apple-system, sans-serif;
```

### 字体层级

| 元素 | 大小 | 重量 | 特点 |
|------|------|------|------|
| H1 | 20px | 600 | 紧凑标题 |
| H2 | 16px | 600 | 区块标题 |
| Body | 14px | 400 | 正文 |
| Mono | 13px | 400 | 代码、分支名 |
| Small | 12px | 400 | 辅助信息 |

**特点：** 标题紧凑，代码字体广泛应用

---

## 4. Component Styling

### 区块卡片 (Block)

```
- Background: Surface (#1a1a1a)
- Border: 无或 1px #2a2a2a
- Radius: 12px
- Padding: 16px
- 特点：区块式布局，清晰分隔
```

### 命令按钮

```
- Background: 渐变 (Accent 到 Cyan)
- Text: White
- Radius: 8px
- Font: Mono
- 特点：等宽字体，渐变高亮
```

### 分支/Worktree 条目

```
┌─────────────────────────────────────────┐
│ 󰘬 main ············ ✓ Clean · 2h ago  │
├─────────────────────────────────────────┤
│ 󰘬 feature/auth ···· ⚡ Modified · 5m   │
└─────────────────────────────────────────┘

- 使用等宽字体显示分支名
- 状态使用彩色圆点
- 时间使用相对格式
```

### 终端风格输入

```
- Background: #0d0d0d
- Border: 无
- Prompt: $ 或 〉
- Font: Mono
- Cursor: 块状光标
```

### 标签系统

```
形状：胶囊形 (pill)
- Radius: 9999px
- Padding: 4px 12px
- Font: 11px Mono
- 背景：20% 透明度的语义色
```

---

## 5. Layout Principles

### 间距系统

| Token | 值 | 说明 |
|-------|-----|------|
| Tight | 4px | 元素内紧凑间距 |
| Normal | 8px | 标准间距 |
| Relaxed | 16px | 区块间距 |
| Loose | 24px | 大区块分隔 |

### 布局特点

```
- 侧边栏：窄版 (200px)，图标+文字
- 主区域：区块堆叠
- 细节面板：右侧抽屉 (320px)
- 底部：命令/状态栏
```

---

## 6. Depth & Elevation

### 层级系统

| 层级 | 效果 | 用途 |
|------|------|------|
| Base | 无阴影 | 背景层 |
| Raised | `0 2px 4px rgba(0,0,0,0.5)` | 卡片 |
| Overlay | `0 8px 24px rgba(0,0,0,0.6)` | 弹窗 |

### 边框发光 (Glow)

```
Focus 状态：
- Border: 1px solid Accent
- Box-shadow: 0 0 0 3px rgba(1,164,255,0.2)
```

---

## 7. Animation & Motion

### 动画原则

- **快速响应：** 所有交互 < 200ms
- **终端原生：** 块状、干脆的动画
- **微妙过渡：** 不分散注意力

### 关键动画

```css
/* 条目进入 */
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 状态变化 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

---

## 8. Do's and Don'ts

### ✅ Do

- 大量使用等宽字体（分支名、命令、路径）
- 使用彩色圆点表示状态
- 保持区块边界清晰
- 使用深黑色背景
- 突出显示当前活动项

### ❌ Don't

- 不要使用纯白背景
- 不要使用过圆的设计
- 不要使用复杂的渐变
- 不要隐藏命令行美学

---

## 9. Agent Prompt Guide

### 核心风格词

```
"深黑终端风格"
"等宽字体优先"
"区块式布局"
"电蓝色强调"
"代码编辑器美学"
```

### 示例提示

```
"创建一个 Warp 风格的分支列表组件，深黑背景，等宽字体显示分支名，使用彩色圆点表示 Git 状态"
"设计一个终端风格的命令输入框，块状光标，渐变提交按钮"
```

---

*参考 Warp 终端设计语言，适配 Git Worktree Manager*