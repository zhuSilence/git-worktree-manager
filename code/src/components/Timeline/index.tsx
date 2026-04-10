import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Clock, Calendar, Loader2 } from 'lucide-react'
import { gitService } from '@/services/git'
import type { CommitInfo, TimelineResponse } from '@/types/worktree'
import { clsx } from 'clsx'
import { formatRelativeTime } from '@/utils/format'

interface TimelineProps {
  isOpen: boolean
  onClose: () => void
  repoPath: string | null
}

type TimeRange = '7d' | '30d' | 'all'

export function Timeline({ isOpen, onClose, repoPath }: TimelineProps) {
  const { t, i18n: i18nInstance } = useTranslation()
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  // 计算时间范围
  const timeRangeParams = useMemo(() => {
    if (timeRange === 'all') {
      return { since: undefined, until: undefined }
    }

    const now = Math.floor(Date.now() / 1000)
    const days = timeRange === '7d' ? 7 : 30
    const since = now - days * 24 * 60 * 60

    return { since, until: now }
  }, [timeRange])

  // 加载时间线数据
  useEffect(() => {
    if (!isOpen || !repoPath) return

    const loadData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const data = await gitService.getTimeline(
          repoPath,
          timeRangeParams.since,
          timeRangeParams.until
        )
        setTimelineData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('timeline.loading'))
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable from i18next, loadData defined inline with all deps
  }, [isOpen, repoPath, timeRangeParams])

  // 按日期分组提交
  const groupedCommits = useMemo(() => {
    if (!timelineData?.commits) return {}

    const groups: Record<string, CommitInfo[]> = {}
    const locale = i18nInstance.language === 'en-US' ? 'en-US' : 'zh-CN'

    for (const commit of timelineData.commits) {
      const date = new Date(commit.date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(commit)
    }

    return groups
  }, [timelineData, i18nInstance.language])

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
            <Clock className="w-5 h-5" />
            {t('timeline.title')}
          </h2>
          <div className="flex items-center gap-2">
            {/* 时间范围选择器 */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { value: '7d', label: t('timeline.7days', '7天') },
                { value: '30d', label: t('timeline.30days', '30天') },
                { value: 'all', label: t('timeline.all', '全部') },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value as TimeRange)}
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
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 加载中 */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300">{t('timeline.loading')}</p>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* 无数据 */}
          {!isLoading && !error && timelineData && timelineData.commits.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Calendar className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('timeline.noCommits')}</p>
              <p className="text-sm mt-1">{t('timeline.tryLongerRange')}</p>
            </div>
          )}

          {/* 时间线 */}
          {!isLoading && !error && timelineData && timelineData.commits.length > 0 && (
            <div className="space-y-6">
              {/* 统计信息 */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 px-2">
                <span>{t('timeline.totalCommits', { count: timelineData.totalCount })}</span>
              </div>

              {/* 按日期分组显示 */}
              {Object.entries(groupedCommits).map(([date, commits]) => (
                <div key={date}>
                  {/* 日期标题 */}
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {date}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t('timeline.commitCount', { count: commits.length })}
                    </span>
                  </div>

                  {/* 提交列表 */}
                  <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                    {commits.map((commit, index) => (
                      <div
                        key={`${commit.hash}-${index}`}
                        className="relative mb-4 last:mb-0"
                      >
                        {/* 时间线节点 */}
                        <div className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-800" />

                        {/* 提交卡片 */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {commit.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-mono text-green-600 dark:text-green-400">
                                  {commit.hash}
                                </span>
                                <span>•</span>
                                <span>{commit.author}</span>
                                <span>•</span>
                                <span className="text-blue-600 dark:text-blue-400">
                                  {commit.worktreeName}
                                </span>
                                <span className="text-gray-400">
                                  ({commit.branch})
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatRelativeTime(commit.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
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