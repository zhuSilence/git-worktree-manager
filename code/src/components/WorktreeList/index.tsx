import { WorktreeItem } from './WorktreeItem'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { GitBranch } from 'lucide-react'

export function WorktreeList() {
  const { worktrees, isLoading } = useWorktreeStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  if (!worktrees || worktrees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <GitBranch className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">No worktrees found</p>
        <p className="text-sm mt-1">Create a worktree to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {worktrees.map((worktree) => (
        <WorktreeItem key={worktree.id} worktree={worktree} />
      ))}
    </div>
  )
}