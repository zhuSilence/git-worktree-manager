import { useState, useEffect, useRef, useCallback } from 'react'
import { X, FileText, Plus, Minus, RefreshCw, GitCompare, ChevronDown, ChevronRight, Columns, AlignLeft, ArrowUp, GripVertical } from 'lucide-react'
import { gitService } from '@/services/git'
import type { DetailedDiffResponse, FileDiff, DiffHunk, DiffLine } from '@/types/worktree'
import { clsx } from 'clsx'

interface DiffSidebarProps {
  isOpen: boolean
  onClose: () => void
  worktreePath: string
  worktreeName: string
  branches?: string[]
  defaultBranch?: string
}

type ViewMode = 'unified' | 'split'

const MIN_WIDTH = 400
const MAX_WIDTH = 1000
const DEFAULT_WIDTH = 600

export function DiffSidebar({ isOpen, onClose, worktreePath, worktreeName, branches = [], defaultBranch = 'main' }: DiffSidebarProps) {
  const [diff, setDiff] = useState<DetailedDiffResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetBranch, setTargetBranch] = useState(defaultBranch)
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const newWidth = window.innerWidth - e.clientX
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth))
    setWidth(clampedWidth)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  useEffect(() => {
    if (isOpen) {
      fetchDiff()
    }
  }, [isOpen, worktreePath, targetBranch])

  const fetchDiff = async () => {
    setIsLoading(true)
    setError(null)
    setSelectedLine(null)
    try {
      const result = await gitService.getDetailedDiff(worktreePath, targetBranch)
      setDiff(result)
      // 默认展开所有文件
      setExpandedFiles(new Set(result.files.map(f => f.path)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取 diff 失败')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFile = (path: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFiles(newExpanded)
  }

  const toggleAll = () => {
    if (diff) {
      if (expandedFiles.size === diff.files.length) {
        setExpandedFiles(new Set())
      } else {
        setExpandedFiles(new Set(diff.files.map(f => f.path)))
      }
    }
  }

  const scrollToLine = (fileIdx: number, hunkIdx: number, lineIdx: number) => {
    const id = `diff-${fileIdx}-${hunkIdx}-${lineIdx}`
    setSelectedLine(id)
    const element = document.getElementById(id)
    if (element && scrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const jumpToNextChange = () => {
    if (!diff) return
    
    // 找到下一个有变更的行
    for (let fIdx = 0; fIdx < diff.files.length; fIdx++) {
      const file = diff.files[fIdx]
      for (let hIdx = 0; hIdx < file.hunks.length; hIdx++) {
        const hunk = file.hunks[hIdx]
        for (let lIdx = 0; lIdx < hunk.lines.length; lIdx++) {
          const line = hunk.lines[lIdx]
          const id = `diff-${fIdx}-${hIdx}-${lIdx}`
          if (line.lineType !== 'context' && (!selectedLine || id > selectedLine)) {
            scrollToLine(fIdx, hIdx, lIdx)
            // 确保文件展开
            setExpandedFiles(prev => new Set([...prev, file.path]))
            return
          }
        }
      }
    }
  }

  const jumpToPrevChange = () => {
    if (!diff) return
    
    // 找到上一个有变更的行
    for (let fIdx = diff.files.length - 1; fIdx >= 0; fIdx--) {
      const file = diff.files[fIdx]
      for (let hIdx = file.hunks.length - 1; hIdx >= 0; hIdx--) {
        const hunk = file.hunks[hIdx]
        for (let lIdx = hunk.lines.length - 1; lIdx >= 0; lIdx--) {
          const line = hunk.lines[lIdx]
          const id = `diff-${fIdx}-${hIdx}-${lIdx}`
          if (line.lineType !== 'context' && (!selectedLine || id < selectedLine)) {
            scrollToLine(fIdx, hIdx, lIdx)
            setExpandedFiles(prev => new Set([...prev, file.path]))
            return
          }
        }
      }
    }
  }

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added': return 'text-green-500'
      case 'deleted': return 'text-red-500'
      case 'modified': return 'text-yellow-500'
      case 'renamed': return 'text-blue-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'added': return 'bg-green-500/10'
      case 'deleted': return 'bg-red-500/10'
      case 'modified': return 'bg-yellow-500/10'
      case 'renamed': return 'bg-blue-500/10'
      default: return 'bg-gray-500/10'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'added': return '新增'
      case 'deleted': return '删除'
      case 'modified': return '修改'
      case 'renamed': return '重命名'
      default: return status
    }
  }

  return (
    <div 
      ref={sidebarRef}
      className="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col relative"
      style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
    >
      {/* 拖拽把手 */}
      <div
        onMouseDown={handleMouseDown}
        className={clsx(
          'absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group z-20',
          'hover:bg-purple-500/30 transition-colors',
          isDragging && 'bg-purple-500/50'
        )}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>
      </div>

      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate text-sm">
            {worktreeName} vs {targetBranch}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 导航按钮 */}
          <div className="flex items-center gap-1">
            <button
              onClick={jumpToPrevChange}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title="上一个变更"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={jumpToNextChange}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rotate-180 rounded"
              title="下一个变更"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* 视图切换 */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded p-0.5">
            <button
              onClick={() => setViewMode('unified')}
              className={clsx(
                'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                viewMode === 'unified' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' 
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              <AlignLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={clsx(
                'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                viewMode === 'split' 
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' 
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              <Columns className="w-3 h-3" />
            </button>
          </div>
          
          {/* 分支选择 */}
          <select
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white max-w-[120px]"
          >
            {branches.length > 0 ? (
              branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))
            ) : (
              <>
                <option value="main">main</option>
                <option value="master">master</option>
                <option value="develop">develop</option>
              </>
            )}
          </select>
          <button
            onClick={fetchDiff}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* 内容 */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        )}
        
        {error && (
          <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {!isLoading && !error && diff && (
          <>
            {/* 统计概览 */}
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-medium">{diff.files.length}</span>
                    <span className="text-gray-500">文件</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-500">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="font-medium">{diff.totalAdditions}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-500">
                    <Minus className="w-3.5 h-3.5" />
                    <span className="font-medium">{diff.totalDeletions}</span>
                  </div>
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {expandedFiles.size === diff.files.length ? '全部收起' : '全部展开'}
                </button>
              </div>
            </div>
            
            {/* 文件列表 */}
            {diff.files.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">没有发现差异</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {diff.files.map((file: FileDiff, fileIdx: number) => (
                  <div key={file.path} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    {/* 文件头部 */}
                    <div
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => toggleFile(file.path)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {expandedFiles.has(file.path) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span className={clsx('text-xs font-medium px-1 py-0.5 rounded', getStatusColor(file.status), getStatusBgColor(file.status))}>
                          {getStatusLabel(file.status)}
                        </span>
                        <span className="truncate text-xs text-gray-700 dark:text-gray-300 font-medium" title={file.path}>
                          {file.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs ml-3">
                        {file.additions > 0 && (
                          <span className="text-green-500">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-red-500">-{file.deletions}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* 文件内容 */}
                    {expandedFiles.has(file.path) && (
                      <div className="overflow-x-auto">
                        {viewMode === 'unified' ? (
                          <UnifiedDiffView hunks={file.hunks} fileIdx={fileIdx} selectedLine={selectedLine} />
                        ) : (
                          <SplitDiffView hunks={file.hunks} fileIdx={fileIdx} selectedLine={selectedLine} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// 统一视图组件
function UnifiedDiffView({ hunks, fileIdx, selectedLine }: { hunks: DiffHunk[], fileIdx: number, selectedLine: string | null }) {
  return (
    <div className="font-mono text-xs">
      {hunks.map((hunk: DiffHunk, hunkIdx: number) => (
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
            
            return (
              <div
                id={id}
                key={lineIdx}
                className={clsx(
                  'flex group',
                  line.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                  line.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
                  isSelected && 'ring-2 ring-purple-500 ring-inset',
                  isChange && 'hover:bg-opacity-80',
                )}
              >
                <span className={clsx(
                  'w-12 px-1 py-0 text-right text-[11px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                  line.lineType === 'deletion' ? 'bg-red-100 dark:bg-red-900/30 text-red-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                )}>
                  {line.oldLine ?? ''}
                </span>
                <span className={clsx(
                  'w-12 px-1 py-0 text-right text-[11px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                  line.lineType === 'addition' ? 'bg-green-100 dark:bg-green-900/30 text-green-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                )}>
                  {line.newLine ?? ''}
                </span>
                <span
                  className={clsx(
                    'w-5 px-0.5 py-0 text-center select-none text-[10px]',
                    line.lineType === 'addition' && 'text-green-500 font-bold',
                    line.lineType === 'deletion' && 'text-red-500 font-bold',
                  )}
                >
                  {line.lineType === 'addition' ? '+' : line.lineType === 'deletion' ? '-' : ' '}
                </span>
                <span className="flex-1 px-2 py-0 whitespace-pre overflow-x-auto text-[11px] leading-5">
                  <HighlightedLine content={line.content} lineType={line.lineType} />
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// 拆分视图组件
function SplitDiffView({ hunks, fileIdx, selectedLine }: { hunks: DiffHunk[], fileIdx: number, selectedLine: string | null }) {
  return (
    <div className="font-mono text-xs">
      {hunks.map((hunk: DiffHunk, hunkIdx: number) => {
        // 分离删除行和新增行
        const leftLines: (DiffLine | null)[] = []
        const rightLines: (DiffLine | null)[] = []
        
        hunk.lines.forEach((line) => {
          if (line.lineType === 'deletion') {
            leftLines.push(line)
          } else if (line.lineType === 'addition') {
            rightLines.push(line)
          } else {
            leftLines.push(line)
            rightLines.push(line)
          }
        })
        
        const maxLines = Math.max(leftLines.length, rightLines.length)
        while (leftLines.length < maxLines) leftLines.push(null)
        while (rightLines.length < maxLines) rightLines.push(null)
        
        return (
          <div key={hunkIdx}>
            {/* Hunk header */}
            <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-y border-blue-200 dark:border-blue-800 text-xs font-mono">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>
            {/* Split view */}
            <div className="flex">
              {/* Left side (old) */}
              <div className="flex-1 border-r border-gray-300 dark:border-gray-600">
                {leftLines.map((line, idx) => {
                  const id = `diff-${fileIdx}-${hunkIdx}-L${idx}`
                  const isSelected = selectedLine === id
                  
                  return (
                    <div
                      id={id}
                      key={`left-${idx}`}
                      className={clsx(
                        'flex',
                        line?.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
                        line === null && 'bg-gray-100 dark:bg-gray-800/50',
                        isSelected && 'ring-2 ring-purple-500 ring-inset',
                      )}
                    >
                      <span className={clsx(
                        'w-10 px-1 py-0 text-right text-[11px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                        line?.lineType === 'deletion' ? 'bg-red-100 dark:bg-red-900/30 text-red-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                      )}>
                        {line?.oldLine ?? ''}
                      </span>
                      <span
                        className={clsx(
                          'w-5 px-0.5 py-0 text-center select-none text-[10px]',
                          line?.lineType === 'deletion' && 'text-red-500 font-bold',
                        )}
                      >
                        {line?.lineType === 'deletion' ? '-' : ' '}
                      </span>
                      <span className="flex-1 px-1 py-0 whitespace-pre overflow-x-auto text-[11px] leading-5">
                        {line ? <HighlightedLine content={line.content} lineType={line.lineType} /> : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Right side (new) */}
              <div className="flex-1">
                {rightLines.map((line, idx) => {
                  const id = `diff-${fileIdx}-${hunkIdx}-R${idx}`
                  const isSelected = selectedLine === id
                  
                  return (
                    <div
                      id={id}
                      key={`right-${idx}`}
                      className={clsx(
                        'flex',
                        line?.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                        line === null && 'bg-gray-100 dark:bg-gray-800/50',
                        isSelected && 'ring-2 ring-purple-500 ring-inset',
                      )}
                    >
                      <span className={clsx(
                        'w-10 px-1 py-0 text-right text-[11px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                        line?.lineType === 'addition' ? 'bg-green-100 dark:bg-green-900/30 text-green-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                      )}>
                        {line?.newLine ?? ''}
                      </span>
                      <span
                        className={clsx(
                          'w-5 px-0.5 py-0 text-center select-none text-[10px]',
                          line?.lineType === 'addition' && 'text-green-500 font-bold',
                        )}
                      >
                        {line?.lineType === 'addition' ? '+' : ' '}
                      </span>
                      <span className="flex-1 px-1 py-0 whitespace-pre overflow-x-auto text-[11px] leading-5">
                        {line ? <HighlightedLine content={line.content} lineType={line.lineType} /> : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// 高亮行组件 - 对变更行的内容做关键字符高亮
function HighlightedLine({ content, lineType }: { content: string, lineType: string }) {
  if (lineType === 'context') {
    return <span className="text-gray-700 dark:text-gray-300">{content}</span>
  }

  if (lineType === 'addition') {
    return (
      <span className="text-green-800 dark:text-green-300">
        {content}
      </span>
    )
  }

  if (lineType === 'deletion') {
    return (
      <span className="text-red-800 dark:text-red-300">
        {content}
      </span>
    )
  }

  return <span>{content}</span>
}