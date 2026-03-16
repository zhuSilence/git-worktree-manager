import { Worktree } from '@/types/worktree'
import { StatusBadge } from './StatusBadge'
import { Folder, GitBranch, ExternalLink, Terminal, Trash2 } from 'lucide-react'
import { gitService } from '@/services/git'

interface WorktreeItemProps {
  worktree: Worktree
}

export function WorktreeItem({ worktree }: WorktreeItemProps) {
  const handleOpenInTerminal = async () => {
    try {
      await gitService.openInTerminal(worktree.path)
    } catch (error) {
      console.error('Failed to open in terminal:', error)
    }
  }

  const handleOpenInEditor = async () => {
    try {
      await gitService.openInEditor(worktree.path)
    } catch (error) {
      console.error('Failed to open in editor:', error)
    }
  }

  const handleOpenFolder = async () => {
    try {
      await gitService.openWorktree(worktree)
    } catch (error) {
      console.error('Failed to open folder:', error)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
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
            <Folder className="w-4 h-4" />
            <span className="truncate" title={worktree.path}>
              {worktree.path}
            </span>
          </div>

          {worktree.lastActiveAt && (
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Last active: {worktree.lastActiveAt}
            </div>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={handleOpenInEditor}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Open in Editor"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenInTerminal}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Open in Terminal"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenFolder}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            title="Open Folder"
          >
            <Folder className="w-4 h-4" />
          </button>
          {!worktree.isMain && (
            <button
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Delete Worktree"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}