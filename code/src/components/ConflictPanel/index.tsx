import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle, Eye, RefreshCw, Info, CheckCircle, AlertCircle } from 'lucide-react'
import { gitService } from '@/services/git'
import type { FileConflict, ConflictPreviewResponse } from '@/types/conflict'
import { clsx } from 'clsx'

interface ConflictPanelProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string
}

export function ConflictPanel({ isOpen, onClose, repoPath }: ConflictPanelProps) {
  const { t } = useTranslation()
  const [conflicts, setConflicts] = useState<FileConflict[]>([])
  const [highRiskCount, setHighRiskCount] = useState(0)
  const [mediumRiskCount, setMediumRiskCount] = useState(0)
  const [lowRiskCount, setLowRiskCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedConflict, setSelectedConflict] = useState<FileConflict | null>(null)
  const [preview, setPreview] = useState<ConflictPreviewResponse | null>(null)
  const [detectedAt, setDetectedAt] = useState<string>('')

  const fetchConflicts = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await gitService.detectConflicts(repoPath)
      setConflicts(result.conflicts)
      setHighRiskCount(result.highRiskCount)
      setMediumRiskCount(result.mediumRiskCount)
      setLowRiskCount(result.lowRiskCount)
      setDetectedAt(result.detectedAt)
    } catch (err) {
      console.error('Failed to detect conflicts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [repoPath])

  useEffect(() => {
    if (isOpen) {
      fetchConflicts()
    }
  }, [isOpen, fetchConflicts])

  const handlePreview = async (conflict: FileConflict) => {
    setSelectedConflict(conflict)
    try {
      const result = await gitService.getConflictPreview(repoPath, conflict.path)
      setPreview(result)
    } catch (err) {
      console.error('Failed to get preview:', err)
    }
  }

  if (!isOpen) return null

  const totalCount = conflicts.length

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'low':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
      case 'deleted':
        return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
      case 'modified':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            {t('conflict.title', '冲突预警')}
            {totalCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                {totalCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchConflicts}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title={t('common.refresh', '刷新')}
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

        {/* 统计信息 */}
        {!isLoading && totalCount > 0 && (
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <span className="flex items-center gap-1.5 text-sm">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-red-600 dark:text-red-400">{t('conflict.highRisk', '高风险')}: {highRiskCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-yellow-600 dark:text-yellow-400">{t('conflict.mediumRisk', '中风险')}: {mediumRiskCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-sm">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-600 dark:text-green-400">{t('conflict.lowRisk', '低风险')}: {lowRiskCount}</span>
            </span>
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {t('conflict.detectedAt', '检测时间')}: {new Date(detectedAt).toLocaleString()}
            </span>
          </div>
        )}

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          ) : totalCount === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg">{t('conflict.noConflicts', '无冲突风险')}</p>
              <p className="text-sm mt-1">{t('conflict.allClear', '所有 worktree 文件变更互不冲突')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((conflict) => (
                <div
                  key={conflict.path}
                  className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {/* 文件路径和风险等级 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getRiskIcon(conflict.riskLevel)}
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {conflict.path}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('px-2 py-0.5 text-xs rounded', getRiskBadgeClass(conflict.riskLevel))}>
                        {t(`conflict.riskLevel.${conflict.riskLevel}`, conflict.riskLevel === 'high' ? '高风险' : conflict.riskLevel === 'medium' ? '中风险' : '低风险')}
                      </span>
                      <button
                        onClick={() => handlePreview(conflict)}
                        className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded"
                        title={t('conflict.preview', '查看详情')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 描述 */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {conflict.description}
                  </p>

                  {/* 涉及的 worktree */}
                  <div className="flex flex-wrap gap-1.5">
                    {conflict.worktrees.map((wt) => (
                      <span
                        key={wt.name}
                        className={clsx(
                          'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                          getChangeTypeBadge(wt.changeType)
                        )}
                      >
                        <span className="font-medium">{wt.name}</span>
                        <span className="opacity-70">({wt.branch})</span>
                        <span className="text-xs opacity-60">
                          +{wt.additions}/-{wt.deletions}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 预览对话框 */}
        {selectedConflict && preview && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-xl max-h-[70vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {t('conflict.previewTitle', '冲突预览')}: {selectedConflict.path}
                </h3>
                <button
                  onClick={() => {
                    setSelectedConflict(null)
                    setPreview(null)
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {preview.diffs.map((diff) => (
                  <div key={diff.worktreeName} className="border border-gray-200 dark:border-gray-700 rounded">
                    <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-medium flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-300">
                        {diff.worktreeName} ({diff.branch})
                      </span>
                      <span className={clsx('px-1.5 py-0.5 rounded text-xs', getChangeTypeBadge(diff.changeType))}>
                        {diff.changeType}
                      </span>
                    </div>
                    <pre className="p-2 text-xs font-mono bg-gray-50 dark:bg-gray-900 overflow-auto max-h-48 text-gray-800 dark:text-gray-200">
                      {diff.diffContent || t('conflict.noChanges', '(无变更内容)')}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}