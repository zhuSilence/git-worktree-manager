import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Zap, Check, Loader2, GitBranch, ArrowRight, Trash2, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gitService } from '@/services/git'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { ConfirmDialog } from '@/components/common'
import { validateBranchName } from '@/utils/namingSuggestion'
import type { HotfixInfo } from '@/types/worktree'
import { HotfixStatus } from '@/types/worktree'

interface HotfixPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function HotfixPanel({ isOpen, onClose }: HotfixPanelProps) {
  const { t } = useTranslation()
  const { currentRepo, refreshWorktrees } = useWorktreeStore()
  const [hotfixStatus, setHotfixStatus] = useState<HotfixInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [baseBranch, setBaseBranch] = useState('main')
  const [branchName, setBranchName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAbortConfirm, setShowAbortConfirm] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const loadHotfixStatus = useCallback(async () => {
    if (!currentRepo?.mainWorktreePath) return
    try {
      const status = await gitService.getHotfixStatus(currentRepo.mainWorktreePath)
      setHotfixStatus(status)
      if (status?.status === HotfixStatus.InProgress) {
        setError(null)
        setSuccess(null)
      }
    } catch (err) {
      console.error('Failed to load hotfix status:', err)
    }
  }, [currentRepo?.mainWorktreePath])

  const handleClose = useCallback(() => {
    onClose()
    previousActiveElement.current?.focus()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      loadHotfixStatus()
      previousActiveElement.current = document.activeElement as HTMLElement
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    }
  }, [isOpen, loadHotfixStatus])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showAbortConfirm) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, showAbortConfirm])

  useEffect(() => {
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return

      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleTabKey)
      return () => window.removeEventListener('keydown', handleTabKey)
    }
  }, [isOpen])

  const handleStartHotfix = async () => {
    if (!currentRepo || !description.trim()) {
      setError(t('hotfix.descriptionRequired', '请输入修复描述'))
      return
    }

    if (branchName.trim()) {
      const validation = validateBranchName(branchName.trim())
      if (!validation.valid) {
        setError(validation.message || t('hotfix.invalidBranchName', '分支名无效'))
        return
      }
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await gitService.startHotfix(
        currentRepo.mainWorktreePath,
        description.trim(),
        baseBranch || undefined,
        branchName || undefined
      )

      if (result.success) {
        setHotfixStatus(result.hotfix || null)
        setSuccess(result.message)
        setDescription('')
        setBranchName('')
        await refreshWorktrees()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinishHotfix = async (push: boolean) => {
    if (!currentRepo) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await gitService.finishHotfix(currentRepo.mainWorktreePath, push)

      if (result.success) {
        setHotfixStatus(null)
        setSuccess(result.message)
        await refreshWorktrees()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAbortHotfix = async () => {
    if (!currentRepo) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await gitService.abortHotfix(currentRepo.mainWorktreePath)

      if (result.success) {
        setHotfixStatus(null)
        setSuccess(result.message)
        await refreshWorktrees()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const confirmAbort = () => {
    setShowAbortConfirm(true)
  }

  if (!isOpen) return null

  const isInProgress = hotfixStatus?.status === HotfixStatus.InProgress

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm cursor-default"
          onClick={handleClose}
          aria-label="Close panel"
        />

        <div
          ref={panelRef}
          className="relative bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('hotfix.title', '快速 Hotfix')}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* 状态卡片 */}
            {isInProgress && hotfixStatus && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
                <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Zap className="w-4 h-4" />
                    <span className="font-medium">{t('hotfix.inProgress', 'Hotfix 进行中')}</span>
                  </div>
                </div>
                <div className="p-4 text-sm text-orange-600 dark:text-orange-400 space-y-2">
                  <p>
                    <GitBranch className="w-3 h-3 inline mr-1" />
                    {t('hotfix.branch', '分支')}: {hotfixStatus.branchName}
                  </p>
                  <p>
                    <ArrowRight className="w-3 h-3 inline mr-1" />
                    {t('hotfix.baseBranch', '基准')}: {hotfixStatus.baseBranch}
                  </p>
                  {hotfixStatus.description && (
                    <p className="text-xs mt-2 opacity-75">"{hotfixStatus.description}"</p>
                  )}
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            {/* 成功信息 */}
            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-xl border border-green-200 dark:border-green-800">
                {success}
              </div>
            )}

            {isInProgress ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('hotfix.finishHint', '修复完成后，点击下方按钮合并到主分支并清理 worktree。')}
                </p>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleFinishHotfix(false)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t('hotfix.finishAndMerge', '完成并合并')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFinishHotfix(true)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                    {t('hotfix.finishAndPush', '完成并推送')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmAbort}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('hotfix.abort', '取消 Hotfix')}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 基本信息卡片 */}
                <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-orange-500" />
                      {t('hotfix.basicInfo', '基本信息')}
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label
                        htmlFor="hotfix-description"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        {t('hotfix.description', '修复描述')} *
                      </label>
                      <input
                        id="hotfix-description"
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('hotfix.descriptionPlaceholder', '例如：修复登录页面样式问题')}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="hotfix-base-branch"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        {t('hotfix.baseBranch', '基准分支')}
                      </label>
                      <select
                        id="hotfix-base-branch"
                        value={baseBranch}
                        onChange={(e) => setBaseBranch(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      >
                        {currentRepo?.branches.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {t('hotfix.baseBranchDesc', 'Hotfix 将从此分支创建')}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="hotfix-branch-name"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        {t('hotfix.branchName', '分支名（可选）')}
                      </label>
                      <input
                        id="hotfix-branch-name"
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder={t('hotfix.branchNamePlaceholder', '留空则自动生成：hotfix/YYYY-MM-DD-描述')}
                        className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      />
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={handleStartHotfix}
                  disabled={isLoading || !description.trim()}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-orange-500/20 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {t('hotfix.start', '开始 Hotfix')}
                </button>
              </div>
            )}
          </div>

          {/* 底部提示 */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('hotfix.help', 'Hotfix 流程将自动创建分支和 worktree，修复完成后一键合并回主分支并清理。')}
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showAbortConfirm}
        onOpenChange={setShowAbortConfirm}
        title={t('hotfix.abort', '取消 Hotfix')}
        description={t('hotfix.confirmAbort', '确定要取消此 Hotfix 吗？这将删除 hotfix 分支和 worktree。')}
        confirmText={t('common.confirm', '确认')}
        cancelText={t('common.cancel', '取消')}
        variant="destructive"
        onConfirm={handleAbortHotfix}
        isLoading={isLoading}
      />
    </>
  )
}
