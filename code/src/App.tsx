import { useState, useEffect, useRef, useCallback } from 'react'
import { PanelLeftOpen, GitBranch } from 'lucide-react'
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { RepositoryInfo } from './types/worktree'

function App() {
  const { currentRepo, isLoading, error, loadRepository, refreshWorktrees, worktrees } = useWorktreeStore()
  const { repositories, activeRepoId, setActiveRepository } = useRepositoryStore()
  const { autoRefreshInterval } = settingsStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [diffWorktree, setDiffWorktree] = useState<{ path: string; name: string } | null>(null)
  const [mainCollapsed, setMainCollapsed] = useState(() => localStorage.getItem('main-panel-collapsed') === 'true')
  
  // 搜索框 ref
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // 聚焦搜索框
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
  }, [])
  
  // 关闭所有对话框
  const closeAllDialogs = useCallback(() => {
    if (showCreateDialog) {
      setShowCreateDialog(false)
    } else if (showSettings) {
      setShowSettings(false)
    } else if (diffWorktree) {
      setDiffWorktree(null)
    }
  }, [showCreateDialog, showSettings, diffWorktree])

  // 注册快捷键
  useKeyboardShortcuts({
    onCreateWorktree: () => setShowCreateDialog(true),
    onRefresh: refreshWorktrees,
    onOpenSettings: () => setShowSettings(true),
    onFocusSearch: focusSearch,
    onCloseDialog: closeAllDialogs,
    enabled: !mainCollapsed && !!currentRepo,
  })

  const toggleMainCollapsed = () => {
    setMainCollapsed(prev => {
      const next = !prev
      localStorage.setItem('main-panel-collapsed', String(next))
      return next
    })
  }

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
    // 更新 repositoryStore 中的 activeRepoId，useEffect 会自动触发 loadRepository
    setActiveRepository(repo.id)
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
        {mainCollapsed ? (
          /* 收缩态：窄条 */
          <div className="w-10 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-2 flex-shrink-0 transition-all duration-200">
            <button
              onClick={toggleMainCollapsed}
              className="p-1.5 mb-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="展开 Worktree 列表"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            {/* 垂直标签 */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <GitBranch className="w-4 h-4 text-gray-400" />
              {currentRepo && (
                <span className="text-xs text-gray-400 font-medium">{worktrees.length}</span>
              )}
            </div>
          </div>
        ) : (
          /* 展开态：完整内容 */
          <Main className="flex-1 min-w-0">
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
              onCollapse={toggleMainCollapsed}
              searchInputRef={searchInputRef}
            />
          )}

          {!isLoading && !error && !currentRepo && repositories.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 animate-fade-in-up">
              <svg className="w-20 h-20 mb-4 text-gray-300 dark:text-gray-600 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-lg mb-2">欢迎使用 Worktree Manager</p>
              <p className="text-sm mb-4">点击左侧“添加仓库”按钮开始</p>
            </div>
          )}

          {!isLoading && !error && !currentRepo && repositories.length > 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 animate-fade-in-up">
              <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg mb-2">选择一个仓库</p>
              <p className="text-sm">点击左侧仓库列表中的项目</p>
            </div>
          )}
          </Main>
        )}

        {/* 右侧 Diff 边栏 */}
        {diffWorktree && (
          <DiffSidebar
            isOpen={true}
            onClose={() => setDiffWorktree(null)}
            worktreePath={diffWorktree.path}
            worktreeName={diffWorktree.name}
            branches={currentRepo?.branches.map(b => b.name) || []}
            defaultBranch={currentRepo?.defaultBranch || 'main'}
            fillWidth={mainCollapsed}
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