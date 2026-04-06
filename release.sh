#!/bin/bash

# Git Worktree Manager 自动发布脚本
# 用法: ./release.sh [patch|minor|major] 或 ./release.sh [版本号]
#
# 示例:
#   ./release.sh patch        # 0.0.10 -> 0.0.11
#   ./release.sh minor        # 0.0.10 -> 0.1.0
#   ./release.sh major        # 0.0.10 -> 1.0.0
#   ./release.sh 0.1.0        # 直接指定版本

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 获取当前版本
get_current_version() {
    local version
    version=$(grep '"version"' code/package.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
    echo "$version"
}

# 升级版本号
bump_version() {
    local current=$1
    local type=$2

    local major=$(echo "$current" | cut -d. -f1)
    local minor=$(echo "$current" | cut -d. -f2)
    local patch=$(echo "$current" | cut -d. -f3)

    case "$type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            error "Unknown bump type: $type"
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# 验证版本号格式
validate_version() {
    local version=$1
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error "Invalid version format: $version. Expected: X.Y.Z"
    fi
}

# 更新版本号文件
update_version_files() {
    local new_version=$1

    info "Updating version to $new_version..."

    # Update package.json
    sed -i '' -E 's/"version": "[^"]+"/"version": "'"$new_version"'"/' code/package.json

    # Update Cargo.toml
    sed -i '' -E 's/^version = "[^"]+"/version = "'"$new_version"'"/' code/src-tauri/Cargo.toml

    # Update tauri.conf.json
    sed -i '' -E 's/"version": "[^"]+"/"version": "'"$new_version"'"/' code/src-tauri/tauri.conf.json

    success "Version files updated"
}

# 检查文件是否已修改
check_changes() {
    if git diff --quiet code/ 2>/dev/null; then
        error "No version changes detected. Something went wrong."
    fi
}

# 主流程
main() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║  Git Worktree Manager Release Script       ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""

    # 检查是否在项目根目录
    if [ ! -f "code/package.json" ] || [ ! -f "code/src-tauri/Cargo.toml" ]; then
        error "Please run this script from the project root directory"
    fi

    # 检查 git 状态
    if [ -n "$(git status --porcelain)" ]; then
        warn "You have uncommitted changes. Please commit or stash them first."
        git status --short
        echo ""
        read -p "Continue anyway? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # 获取当前版本
    CURRENT_VERSION=$(get_current_version)
    info "Current version: $CURRENT_VERSION"

    # 确定新版本
    BUMP_TYPE="${1:-patch}"

    if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        # 直接指定版本号
        NEW_VERSION="$BUMP_TYPE"
        validate_version "$NEW_VERSION"
        if [ "$NEW_VERSION" = "$CURRENT_VERSION" ]; then
            error "New version ($NEW_VERSION) is the same as current version"
        fi
        info "Using specified version: $NEW_VERSION"
    else
        # 自动升级版本
        case "$BUMP_TYPE" in
            patch|minor|major)
                NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$BUMP_TYPE")
                info "Bump type: $BUMP_TYPE -> $NEW_VERSION"
                ;;
            *)
                error "Invalid argument. Usage: $0 [patch|minor|major|X.Y.Z]"
                ;;
        esac
    fi

    # 确认
    echo ""
    warn "Ready to release: $CURRENT_VERSION -> $NEW_VERSION"
    read -p "Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Aborted"
        exit 0
    fi

    # 更新版本文件
    update_version_files "$NEW_VERSION"

    # 验证更新
    check_changes

    # 显示 diff
    echo ""
    info "Changes to be committed:"
    git diff code/

    # 确认提交
    echo ""
    read -p "Commit and push these changes? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        warn "Rolling back changes..."
        git checkout code/
        exit 1
    fi

    # 提交更改
    git add code/
    git commit -m "chore: release v$NEW_VERSION"
    success "Committed: chore: release v$NEW_VERSION"

    # 推送
    git push
    success "Pushed to remote"

    # 创建标签
    TAG="v$NEW_VERSION"
    git tag "$TAG"
    success "Created tag: $TAG"

    # 推送标签
    git push origin "$TAG"
    success "Pushed tag: $TAG"

    # 完成
    echo ""
    echo "═══════════════════════════════════════════════════"
    success "Release $NEW_VERSION initiated!"
    echo "═══════════════════════════════════════════════════"
    echo ""
    info "Next steps:"
    echo "  1. Monitor build progress:"
    echo "     https://github.com/zhuSilence/git-worktree-manager/actions"
    echo "  2. Verify release:"
    echo "     https://github.com/zhuSilence/git-worktree-manager/releases/tag/$TAG"
    echo ""
}

# 运行
main "$@"
