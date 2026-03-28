import { useRef, useCallback, memo } from 'react'
import { clsx } from 'clsx'
import type { DiffHunk, DiffLine } from '@/types/worktree'
import type { AIReviewResult } from '@/types/ai'
import { pairHunkLines } from './DiffAlgorithm'
import { getLineIssues } from '@/utils/aiReview'
import { InlineReviewMarker } from './InlineReviewMarker'
import { CopyButton } from './CopyButton'
import { HighlightedLine } from './HighlightedLine'
import {
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

interface SplitDiffViewProps {
  hunks: DiffHunk[]
  fileIdx: number
  selectedLine: string | null
  sourceBranch: string
  targetBranch: string
  /** AI 评审结果 */
  reviewResult?: AIReviewResult | null
  /** 当前文件路径 */
  filePath?: string
}

/**
 * 拆分视图组件 - 支持左右同步滚动
 */
export const SplitDiffView = memo(function SplitDiffView({
  hunks,
  fileIdx,
  selectedLine,
  sourceBranch,
  targetBranch,
  reviewResult,
  filePath,
}: SplitDiffViewProps) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const isScrolling = useRef(false)

  // 同步滚动处理
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrolling.current) return
    isScrolling.current = true

    const sourceRef = source === 'left' ? leftRef : rightRef
    const targetRef = source === 'left' ? rightRef : leftRef

    if (sourceRef.current && targetRef.current) {
      targetRef.current.scrollLeft = sourceRef.current.scrollLeft
    }

    requestAnimationFrame(() => {
      isScrolling.current = false
    })
  }, [])

  return (
    <div className="font-mono text-xs flex flex-col">
      {hunks.map((hunk: DiffHunk, hunkIdx: number) => {
        const charMap = pairHunkLines(hunk.lines)

        // 分离删除行和新增行
        const leftLines: { line: DiffLine | null; origIdx: number }[] = []
        const rightLines: { line: DiffLine | null; origIdx: number }[] = []

        hunk.lines.forEach((line, idx) => {
          if (line.lineType === 'deletion') {
            leftLines.push({ line, origIdx: idx })
          } else if (line.lineType === 'addition') {
            rightLines.push({ line, origIdx: idx })
          } else {
            leftLines.push({ line, origIdx: idx })
            rightLines.push({ line, origIdx: idx })
          }
        })

        // 补齐行数
        const maxLines = Math.max(leftLines.length, rightLines.length)
        while (leftLines.length < maxLines) leftLines.push({ line: null, origIdx: -1 })
        while (rightLines.length < maxLines) rightLines.push({ line: null, origIdx: -1 })

        return (
          <div key={hunkIdx}>
            {/* Hunk header */}
            <div className={`px-3 py-1 ${HUNK_HEADER_BG_CLASS} ${HUNK_HEADER_TEXT_CLASS} border-y border-blue-200 dark:border-blue-800 text-xs font-mono`}>
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>

            {/* Split view */}
            <div className="flex min-w-0">
              {/* Left side */}
              <div className="w-1/2 flex flex-col">
                <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
                  {targetBranch}
                </div>
                <div ref={leftRef} className="overflow-x-auto flex-1" onScroll={() => handleScroll('left')}>
                  {leftLines.map(({ line, origIdx }, idx) => {
                    const id = `diff-${fileIdx}-${hunkIdx}-L${idx}`
                    const isSelected = selectedLine === id
                    const segments = origIdx >= 0 ? charMap.get(origIdx) : undefined

                    return (
                      <div
                        id={id}
                        key={`left-${idx}`}
                        className={clsx(
                          'flex items-center group/line h-[22px] overflow-y-clip',
                          line?.lineType === 'deletion' && DELETION_BG_CLASS,
                          line === null && 'bg-gray-100 dark:bg-gray-800/50',
                          isSelected && SELECTED_LINE_CLASS
                        )}
                      >
                        <span
                          className={clsx(
                            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                            line?.lineType === 'deletion'
                              ? DELETION_LINE_NUMBER_BG_CLASS + ' text-red-400'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {line?.oldLine ?? ''}
                        </span>
                        <span
                          className={clsx(
                            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                            line?.lineType === 'deletion' && DELETION_MARKER_CLASS
                          )}
                        >
                          {line?.lineType === 'deletion' ? '-' : ' '}
                        </span>
                        <span className="flex-1 px-1 whitespace-pre text-[11px] leading-[22px] relative">
                          {line ? (
                            <HighlightedLine content={line.content} lineType={line.lineType} charSegments={segments} />
                          ) : (
                            ''
                          )}
                          {line && <CopyButton text={line.content} />}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="w-[3px] flex-shrink-0 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />

              {/* Right side */}
              <div className="w-1/2 flex flex-col">
                <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
                  {sourceBranch}
                </div>
                <div ref={rightRef} className="overflow-x-auto flex-1" onScroll={() => handleScroll('right')}>
                  {rightLines.map(({ line, origIdx }, idx) => {
                    const id = `diff-${fileIdx}-${hunkIdx}-R${idx}`
                    const isSelected = selectedLine === id
                    const segments = origIdx >= 0 ? charMap.get(origIdx) : undefined

                    return (
                      <div
                        id={id}
                        key={`right-${idx}`}
                        className={clsx(
                          'flex items-center group/line h-[22px] overflow-y-clip',
                          line?.lineType === 'addition' && ADDITION_BG_CLASS,
                          line === null && 'bg-gray-100 dark:bg-gray-800/50',
                          isSelected && SELECTED_LINE_CLASS
                        )}
                      >
                        {/* AI 评审标记 */}
                        <span className="w-[20px] flex-shrink-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                          {filePath && reviewResult && line?.newLine && (() => {
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
                            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                            line?.lineType === 'addition'
                              ? ADDITION_LINE_NUMBER_BG_CLASS + ' text-green-400'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {line?.newLine ?? ''}
                        </span>
                        <span
                          className={clsx(
                            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                            line?.lineType === 'addition' && ADDITION_MARKER_CLASS
                          )}
                        >
                          {line?.lineType === 'addition' ? '+' : ' '}
                        </span>
                        <span className="flex-1 px-1 whitespace-pre text-[11px] leading-[22px] relative">
                          {line ? (
                            <HighlightedLine content={line.content} lineType={line.lineType} charSegments={segments} />
                          ) : (
                            ''
                          )}
                          {line && <CopyButton text={line.content} />}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})
