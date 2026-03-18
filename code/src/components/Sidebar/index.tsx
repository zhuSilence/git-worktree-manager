import { useState } from 'react'
import { GitBranch, Plus, Trash2, RefreshCw, ChevronRight, ChevronLeft, FolderOpen } from 'lucide-react'
import { useRepositoryStore } from '@/stores/repositoryStore'
import { useWorktreeStore } from '@/stores/worktreeStore'
import type { RepositoryInfo } from '@/types/worktree'
import { clsx } from 'clsx'
import { open } from '@tauri-apps/plugin-dialog'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

interface SidebarProps {
  onRepoSelect: (repo: RepositoryInfo) => void
}

export function Sidebar({ onRepoSelect }: SidebarProps) {
  const { repositories, activeRepoId, addRepository, removeRepository, refreshRepositories, isLoading } = useRepositoryStore()
  const { refreshWorktrees } = useWorktreeStore()
  const [isAdding, setIsAdding] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true')

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  const handleAddRepo = async () => {
    try {
      setIsAdding(true)
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Git 仓库',
      })

      if (selected && typeof selected === 'string') {
        const repo = await addRepository(selected)
        if (repo) {
          onRepoSelect(repo)
        }
      }
    } catch (error) {
      console.error('Failed to add repository:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveRepo = (e: React.MouseEvent, repoId: string) => {
    e.stopPropagation()
    removeRepository(repoId)
  }

  const handleRefresh = async () => {
    await Promise.all([
      refreshRepositories(),
      refreshWorktrees(),
    ])
  }

  // ─── 收缩态 ─────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="w-12 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-2 transition-all duration-200">
        {/* 展开按钮 */}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 mb-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          title="展开仓库列表"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* 仓库图标列表 */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1.5 w-full px-1">
          {repositories.map((repo) => (
            <button
              key={repo.id}
              onClick={() => onRepoSelect(repo)}
              className={clsx(
                'w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0',
                activeRepoId === repo.id
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title={repo.name}
            >
              {repo.name.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>

        {/* 添加按钮 */}
        <button
          onClick={handleAddRepo}
          disabled={isAdding}
          className="mt-2 p-1.5 text-gray-400 hover:text-green-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
          title="添加仓库"
        >
          <Plus className="w-4 h-4" />
        </button>
      </aside>
    )
  }

  // ─── 展开态 ─────────────────────────────────────────────────────
  return (
    <aside className="w-64 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200">
      {/* 头部 */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            仓库列表
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="刷新"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            </button>
            <button
              onClick={handleAddRepo}
              disabled={isAdding}
              className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded"
              title="添加仓库"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleCollapsed}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="收起仓库列表"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {repositories.length} 个仓库
        </p>
      </div>

      {/* 仓库列表 */}
      <div className="flex-1 overflow-y-auto">
        {repositories.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无仓库</p>
            <button
              onClick={handleAddRepo}
              className="mt-2 text-xs text-green-500 hover:text-green-600"
            >
              + 添加仓库
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                onClick={() => onRepoSelect(repo)}
                className={clsx(
                  'group p-2 rounded-lg cursor-pointer transition-colors',
                  activeRepoId === repo.id
                    ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                        {repo.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 min-w-0">
                      <span className="flex items-center gap-1 min-w-0 flex-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                        <span className="truncate">{repo.currentBranch}</span>
                      </span>
                      <span className="flex-shrink-0">{repo.worktreeCount} wt</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRepo(e, repo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-opacity"
                    title="移除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 展开指示器 */}
                {activeRepoId === repo.id && (
                  <div className="mt-2 flex items-center text-xs text-green-600 dark:text-green-400">
                    <ChevronRight className="w-3 h-3" />
                    <span>当前选中</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部 */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleAddRepo}
          disabled={isAdding}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          添加仓库
        </button>
      </div>
    </aside>
  )
}