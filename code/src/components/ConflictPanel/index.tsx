import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle, AlertCircle, AlertOctagon, RefreshCw, Info, Eye, GitBranch } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import type { ConflictDetectionResponse, FileConflict, ConflictRiskLevel } from '@/types/conflict'
import { clsx } from 'clsx'

interface ConflictPanelProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string
  mainBranch: string
}

/** 风险等级对应的图标和颜色 */
const riskLevelConfig: Record<ConflictRiskLevel, { icon: typeof AlertTriangle; color: string; bgColor: string; textColor: string }> = {
  high: {
    icon: AlertOctagon,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    textColor: 'text-red-700 dark:text-red-400'
  },
  medium: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    textColor: 'text-yellow-700 dark:text-yellow-400'
  },
  low: {
    icon: AlertCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-400'
  }
}

export function ConflictPanel({ isOpen, onClose, repoPath, mainBranch }: ConflictPanelProps) {
  const { t } = useTranslation()
  const [result, setResult] = useState<ConflictDetectionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConflict, setSelectedConflict] = useState<FileConflict | null>(null)
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      detectConflicts()
    }
  }, [isOpen, repoPath, mainBranch])

  /** 检测冲突 */
  const detectConflicts = async () => {
    setIsLoading(true)
    setSelectedConflict(null)
    setPreview('')
    try {
      const response = await invoke<ConflictDetectionResponse>('check_conflicts', {
        repoPath,
        mainBranch
      })
      setResult(response)
    } catch (err) {
      console.error('Failed to detect conflicts:', err)
      setResult({
        success: false,
        message: String(err),
        detectedAt: new Date().toISOString(),
        conflicts: [],
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        worktreeCount: 0
      })
    } finally {
      setIsLoading(false)
    }
  }

  /** 获取冲突预览 */
  const getPreview = async (conflict: FileConflict) => {
    setSelectedConflict(conflict)
    try {
      const previewText = await invoke<string>('get_file_conflict_preview', {
        worktreePath: conflict.changes[0]?.worktreeName || '',
        mainBranch,
        filePath: conflict.path
      })
      setPreview(previewText)
    } catch (err) {
      console.error('Failed to get preview:', err)
      setPreview(t('conflicts.previewFailed'))
    }
  }

  if (!isOpen) return null

  const totalConflicts = result?.conflicts.length || 0
  const hasHighRisk = (result?.highRiskCount ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className={clsx('w-5 h-5', hasHighRisk ? 'text-red-500' : 'text-yellow-500')} />
            {t('conflicts.title')}
            {totalConflicts > 0 && (
              <span className={clsx(
                'ml-2 px-2 py-0.5 text-xs rounded-full',
                hasHighRisk
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
              )}>
                {totalConflicts}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={detectConflicts}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title={t('common.refresh')}
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 风险统计 */}
        {result && (
          <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('conflicts.detectedAt')}: {new Date(result.detectedAt).toLocaleString()}
            </span>
            <div className="flex items-center gap-3 ml-auto">
              {result.highRiskCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                  <AlertOctagon className="w-4 h-4" />
                  {result.highRiskCount} {t('conflicts.high')}
                </span>
              )}
              {result.mediumRiskCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  {result.mediumRiskCount} {t('conflicts.medium')}
                </span>
              )}
              {result.lowRiskCount > 0 && (
                <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                  <AlertCircle className="w-4 h-4" />
                  {result.lowRiskCount} {t('conflicts.low')}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : !result ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('conflicts.noData')}</p>
            </div>
          ) : !result.success ? (
            <div className="text-center py-8 text-red-500">
              <AlertOctagon className="w-12 h-12 mx-auto mb-4" />
              <p>{result.message}</p>
            </div>
          ) : totalConflicts === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{t('conflicts.noConflicts')}</p>
              <p className="text-sm mt-1">{t('conflicts.allGood')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.conflicts.map((conflict, idx) => {
                const config = riskLevelConfig[conflict.riskLevel]
                const Icon = config.icon

                return (
                  <div
                    key={idx}
                    className={clsx('p-3 rounded-lg border', config.bgColor)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={clsx('w-4 h-4', config.color)} />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {conflict.path}
                          </span>
                          <span className={clsx('px-2 py-0.5 text-xs rounded', config.textColor)}>
                            {t(`conflicts.${conflict.riskLevel}Risk`)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <GitBranch className="w-3 h-3" />
                          <span>
                            {t('conflicts.modifiedBy')}: {conflict.branches.join(', ')}
                          </span>
                        </div>

                        {/* 变更统计 */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {conflict.changes.map((change, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
                            >
                              {change.branch}: +{change.additions}/-{change.deletions}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => getPreview(conflict)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={t('conflicts.viewPreview')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 预览面板 */}
        {selectedConflict && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('conflicts.preview')}: {selectedConflict.path}
              </h3>
              <button
                onClick={() => setSelectedConflict(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-3 bg-gray-900 rounded text-sm text-gray-100 overflow-auto max-h-48 font-mono">
              {preview || t('conflicts.loadingPreview')}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}