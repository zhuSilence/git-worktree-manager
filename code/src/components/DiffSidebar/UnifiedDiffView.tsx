import { useState, useCallback, useMemo, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Plus, Minus } from 'lucide-react'
import type { DiffHunk, DiffLine } from '@/types/worktree'
import type { AIReviewResult } from '@/types/ai'
import type { CollapsibleRange, MergedHunk } from './HunkMerger'
import { mergeHunks_smart } from './HunkMerger'
import { pairHunkLines } from './DiffAlgorithm'
import { getLineIssues } from '@/utils/aiReview'
import { InlineReviewMarker } from './InlineReviewMarker'
import { CopyButton } from './CopyButton'
import { HighlightedLine } from './HighlightedLine'
import { CollapsedIndicator } from './CollapsedIndicator'
import {
  DEFAULT_ENABLE_SMART_MERGE,
  DEFAULT_MAX_GAP_LINES,
  BRANCH_MAX_DISPLAY_LENGTH,
  BRANCH_TRUNCATE_SUFFIX,
  ADDITION_BG_CLASS,
  DELETION_BG_CLASS,
  SELECTED_LINE_CLASS,
  ADDITION_LINE_NUMBER_BG_CLASS,
  DELETION_LINE_NUMBER_BG_CLASS,
  ADDITION_MARKER_CLASS,
  DELETION_MARKER_CLASS,
  HUNK_HEADER_BG_CLASS,
  HUNK_HEADER_TEXT_CLASS,
} from './constants'

interface UnifiedDiffViewProps {
  hunks: DiffHunk[]
  fileIdx: number
  selectedLine: string | null
  sourceBranch: string
  targetBranch: string
  /** 是否启用智能 Hunk 合并，默认开启 */
  enableSmartMerge?: boolean
  /** Hunk 合并的最大间隔行数，默认 15 */
  maxGapLines?: number
  /** AI 评审结果 */
  reviewResult?: AIReviewResult | null
  /** 当前文件路径 */
  filePath?: string
}

/**
 * 格式化分支名称显示
 */
function formatBranchName(name: string): string {
  return name.length > BRANCH_MAX_DISPLAY_LENGTH
    ? name.slice(0, BRANCH_MAX_DISPLAY_LENGTH) + BRANCH_TRUNCATE_SUFFIX
    : name
}

/**
 * 统一视图组件
 */
export const UnifiedDiffView = memo(function UnifiedDiffView({
  hunks,
  fileIdx,
  selectedLine,
  sourceBranch,
  targetBranch,
  enableSmartMerge = DEFAULT_ENABLE_SMART_MERGE,
  maxGapLines = DEFAULT_MAX_GAP_LINES,
  reviewResult,
  filePath,
}: UnifiedDiffViewProps) {
  const { t } = useTranslation()
  // 智能合并 hunks
  const mergedHunks = useMemo(() => {
    if (!enableSmartMerge) {
      return hunks.map((h, i) => ({
        ...h,
        sourceHunkIndices: [i],
        collapsibleRanges: [],
        isMerged: false,
      })) as MergedHunk[]
    }
    return mergeHunks_smart(hunks, { maxGapLines, enableSemanticMerge: true })
  }, [hunks, enableSmartMerge, maxGapLines])

  // 折叠状态管理
  const [collapseStates, setCollapseStates] = useState<Record<string, boolean>>({})

  const toggleCollapse = useCallback((hunkIdx: number, rangeIdx: number) => {
    const key = `${hunkIdx}-${rangeIdx}`
    setCollapseStates(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  return (
    <div className="font-mono text-xs overflow-x-auto">
      {/* 分支名称标识行 */}
      {hunks.length > 0 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <div className="w-[24px] bg-gray-100 dark:bg-gray-800" title={t('diff.aiReviewMark')} />
          <div className="w-[24px] px-1 text-center text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
          <div
            className="w-12 px-1 text-right text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
            title={`旧版本: ${targetBranch}`}
          >
            <span className="cursor-help" title={targetBranch}>
              {formatBranchName(targetBranch)}
            </span>
          </div>
          <div
            className="w-12 px-1 text-right text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
            title={`新版本: ${sourceBranch}`}
          >
            <span className="cursor-help" title={sourceBranch}>
              {formatBranchName(sourceBranch)}
            </span>
          </div>
          <div className="flex-1 flex items-center px-2 text-[10px] leading-5 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
            <span className="flex items-center gap-1 text-red-500" title={`删除的内容来自: ${targetBranch}`}>
              <Minus className="w-2.5 h-2.5" />
              <span className="truncate max-w-[100px]" title={targetBranch}>
                {targetBranch}
              </span>
            </span>
            <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
            <span className="flex items-center gap-1 text-green-500" title={`新增的内容来自: ${sourceBranch}`}>
              <Plus className="w-2.5 h-2.5" />
              <span className="truncate max-w-[100px]" title={sourceBranch}>
                {sourceBranch}
              </span>
            </span>
          </div>
        </div>
      )}

      {mergedHunks.map((hunk: MergedHunk, hunkIdx: number) => {
        const charMap = pairHunkLines(hunk.lines)

        // 构建包含折叠状态的行列表
        const renderLines: Array<{ type: 'line' | 'collapse', data: DiffLine | CollapsibleRange, idx: number, rangeIdx?: number }> = []
        let currentIdx = 0

        // 处理可折叠区域
        for (let ri = 0; ri < hunk.collapsibleRanges.length; ri++) {
          const range = hunk.collapsibleRanges[ri]
          const key = `${hunkIdx}-${ri}`
          const isCollapsed = collapseStates[key] !== false // 默认折叠

          // 添加折叠区域之前的行
          while (currentIdx < range.startIdx) {
            renderLines.push({ type: 'line', data: hunk.lines[currentIdx], idx: currentIdx })
            currentIdx++
          }

          if (isCollapsed) {
            // 添加折叠指示器
            renderLines.push({ type: 'collapse', data: range, idx: currentIdx, rangeIdx: ri })
          } else {
            // 展开：添加所有行
            while (currentIdx < range.endIdx) {
              renderLines.push({ type: 'line', data: hunk.lines[currentIdx], idx: currentIdx })
              currentIdx++
            }
          }

          currentIdx = range.endIdx
        }

        // 添加剩余的行
        while (currentIdx < hunk.lines.length) {
          renderLines.push({ type: 'line', data: hunk.lines[currentIdx], idx: currentIdx })
          currentIdx++
        }

        return (
          <div key={hunkIdx}>
            {/* Hunk header - 显示合并标识 */}
            <div className={`px-3 py-1 ${HUNK_HEADER_BG_CLASS} ${HUNK_HEADER_TEXT_CLASS} border-y border-blue-200 dark:border-blue-800 text-xs font-mono flex items-center justify-between`}>
              <span>
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </span>
              {hunk.isMerged && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded">
                  合并了 {hunk.sourceHunkIndices.length} 个变更块
                </span>
              )}
            </div>

            {/* Lines with collapse support */}
            {renderLines.map((item, renderIdx) => {
              if (item.type === 'collapse') {
                const range = item.data as CollapsibleRange
                return (
                  <CollapsedIndicator
                    key={`collapse-${renderIdx}`}
                    range={range}
                    isCollapsed={true}
                    onToggle={() => toggleCollapse(hunkIdx, item.rangeIdx!)}
                  />
                )
              }

              const line = item.data as DiffLine
              const lineIdx = item.idx
              const id = `diff-${fileIdx}-${hunkIdx}-${lineIdx}`
              const isSelected = selectedLine === id
              const isChange = line.lineType !== 'context'
              const segments = charMap.get(lineIdx)

              return (
                <div
                  id={id}
                  key={lineIdx}
                  className={clsx(
                    'flex items-center group/line h-[22px] overflow-y-clip',
                    line.lineType === 'addition' && ADDITION_BG_CLASS,
                    line.lineType === 'deletion' && DELETION_BG_CLASS,
                    isSelected && SELECTED_LINE_CLASS,
                    isChange && 'hover:bg-opacity-80'
                  )}
                >
                  {/* AI 评审标记列 */}
                  <span className="w-[24px] flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                    {filePath && reviewResult && line.newLine && (() => {
                      const issues = getLineIssues(reviewResult, filePath, line.newLine)
                      if (issues.length > 0) {
                        return (
                          <InlineReviewMarker
                            issues={issues}
                            filePath={filePath}
                            lineNum={line.newLine}
                          />
                        )
                      }
                      return null
                    })()}
                  </span>
                  <span
                    className={clsx(
                      'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                      line.lineType === 'deletion'
                        ? DELETION_LINE_NUMBER_BG_CLASS + ' text-red-400'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {line.oldLine ?? ''}
                  </span>
                  <span
                    className={clsx(
                      'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                      line.lineType === 'addition'
                        ? ADDITION_LINE_NUMBER_BG_CLASS + ' text-green-400'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {line.newLine ?? ''}
                  </span>
                  <span
                    className={clsx(
                      'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                      line.lineType === 'addition' && ADDITION_MARKER_CLASS,
                      line.lineType === 'deletion' && DELETION_MARKER_CLASS
                    )}
                  >
                    {line.lineType === 'addition' ? '+' : line.lineType === 'deletion' ? '-' : ' '}
                  </span>
                  <span className="flex-1 px-2 whitespace-pre text-[11px] leading-[22px] relative">
                    <HighlightedLine content={line.content} lineType={line.lineType} charSegments={segments} />
                    <CopyButton text={line.content} />
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
})
