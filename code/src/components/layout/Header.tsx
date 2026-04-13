import { GitBranch, Settings, RefreshCw, Plus, Clock, Download, Zap, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/common'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { updateStore } from '@/stores/updateStore'

interface HeaderProps {
  onCreateWorktree?: () => void
  onOpenSettings?: () => void
  onOpenTimeline?: () => void
  onOpenHotfix?: () => void
  onOpenOperationLog?: () => void
  onRefresh?: () => void
  onFetch?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onCreateWorktree, onOpenSettings, onOpenTimeline, onOpenHotfix, onOpenOperationLog, onRefresh, onFetch }) => {
  const { t } = useTranslation()
  const { currentRepo, refreshWorktrees, isLoading, isFetching } = useWorktreeStore()
  const isUpdateAvailable = updateStore(state => state.isUpdateAvailable)

  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh()
    } else {
      await refreshWorktrees()
    }
  }

  const handleFetch = async () => {
    if (onFetch) {
      await onFetch()
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
                aria-label={t('worktree.create')}
              >
                <Plus className="h-4 w-4" />
                <span>{t('header.create')}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onOpenHotfix}
                disabled={isLoading}
                className="flex items-center gap-2 text-orange-500 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                title={t('hotfix.title', '快速 Hotfix')}
              >
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Hotfix</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenTimeline}
                title={t('timeline.title')}
              >
                <Clock className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenOperationLog}
                title={t('operationLog.title')}
              >
                <ScrollText className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleFetch}
                disabled={isFetching || isLoading}
                title={t('header.fetchRemote')}
              >
                <Download className={`h-4 w-4 ${isFetching ? 'animate-pulse' : ''}`} />
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

          <Button variant="ghost" size="icon" onClick={onOpenSettings} className="relative">
            <Settings className="h-4 w-4" />
            {isUpdateAvailable && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}