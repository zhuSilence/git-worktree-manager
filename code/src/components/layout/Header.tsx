import { GitBranch, Settings, RefreshCw, Plus, Clock } from 'lucide-react'
import { Button } from '@/components/common'
import { useWorktreeStore } from '@/stores/worktreeStore'

interface HeaderProps {
  onCreateWorktree?: () => void
  onOpenSettings?: () => void
  onOpenTimeline?: () => void
  onRefresh?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onCreateWorktree, onOpenSettings, onOpenTimeline, onRefresh }) => {
  const { currentRepo, refreshWorktrees, isLoading } = useWorktreeStore()

  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh()
    } else {
      await refreshWorktrees()
    }
  }

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-green-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Worktree Manager
          </h1>
          {currentRepo && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded truncate max-w-[300px]">
              {currentRepo.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentRepo && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onCreateWorktree}
                disabled={isLoading}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white"
                translate="no"
                aria-label="创建 Worktree"
              >
                <Plus className="h-4 w-4" />
                <span>创建</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenTimeline}
                title="时间线"
              >
                <Clock className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </>
          )}

          <Button variant="ghost" size="icon" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}