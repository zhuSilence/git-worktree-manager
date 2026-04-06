# Git Worktree Manager Installation Script for Windows
# https://github.com/zhuSilence/git-worktree-manager

param(
    [string]$Version = "",
    [string]$InstallDir = "",
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$Repo = "zhuSilence/git-worktree-manager"
$BinaryName = "git-worktree-manager"

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Blue }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red; exit 1 }

function Get-LatestVersion {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    return $release.tag_name -replace "^v", ""
}

function Download-File {
    param($Url, $Output)
    
    Write-Info "Downloading from $Url..."
    
    try {
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $Output)
    } catch {
        Invoke-WebRequest -Uri $Url -OutFile $Output
    }
}

function Install-Windows {
    param($Version, $Arch)
    
    # Note: Windows release artifacts use product name without version in filename
    $downloadUrl = "https://github.com/$Repo/releases/download/v$Version/Git.Worktree.Manager_x64-setup.exe"
    $tempFile = "$env:TEMP\${BinaryName}-setup.exe"
    
    # Download
    Download-File -Url $downloadUrl -Output $tempFile
    
    # Run installer
    Write-Info "Running installer..."
    Start-Process -FilePath $tempFile -Wait
    
    # Cleanup
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    
    Write-Success "Git Worktree Manager v$Version installed successfully!"
    Write-Success "You can find it in your Start Menu or Desktop"
}

# Main
if ($Help) {
    Write-Host @"

Git Worktree Manager Installer

Usage:
  .\install.ps1                    # Install latest version
  .\install.ps1 -Version 0.0.1     # Install specific version
  .\install.ps1 -Help              # Show this help

Environment Variables:
  INSTALL_DIR                      # Custom installation directory

"@
    exit 0
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗"
Write-Host "║     Git Worktree Manager Installer         ║"
Write-Host "╚════════════════════════════════════════════╝"
Write-Host ""

# Get version
if (-not $Version) {
    Write-Info "Fetching latest version..."
    $Version = Get-LatestVersion
}

Write-Info "Installing version: v$Version"
Write-Info "Detected: Windows (x64)"

# Install
Install-Windows -Version $Version -Arch "x64"

Write-Host ""
Write-Host "Run 'Git Worktree Manager' from Start Menu to get started!"