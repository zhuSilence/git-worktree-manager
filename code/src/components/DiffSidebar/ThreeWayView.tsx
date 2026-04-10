import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import type { ThreeWayDiff } from '@/types/worktree'

interface ThreeWayViewProps {
  threeWayDiff: ThreeWayDiff | null
  isLoading?: boolean
  error?: string | null
  onClose?: () => void
}

/**
 * 三方对比视图组件
 * 用于显示合并冲突场景下的 BASE / OURS / THEIRS 三个版本
 */
export function ThreeWayView({
  threeWayDiff,
  isLoading = false,
  error = null,
  onClose,
}: ThreeWayViewProps) {
  const { t } = useTranslation()

  const { baseLines, oursLines, theirsLines, maxLines } = useMemo(() => {
    if (!threeWayDiff) {
      return { baseLines: [], oursLines: [], theirsLines: [], maxLines: 0 }
    }

    const base = threeWayDiff.baseContent?.split('\n') || []
    const ours = threeWayDiff.oursContent?.split('\n') || []
    const theirs = threeWayDiff.theirsContent?.split('\n') || []

    return {
      baseLines: base,
      oursLines: ours,
      theirsLines: theirs,
      maxLines: Math.max(base.length, ours.length, theirs.length),
    }
  }, [threeWayDiff])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        <span className="ml-2 text-sm text-gray-500">{t('merge.loadingThreeWayDiff')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">
        {error}
      </div>
    )
  }

  if (!threeWayDiff) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {t('merge.threeWayDiffTitle')}: {threeWayDiff.filePath}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 三列头部 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          BASE
        </div>
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-blue-500 dark:text-blue-400 border-r border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          OURS ({t('merge.currentBranch')})
        </div>
        <div className="w-1/3 px-2 py-1.5 text-xs font-semibold text-purple-500 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20">
          THEIRS ({t('merge.incomingBranch')})
        </div>
      </div>

      {/* 三列内容 */}
      <div className="flex-1 overflow-auto">
        {Array.from({ length: maxLines }, (_, i) => {
          const baseLine = baseLines[i]
          const oursLine = oursLines[i]
          const theirsLine = theirsLines[i]

          // 检测变更
          const oursChanged = oursLine !== baseLine
          const theirsChanged = theirsLine !== baseLine

          return (
            <div
              key={i}
              className="flex hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800"
            >
              {/* BASE 列 */}
              <div className="w-1/3 px-2 border-r border-gray-200 dark:border-gray-700 font-mono">
                <div className="flex">
                  <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                    {i < baseLines.length ? i + 1 : ''}
                  </span>
                  <span className="flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] text-gray-600 dark:text-gray-400">
                    {baseLine ?? ''}
                  </span>
                </div>
              </div>

              {/* OURS 列 */}
              <div
                className={`w-1/3 px-2 border-r border-gray-200 dark:border-gray-700 font-mono ${
                  oursChanged
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
              >
                <div className="flex">
                  <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                    {i < oursLines.length ? i + 1 : ''}
                  </span>
                  <span
                    className={`flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] ${
                      oursChanged ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {oursLine ?? ''}
                  </span>
                </div>
              </div>

              {/* THEIRS 列 */}
              <div
                className={`w-1/3 px-2 font-mono ${
                  theirsChanged
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : ''
                }`}
              >
                <div className="flex">
                  <span className="w-8 text-right pr-2 text-[10px] text-gray-400 select-none flex-shrink-0">
                    {i < theirsLines.length ? i + 1 : ''}
                  </span>
                  <span
                    className={`flex-1 text-[11px] whitespace-pre-wrap break-all leading-[20px] ${
                      theirsChanged ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {theirsLine ?? ''}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* 空状态 */}
        {maxLines === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">
            {t('merge.noContentAvailable')}
          </div>
        )}
      </div>
    </div>
  )
}

export default ThreeWayView
