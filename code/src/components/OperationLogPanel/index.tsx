import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ScrollText, Calendar, Loader2, Download, Trash2, CheckCircle2, XCircle, FolderOpen } from 'lucide-react'
import { gitService } from '@/services/git'
import { OperationType, OperationResult } from '@/types/log'
import type { OperationLog, OperationLogFilter, OperationLogListResponse } from '@/types/log'
import { clsx } from 'clsx'
import { formatRelativeTime } from '@/utils/format'
import { open } from '@tauri-apps/plugin-dialog'
import { useToast } from '@/hooks/useToast'

interface OperationLogPanelProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string | null
}

type TimeRange = '7d' | '30d' | 'all'
type TypeFilter = 'all' | OperationType
type ResultFilter = 'all' | OperationResult

const OPERATION_TYPE_CONFIG: Record<OperationType, { labelKey: string; color: string }> = {
  [OperationType.Create]: { labelKey: 'operationLog.typeCreate', color: 'text-green-500' },
  [OperationType.Delete]: { labelKey: 'operationLog.typeDelete', color: 'text-red-500' },
  [OperationType.Switch]: { labelKey: 'operationLog.typeSwitch', color: 'text-blue-500' },
  [OperationType.Prune]: { labelKey: 'operationLog.typePrune', color: 'text-yellow-500' },
  [OperationType.BatchDelete]: { labelKey: 'operationLog.typeBatchDelete', color: 'text-orange-500' },
}

export function OperationLogPanel({ isOpen, onClose, repoPath }: OperationLogPanelProps) {
  const { t, i18n: i18nInstance } = useTranslation()
  const toast = useToast()
  const [logData, setLogData] = useState<OperationLogListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')

  // 构建筛选条件
  const filter: OperationLogFilter | undefined = useMemo(() => {
    const f: OperationLogFilter = {}

    // 时间范围
    if (timeRange !== 'all') {
      const now = new Date()
      const days = timeRange === '7d' ? 7 : 30
      now.setDate(now.getDate() - days)
      f.startTime = now.toISOString()
    }

    // 操作类型
    if (typeFilter !== 'all') {
      f.operationType = typeFilter
    }

    // 结果筛选
    if (resultFilter !== 'all') {
      f.result = resultFilter
    }

    // 仓库关联（与 Timeline 保持一致）
    if (repoPath) {
      f.repoPath = repoPath
    }

    // 如果所有条件都是默认值且没有 repoPath，返回 undefined
    if (!f.startTime && !f.operationType && !f.result && !f.repoPath) {
      return undefined
    }

    return f
  }, [timeRange, typeFilter, resultFilter, repoPath])

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    if (!isOpen) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await gitService.listOperationLogs(filter)
      setLogData(data)
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : t('operationLog.loadError'))
    } finally {
      setIsLoading(false)
    }
  }, [isOpen, filter, t])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // 按日期分组日志
  const groupedLogs = useMemo(() => {
    if (!logData?.logs) return {}

    const groups: Record<string, OperationLog[]> = {}
    const locale = i18nInstance.language === 'en-US' ? 'en-US' : 'zh-CN'

    for (const log of logData.logs) {
      const date = new Date(log.timestamp).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(log)
    }

    return groups
  }, [logData, i18nInstance.language])

  // 导出日志
  const handleExport = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('operationLog.selectExportDir'),
      })

      if (selected && typeof selected === 'string') {
        const outputPath = `${selected}/operation-logs.json`
        await gitService.exportOperationLogs(outputPath)
        toast.success(t('operationLog.exportSuccess'))
      }
    } catch {
      toast.error(t('operationLog.exportFailed'))
    }
  }

  // 清理过期日志
  const handleCleanup = async () => {
    try {
      const count = await gitService.cleanupOldLogs()
      toast.success(t('operationLog.cleanupSuccess', { count }))
      loadLogs()
    } catch {
      toast.error(t('operationLog.cleanupFailed'))
    }
  }

  // 获取操作类型的显示配置
  const getTypeConfig = (type: OperationType) => {
    return OPERATION_TYPE_CONFIG[type] || { labelKey: 'operationLog.typeUnknown', color: 'text-gray-500' }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 对话框 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5" />
            {t('operationLog.title')}
          </h2>
          <div className="flex items-center gap-2">
            {/* 导出按钮 */}
            <button
              onClick={handleExport}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              title={t('operationLog.export')}
            >
              <Download className="w-4 h-4" />
            </button>
            {/* 清理按钮 */}
            <button
              onClick={handleCleanup}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
              title={t('operationLog.cleanup')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-wrap">
          {/* 时间范围 */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {([
              { value: '7d', label: t('operationLog.7days') },
              { value: '30d', label: t('operationLog.30days') },
              { value: 'all', label: t('operationLog.all') },
            ] as const).map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value)}
                className={clsx(
                  'px-3 py-1 text-sm rounded-md transition-colors',
                  timeRange === option.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 操作类型筛选 */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="all">{t('operationLog.allTypes')}</option>
            <option value={OperationType.Create}>{t('operationLog.typeCreate')}</option>
            <option value={OperationType.Delete}>{t('operationLog.typeDelete')}</option>
            <option value={OperationType.Switch}>{t('operationLog.typeSwitch')}</option>
            <option value={OperationType.Prune}>{t('operationLog.typePrune')}</option>
            <option value={OperationType.BatchDelete}>{t('operationLog.typeBatchDelete')}</option>
          </select>

          {/* 结果筛选 */}
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
            className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="all">{t('operationLog.allResults')}</option>
            <option value={OperationResult.Success}>{t('operationLog.resultSuccess')}</option>
            <option value={OperationResult.Failed}>{t('operationLog.resultFailed')}</option>
          </select>

          {/* 仓库指示 */}
          {repoPath && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <FolderOpen className="w-3 h-3" />
              {t('operationLog.filteredByRepo')}
            </span>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 加载中 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300">{t('operationLog.loading')}</p>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* 无数据 */}
          {!isLoading && !error && logData && logData.logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <ScrollText className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('operationLog.noLogs')}</p>
              <p className="text-sm mt-1">{t('operationLog.tryLongerRange')}</p>
            </div>
          )}

          {/* 日志列表 */}
          {!isLoading && !error && logData && logData.logs.length > 0 && (
            <div className="space-y-6">
              {/* 统计信息 */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 px-2">
                <span>{t('operationLog.totalLogs', { count: logData.totalCount })}</span>
              </div>

              {/* 按日期分组显示 */}
              {Object.entries(groupedLogs).map(([date, logs]) => (
                <div key={date}>
                  {/* 日期标题 */}
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {date}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t('operationLog.logCount', { count: logs.length })}
                    </span>
                  </div>

                  {/* 日志条目 */}
                  <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                    {logs.map((log) => {
                      const typeConfig = getTypeConfig(log.operationType)
                      const isSuccess = log.result === OperationResult.Success

                      return (
                        <div key={log.id} className="relative mb-4 last:mb-0">
                          {/* 时间线节点 */}
                          <div className={clsx(
                            'absolute -left-[25px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800',
                            isSuccess ? 'bg-green-500' : 'bg-red-500'
                          )} />

                          {/* 日志卡片 */}
                          <div className={clsx(
                            'rounded-lg p-3 transition-colors',
                            isSuccess
                              ? 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                              : 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {/* 操作类型 + 目标 */}
                                <div className="flex items-center gap-2">
                                  {isSuccess ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                  )}
                                  <span className={clsx('text-sm font-medium', typeConfig.color)}>
                                    {t(typeConfig.labelKey)}
                                  </span>
                                  <span className="text-sm text-gray-900 dark:text-white font-mono truncate">
                                    {log.target}
                                  </span>
                                </div>

                                {/* 详情 / 错误信息 */}
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                                  {log.details && (
                                    <p className="truncate">{log.details}</p>
                                  )}
                                  {log.errorMessage && (
                                    <p className="text-red-500 dark:text-red-400 truncate">
                                      {log.errorMessage}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0">
                                {formatRelativeTime(new Date(log.timestamp).getTime() / 1000)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
