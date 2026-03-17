import { useState, useMemo } from 'react'
import { WorktreeItem } from './WorktreeItem'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { GitBranch, Plus, Search, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/common'
import type { Worktree } from '@/types/worktree'
import { WorktreeStatus } from '@/types/worktree'

type SortField = 'name' | 'status' | 'time'
type SortOrder = 'asc' | 'desc'

interface WorktreeListProps {
  onCreateWorktree?: () => void
}

export function WorktreeList({ onCreateWorktree }: WorktreeListProps) {
  const { worktrees, isLoading } = useWorktreeStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // 过滤和排序
  const filteredAndSortedWorktrees = useMemo(() => {
    let result = [...worktrees]

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((wt: Worktree) => 
        wt.name.toLowerCase().includes(query) ||
        wt.branch.toLowerCase().includes(query) ||
        wt.path.toLowerCase().includes(query)
      )
    }

    // 排序
    result.sort((a: Worktree, b: Worktree) => {
      let comparison = 0
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'status':
          // 状态优先级: conflict > dirty > detached > clean > unknown
          const statusOrder: Record<string, number> = {
            [WorktreeStatus.Conflicted]: 0,
            [WorktreeStatus.Dirty]: 1,
            [WorktreeStatus.Detached]: 2,
            [WorktreeStatus.Unpushed]: 3,
            [WorktreeStatus.Clean]: 4,
            [WorktreeStatus.Unknown]: 5,
          }
          comparison = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
          break
        case 'time':
          // 按最后提交时间排序 (没有时间信息的按 id 排序)
          comparison = a.id.localeCompare(b.id)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [worktrees, searchQuery, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!worktrees || worktrees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">No worktrees found</p>
        <p className="text-sm mt-1 mb-4">Create a worktree to get started</p>
        {onCreateWorktree && (
          <Button
            onClick={onCreateWorktree}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white"
          >
            <Plus className="w-4 h-4" />
            创建 Worktree
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* 工具栏 */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索分支名、路径..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
            />
          </div>
          
          {/* 排序按钮 */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <ArrowUpDown className="w-4 h-4" />
            <button
              onClick={() => toggleSort('name')}
              className={`px-2 py-1 rounded ${sortField === 'name' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              名称
            </button>
            <button
              onClick={() => toggleSort('status')}
              className={`px-2 py-1 rounded ${sortField === 'status' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              状态
            </button>
          </div>
        </div>
        
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          共 {filteredAndSortedWorktrees.length} 个 Worktree
          {searchQuery && worktrees.length !== filteredAndSortedWorktrees.length && (
            <span className="text-gray-400 ml-1">(筛选自 {worktrees.length} 个)</span>
          )}
        </h2>
      </div>
      
      {/* 列表 */}
      <div className="space-y-2">
        {filteredAndSortedWorktrees.map((worktree) => (
          <WorktreeItem key={worktree.id} worktree={worktree} />
        ))}
      </div>
      
      {/* 无搜索结果 */}
      {searchQuery && filteredAndSortedWorktrees.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>未找到匹配 "{searchQuery}" 的 Worktree</p>
        </div>
      )}
    </div>
  )
}