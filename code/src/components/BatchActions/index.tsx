import { useState } from 'react'
import { X, Trash2, AlertTriangle, CheckSquare, Square } from 'lucide-react'
import type { Worktree } from '@/types/worktree'
import { gitService } from '@/services/git'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { clsx } from 'clsx'

interface BatchActionsProps {
  isOpen: boolean
  onClose: () => void
  worktrees: Worktree[]
  repoPath: string
}

export function BatchActions({ isOpen, onClose, worktrees, repoPath }: BatchActionsProps) {
  const { refreshWorktrees } = useWorktreeStore()
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ successCount: number; failedCount: number } | null>(null)

  const toggleSelect = (path: string) => {
    const newSelected = new Set(selectedPaths)
    if (newSelected.has(path)) {
      newSelected.delete(path)
    } else {
      newSelected.add(path)
    }
    setSelectedPaths(newSelected)
  }

  const selectAll = () => {
    // 只选择非主 worktree
    const allPaths = worktrees.filter(w => !w.isMain).map(w => w.path)
    setSelectedPaths(new Set(allPaths))
  }

  const deselectAll = () => {
    setSelectedPaths(new Set())
  }

  const handleBatchDelete = async (force: boolean) => {
    const selectedWorktrees = worktrees.filter(w => selectedPaths.has(w.path))
    if (selectedWorktrees.length === 0) return

    const confirmMsg = force
      ? `确定强制删除 ${selectedWorktrees.length} 个 worktree 吗？（包括有未提交更改的）`
      : `确定删除 ${selectedWorktrees.length} 个 worktree 吗？`

    if (!confirm(confirmMsg)) return

    setIsLoading(true)
    setResult(null)

    try {
      const paths = selectedWorktrees.map(w => w.path)
      const batchResult = await gitService.batchDeleteWorktrees(repoPath, paths, force)
      setResult({ successCount: batchResult.successCount, failedCount: batchResult.failedCount })

      if (batchResult.successCount > 0) {
        await refreshWorktrees()
        setSelectedPaths(new Set())
      }
    } catch (err) {
      console.error('Batch delete failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const nonMainWorktrees = worktrees.filter(w => !w.isMain)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            批量删除
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-blue-500 hover:text-blue-600">
              全选
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button onClick={deselectAll} className="text-xs text-blue-500 hover:text-blue-600">
              取消全选
            </button>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            已选择 {selectedPaths.size} 个
          </span>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-auto p-4">
          {nonMainWorktrees.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>没有可删除的 worktree</p>
              <p className="text-sm mt-1">主 worktree 不能删除</p>
            </div>
          ) : (
            <div className="space-y-2">
              {nonMainWorktrees.map((worktree) => (
                <div
                  key={worktree.path}
                  onClick={() => toggleSelect(worktree.path)}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                    selectedPaths.has(worktree.path)
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-900 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {selectedPaths.has(worktree.path) ? (
                    <CheckSquare className="w-5 h-5 text-red-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{worktree.branch}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{worktree.path}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 结果 */}
        {result && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-center">
              <span className="text-green-500">成功 {result.successCount} 个</span>
              {result.failedCount > 0 && (
                <span className="text-red-500 ml-2">失败 {result.failedCount} 个</span>
              )}
            </p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => handleBatchDelete(false)}
            disabled={selectedPaths.size === 0 || isLoading}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            删除
          </button>
          <button
            onClick={() => handleBatchDelete(true)}
            disabled={selectedPaths.size === 0 || isLoading}
            className="flex-1 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            强制删除
          </button>
        </div>
      </div>
    </div>
  )
}