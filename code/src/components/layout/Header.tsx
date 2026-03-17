import { useState } from 'react'
import { GitBranch, FolderOpen, Settings, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@/components/common'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorktreeStore } from '@/stores/worktreeStore'

interface HeaderProps {
  onCreateWorktree?: () => void
  onOpenSettings?: () => void
}

export const Header: React.FC<HeaderProps> = ({ onCreateWorktree, onOpenSettings }) => {
  const { currentRepo, loadRepository, refreshWorktrees, isLoading } = useWorktreeStore()
  const [isOpening, setIsOpening] = useState(false)

  const handleOpenRepo = async () => {
    try {
      setIsOpening(true)
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择 Git 仓库',
      })
      
      if (selected && typeof selected === 'string') {
        await loadRepository(selected)
      }
    } catch (error) {
      console.error('Failed to open repository:', error)
    } finally {
      setIsOpening(false)
    }
  }

  const handleRefresh = async () => {
    await refreshWorktrees()
  }

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenRepo}
            disabled={isOpening || isLoading}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            打开仓库
          </Button>
          
          {currentRepo && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onCreateWorktree}
                disabled={isLoading}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white"
              >
                <Plus className="h-4 w-4" />
                创建
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