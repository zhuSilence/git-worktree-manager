import { useState } from 'react'
import { Header } from './components/layout'
import { Main } from './components/layout'
import { WorktreeList } from './components/WorktreeList'
import { CreateWorktreeDialog } from './components/CreateWorktreeDialog'
import { useWorktreeStore } from './stores/worktreeStore'

function App() {
  const { currentRepo, isLoading, error } = useWorktreeStore()
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header onCreateWorktree={() => setShowCreateDialog(true)} />
      <Main>
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
          <WorktreeList onCreateWorktree={() => setShowCreateDialog(true)} />
        )}
        
        {!isLoading && !error && !currentRepo && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-lg mb-2">No repository selected</p>
            <p className="text-sm">Click "打开仓库" to get started</p>
          </div>
        )}
      </Main>
      
      {/* 创建 Worktree 对话框 */}
      <CreateWorktreeDialog 
        isOpen={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)} 
      />
    </div>
  )
}

export default App