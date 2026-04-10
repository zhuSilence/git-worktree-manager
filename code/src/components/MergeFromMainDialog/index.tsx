import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, GitMerge, AlertTriangle, Check, Loader2, ExternalLink, Package, GitCommit } from 'lucide-react'
import { gitService } from '@/services/git'
import type {
  Worktree,
  MergeResult,
  ConflictFile,
  MergeConflictCheckResult,
  AutoHandleUncommitted,
} from '@/types/worktree'
import { MergeStatus } from '@/types/worktree'

interface MergeFromMainDialogProps {
  isOpen: boolean
  onClose: () => void
  worktree: Worktree
  mainBranch: string
  repoPath: string
  onComplete: () => void
}

type Step = 'checking' | 'uncommitted' | 'confirm' | 'conflicts' | 'success' | 'failed'

export function MergeFromMainDialog({
  isOpen,
  onClose,
  worktree,
  mainBranch,
  repoPath,
  onComplete,
}: MergeFromMainDialogProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [conflictCheck, setConflictCheck] = useState<MergeConflictCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setStep(null)
    setIsMerging(false)
    setMergeResult(null)
    setConflictCheck(null)
    setError(null)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  // Step 1: Check for conflicts
  const handleStartMerge = async () => {
    setStep('checking')
    setError(null)

    try {
      const checkResult = await gitService.checkMergeConflicts(worktree.path, repoPath, mainBranch)
      setConflictCheck(checkResult)

      if (!checkResult.hasConflicts) {
        // No conflicts, proceed with merge
        setStep('confirm')
      } else {
        // Has conflicts, show them
        setStep('conflicts')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setStep('failed')
    }
  }

  // Step 2a: Execute merge (no conflicts)
  const handleExecuteMerge = async () => {
    setIsMerging(true)
    setError(null)

    try {
      const result = await gitService.mergeBranch({
        repoPath,
        targetWorktreePath: worktree.path,
        sourceBranch: mainBranch,
        autoPush: false,
        autoDeleteSource: false,
      })

      setMergeResult(result)

      if (result.success && result.status === MergeStatus.Completed) {
        onComplete()
        setStep('success')
      } else if (result.status === MergeStatus.HasConflicts) {
        setStep('conflicts')
      } else if (result.status === MergeStatus.HasUncommittedChanges) {
        setStep('uncommitted')
      } else {
        setError(result.message || t('merge.failed'))
        setStep('failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setStep('failed')
    } finally {
      setIsMerging(false)
    }
  }

  // Step 2b: Complete merge after conflict resolution
  const handleCompleteMerge = async () => {
    setIsMerging(true)
    setError(null)

    try {
      const result = await gitService.completeMerge(
        worktree.path,
        `Merge branch '${mainBranch}' into ${worktree.branch}`
      )

      setMergeResult(result)

      if (result.success) {
        setStep('success')
      } else {
        setError(result.message || t('merge.completeFailed'))
        setStep('failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('merge.completeFailed'))
      setStep('failed')
    } finally {
      setIsMerging(false)
    }
  }

  // Abort merge
  const handleAbortMerge = async () => {
    try {
      await gitService.abortMerge(worktree.path)
      resetState()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('merge.abortFailed'))
    }
  }

  // Open worktree in editor for conflict resolution
  const handleOpenInEditor = async () => {
    try {
      await gitService.openInEditor(worktree.path)
    } catch {
      // Non-critical, just open the folder
    }
  }

  // Handle auto-handle uncommitted changes option
  const handleAutoHandle = async (option: AutoHandleUncommitted) => {
    setIsMerging(true)
    setError(null)

    try {
      const result = await gitService.mergeBranch({
        repoPath,
        targetWorktreePath: worktree.path,
        sourceBranch: mainBranch,
        autoPush: false,
        autoDeleteSource: false,
        autoHandleUncommitted: option,
      })

      setMergeResult(result)

      if (result.success && result.status === MergeStatus.Completed) {
        onComplete()
        setStep('success')
      } else if (result.status === MergeStatus.HasConflicts) {
        setStep('conflicts')
      } else if (result.status === MergeStatus.HasUncommittedChanges) {
        // Shouldn't happen with auto-handle option, but handle gracefully
        setStep('uncommitted')
      } else {
        setError(result.message || t('merge.failed'))
        setStep('failed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      setStep('failed')
    } finally {
      setIsMerging(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <GitMerge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('merge.fromMainTitle', { branch: mainBranch, target: worktree.branch })}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Source & Target Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('merge.sourceBranch')}</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm mt-1">{mainBranch}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t('merge.targetBranch')}</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm mt-1">{worktree.branch}</div>
            </div>
          </div>

          {/* Checking conflicts */}
          {step === 'checking' && (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
              <span>{t('merge.checkingConflicts')}</span>
            </div>
          )}

          {/* Uncommitted changes detected */}
          {step === 'uncommitted' && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-orange-700 dark:text-orange-400">
                      {t('merge.hasUncommittedChanges')}
                    </div>
                    <div className="text-sm text-orange-600 dark:text-orange-300 mt-1">
                      {t('merge.chooseHandleMethod')}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleAutoHandle('stash')}
                    disabled={isMerging}
                    className="px-3 py-3 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Package className="w-5 h-5" />
                    <span className="text-sm">{t('merge.autoStash')}</span>
                    <span className="text-xs opacity-75 text-center">{t('merge.autoStashDesc')}</span>
                  </button>
                  <button
                    onClick={() => handleAutoHandle('commit')}
                    disabled={isMerging}
                    className="px-3 py-3 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-lg font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <GitCommit className="w-5 h-5" />
                    <span className="text-sm">{t('merge.autoCommit')}</span>
                    <span className="text-xs opacity-75 text-center">{t('merge.autoCommitDesc')}</span>
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-3 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex flex-col items-center gap-1"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-sm">{t('merge.abort')}</span>
                    <span className="text-xs opacity-75 text-center">{t('merge.handleManually')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No conflicts - confirm merge */}
          {step === 'confirm' && (
            <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>{t('merge.noConflicts')}</span>
            </div>
          )}

          {/* Has conflicts */}
          {step === 'conflicts' && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-yellow-700 dark:text-yellow-400">
                      {t('merge.conflictsDetected', {
                        count: conflictCheck?.conflictFiles.length || mergeResult?.conflicts.length || 0,
                      })}
                    </div>
                    <div className="mt-3 space-y-1">
                      {(conflictCheck?.conflictFiles || mergeResult?.conflicts || []).map(
                        (file: ConflictFile) => (
                          <div
                            key={file.path}
                            className="text-sm text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded"
                          >
                            {file.path}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex items-center gap-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4">
              <Check className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{t('merge.mergeFromMainSuccess')}</div>
                {mergeResult?.commitId && (
                  <div className="text-xs mt-1 font-mono opacity-75">
                    {mergeResult.commitId.substring(0, 7)}
                  </div>
                )}
                {mergeResult?.autoHandleResult && (
                  <div className="text-xs mt-1 opacity-75">
                    {mergeResult.autoHandleResult.strategy === 'stash' &&
                      (mergeResult.autoHandleResult.stashPopped
                        ? t('merge.stashRestored')
                        : t('merge.stashPopFailed'))}
                    {mergeResult.autoHandleResult.strategy === 'commit' &&
                      mergeResult.autoHandleResult.tempCommitId &&
                      t('merge.tempCommitCreated', {
                        id: mergeResult.autoHandleResult.tempCommitId.substring(0, 7),
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Failed */}
          {step === 'failed' && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>{error || t('merge.unknownError')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {step === null && (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleStartMerge}
                disabled={isMerging}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {t('merge.checkConflicts')}
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={isMerging}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isMerging && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('merge.merge')}
              </button>
            </>
          )}

          {step === 'conflicts' && (
            <>
              <button
                onClick={handleAbortMerge}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('merge.abortMergeFromMain')}
              </button>
              <button
                onClick={handleOpenInEditor}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {t('merge.resolveInEditor')}
              </button>
              <button
                onClick={handleCompleteMerge}
                disabled={isMerging}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isMerging && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('merge.completeMergeFromMain')}
              </button>
            </>
          )}

          {step === 'success' && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20"
            >
              {t('common.close')}
            </button>
          )}

          {step === 'failed' && (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                {t('common.close')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
