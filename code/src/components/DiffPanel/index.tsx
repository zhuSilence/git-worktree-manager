import { useState, useEffect } from 'react'
import { X, FileText, Plus, Minus, RefreshCw, GitCompare, ChevronDown, ChevronRight, Columns, AlignLeft } from 'lucide-react'
import { gitService } from '@/services/git'
import type { DetailedDiffResponse, FileDiff, DiffHunk, DiffLine } from '@/types/worktree'
import { clsx } from 'clsx'

interface DiffPanelProps {
  isOpen: boolean
  onClose: () => void
  worktreePath: string
  worktreeName: string
}

type ViewMode = 'unified' | 'split'

export function DiffPanel({ isOpen, onClose, worktreePath, worktreeName }: DiffPanelProps) {
  const [diff, setDiff] = useState<DetailedDiffResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetBranch, setTargetBranch] = useState('main')
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      fetchDiff()
    }
  }, [isOpen, worktreePath, targetBranch])

  const fetchDiff = async () => {
    setIsLoading(true)
    setError(null)
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

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'text-green-500'
      case 'deleted':
        return 'text-red-500'
      case 'modified':
        return 'text-yellow-500'
      case 'renamed':
        return 'text-blue-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'bg-green-500/10'
      case 'deleted':
        return 'bg-red-500/10'
      case 'modified':
        return 'bg-yellow-500/10'
      case 'renamed':
        return 'bg-blue-500/10'
      default:
        return 'bg-gray-500/10'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'added':
        return '新增'
      case 'deleted':
        return '删除'
      case 'modified':
        return '修改'
      case 'renamed':
        return '重命名'
      default:
        return status
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Diff 面板 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            {worktreeName} vs {targetBranch}
          </h2>
          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('unified')}
                className={clsx(
                  'px-2 py-1 text-xs rounded flex items-center gap-1',
                  viewMode === 'unified' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' 
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <AlignLeft className="w-3 h-3" />
                统一
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={clsx(
                  'px-2 py-1 text-xs rounded flex items-center gap-1',
                  viewMode === 'split' 
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' 
                    : 'text-gray-500 dark:text-gray-400'
                )}
              >
                <Columns className="w-3 h-3" />
                拆分
              </button>
            </div>
            
            {/* 分支选择 */}
            <select
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="main">main</option>
              <option value="master">master</option>
              <option value="develop">develop</option>
            </select>
            <button
              onClick={fetchDiff}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          )}
          
          {error && (
            <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
          
          {!isLoading && !error && diff && (
            <>
              {/* 统计概览 */}
              <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-sm">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{diff.files.length}</span>
                      <span className="text-gray-500 dark:text-gray-400">文件</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-green-500">
                      <Plus className="w-4 h-4" />
                      <span className="font-medium">{diff.totalAdditions}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-red-500">
                      <Minus className="w-4 h-4" />
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
                  <GitCompare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">没有发现差异</p>
                  <p className="text-sm">当前分支与 {targetBranch} 相同</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {diff.files.map((file: FileDiff) => (
                    <div key={file.path} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      {/* 文件头部 */}
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => toggleFile(file.path)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {expandedFiles.has(file.path) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded', getStatusColor(file.status), getStatusBgColor(file.status))}>
                            {getStatusLabel(file.status)}
                          </span>
                          <span className="truncate text-sm text-gray-700 dark:text-gray-300 font-medium" title={file.path}>
                            {file.path}
                          </span>
                          {file.oldPath && (
                            <span className="text-xs text-gray-400">← {file.oldPath}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm ml-4">
                          {file.additions > 0 && (
                            <span className="text-green-500 flex items-center gap-0.5">
                              <Plus className="w-3 h-3" />
                              {file.additions}
                            </span>
                          )}
                          {file.deletions > 0 && (
                            <span className="text-red-500 flex items-center gap-0.5">
                              <Minus className="w-3 h-3" />
                              {file.deletions}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 文件内容 */}
                      {expandedFiles.has(file.path) && (
                        <div className="overflow-x-auto">
                          {viewMode === 'unified' ? (
                            <UnifiedDiffView hunks={file.hunks} />
                          ) : (
                            <SplitDiffView hunks={file.hunks} />
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
    </div>
  )
}

// 统一视图组件
function UnifiedDiffView({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div className="font-mono text-xs">
      {hunks.map((hunk: DiffHunk, hunkIdx: number) => (
        <div key={hunkIdx}>
          {/* Hunk header */}
          <div className="px-4 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-y border-blue-200 dark:border-blue-800">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>
          {/* Lines */}
          {hunk.lines.map((line: DiffLine, lineIdx: number) => (
            <div
              key={lineIdx}
              className={clsx(
                'flex',
                line.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                line.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
              )}
            >
              <span className="w-12 px-2 py-0.5 text-right text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 select-none">
                {line.oldLine ?? ''}
              </span>
              <span className="w-12 px-2 py-0.5 text-right text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 select-none">
                {line.newLine ?? ''}
              </span>
              <span
                className={clsx(
                  'w-6 px-1 py-0.5 text-center select-none',
                  line.lineType === 'addition' && 'text-green-500',
                  line.lineType === 'deletion' && 'text-red-500',
                )}
              >
                {line.lineType === 'addition' ? '+' : line.lineType === 'deletion' ? '-' : ' '}
              </span>
              <span className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
                {line.content}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// 拆分视图组件
function SplitDiffView({ hunks }: { hunks: DiffHunk[] }) {
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
            // 上下文行，两边都有
            leftLines.push(line)
            rightLines.push(line)
          }
        })
        
        // 对齐行数
        const maxLines = Math.max(leftLines.length, rightLines.length)
        while (leftLines.length < maxLines) leftLines.push(null)
        while (rightLines.length < maxLines) rightLines.push(null)
        
        return (
          <div key={hunkIdx}>
            {/* Hunk header */}
            <div className="px-4 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-y border-blue-200 dark:border-blue-800">
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
            </div>
            {/* Split view */}
            <div className="flex">
              {/* Left side (old) */}
              <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
                {leftLines.map((line, idx) => (
                  <div
                    key={`left-${idx}`}
                    className={clsx(
                      'flex',
                      line?.lineType === 'deletion' && 'bg-red-50 dark:bg-red-900/20',
                      line === null && 'bg-gray-100 dark:bg-gray-800/50',
                    )}
                  >
                    <span className="w-12 px-2 py-0.5 text-right text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 select-none">
                      {line?.oldLine ?? ''}
                    </span>
                    <span
                      className={clsx(
                        'w-6 px-1 py-0.5 text-center select-none',
                        line?.lineType === 'deletion' && 'text-red-500',
                      )}
                    >
                      {line?.lineType === 'deletion' ? '-' : ' '}
                    </span>
                    <span className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
                      {line?.content ?? ''}
                    </span>
                  </div>
                ))}
              </div>
              {/* Right side (new) */}
              <div className="flex-1">
                {rightLines.map((line, idx) => (
                  <div
                    key={`right-${idx}`}
                    className={clsx(
                      'flex',
                      line?.lineType === 'addition' && 'bg-green-50 dark:bg-green-900/20',
                      line === null && 'bg-gray-100 dark:bg-gray-800/50',
                    )}
                  >
                    <span className="w-12 px-2 py-0.5 text-right text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 select-none">
                      {line?.newLine ?? ''}
                    </span>
                    <span
                      className={clsx(
                        'w-6 px-1 py-0.5 text-center select-none',
                        line?.lineType === 'addition' && 'text-green-500',
                      )}
                    >
                      {line?.lineType === 'addition' ? '+' : ' '}
                    </span>
                    <span className="flex-1 px-2 py-0.5 whitespace-pre overflow-x-auto">
                      {line?.content ?? ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}