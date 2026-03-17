import { WorktreeItem } from './WorktreeItem'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { GitBranch, Plus } from 'lucide-react'
import { Button } from '@/components/common'

interface WorktreeListProps {
  onCreateWorktree?: () => void
}

export function WorktreeList({ onCreateWorktree }: WorktreeListProps) {
  const { worktrees, isLoading } = useWorktreeStore()

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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          共 {worktrees.length} 个 Worktree
        </h2>
      </div>
      <div className="space-y-2">
        {worktrees.map((worktree) => (
          <WorktreeItem key={worktree.id} worktree={worktree} />
        ))}
      </div>
    </div>
  )
}