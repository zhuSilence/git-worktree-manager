import { useState } from 'react'
import { Worktree } from '@/types/worktree'
import { StatusBadge } from './StatusBadge'
import { Folder, ExternalLink, Terminal, Trash2, GitCompare, GitBranch } from 'lucide-react'
import { gitService } from '@/services/git'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { settingsStore } from '@/stores/settingsStore'
import { BranchManager } from '@/components/BranchManager'

interface WorktreeItemProps {
  worktree: Worktree
  branches: { name: string; isCurrent: boolean }[]
  onShowDiff?: (path: string, name: string) => void
}

export function WorktreeItem({ worktree, branches, onShowDiff }: WorktreeItemProps) {
  const { deleteWorktree } = useWorktreeStore()
  const { defaultIde, defaultTerminal } = settingsStore()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showBranchManager, setShowBranchManager] = useState(false)

  const handleOpenInTerminal = async () => {
    try {
      await gitService.openInTerminal(worktree.path, defaultTerminal)
    } catch (error) {
      console.error('Failed to open in terminal:', error)
    }
  }

  const handleOpenInEditor = async () => {
    try {
      await gitService.openInEditor(worktree.path, defaultIde)
    } catch (error) {
      console.error('Failed to open in editor:', error)
    }
  }

  const handleOpenFolder = async () => {
    try {
      // 在 Finder 中打开
      await gitService.openWorktree(worktree)
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteWorktree(worktree.path, false)
      if (!result.success) {
        // 如果有未提交更改，尝试强制删除
        if (result.message.includes('uncommitted changes')) {
          const forceResult = await deleteWorktree(worktree.path, true)
          if (!forceResult.success) {
            setDeleteError(forceResult.message)
          } else {
            setShowDeleteConfirm(false)
          }
        } else {
          setDeleteError(result.message)
        }
      } else {
        setShowDeleteConfirm(false)
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors overflow-hidden">
        <div className="flex items-start justify-between">
          {/* 左侧：分支信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={worktree.status} />
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {worktree.branch || 'DETACHED'}
              </span>
              {worktree.isMain && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                  Main
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <Folder className="w-4 h-4 flex-shrink-0" />
              <span className="truncate" title={worktree.path}>
                {worktree.path}
              </span>
            </div>

            {/* 最后提交信息 */}
            {worktree.lastCommit && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0" title={`${worktree.lastCommit.author} • ${worktree.lastCommit.hash}`}>
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                  {worktree.lastCommit.hash}
                </span>
                <span className="truncate block min-w-0 flex-1">{worktree.lastCommit.message}</span>
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 text-xs" title={worktree.lastCommit.relativeTime}>
                  {worktree.lastCommit.relativeTime}
                </span>
              </div>
            )}

            {worktree.lastActiveAt && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1" title={worktree.lastActiveAt}>
                最后活跃: {worktree.lastActiveAt}
              </div>
            )}
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setShowBranchManager(true)}
              className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="分支管理"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <button
              onClick={() => onShowDiff?.(worktree.path, worktree.name)}
              className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="查看与主分支差异"
            >
              <GitCompare className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenInEditor}
              className="p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="在 VS Code 中打开"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenInTerminal}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="在终端中打开"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenFolder}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="在 Finder 中打开"
            >
              <Folder className="w-4 h-4" />
            </button>
            {!worktree.isMain && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="删除 Worktree"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              确认删除
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              确定要删除 worktree <span className="font-medium">{worktree.branch}</span> 吗？
            </p>
            {deleteError && (
              <div className="mb-4 p-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分支管理 */}
      <BranchManager
        isOpen={showBranchManager}
        onClose={() => setShowBranchManager(false)}
        worktreePath={worktree.path}
        worktreeBranch={worktree.branch}
        branches={branches}
      />
    </>
  )
}