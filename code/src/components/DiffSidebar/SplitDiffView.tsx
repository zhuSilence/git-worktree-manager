import { useCallback, memo, useMemo } from 'react'
import { clsx } from 'clsx'
import type { DiffHunk, DiffLine } from '@/types/worktree'
import type { AIReviewResult } from '@/types/ai'
import type { AlignedLine, AlignedFunctionPair } from './types'
import { computeIntraLineDiff } from './DiffAlgorithm'
import { alignDiff, alignLinesSimple, supportsFunctionAlign } from './LineAligner'
import { getLineIssues } from '@/utils/aiReview'
import { InlineReviewMarker } from './InlineReviewMarker'
import { CopyButton } from './CopyButton'
import { HighlightedLine } from './HighlightedLine'
import { LazyRender } from './LazyRender'
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
  /** 是否启用函数级对齐 */
  enableFunctionAlign?: boolean
}

/**
 * 拆分视图组件 - 支持函数级对齐
 */
export const SplitDiffView = memo(function SplitDiffView({
  hunks,
  fileIdx,
  selectedLine,
  sourceBranch,
  targetBranch,
  reviewResult,
  filePath,
  enableFunctionAlign = true,
}: SplitDiffViewProps) {

  // 检查是否支持函数对齐
  const canUseFunctionAlign = useMemo(() => {
    return enableFunctionAlign && filePath && supportsFunctionAlign(filePath)
  }, [enableFunctionAlign, filePath])

  // 渲染单行（左侧）
  const renderLeftLine = useCallback((
    line: DiffLine | null,
    _origIdx: number,
    lineIdx: number,
    hunkIdx: number,
    charSegments?: import('./types').CharSegment[]
  ) => {
    const id = `diff-${fileIdx}-${hunkIdx}-L${lineIdx}`
    const isSelected = selectedLine === id

    return (
      <div
        id={id}
        key={`left-${lineIdx}`}
        className={clsx(
          'flex items-start group/line min-h-[22px]',
          line?.lineType === 'deletion' && DELETION_BG_CLASS,
          line === null && 'bg-gray-100 dark:bg-gray-800/50',
          isSelected && SELECTED_LINE_CLASS
        )}
      >
        <span
          className={clsx(
            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono flex-shrink-0',
            line?.lineType === 'deletion'
              ? DELETION_LINE_NUMBER_BG_CLASS + ' text-red-400'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          )}
        >
          {line?.oldLine ?? ''}
        </span>
        <span
          className={clsx(
            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px] flex-shrink-0',
            line?.lineType === 'deletion' && DELETION_MARKER_CLASS
          )}
        >
          {line?.lineType === 'deletion' ? '-' : ' '}
        </span>
        <span className="flex-1 px-1 whitespace-pre-wrap break-all text-[11px] leading-[22px] relative">
          {line ? (
            <HighlightedLine content={line.content} lineType={line.lineType} charSegments={charSegments} filePath={filePath} />
          ) : (
            ''
          )}
          {line && <CopyButton text={line.content} />}
        </span>
      </div>
    )
  }, [fileIdx, selectedLine])

  // 渲染单行（右侧）
  const renderRightLine = useCallback((
    line: DiffLine | null,
    _origIdx: number,
    lineIdx: number,
    hunkIdx: number,
    charSegments?: import('./types').CharSegment[]
  ) => {
    const id = `diff-${fileIdx}-${hunkIdx}-R${lineIdx}`
    const isSelected = selectedLine === id

    return (
      <div
        id={id}
        key={`right-${lineIdx}`}
        className={clsx(
          'flex items-start group/line min-h-[22px]',
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
            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono flex-shrink-0',
            line?.lineType === 'addition'
              ? ADDITION_LINE_NUMBER_BG_CLASS + ' text-green-400'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          )}
        >
          {line?.newLine ?? ''}
        </span>
        <span
          className={clsx(
            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px] flex-shrink-0',
            line?.lineType === 'addition' && ADDITION_MARKER_CLASS
          )}
        >
          {line?.lineType === 'addition' ? '+' : ' '}
        </span>
        <span className="flex-1 px-1 whitespace-pre-wrap break-all text-[11px] leading-[22px] relative">
          {line ? (
            <HighlightedLine content={line.content} lineType={line.lineType} charSegments={charSegments} filePath={filePath} />
          ) : (
            ''
          )}
          {line && <CopyButton text={line.content} />}
        </span>
      </div>
    )
  }, [fileIdx, selectedLine, filePath, reviewResult])

  // 渲染对齐后的行
  const renderAlignedLines = useCallback((
    alignedLines: AlignedLine[],
    hunkIdx: number
  ) => {
    return alignedLines.map((aligned, idx) => {
      // 计算字符级差异
      let leftSegments, rightSegments
      if (aligned.left && aligned.right &&
          aligned.left.lineType === 'deletion' &&
          aligned.right.lineType === 'addition') {
        const { oldSegments, newSegments } = computeIntraLineDiff(
          aligned.left.content,
          aligned.right.content
        )
        leftSegments = oldSegments
        rightSegments = newSegments
      }

      return (
        <div key={`aligned-${idx}`} className="flex min-w-0">
          {/* 左侧 */}
          <div className="w-1/2">
            {renderLeftLine(
              aligned.left,
              aligned.leftOrigIdx,
              idx,
              hunkIdx,
              leftSegments
            )}
          </div>
          {/* 分隔线 */}
          <div className="w-[3px] flex-shrink-0 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
          {/* 右侧 */}
          <div className="w-1/2">
            {renderRightLine(
              aligned.right,
              aligned.rightOrigIdx,
              idx,
              hunkIdx,
              rightSegments
            )}
          </div>
        </div>
      )
    })
  }, [renderLeftLine, renderRightLine])

  // 渲染函数对
  const renderFunctionPair = useCallback((
    pair: AlignedFunctionPair,
    pairIdx: number,
    hunkIdx: number
  ) => {
    const hasLeftHeader = pair.leftHeader && pair.type !== 'right-only'
    const hasRightHeader = pair.rightHeader && pair.type !== 'left-only'

    return (
      <div key={`func-${pairIdx}`} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
        {/* 函数头 */}
        {(hasLeftHeader || hasRightHeader) && (
          <div className="flex min-w-0 bg-purple-50/50 dark:bg-purple-900/20 border-y border-purple-200 dark:border-purple-800">
            <div className="w-1/2 px-3 py-1 text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate">
              {pair.leftHeader || '—'}
            </div>
            <div className="w-[3px] flex-shrink-0 bg-purple-200 dark:bg-purple-800" />
            <div className="w-1/2 px-3 py-1 text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate">
              {pair.rightHeader || '—'}
            </div>
          </div>
        )}
        {/* 函数内容 */}
        {renderAlignedLines(pair.lines, hunkIdx)}
      </div>
    )
  }, [renderAlignedLines])

  return (
    <div className="font-mono text-xs flex flex-col">
      {/* 分支标签头 */}
      <div className="flex min-w-0 sticky top-0 z-10">
        <div className="w-1/2 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
          {targetBranch}
        </div>
        <div className="w-[3px] flex-shrink-0 bg-gray-200 dark:bg-gray-700" />
        <div className="w-1/2 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
          {sourceBranch}
        </div>
      </div>

      {hunks.map((hunk: DiffHunk, hunkIdx: number) => {
        // 分离删除行和新增行
        const leftLines: DiffLine[] = []
        const rightLines: DiffLine[] = []

        hunk.lines.forEach((line) => {
          if (line.lineType === 'deletion') {
            leftLines.push(line)
          } else if (line.lineType === 'addition') {
            rightLines.push(line)
          } else {
            // context 行同时添加到两侧
            leftLines.push(line)
            rightLines.push(line)
          }
        })

        // 函数级对齐 or 简单对齐
        let alignedContent
        if (canUseFunctionAlign) {
          const alignResult = alignDiff(leftLines, rightLines)
          alignedContent = (
            <>
              {/* 函数对 */}
              {alignResult.pairs.map((pair, pairIdx) =>
                renderFunctionPair(pair, pairIdx, hunkIdx)
              )}
              {/* 孤儿行 */}
              {alignResult.orphanLines.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {renderAlignedLines(alignResult.orphanLines, hunkIdx)}
                </div>
              )}
            </>
          )
        } else {
          // 简单对齐（不进行函数解析）
          const simpleAligned = alignLinesSimple(leftLines, rightLines)
          alignedContent = renderAlignedLines(simpleAligned, hunkIdx)
        }

        // 估算 hunk 高度：header (28px) + 每行 (22px)
        const estimatedHunkHeight = 28 + hunk.lines.length * 22

        return (
          <LazyRender
            key={hunkIdx}
            estimatedHeight={estimatedHunkHeight}
            rootMargin="300px"
            keepOnceRendered={true}
          >
            {/* Hunk header */}
            <div className={`px-3 py-1 ${HUNK_HEADER_BG_CLASS} ${HUNK_HEADER_TEXT_CLASS} border-y border-blue-200 dark:border-blue-800 text-xs font-mono flex items-center justify-between`}>
              <span>
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </span>
              {canUseFunctionAlign && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded">
                  函数对齐
                </span>
              )}
            </div>

            {/* 对齐后的内容 */}
            {alignedContent}
          </LazyRender>
        )
      })}
    </div>
  )
})
