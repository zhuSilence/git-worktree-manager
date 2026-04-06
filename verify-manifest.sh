#!/bin/bash
# Manifest 验证脚本

REPO="zhuSilence/git-worktree-manager"
VERSION="${1:-latest}"

if [ "$VERSION" = "latest" ]; then
  TAG="latest"
else
  TAG="v${VERSION}"
fi

echo "=== Verifying manifests for ${TAG} ==="

for PLATFORM in darwin-aarch64 darwin-x86_64 linux-x86_64 windows-x86_64; do
  echo ""
  echo "--- ${PLATFORM} ---"

  URL="https://github.com/${REPO}/releases/download/${TAG}/${PLATFORM}.json"

  # 下载 manifest
  MANIFEST=$(curl -sL "$URL" 2>/dev/null)

  if [ -z "$MANIFEST" ]; then
    echo "❌ Manifest not found: ${PLATFORM}.json"
    continue
  fi

  # 提取字段
  VERSION_FOUND=$(echo "$MANIFEST" | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
  FILE_URL=$(echo "$MANIFEST" | grep -o '"url": "[^"]*"' | cut -d'"' -f4)
  SIGNATURE=$(echo "$MANIFEST" | grep -o '"signature": "[^"]*"' | cut -d'"' -f4)

  echo "  Version: ${VERSION_FOUND}"
  echo "  URL: ${FILE_URL}"

  # 检查 version
  if [ -z "$VERSION_FOUND" ]; then
    echo "  ❌ Version is empty"
  else
    echo "  ✅ Version correct"
  fi

  # 检查 signature
  if [ -z "$SIGNATURE" ]; then
    echo "  ❌ Signature is empty"
  else
    echo "  ✅ Signature present (${#SIGNATURE} chars)"
  fi

  # 检查 URL 可访问
  HTTP_CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$FILE_URL" 2>/dev/null)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ URL accessible (HTTP 200)"
  else
    echo "  ❌ URL not accessible (HTTP ${HTTP_CODE})"
  fi
done
