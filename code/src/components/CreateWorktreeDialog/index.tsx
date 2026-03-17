import { useState, useEffect } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { useWorktreeStore } from '@/stores/worktreeStore'

interface CreateWorktreeDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateWorktreeDialog({ isOpen, onClose }: CreateWorktreeDialogProps) {
  const { currentRepo, createWorktree, isLoading } = useWorktreeStore()
  const [name, setName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [createNewBranch, setCreateNewBranch] = useState(true)
  const [error, setError] = useState('')

  // 当仓库改变时，更新默认分支
  useEffect(() => {
    if (currentRepo?.branches.length) {
      const current = currentRepo.branches.find(b => b.isCurrent)
      setBaseBranch(current?.name || currentRepo.branches[0]?.name || '')
    }
  }, [currentRepo])

  // 重置表单
  const resetForm = () => {
    setName('')
    setCustomPath('')
    setError('')
    setCreateNewBranch(true)
  }

  // 关闭对话框
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // 提交创建
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('请输入 Worktree 名称')
      return
    }

    if (!baseBranch) {
      setError('请选择基础分支')
      return
    }

    // 构建目标路径
    const targetPath = customPath.trim() || `${currentRepo?.mainWorktreePath}-${name.replace(/\//g, '-')}`

    const result = await createWorktree({
      name: name.trim(),
      baseBranch,
      newBranch: createNewBranch ? name.trim() : undefined,
      customPath: targetPath,
    })

    if (result.success) {
      handleClose()
    } else {
      setError(result.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      
      {/* 对话框 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            创建 Worktree
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Worktree 名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: feature/new-feature"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          
          {/* 基础分支 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              基础分支
            </label>
            <select
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {currentRepo?.branches.map((branch) => (
                <option key={branch.name} value={branch.name}>
                  {branch.name} {branch.isCurrent ? '(当前)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          {/* 创建新分支选项 */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="createNewBranch"
              checked={createNewBranch}
              onChange={(e) => setCreateNewBranch(e.target.checked)}
              className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
            />
            <label htmlFor="createNewBranch" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              创建新分支 (使用 Worktree 名称)
            </label>
          </div>
          
          {/* 自定义路径 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              自定义路径 (可选)
            </label>
            <div className="relative">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder={`默认: ${currentRepo?.mainWorktreePath}-${name || 'xxx'}`}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          
          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md">
              {error}
            </div>
          )}
          
          {/* 按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}