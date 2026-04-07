# Git Worktree Manager - Cursor Style Design System

> 参考 Cursor 风格：AI 代码编辑器美学，深色优雅，渐变高亮

---

## 1. Visual Theme & Atmosphere

**设计哲学：** AI 原生、代码优先、优雅深色

- **风格定位：** AI 代码编辑器，专业开发者工具
- **视觉密度：** 中等密度，平衡信息与美观
- **情感基调：** 智能、现代、高端
- **设计语言：** 深色背景 + 渐变高亮 + 精致细节

---

## 2. Color Palette

### 核心色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Background | `#0f0f0f` | 主背景 |
| Surface | `#1a1a1a` | 卡片背景 |
| Surface Light | `#252525` | 悬浮背景 |
| Border | `#2d2d2d` | 边框 |
| Foreground | `#e4e4e4` | 主文字 |
| Muted | `#8a8a8a` | 次要文字 |
| Accent | `#7c3aed` (Violet) | 主强调 |
| Accent Secondary | `#2563eb` (Blue) | 次强调 |

### 渐变色

```css
/* 主渐变（AI 主题） */
background: linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%);

/* 按钮渐变 */
background: linear-gradient(90deg, #7c3aed, #2563eb);

/* 边框渐变 */
border-image: linear-gradient(90deg, #7c3aed, #2563eb) 1;
```

### 语义色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| Success | `#10b981` | 成功、干净 |
| Warning | `#f59e0b` | 警告、修改中 |
| Error | `#ef4444` | 错误、冲突 |
| Info | `#3b82f6` | 信息 |

### AI 特殊色彩

| 名称 | 色值 | 用途 |
|------|------|------|
| AI Glow | `#a855f7` | AI 功能高亮 |
| Thinking | `#6366f1` | AI 处理中 |
| Suggestion | `#8b5cf6` | AI 建议 |

---

## 3. Typography

### 字体家族

```css
/* UI 字体 */
font-family: 'Inter', -apple-system, sans-serif;

/* 代码字体 */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

### 字体层级

| 元素 | 大小 | 重量 | 行高 |
|------|------|------|------|
| H1 | 20px | 600 | 1.3 |
| H2 | 16px | 600 | 1.4 |
| H3 | 14px | 600 | 1.4 |
| Body | 14px | 400 | 1.5 |
| Code | 13px | 400 | 1.6 |
| Small | 12px | 400 | 1.5 |

---

## 4. Component Styling

### 卡片

```
- Background: Surface (#1a1a1a)
- Border: 1px solid Border 或渐变边框
- Radius: 12px
- Padding: 16-20px
- 特点：可能有渐变边框高亮
```

### 按钮

```
主按钮：
- Background: 紫蓝渐变
- Text: White
- Radius: 8px
- Padding: 10px 18px
- Font: 14px, 500
- Hover: 发光效果增强

幽灵按钮：
- Background: transparent
- Border: 1px 渐变
- Text: Foreground
- 特点：渐变边框
```

### AI 功能卡片

```
特殊样式：
- Border: 1px 渐变边框
- Background: Surface + 微妙渐变叠加
- 左侧：AI 图标 + 发光
- 内容：AI 建议/分析结果
```

### 列表条目

```
┌────────────────────────────────────────────┐
│ 󰘬 main                           ✓ Clean │
│   󰚐 Last commit: 2 hours ago              │
│   󰖟 AI: No conflicts detected             │
└────────────────────────────────────────────┘

- 图标使用 Nerd Font
- AI 相关信息特殊标记
- 悬浮时边框发光
```

### 代码片段

```
- Background: #0f0f0f
- Border: 1px #2d2d2d
- Radius: 8px
- Font: JetBrains Mono
- 语法高亮：VS Code Dark+ 主题
```

### 标签

```
- Background: 15% 透明度的语义色
- Text: 对应语义色
- Radius: 6px
- Font: 12px, 500
```

---

## 5. Layout Principles

### 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 紧凑 |
| sm | 8px | 元素内 |
| md | 16px | 标准 |
| lg | 24px | 区块 |
| xl | 32px | 大区块 |

### 布局特点

```
- 侧边栏：220px，可折叠
- 主区域：代码编辑器风格
- AI 面板：右侧抽屉 350px
- 底部：状态栏 + AI 状态指示
```

---

## 6. Depth & Elevation

### 阴影系统

| 层级 | 效果 | 用途 |
|------|------|------|
| Base | none | 背景 |
| Card | `0 2px 8px rgba(0,0,0,0.4)` | 卡片 |
| Elevated | `0 8px 24px rgba(0,0,0,0.5)` | 悬浮 |
| Modal | `0 16px 48px rgba(0,0,0,0.6)` | 模态框 |

### 发光效果

```css
/* AI 功能发光 */
.ai-glow {
  box-shadow: 
    0 0 0 1px rgba(124, 58, 237, 0.3),
    0 0 30px rgba(124, 58, 237, 0.15);
}

/* 聚焦发光 */
.focus-glow {
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.5);
}
```

---

## 7. Animation & Motion

### 动画原则

- **流畅优雅：** ease-out 缓动
- **适中速度：** 200-300ms
- **AI 特色：** 打字机效果、思维动画

### 关键动画

```css
/* AI 思考动画 */
@keyframes thinking {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* 渐变流动 */
@keyframes gradientFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 打字机效果 */
@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}
```

---

## 8. Do's and Don'ts

### ✅ Do

- 使用紫蓝渐变作为主题
- 为 AI 功能添加特殊视觉标识
- 使用代码编辑器美学
- 保持界面优雅精致
- 使用 JetBrains Mono 等专业代码字体

### ❌ Don't

- 不要使用过亮的颜色
- 不要忽略 AI 功能的视觉区分
- 不要使用生硬的边角
- 不要过度装饰

---

## 9. Agent Prompt Guide

### 核心风格词

```
"AI 代码编辑器风格"
"紫蓝渐变主题"
"优雅深色界面"
"AI 功能发光效果"
"JetBrains Mono 字体"
```

### 示例提示

```
"创建一个 Cursor 风格的 AI 功能卡片，渐变边框，左侧 AI 图标发光，显示分析结果"
"设计一个代码编辑器风格的分支列表，等宽字体显示分支名，AI 状态在右侧显示"
"构建一个 AI 建议面板，紫蓝渐变背景，打字机效果显示内容"
```

---

*参考 Cursor AI 代码编辑器设计语言*