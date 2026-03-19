#!/bin/bash

# Git Worktree Manager Installation Script
# https://github.com/zhuSilence/git-worktree-manager

set -e

REPO="zhuSilence/git-worktree-manager"
BINARY_NAME="git-worktree-manager"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Get latest version from GitHub API
get_latest_version() {
    local version
    version=$(curl -sf "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
    if [ -z "$version" ]; then
        error "Failed to get latest version. Please check your internet connection."
    fi
    echo "$version"
}

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*)  echo "linux" ;;
        *)       error "Unsupported OS: $(uname -s)" ;;
    esac
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        arm64|aarch64) echo "aarch64" ;;
        x86_64|amd64)  echo "x64" ;;
        *)             error "Unsupported architecture: $(uname -m)" ;;
    esac
}

# Download file
download_file() {
    local url="$1"
    local output="$2"
    
    info "Downloading from $url..."
    
    if command -v curl &> /dev/null; then
        curl -fSL --progress-bar -o "$output" "$url"
    elif command -v wget &> /dev/null; then
        wget -q --show-progress -O "$output" "$url"
    else
        error "Neither curl nor wget is installed. Please install one of them."
    fi
}

# Install on macOS
install_macos() {
    local version="$1"
    local arch="$2"
    local install_dir="${INSTALL_DIR:-$HOME/.local/bin}"
    local tmp_dir=$(mktemp -d)
    local dmg_file="$tmp_dir/$BINARY_NAME.dmg"
    
    local download_url="https://github.com/$REPO/releases/download/v$version/Git.Worktree.Manager_${version}_${arch}.dmg"
    
    # Download DMG
    download_file "$download_url" "$dmg_file"
    
    # Mount DMG
    info "Mounting DMG..."
    hdiutil attach -quiet "$dmg_file"
    
    # Find mount point
    local mount_point="/Volumes/Git Worktree Manager"
    if [ ! -d "$mount_point" ]; then
        mount_point="/Volumes/${BINARY_NAME}"
    fi
    
    # Copy app to Applications
    info "Installing to /Applications..."
    if [ -d "$mount_point/Git Worktree Manager.app" ]; then
        cp -R "$mount_point/Git Worktree Manager.app" /Applications/
    elif [ -d "$mount_point/${BINARY_NAME}.app" ]; then
        cp -R "$mount_point/${BINARY_NAME}.app" /Applications/
    else
        hdiutil detach -quiet "$mount_point"
        error "Could not find app in DMG"
    fi
    
    # Unmount
    hdiutil detach -quiet "$mount_point"
    
    # Create symlink for CLI
    mkdir -p "$install_dir"
    local app_path="/Applications/Git Worktree Manager.app"
    if [ ! -d "$app_path" ]; then
        app_path="/Applications/${BINARY_NAME}.app"
    fi
    
    if [ -d "$app_path/Contents/MacOS" ]; then
        ln -sf "$app_path/Contents/MacOS/Git Worktree Manager" "$install_dir/$BINARY_NAME" 2>/dev/null || true
        success "CLI installed to $install_dir/$BINARY_NAME"
        
        # Add to PATH if needed
        if ! echo "$PATH" | grep -q "$install_dir"; then
            warn "Add $install_dir to your PATH:"
            echo "  export PATH=\"\$PATH:$install_dir\"" >> ~/.zshrc 2>/dev/null || true
            echo "  export PATH=\"\$PATH:$install_dir\"" >> ~/.bashrc 2>/dev/null || true
        fi
    fi
    
    # Cleanup
    rm -rf "$tmp_dir"
    
    success "Git Worktree Manager v$version installed successfully!"
    success "You can find it in /Applications or run '$BINARY_NAME' from terminal"
}

# Install on Linux
install_linux() {
    local version="$1"
    local arch="$2"
    local install_dir="${INSTALL_DIR:-$HOME/.local/bin}"
    
    local download_url="https://github.com/$REPO/releases/download/v$version/${BINARY_NAME}_${version}_amd64.AppImage"
    local tmp_file="/tmp/$BINARY_NAME"
    
    # Download AppImage
    download_file "$download_url" "$tmp_file"
    
    # Make executable
    chmod +x "$tmp_file"
    
    # Move to install directory
    mkdir -p "$install_dir"
    mv "$tmp_file" "$install_dir/$BINARY_NAME"
    
    # Add to PATH if needed
    if ! echo "$PATH" | grep -q "$install_dir"; then
        warn "Add $install_dir to your PATH:"
        echo ""
        echo "  echo 'export PATH=\"\$PATH:$install_dir\"' >> ~/.bashrc"
        echo "  source ~/.bashrc"
    fi
    
    success "Git Worktree Manager v$version installed to $install_dir/$BINARY_NAME"
}

# Main
main() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║     Git Worktree Manager Installer         ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    
    # Check for version argument
    VERSION="${1:-}"
    if [ -z "$VERSION" ]; then
        info "Fetching latest version..."
        VERSION=$(get_latest_version)
    fi
    
    info "Installing version: v$VERSION"
    
    # Detect OS and architecture
    OS=$(detect_os)
    ARCH=$(detect_arch)
    
    info "Detected: $OS ($ARCH)"
    
    # Install
    case "$OS" in
        macos) install_macos "$VERSION" "$ARCH" ;;
        linux) install_linux "$VERSION" "$ARCH" ;;
    esac
    
    echo ""
    echo "Run '$BINARY_NAME' to get started!"
}

# Run main
main "$@"