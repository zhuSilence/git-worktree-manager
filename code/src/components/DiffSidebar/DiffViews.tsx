import { useState, memo, useRef, useCallback } from 'react'
import { Plus, Minus, Copy, Check } from 'lucide-react'
import { clsx } from 'clsx'
import type { DiffHunk, DiffLine } from '@/types/worktree'
import type { CharSegment } from './types'
import { pairHunkLines } from './DiffAlgorithm'
import { tokenize, SYNTAX_COLORS } from './SyntaxHighlighter'

/**
 * 行内复制按钮
 */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-1 top-0 bottom-0 my-auto h-5 w-5 items-center justify-center rounded opacity-0 group-hover/line:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity flex"
      title="复制行内容"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
    </button>
  )
}

interface HighlightedLineProps {
  content: string
  lineType: string
  charSegments?: CharSegment[]
}

/**
 * 高亮行组件 - 支持字符级差异高亮 + 语法着色
 */
export function HighlightedLine({ content, lineType, charSegments }: HighlightedLineProps) {
  // 如果有字符级 diff segments，优先用它
  if (charSegments && charSegments.length > 0) {
    const hlClass =
      lineType === 'deletion'
        ? 'bg-red-200 dark:bg-red-800/60 rounded-sm px-[1px]'
        : 'bg-green-200 dark:bg-green-800/60 rounded-sm px-[1px]'
    const textClass =
      lineType === 'deletion' ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'

    return (
      <span className={textClass}>
        {charSegments.map((seg, i) => (
          <span key={i} className={seg.highlight ? hlClass : undefined}>
            {seg.text}
          </span>
        ))}
      </span>
    )
  }

  // context 行：应用语法着色
  if (lineType === 'context') {
    const tokens = tokenize(content)
    return (
      <span className="text-gray-700 dark:text-gray-300">
        {tokens.map((t, i) => {
          const color = SYNTAX_COLORS[t.type]
          return color ? (
            <span key={i} className={color}>
              {t.text}
            </span>
          ) : (
            <span key={i}>{t.text}</span>
          )
        })}
      </span>
    )
  }

  // addition / deletion 无 char-level 时——语法着色 + 基础色
  const baseClass =
    lineType === 'addition'
      ? 'text-green-800 dark:text-green-300'
      : lineType === 'deletion'
        ? 'text-red-800 dark:text-red-300'
        : ''

  const tokens = tokenize(content)
  return (
    <span className={baseClass}>
      {tokens.map((t, i) => {
        const color = SYNTAX_COLORS[t.type]
        return color ? (
          <span key={i} className={color}>
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        )
      })}
    </span>
  )
}

interface UnifiedDiffViewProps {
  hunks: DiffHunk[]
  fileIdx: number
  selectedLine: string | null
  sourceBranch: string
  targetBranch: string
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
}: UnifiedDiffViewProps) {
  return (
    <div className="font-mono text-xs overflow-x-auto">
      {/* 分支名称标识行 */}
      {hunks.length > 0 && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <div className="w-[24px] bg-gray-100 dark:bg-gray-800" />
          <div className="w-[24px] px-1 text-center text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
          <div
            className="w-12 px-1 text-right text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
            title={`旧版本: ${targetBranch}`}
          >
            <span className="cursor-help" title={targetBranch}>
              {targetBranch.length > 6 ? targetBranch.slice(0, 6) + '…' : targetBranch}
            </span>
          </div>
          <div
            className="w-12 px-1 text-right text-[10px] leading-5 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
            title={`新版本: ${sourceBranch}`}
          >
            <span className="cursor-help" title={sourceBranch}>
              {sourceBranch.length > 6 ? sourceBranch.slice(0, 6) + '…' : sourceBranch}
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

      {hunks.map((hunk: DiffHunk, hunkIdx: number) => {
        const charMap = pairHunkLines(hunk.lines)

        return (
          <div key={hunkIdx}>
            {/* Hunk header */}
            <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-y border-blue-200 dark:border-blue-800 text-xs font-mono">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>

            {/* Lines */}
            {hunk.lines.map((line: DiffLine, lineIdx: number) => {
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
                    line.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                    line.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
                    isSelected && 'ring-2 ring-purple-500 ring-inset',
                    isChange && 'hover:bg-opacity-80'
                  )}
                >
                  <span
                    className={clsx(
                      'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                      line.lineType === 'deletion'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-400'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {line.oldLine ?? ''}
                  </span>
                  <span
                    className={clsx(
                      'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                      line.lineType === 'addition'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-400'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                    )}
                  >
                    {line.newLine ?? ''}
                  </span>
                  <span
                    className={clsx(
                      'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                      line.lineType === 'addition' && 'text-green-500 font-bold',
                      line.lineType === 'deletion' && 'text-red-500 font-bold'
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

interface SplitDiffViewProps {
  hunks: DiffHunk[]
  fileIdx: number
  selectedLine: string | null
  sourceBranch: string
  targetBranch: string
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
            <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-y border-blue-200 dark:border-blue-800 text-xs font-mono">
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
                          line?.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
                          line === null && 'bg-gray-100 dark:bg-gray-800/50',
                          isSelected && 'ring-2 ring-purple-500 ring-inset'
                        )}
                      >
                        <span
                          className={clsx(
                            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                            line?.lineType === 'deletion'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-400'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {line?.oldLine ?? ''}
                        </span>
                        <span
                          className={clsx(
                            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                            line?.lineType === 'deletion' && 'text-red-500 font-bold'
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
                          line?.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                          line === null && 'bg-gray-100 dark:bg-gray-800/50',
                          isSelected && 'ring-2 ring-purple-500 ring-inset'
                        )}
                      >
                        <span
                          className={clsx(
                            'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                            line?.lineType === 'addition'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-400'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {line?.newLine ?? ''}
                        </span>
                        <span
                          className={clsx(
                            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                            line?.lineType === 'addition' && 'text-green-500 font-bold'
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
