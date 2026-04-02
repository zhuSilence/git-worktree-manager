import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, GitMerge, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { gitService } from '@/services/git'
import type { Worktree, MergeResult, ConflictFile } from '@/types/worktree'
import { MergeStatus } from '@/types/worktree'
import { clsx } from 'clsx'

interface MergePanelProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string
  sourceWorktree: Worktree
  targetWorktrees: Worktree[]
  onMergeComplete?: () => void
}

export function MergePanel({
  isOpen,
  onClose,
  repoPath,
  sourceWorktree,
  targetWorktrees,
  onMergeComplete,
}: MergePanelProps) {
  const { t } = useTranslation()
  const [selectedTarget, setSelectedTarget] = useState<Worktree | null>(null)
  const [autoPush, setAutoPush] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 过滤掉源 worktree 和 detached HEAD 的 worktree
  const availableTargets = useMemo(() => {
    return targetWorktrees.filter(
      (wt) => wt.path !== sourceWorktree.path && wt.branch && !wt.branch.startsWith('(')
    )
  }, [targetWorktrees, sourceWorktree])

  // 重置状态当面板打开时
  useState(() => {
    if (isOpen) {
      setSelectedTarget(null)
      setAutoPush(false)
      setMergeResult(null)
      setError(null)
    }
  })

  const handleMerge = async () => {
    if (!selectedTarget) return

    setIsMerging(true)
    setError(null)
    setMergeResult(null)

    try {
      const result = await gitService.mergeBranch({
        repoPath,
        targetWorktreePath: selectedTarget.path,
        sourceBranch: sourceWorktree.branch,
        autoPush,
        autoDeleteSource: false, // 暂时不支持自动删除
      })

      setMergeResult(result)

      if (result.success && result.status === MergeStatus.Completed) {
        onMergeComplete?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('merge.unknownError'))
    } finally {
      setIsMerging(false)
    }
  }

  const handleAbortMerge = async () => {
    if (!selectedTarget) return

    try {
      await gitService.abortMerge(selectedTarget.path)
      setMergeResult(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('merge.abortFailed'))
    }
  }

  const handleCompleteMerge = async () => {
    if (!selectedTarget) return

    try {
      const result = await gitService.completeMerge(
        selectedTarget.path,
        `Merge branch '${sourceWorktree.branch}' into ${selectedTarget.branch}`
      )
      setMergeResult(result)

      if (result.success) {
        onMergeComplete?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('merge.completeFailed'))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-purple-500" />
            {t('merge.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {/* 源分支信息 */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400">{t('merge.sourceBranch')}</div>
            <div className="font-medium text-gray-900 dark:text-white">{sourceWorktree.branch}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{sourceWorktree.path}</div>
          </div>

          {/* 目标分支选择 */}
          {!mergeResult && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('merge.targetBranch')}
                </label>
                {availableTargets.length === 0 ? (
                  <div className="text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-3 rounded">
                    {t('merge.noAvailableTargets')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableTargets.map((wt) => (
                      <label
                        key={wt.path}
                        className={clsx(
                          'flex items-center p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedTarget?.path === wt.path
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )}
                      >
                        <input
                          type="radio"
                          name="target"
                          checked={selectedTarget?.path === wt.path}
                          onChange={() => setSelectedTarget(wt)}
                          className="w-4 h-4 text-purple-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">{wt.branch}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{wt.path}</div>
                        </div>
                        {wt.isMain && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                            {t('worktree.main')}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 选项 */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPush}
                    onChange={(e) => setAutoPush(e.target.checked)}
                    className="w-4 h-4 text-purple-500 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t('merge.autoPush')}
                  </span>
                </label>
              </div>
            </>
          )}

          {/* 合并结果 */}
          {mergeResult && (
            <div
              className={clsx(
                'mb-4 p-4 rounded-lg',
                mergeResult.success
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : mergeResult.status === MergeStatus.HasConflicts
                    ? 'bg-yellow-50 dark:bg-yellow-900/20'
                    : 'bg-red-50 dark:bg-red-900/20'
              )}
            >
              <div className="flex items-start gap-3">
                {mergeResult.success ? (
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                ) : mergeResult.status === MergeStatus.HasConflicts ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <div
                    className={clsx(
                      'font-medium',
                      mergeResult.success
                        ? 'text-green-700 dark:text-green-400'
                        : mergeResult.status === MergeStatus.HasConflicts
                          ? 'text-yellow-700 dark:text-yellow-400'
                          : 'text-red-700 dark:text-red-400'
                    )}
                  >
                    {mergeResult.success ? t('merge.success') : t('merge.failed')}
                  </div>
                  <div className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                    {mergeResult.message}
                  </div>
                  {mergeResult.commitId && (
                    <div className="text-xs mt-2 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">
                      {mergeResult.commitId.substring(0, 7)}
                    </div>
                  )}
                </div>
              </div>

              {/* 冲突文件列表 */}
              {mergeResult.status === MergeStatus.HasConflicts && mergeResult.conflicts.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                    {t('merge.conflictFiles')}:
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-auto">
                    {mergeResult.conflicts.map((conflict: ConflictFile) => (
                      <li
                        key={conflict.path}
                        className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded"
                      >
                        {conflict.path}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
                    {t('merge.conflictHint')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-red-700 dark:text-red-400">{error}</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          {mergeResult?.status === MergeStatus.HasConflicts ? (
            <>
              <button
                onClick={handleAbortMerge}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {t('merge.abort')}
              </button>
              <button
                onClick={handleCompleteMerge}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
              >
                {t('merge.complete')}
              </button>
            </>
          ) : mergeResult?.success ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              {t('common.close')}
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleMerge}
                disabled={!selectedTarget || isMerging}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isMerging && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('merge.merge')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
