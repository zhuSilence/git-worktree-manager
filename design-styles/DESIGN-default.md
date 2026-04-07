# Git Worktree Manager - Design System

> 默认设计风格：现代深色主题，简洁高效，面向开发者

---

## 1. Visual Theme & Atmosphere

**设计哲学：** 高效、专注、无干扰

- **风格定位：** 现代 IDE 风格，深色优先
- **视觉密度：** 紧凑但不拥挤，信息层级清晰
- **情感基调：** 专业、可靠、技术感
- **设计语言：** 扁平 + 微妙阴影，圆润边角

---

## 2. Color Palette

### 核心色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Background | `#242424` | 主背景 |
| Surface | `#2a2a2a` | 卡片、面板背景 |
| Border | `#3a3a3a` | 边框、分隔线 |
| Foreground | `rgba(255,255,255,0.87)` | 主文字 |
| Muted | `rgba(255,255,255,0.6)` | 次要文字 |
| Accent | `#6366f1` (Indigo) | 强调色、交互元素 |

### 语义色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Success | `#22c55e` | 成功状态、已合并 |
| Warning | `#eab308` | 警告、待处理 |
| Error | `#ef4444` | 错误、冲突 |
| Info | `#3b82f6` | 信息提示 |

### Git 状态色彩

| 状态 | 色值 | 示例 |
|------|------|------|
| Clean | `#22c55e` | 工作树干净 |
| Modified | `#eab308` | 有修改 |
| Conflicted | `#ef4444` | 冲突 |
| Stale | `#6b7280` | 陈旧分支 |

---

## 3. Typography

### 字体家族

```css
font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
```

### 字体层级

| 元素 | 大小 | 重量 | 行高 |
|------|------|------|------|
| H1 | 24px | 600 | 1.2 |
| H2 | 20px | 600 | 1.3 |
| H3 | 16px | 600 | 1.4 |
| Body | 14px | 400 | 1.5 |
| Small | 12px | 400 | 1.5 |
| Mono | 13px | 400 | 1.6 |

### 代码字体

```css
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

---

## 4. Component Styling

### 按钮

```
主按钮：
- Background: Accent (#6366f1)
- Text: White
- Radius: 8px
- Padding: 8px 16px
- Hover: 亮度+10%
- Active: 亮度-10%

次按钮：
- Background: transparent
- Border: 1px solid Border
- Text: Foreground
- Hover: Background 变为 Surface

危险按钮：
- Background: Error (#ef4444)
- Text: White
```

### 卡片

```
- Background: Surface (#2a2a2a)
- Border: 1px solid Border
- Radius: 12px
- Padding: 16px
- Hover: 轻微上移 + 阴影增强
```

### 输入框

```
- Background: transparent
- Border: 1px solid Border
- Radius: 8px
- Padding: 8px 12px
- Focus: Border 变为 Accent
- Placeholder: Muted 色
```

### 标签 (Tag)

```
- Background: 20% 透明度的语义色
- Text: 对应语义色
- Radius: 4px
- Padding: 2px 8px
- Font: 12px, 500
```

---

## 5. Layout Principles

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 紧凑间距 |
| sm | 8px | 元素内间距 |
| md | 16px | 卡片内间距 |
| lg | 24px | 区块间距 |
| xl | 32px | 大区块间距 |

### 布局结构

```
┌─────────────────────────────────────────────┐
│ Sidebar (240px)  │  Main Content           │
│ ├─ Repository    │  ├─ Header              │
│ ├─ Branches      │  ├─ Worktree List       │
│ └─ Settings      │  └─ Details Panel       │
└─────────────────────────────────────────────┘
```

---

## 6. Depth & Elevation

### 阴影系统

| 层级 | 阴影 | 用途 |
|------|------|------|
| 0 | none | 平面元素 |
| 1 | `0 1px 2px rgba(0,0,0,0.3)` | 卡片、按钮 |
| 2 | `0 4px 6px rgba(0,0,0,0.4)` | 悬浮面板 |
| 3 | `0 10px 15px rgba(0,0,0,0.5)` | 模态框 |

---

## 7. Do's and Don'ts

### ✅ Do

- 使用深色主题作为默认
- 保持视觉层级清晰
- 使用语义色彩传达状态
- 动画要微妙、快速（<300ms）
- 重要操作需要确认

### ❌ Don't

- 不要使用过多颜色
- 不要在深色背景上使用纯白文字
- 不要使用过长的动画
- 不要隐藏重要的 Git 状态信息

---

## 8. Responsive Behavior

### 断点

| 名称 | 宽度 | 布局调整 |
|------|------|----------|
| Compact | < 768px | 侧边栏折叠为图标 |
| Regular | 768px - 1024px | 侧边栏展开 |
| Wide | > 1024px | 双栏布局 |

### 触控目标

- 最小点击区域：32px × 32px
- 按钮间距：至少 8px

---

## 9. Agent Prompt Guide

### 快速配色参考

```
深色背景 + 浅色文字 + Indigo 强调色
成功用绿，警告用黄，错误用红
```

### 常用提示词

```
"创建一个深色主题的卡片组件，包含标题、描述和操作按钮"
"设计一个 Git 分支列表，显示分支名、状态标签和最后提交时间"
"构建一个设置面板，使用分组卡片布局"
```

---

*基于 Git Worktree Manager 现有设计系统整理*