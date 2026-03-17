# Release 发布指南

本文档描述如何发布 Git Worktree Manager 的新版本。

## 版本号规范

使用语义化版本：`MAJOR.MINOR.PATCH`

- **MAJOR**: 不兼容的 API 更改
- **MINOR**: 向后兼容的功能新增
- **PATCH**: 向后兼容的问题修复

---

## 1. 构建发布版本

### macOS

```bash
# 安装依赖
npm install

# 构建
npm run tauri:build

# 产物位置
# - src-tauri/target/release/bundle/dmg/worktree-manager_0.1.0_aarch64.dmg
# - src-tauri/target/release/bundle/dmg/worktree-manager_0.1.0_x64.dmg
# - src-tauri/target/release/bundle/macos/worktree-manager.app
```

### Windows

```powershell
# 需要安装 Visual Studio Build Tools
npm install
npm run tauri:build

# 产物位置
# - src-tauri/target/release/bundle/msi/worktree-manager_0.1.0_x64.msi
# - src-tauri/target/release/bundle/nsis/worktree-manager_0.1.0_x64-setup.exe
```

### Linux

```bash
npm install
npm run tauri:build

# 产物位置
# - src-tauri/target/release/bundle/deb/worktree-manager_0.1.0_amd64.deb
# - src-tauri/target/release/bundle/appimage/worktree-manager_0.1.0_amd64.AppImage
```

---

## 2. GitHub Release 发布

### 自动发布（推荐）

项目已配置 GitHub Actions，推送 tag 后自动构建发布：

```bash
# 创建并推送 tag
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions 会自动：
1. 构建 macOS/Windows/Linux 安装包
2. 创建 GitHub Release
3. 上传所有安装包

### 手动发布

1. 进入 [Releases](https://github.com/zhuSilence/worktree-manager/releases)
2. 点击 **Draft a new release**
3. 填写信息：
   - **Tag**: `v0.1.0`
   - **Title**: `v0.1.0 - 首个正式版本`
   - **Notes**: 更新日志
4. 上传构建产物
5. 点击 **Publish release**

---

## 3. Homebrew Formula

### 创建 Formula

在 `homebrew-worktree-manager` 仓库创建 Formula：

```ruby
# Formula/worktree-manager.rb
class WorktreeManager < Formula
  desc "轻量级 Git Worktree 可视化管理器"
  homepage "https://github.com/zhuSilence/worktree-manager"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/zhuSilence/worktree-manager/releases/download/v#{version}/worktree-manager_#{version}_aarch64.dmg"
      sha256 "下载后计算"
    end
    on_intel do
      url "https://github.com/zhuSilence/worktree-manager/releases/download/v#{version}/worktree-manager_#{version}_x64.dmg"
      sha256 "下载后计算"
    end
  end

  def install
    prefix.install "worktree-manager.app"
    bin.install_symlink prefix/"worktree-manager.app/Contents/MacOS/worktree-manager" => "worktree-manager"
  end

  test do
    assert_match "Git Worktree Manager", shell_output("#{bin}/worktree-manager --version")
  end
end
```

### 用户安装

```bash
# 添加 Tap
brew tap zhuSilence/worktree-manager

# 安装
brew install worktree-manager
```

---

## 4. DMG 安装（macOS）

### 签名（可选但推荐）

```bash
# 查看证书
security find-identity -v -p codesigning

# 签名
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (XXXXXXXXXX)" \
  --options runtime \
  src-tauri/target/release/bundle/macos/worktree-manager.app

# 公证
xcrun notarytool submit worktree-manager.dmg \
  --apple-id "your@email.com" \
  --password "@keychain:AC_PASSWORD" \
  --team-id "XXXXXXXXXX" \
  --wait
```

### 用户安装

```bash
# 下载 DMG
curl -LO https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_aarch64.dmg

# 挂载并安装
hdiutil attach worktree-manager_0.1.0_aarch64.dmg
cp -R /Volumes/worktree-manager/worktree-manager.app /Applications/
hdiutil detach /Volumes/worktree-manager
```

---

## 5. 源码安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/zhuSilence/worktree-manager.git
cd worktree-manager/code

# 安装依赖
npm install

# 开发模式
npm run tauri:dev

# 构建发布版本
npm run tauri:build
```

### 系统要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 18 |
| Rust | >= 1.70 |
| Git | >= 2.5 |

---

## 6. 更新日志模板

```markdown
# v0.1.0 (2026-03-17)

## ✨ 新功能

- Worktree 管理：列表展示、创建、删除
- 快捷操作：IDE、终端、文件管理器一键打开
- Diff 对比：与主分支的代码差异对比
- 多仓库管理：侧边栏仓库列表
- 分支管理：切换、创建、拉取远程分支
- 智能提示：已合并/陈旧分支提醒
- 批量操作：批量删除 worktree

## 🐛 Bug 修复

- 修复左侧仓库和中间面板文字溢出
- 修复 Diff 视图显示问题

## 🔧 改进

- UI 优化：面板收缩功能
- 性能优化：状态同步改进

## 📦 安装

- [macOS (Apple Silicon)](https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_aarch64.dmg)
- [macOS (Intel)](https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_x64.dmg)
- [Windows](https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_x64.msi)
- [Linux (deb)](https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_amd64.deb)
- [Linux (AppImage)](https://github.com/zhuSilence/worktree-manager/releases/download/v0.1.0/worktree-manager_0.1.0_amd64.AppImage)
```

---

## 7. 发布检查清单

- [ ] 更新 `package.json` 版本号
- [ ] 更新 `src-tauri/tauri.conf.json` 版本号
- [ ] 更新 `Cargo.toml` 版本号
- [ ] 运行完整测试
- [ ] 构建所有平台安装包
- [ ] 计算 SHA256 哈希值
- [ ] 创建 Git tag
- [ ] 创建 GitHub Release
- [ ] 上传安装包
- [ ] 更新 Homebrew Formula
- [ ] 更新文档

---

## 8. 发布后

1. 在 GitHub Release 发布公告
2. 更新项目主页
3. 社交媒体宣传
4. 收集用户反馈