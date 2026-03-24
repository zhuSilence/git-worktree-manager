import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { X, FolderOpen, Lightbulb, Github } from 'lucide-react'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { generateSuggestions, validateBranchName, NamingSuggestion } from '@/utils/namingSuggestion'
import { clsx } from 'clsx'

interface CreateWorktreeDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateWorktreeDialog({ isOpen, onClose }: CreateWorktreeDialogProps) {
  const { currentRepo, createWorktree, isLoading } = useWorktreeStore()
  const [name, setName] = useState('')
  const deferredName = useDeferredValue(name)
  const [baseBranch, setBaseBranch] = useState('')
  const [customPath, setCustomPath] = useState('')
  const [createNewBranch, setCreateNewBranch] = useState(true)
  const [error, setError] = useState('')
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // 弹窗打开后延迟标记为就绪，避免初始渲染阻塞
  useEffect(() => {
    if (isOpen) {
      setIsReady(false)
      const timer = setTimeout(() => setIsReady(true), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // 生成命名建议 - 使用 deferred value 避免输入阻塞
  const suggestions = useMemo(() => {
    if (!isReady) return []
    return generateSuggestions(deferredName)
  }, [deferredName, isReady])

  // 验证名称 - 使用即时值保证输入响应
  const nameValidation = useMemo(() => validateBranchName(name), [name])

  // 当仓库改变时，更新默认分支
  useEffect(() => {
    if (currentRepo?.branches.length) {
      const current = currentRepo.branches.find(b => b.isCurrent)
      setBaseBranch(current?.name || currentRepo.branches[0]?.name || '')
    }
  }, [currentRepo])

  // 检测剪贴板内容 - 使用 setTimeout 延迟执行避免阻塞渲染
  useEffect(() => {
    if (!isOpen) return

    const checkClipboard = async () => {
      try {
        // 检查是否在 Tauri 环境
        const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
        if (isTauri) {
          // Tauri 环境下跳过剪贴板读取，避免权限问题
          setClipboardHint(null)
          return
        }

        const text = await navigator.clipboard.readText()
        if (text) {
          // 检查是否是 GitHub Issue 链接
          if (text.includes('github.com') && text.includes('/issues/')) {
            setClipboardHint('检测到 GitHub Issue 链接，粘贴后自动生成建议')
          } else if (text.includes('atlassian.net/browse/') || /^[A-Z]+-\d+$/i.test(text.trim())) {
            setClipboardHint('检测到 Jira Issue，粘贴后自动生成建议')
          } else {
            setClipboardHint(null)
          }
        }
      } catch {
        // 剪贴板访问失败，忽略
        setClipboardHint(null)
      }
    }

    // 延迟执行，避免阻塞弹窗渲染
    const timer = setTimeout(() => {
      checkClipboard()
    }, 100)

    return () => clearTimeout(timer)
  }, [isOpen])

  // 重置表单
  const resetForm = () => {
    setName('')
    setCustomPath('')
    setError('')
    setCreateNewBranch(true)
    setClipboardHint(null)
  }

  // 关闭对话框
  const handleClose = () => {
    resetForm()
    onClose()
  }

  // 应用建议
  const applySuggestion = (suggestion: NamingSuggestion) => {
    setName(suggestion.value)
  }

  // 提交创建
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('请输入 Worktree 名称')
      return
    }

    if (!nameValidation.valid) {
      setError(nameValidation.message || '名称格式不正确')
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
              placeholder="例如: feature/new-feature 或粘贴 Issue 链接"
              className={clsx(
                'w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2',
                nameValidation.valid || !name
                  ? 'border-gray-300 dark:border-gray-600 focus:ring-green-500'
                  : 'border-red-300 dark:border-red-600 focus:ring-red-500'
              )}
            />
            {clipboardHint && !name && (
              <p className="mt-1 text-xs text-blue-500 flex items-center gap-1">
                <Github className="w-3 h-3" />
                {clipboardHint}
              </p>
            )}
            {!nameValidation.valid && name && (
              <p className="mt-1 text-xs text-red-500">{nameValidation.message}</p>
            )}
          </div>

          {/* 智能命名建议 */}
          {suggestions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                命名建议
              </label>
              <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 6).map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applySuggestion(suggestion)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded border transition-colors',
                      'hover:bg-gray-100 dark:hover:bg-gray-700',
                      name === suggestion.value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              disabled={isLoading || (!nameValidation.valid && !!name)}
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