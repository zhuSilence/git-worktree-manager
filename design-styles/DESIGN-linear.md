# Git Worktree Manager - Linear Style Design System

> 参考 Linear 风格：极简紫色，项目管理美学，超干净界面

---

## 1. Visual Theme & Atmosphere

**设计哲学：** 极简、精确、无噪音

- **风格定位：** SaaS 项目管理风格，极致简约
- **视觉密度：** 透气、大量留白、信息精炼
- **情感基调：** 优雅、现代、高效
- **设计语言：** 超圆角 + 微妙渐变 + 紫色系

---

## 2. Color Palette

### 核心色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Background | `#0a0a0b` | 深紫黑 |
| Surface | `#131316` | 卡片背景 |
| Surface Hover | `#1a1a1e` | 悬浮状态 |
| Border | `#27272a` | 微妙分隔 |
| Foreground | `#fafafa` | 主文字 |
| Muted | `#71717a` | 次要文字 |
| Accent | `#8b5cf6` (Violet) | 主强调色 |
| Accent Light | `#a78bfa` | 浅强调色 |

### 渐变色

```css
/* 主渐变 */
background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);

/* 紫色发光 */
box-shadow: 0 0 40px rgba(139, 92, 246, 0.15);
```

### 语义色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Success | `#10b981` | 完成、干净 |
| Warning | `#f59e0b` | 进行中、警告 |
| Error | `#ef4444` | 错误、冲突 |
| Info | `#3b82f6` | 信息 |

---

## 3. Typography

### 字体家族

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### 字体层级

| 元素 | 大小 | 重量 | 行高 | 特点 |
|------|------|------|------|------|
| H1 | 22px | 600 | 1.3 | 页面标题 |
| H2 | 16px | 600 | 1.4 | 区块标题 |
| Body | 14px | 400 | 1.5 | 正文 |
| Small | 12px | 500 | 1.5 | 标签、辅助 |
| Micro | 11px | 500 | 1.4 | 极小标签 |

**特点：** Inter 字体，字重对比明显

---

## 4. Component Styling

### 卡片

```
- Background: Surface (#131316)
- Border: 无或 1px #27272a
- Radius: 16px (大圆角)
- Padding: 20px
- Hover: 轻微上移 + 紫色发光
```

### 按钮

```
主按钮：
- Background: 渐变紫色
- Text: White
- Radius: 10px
- Padding: 10px 20px
- Font: 14px, 500
- Shadow: 紫色发光

次按钮：
- Background: transparent
- Border: 1px solid Border
- Text: Foreground
- Radius: 10px

文字按钮：
- 无背景
- Text: Accent
- Hover: 下划线
```

### 列表条目

```
┌──────────────────────────────────────────┐
│ ● main                          Clean ✓  │
│   Last commit: 2 hours ago               │
└──────────────────────────────────────────┘

- 使用圆点图标
- 右侧状态对齐
- 悬浮时背景变化
- 圆角：12px
```

### 标签 (Tag)

```
- Background: 渐变或纯色 + 15% 透明度
- Text: 对应色
- Radius: 6px
- Padding: 4px 10px
- Font: 12px, 500
```

### 状态指示器

```
圆形圆点：
- 直径：8px
- 颜色：语义色
- 动画：活跃状态有脉冲
```

---

## 5. Layout Principles

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 紧凑 |
| sm | 8px | 元素内 |
| md | 16px | 标准间距 |
| lg | 24px | 区块间距 |
| xl | 40px | 大区块分隔 |

### 留白哲学

```
"更多留白 = 更清晰的层级"
- 列表条目间距：16px
- 区块间距：24px
- 页面边距：32px
```

---

## 6. Depth & Elevation

### 阴影系统

| 层级 | 阴影 | 用途 |
|------|------|------|
| 0 | none | 平面 |
| 1 | `0 1px 3px rgba(0,0,0,0.3)` | 卡片 |
| 2 | `0 4px 12px rgba(0,0,0,0.4)` | 悬浮 |
| 3 | `0 8px 32px rgba(0,0,0,0.5)` + 紫光 | 模态框 |

### 紫色发光

```css
/* 强调元素发光 */
box-shadow: 
  0 0 0 1px rgba(139, 92, 246, 0.3),
  0 0 20px rgba(139, 92, 246, 0.1);
```

---

## 7. Animation & Motion

### 动画原则

- **流畅：** ease-out 缓动
- **快速：** 150-250ms
- **微妙：** 不抢眼

### 关键动画

```css
/* 渐入 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 脉冲（活跃状态） */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}
```

---

## 8. Do's and Don'ts

### ✅ Do

- 使用大量留白
- 紫色作为主强调色
- 大圆角设计
- 微妙的渐变和发光
- 清晰的信息层级

### ❌ Don't

- 不要过度使用颜色
- 不要使用硬边角
- 不要拥挤的布局
- 不要复杂的装饰元素

---

## 9. Agent Prompt Guide

### 核心风格词

```
"极简紫色主题"
"大量留白"
"超圆角设计"
"微妙紫色发光"
"项目管理美学"
```

### 示例提示

```
"创建一个 Linear 风格的卡片列表，深紫黑背景，大圆角，大量留白，紫色渐变按钮"
"设计一个极简的分支条目组件，右侧状态对齐，使用圆点指示器，悬浮时有紫色发光效果"
```

---

*参考 Linear 项目管理工具设计语言*