import { Header } from './components/layout'
import { Main } from './components/layout'
import { WorktreeList } from './components/WorktreeList'
import { useWorktreeStore } from './stores/worktreeStore'

function App() {
  const { currentRepo, isLoading, error } = useWorktreeStore()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
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
          <WorktreeList />
        )}
        
        {!isLoading && !error && !currentRepo && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No repository selected</p>
            <p className="text-sm">Click "打开仓库" to get started</p>
          </div>
        )}
      </Main>
    </div>
  )
}

export default App