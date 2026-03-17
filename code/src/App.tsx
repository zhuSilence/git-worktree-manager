import { useState, useEffect, useCallback } from 'react'
import { Header } from './components/layout'
import { Main } from './components/layout'
import { WorktreeList } from './components/WorktreeList'
import { CreateWorktreeDialog } from './components/CreateWorktreeDialog'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { DiffSidebar } from './components/DiffSidebar'
import { useWorktreeStore } from './stores/worktreeStore'
import { useRepositoryStore } from './stores/repositoryStore'
import { settingsStore } from './stores/settingsStore'
import type { RepositoryInfo } from './types/worktree'

function App() {
  const { currentRepo, isLoading, error, loadRepository, refreshWorktrees } = useWorktreeStore()
  const { repositories, activeRepoId } = useRepositoryStore()
  const { autoRefreshInterval } = settingsStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [diffWorktree, setDiffWorktree] = useState<{ path: string; name: string } | null>(null)

  // 当活动仓库改变时，加载仓库数据
  useEffect(() => {
    if (activeRepoId) {
      loadRepository(activeRepoId)
    }
  }, [activeRepoId, loadRepository])

  // 自动刷新
  useEffect(() => {
    if (autoRefreshInterval <= 0 || !currentRepo) return
    const timer = setInterval(() => {
      refreshWorktrees()
    }, autoRefreshInterval * 1000)
    return () => clearInterval(timer)
  }, [autoRefreshInterval, currentRepo, refreshWorktrees])

  const handleRepoSelect = (repo: RepositoryInfo) => {
    loadRepository(repo.path)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Header 
        onCreateWorktree={() => setShowCreateDialog(true)} 
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 */}
        <Sidebar 
          onRepoSelect={handleRepoSelect}
        />
        
        {/* 主内容区 */}
        <Main className="flex-1">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          )}
          
          {error && (
            <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
          
          {!isLoading && !error && currentRepo && (
            <WorktreeList 
              onCreateWorktree={() => setShowCreateDialog(true)}
              onShowDiff={(path, name) => setDiffWorktree({ path, name })}
            />
          )}
          
          {!isLoading && !error && !currentRepo && repositories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg className="w-20 h-20 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-lg mb-2">欢迎使用 Worktree Manager</p>
              <p className="text-sm mb-4">点击左侧"添加仓库"按钮开始</p>
            </div>
          )}
          
          {!isLoading && !error && !currentRepo && repositories.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg mb-2">选择一个仓库</p>
              <p className="text-sm">点击左侧仓库列表中的项目</p>
            </div>
          )}
        </Main>

        {/* 右侧 Diff 边栏 */}
        {diffWorktree && (
          <DiffSidebar
            isOpen={true}
            onClose={() => setDiffWorktree(null)}
            worktreePath={diffWorktree.path}
            worktreeName={diffWorktree.name}
            branches={currentRepo?.branches.map(b => b.name) || []}
            defaultBranch={currentRepo?.defaultBranch || 'main'}
          />
        )}
      </div>
      
      {/* 创建 Worktree 对话框 */}
      <CreateWorktreeDialog 
        isOpen={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)} 
      />
      
      {/* 设置面板 */}
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  )
}

export default App