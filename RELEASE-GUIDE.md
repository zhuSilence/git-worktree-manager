# Git Worktree Manager 发布流程指南

本文档描述从代码提交到用户安装的完整发布流程。

---

## 📋 目录

1. [发布前检查](#发布前检查)
2. [版本号管理](#版本号管理)
3. [GitHub Actions 构建流程](#github-actions-构建流程)
4. [Release 发布步骤](#release-发布步骤)
5. [安装脚本维护](#安装脚本维护)
6. [Homebrew Tap 维护](#homebrew-tap-维护)
7. [发布检查清单](#发布检查清单)

---

## 发布前检查

### 1. 代码质量

```bash
# 运行测试
cd code
npm test

# 类型检查
npm run type-check

# 构建测试
npm run tauri:build
```

### 2. 版本号同步

确保以下位置的版本号一致：

| 文件 | 字段 | 示例 |
|------|------|------|
| `code/package.json` | `version` | `"0.0.5"` |
| `code/src-tauri/tauri.conf.json` | `version` | `"0.0.5"` |
| `code/src-tauri/Cargo.toml` | `version` | `version = "0.0.5"` |

### 3. CHANGELOG 更新

更新 `CHANGELOG.md`：

```markdown
## [0.0.5] - 2026-03-20

### Added
- 新增功能描述

### Fixed
- 修复问题描述

### Changed
- 变更描述
```

---

## 版本号管理

### 版本号规范

使用语义化版本号：`MAJOR.MINOR.PATCH`

- **MAJOR**: 不兼容的 API 变更
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修复

### 版本号位置

```
code/
├── package.json              # 前端版本号
└── src-tauri/
    ├── tauri.conf.json       # Tauri 配置版本号
    └── Cargo.toml            # Rust 版本号
```

### 更新版本号脚本

```bash
# 更新所有版本号（示例：0.0.5）
cd code
npm version 0.0.5 --no-git-tag-version
cd src-tauri
# 手动更新 tauri.conf.json 和 Cargo.toml 中的版本号
```

---

## GitHub Actions 构建流程

### 工作流文件

`.github/workflows/release.yml` 负责构建和发布。

### 触发条件

```yaml
on:
  push:
    tags:
      - 'v*'  # 推送 v 开头的 tag 触发
  workflow_dispatch:  # 手动触发
```

### 构建产物

| 平台 | 产物文件 | 说明 |
|------|----------|------|
| macOS ARM64 | `Git.Worktree.Manager_版本_aarch64.dmg` | Apple Silicon |
| macOS x64 | `Git.Worktree.Manager_版本_x64.dmg` | Intel Mac |
| Windows | `Git.Worktree.Manager_版本_x64-setup.exe` | 安装程序 |
| Windows | `Git.Worktree.Manager_版本_x64_en-US.msi` | MSI 安装包 |
| Linux | `Git.Worktree.Manager_版本_amd64.AppImage` | 通用二进制 |
| Linux | `Git.Worktree.Manager_版本_amd64.deb` | Debian/Ubuntu |

### 产物命名规范

**格式：** `Git.Worktree.Manager_版本_架构.后缀`

**注意：** 
- 使用点号 `.` 分隔单词（不是下划线）
- 架构名称：`aarch64` / `x64` / `amd64`

### 构建流程图

```
git tag v0.0.5
     ↓
git push origin v0.0.5
     ↓
GitHub Actions 触发
     ↓
┌─────────────────────────────────────┐
│  并行构建                           │
│  ├── build-macos-arm64 → .dmg      │
│  ├── build-macos-x64   → .dmg      │
│  ├── build-linux       → .AppImage │
│  └── build-windows     → .exe/.msi │
└─────────────────────────────────────┘
     ↓
创建 Draft Release
     ↓
上传所有产物到 Release
```

---

## Release 发布步骤

### 1. 创建 Tag 并推送

```bash
# 确保在 main 分支
git checkout main
git pull origin main

# 创建 tag
git tag v0.0.5

# 推送 tag
git push origin v0.0.5
```

### 2. 等待构建完成

- 访问 https://github.com/zhuSilence/git-worktree-manager/actions
- 查看 Release workflow 运行状态
- 预计耗时：10-15 分钟

### 3. 检查 Draft Release

构建成功后会创建一个 Draft Release：

1. 访问 https://github.com/zhuSilence/git-worktree-manager/releases
2. 找到新建的 Draft Release
3. 检查以下内容：

**产物检查：**
- [ ] 所有平台的产物都已上传
- [ ] 文件名格式正确
- [ ] 文件大小合理（DMG ~2.5MB）

**Release Notes 检查：**
- [ ] 版本号正确
- [ ] 更新说明完整
- [ ] 下载链接正确

### 4. 发布 Release

确认无误后：

1. 编辑 Release Notes
2. 点击 **Publish release** 按钮
3. 确认 Release 状态变为 **Published**

---

## 安装脚本维护

### 脚本位置

| 平台 | 文件 |
|------|------|
| macOS/Linux | `install.sh` |
| Windows | `install.ps1` |

### URL 格式

安装脚本中的下载 URL 必须与 Release 产物文件名匹配：

```bash
# 正确格式
https://github.com/zhuSilence/git-worktree-manager/releases/download/v版本/Git.Worktree.Manager_版本_架构.后缀

# 示例
https://github.com/zhuSilence/git-worktree-manager/releases/download/v0.0.5/Git.Worktree.Manager_0.0.5_x64.dmg
```

### 脚本检查清单

- [ ] 版本号获取逻辑正确（从 GitHub API 获取最新版本）
- [ ] 下载 URL 格式与 Release 产物匹配
- [ ] 架构检测逻辑正确（aarch64/x64/amd64）
- [ ] 安装后清理临时文件

### 测试安装脚本

```bash
# 测试 curl 安装
curl -fsSL https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.sh | bash

# 测试指定版本
curl -fsSL https://raw.githubusercontent.com/zhuSilence/git-worktree-manager/main/install.sh | bash -s 0.0.5
```

---

## Homebrew Tap 维护

### Tap 仓库

**地址：** https://github.com/zhuSilence/homebrew-git-worktree-manager

### 文件结构

```
homebrew-git-worktree-manager/
├── Casks/
│   └── git-worktree-manager.rb
└── README.md
```

### 自动更新（推荐）

项目已配置自动化 workflow `.github/workflows/update-tap.yml`。

当 Release 发布时，会自动：
1. 下载 DMG 文件
2. 计算 SHA256
3. 更新 Cask 文件
4. 推送到 Tap 仓库

**配置要求：** 需要在主仓库添加 `TAP_TOKEN` secret（GitHub Personal Access Token，需要 `repo` 权限）。

### 手动更新 Cask 文件

如果自动更新失败，可以手动更新：

**文件：** `Casks/git-worktree-manager.rb`

```ruby
cask "git-worktree-manager" do
  version "0.0.5"  # ← 更新版本号
  
  on_macos do
    on_intel do
      url "https://github.com/zhuSilence/git-worktree-manager/releases/download/v#{version}/Git.Worktree.Manager_#{version}_x64.dmg"
      sha256 "新的_x64_SHA256"  # ← 更新 SHA256
    end
    on_arm do
      url "https://github.com/zhuSilence/git-worktree-manager/releases/download/v#{version}/Git.Worktree.Manager_#{version}_aarch64.dmg"
      sha256 "新的_aarch64_SHA256"  # ← 更新 SHA256
    end
  end
  # ...
end
```

### 计算 SHA256

```bash
# macOS x64
curl -fsSL -o x64.dmg "https://github.com/zhuSilence/git-worktree-manager/releases/download/v0.0.5/Git.Worktree.Manager_0.0.5_x64.dmg"
shasum -a 256 x64.dmg

# macOS aarch64
curl -fsSL -o aarch64.dmg "https://github.com/zhuSilence/git-worktree-manager/releases/download/v0.0.5/Git.Worktree.Manager_0.0.5_aarch64.dmg"
shasum -a 256 aarch64.dmg
```

### 更新 Tap 仓库

```bash
cd /tmp/homebrew-git-worktree-manager
# 或克隆仓库
git clone https://github.com/zhuSilence/homebrew-git-worktree-manager.git
cd homebrew-git-worktree-manager

# 更新 Casks/git-worktree-manager.rb
# 更新版本号和 SHA256

git add .
git commit -m "chore: update to v0.0.5"
git push
```

### 测试 Homebrew 安装

```bash
# 更新 tap
brew untap zhuSilence/git-worktree-manager
brew tap zhuSilence/git-worktree-manager

# 安装测试
brew install --cask git-worktree-manager

# 验证安装
ls -la /Applications/Git\ Worktree\ Manager.app
which git-worktree-manager
```

---

## 发布检查清单

### 发布前

- [ ] 代码已合并到 main 分支
- [ ] 所有测试通过
- [ ] 版本号已更新（package.json, tauri.conf.json, Cargo.toml）
- [ ] CHANGELOG.md 已更新
- [ ] README.md 已更新（如有需要）

### 构建发布

- [ ] 创建并推送 tag `vX.X.X`
- [ ] GitHub Actions 构建成功
- [ ] Draft Release 产物完整
- [ ] Release Notes 准确
- [ ] Publish Release

### 安装脚本

- [ ] 验证 curl 安装脚本下载 URL 正确
- [ ] 测试 `curl -fsSL ... | bash` 安装成功
- [ ] 测试 Windows PowerShell 安装成功

### Homebrew Tap

- [ ] 更新 Cask 版本号
- [ ] 计算并更新 SHA256
- [ ] 推送 Tap 仓库更新
- [ ] 测试 `brew install --cask git-worktree-manager` 成功

### 发布后

- [ ] 验证 GitHub Release 页面
- [ ] 验证官网/README 下载链接
- [ ] 通知用户新版本发布

---

## 快速命令参考

### 完整发布流程

```bash
# 1. 更新版本号
# 手动更新 package.json, tauri.conf.json, Cargo.toml

# 2. 更新 CHANGELOG
# 手动编辑 CHANGELOG.md

# 3. 提交并打 tag
git add .
git commit -m "chore: release v0.0.5"
git tag v0.0.5
git push origin main
git push origin v0.0.5

# 4. 等待 GitHub Actions 构建

# 5. 在 GitHub 上 Publish Release

# 6. 更新 Homebrew Tap
# 计算 SHA256
curl -fsSL -o x64.dmg "https://github.com/zhuSilence/git-worktree-manager/releases/download/v0.0.5/Git.Worktree.Manager_0.0.5_x64.dmg"
shasum -a 256 x64.dmg

curl -fsSL -o aarch64.dmg "https://github.com/zhuSilence/git-worktree-manager/releases/download/v0.0.5/Git.Worktree.Manager_0.0.5_aarch64.dmg"
shasum -a 256 aarch64.dmg

# 更新 Cask 文件并推送
```

### SHA256 一键获取

```bash
VERSION="0.0.5"
echo "x64: $(curl -fsSL https://github.com/zhuSilence/git-worktree-manager/releases/download/v${VERSION}/Git.Worktree.Manager_${VERSION}_x64.dmg | shasum -a 256 | cut -d' ' -f1)"
echo "aarch64: $(curl -fsSL https://github.com/zhuSilence/git-worktree-manager/releases/download/v${VERSION}/Git.Worktree.Manager_${VERSION}_aarch64.dmg | shasum -a 256 | cut -d' ' -f1)"
```

---

## 常见问题

### Q: Release 产物文件名格式是什么？

**A:** `Git.Worktree.Manager_版本_架构.后缀`

示例：
- `Git.Worktree.Manager_0.0.5_aarch64.dmg`
- `Git.Worktree.Manager_0.0.5_x64.dmg`
- `Git.Worktree.Manager_0.0.5_amd64.AppImage`

### Q: 安装脚本 404 错误？

**A:** 检查：
1. Release 是否已 Publish（不是 Draft）
2. 文件名是否与脚本中的 URL 匹配
3. 版本号是否正确

### Q: Homebrew 安装失败？

**A:** 检查：
1. Tap 仓库的 Cask 版本号是否更新
2. SHA256 是否正确
3. binary 路径是否正确（`git-worktree-manager` 不是 `Git Worktree Manager`）

### Q: macOS 提示"无法验证开发者"？

**A:** 这是正常现象，应用未经过 Apple 公证。用户可以：
1. 右键点击应用 → 打开
2. 系统设置 → 隐私与安全性 → 仍要打开
3. 命令行：`xattr -cr "/Applications/Git Worktree Manager.app"`

---

## 附录：文件模板

### release.yml 关键配置

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-macos-arm64:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin
      - run: cd code && npm install
      - run: cd code && npx tauri build --target aarch64-apple-darwin
      - uses: actions/upload-artifact@v4
        with:
          name: macos-arm64
          path: code/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg
```

### Cask 模板

```ruby
cask "git-worktree-manager" do
  version "VERSION"
  
  on_macos do
    on_intel do
      url "https://github.com/zhuSilence/git-worktree-manager/releases/download/v#{version}/Git.Worktree.Manager_#{version}_x64.dmg"
      sha256 "X64_SHA256"
    end
    on_arm do
      url "https://github.com/zhuSilence/git-worktree-manager/releases/download/v#{version}/Git.Worktree.Manager_#{version}_aarch64.dmg"
      sha256 "AARCH64_SHA256"
    end
  end

  name "Git Worktree Manager"
  desc "A GUI tool for managing Git worktrees"
  homepage "https://github.com/zhuSilence/git-worktree-manager"

  app "Git Worktree Manager.app"
  binary "#{appdir}/Git Worktree Manager.app/Contents/MacOS/git-worktree-manager"
end
```

---

*最后更新：2026-03-19*