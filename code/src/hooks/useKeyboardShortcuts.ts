import { useEffect, useCallback, useRef } from 'react'

interface KeyboardShortcutsConfig {
  onCreateWorktree: () => void
  onRefresh: () => void
  onOpenSettings: () => void
  onFocusSearch: () => void
  onCloseDialog: () => void
  onDeleteSelected?: () => void
  enabled?: boolean
}

/**
 * 全局快捷键 Hook
 * 
 * 快捷键映射：
 * - Cmd/Ctrl + N: 创建新 worktree
 * - Cmd/Ctrl + R: 刷新 worktree 列表
 * - Cmd/Ctrl + F: 聚焦搜索框
 * - Cmd/Ctrl + ,: 打开设置
 * - Escape: 关闭对话框/取消操作
 */
export function useKeyboardShortcuts({
  onCreateWorktree,
  onRefresh,
  onOpenSettings,
  onFocusSearch,
  onCloseDialog,
  onDeleteSelected,
  enabled = true,
}: KeyboardShortcutsConfig) {
  const isDialogOpen = useRef(false)

  // 设置对话框状态（供外部组件调用）
  const setDialogOpen = useCallback((open: boolean) => {
    isDialogOpen.current = open
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      // Escape - 关闭对话框（优先级最高）
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseDialog()
        return
      }

      // 以下快捷键在有对话框打开时不触发
      if (isDialogOpen.current) return

      // Cmd/Ctrl + N - 创建新 worktree
      if (cmdKey && e.key === 'n') {
        e.preventDefault()
        onCreateWorktree()
        return
      }

      // Cmd/Ctrl + R - 刷新列表
      if (cmdKey && e.key === 'r') {
        e.preventDefault()
        onRefresh()
        return
      }

      // Cmd/Ctrl + F - 聚焦搜索框
      if (cmdKey && e.key === 'f') {
        e.preventDefault()
        onFocusSearch()
        return
      }

      // Cmd/Ctrl + , - 打开设置
      if (cmdKey && e.key === ',') {
        e.preventDefault()
        onOpenSettings()
        return
      }

      // Delete - 删除选中的 worktree（可选）
      if (e.key === 'Delete' && onDeleteSelected) {
        e.preventDefault()
        onDeleteSelected()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onCreateWorktree, onRefresh, onOpenSettings, onFocusSearch, onCloseDialog, onDeleteSelected])

  return { setDialogOpen }
}