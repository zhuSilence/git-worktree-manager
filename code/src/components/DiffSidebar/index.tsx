import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, FileText, Plus, Minus, RefreshCw, GitCompare, ChevronDown, ChevronRight, Columns, AlignLeft, ArrowUp, GripVertical, ChevronsDown, LayoutList, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gitService } from '@/services/git'
import type { DetailedDiffResponse, FileDiff } from '@/types/worktree'
import { clsx } from 'clsx'
import { aiReviewStore } from '@/stores/aiReviewStore'
import { AIConfigPanel } from '@/components/AIConfigPanel'

// 拆分的子模块
import type { ViewMode, FileTreeNode } from './types'
import { buildFileTree, FileTreeNodeItem } from './FileTree'
import { UnifiedDiffView, SplitDiffView } from './DiffViews'

interface DiffSidebarProps {
  isOpen: boolean
  onClose: () => void
  worktreePath: string
  worktreeName: string
  branches?: string[]
  defaultBranch?: string
  fillWidth?: boolean
  refreshToken?: number
}

const MIN_WIDTH = 400
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 600
const STORAGE_KEY = 'diff-sidebar-width'
const SPLIT_MIN_WIDTH = 700

export function DiffSidebar({ isOpen, onClose, worktreePath, worktreeName, branches = [], defaultBranch = 'main', fillWidth = false, refreshToken }: DiffSidebarProps) {
  const { t } = useTranslation()
  const [diff, setDiff] = useState<DetailedDiffResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetBranch, setTargetBranch] = useState(defaultBranch)
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
  const [selectedLine, setSelectedLine] = useState<string | null>(null)
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const maxW = typeof window !== 'undefined' ? window.innerWidth - 350 : MAX_WIDTH
    return saved ? Math.min(maxW, Math.max(MIN_WIDTH, Number(saved))) : DEFAULT_WIDTH
  })
  const [isDragging, setIsDragging] = useState(false)
  const [showFileTree, setShowFileTree] = useState(true)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [showAIConfig, setShowAIConfig] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // AI 评审状态
  const reviewStatus = aiReviewStore((state) => state.reviewStatus)
  const currentResult = aiReviewStore((state) => state.currentResult)
  const performReview = aiReviewStore((state) => state.performReview)
  const reReview = aiReviewStore((state) => state.reReview)
  const showConfigGuide = aiReviewStore((state) => state.showConfigGuide)
  const setShowConfigGuide = aiReviewStore((state) => state.setShowConfigGuide)

  // 拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const newWidth = window.innerWidth - e.clientX
    const dynamicMax = window.innerWidth - 350 // leave space for left panels
    const clampedWidth = Math.min(dynamicMax, Math.max(MIN_WIDTH, newWidth))
    setWidth(clampedWidth)
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    // 持久化宽度
    setWidth(prev => { localStorage.setItem(STORAGE_KEY, String(prev)); return prev })
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

  // 响应式：窗口过窄时自动退回 unified
  useEffect(() => {
    if (width < SPLIT_MIN_WIDTH && viewMode === 'split') {
      setViewMode('unified')
    }
  }, [width, viewMode])

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      // 在 input/select 中不触发
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return
      switch (e.key) {
        case 'n': jumpToNextChange(); break
        case 'p': jumpToPrevChange(); break
        case 'e': toggleAll(); break
        case 'Escape': onClose(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, diff, selectedLine, expandedFiles])

  useEffect(() => {
    if (isOpen) {
      fetchDiff()
    }
  }, [isOpen, worktreePath, targetBranch, refreshToken])

  const fetchDiff = async () => {
    setIsLoading(true)
    setError(null)
    setSelectedLine(null)
    try {
      const result = await gitService.getDetailedDiff(worktreePath, targetBranch)
      setDiff(result)
      // 默认全部收起，避免大量文件同时渲染卡顿
      setExpandedFiles(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('diff.fetchFailed'))
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

  // 构建文件树
  const fileTree = useMemo(() => {
    if (!diff) return []
    return buildFileTree(diff.files)
  }, [diff])

  // diff 加载后自动展开所有目录
  useEffect(() => {
    if (!diff) return
    const allDirs = new Set<string>()
    for (const file of diff.files) {
      const parts = file.path.split('/')
      // 构建所有可能的目录路径（包括压缩后的路径）
      for (let i = 1; i < parts.length; i++) {
        allDirs.add(parts.slice(0, i).join('/'))
      }
    }
    // 同时收集压缩后的目录路径
    function collectDirs(nodes: FileTreeNode[]) {
      for (const n of nodes) {
        if (!n.isFile) {
          allDirs.add(n.fullPath)
          collectDirs(n.children)
        }
      }
    }
    collectDirs(fileTree)
    setExpandedDirs(allDirs)
  }, [diff, fileTree])

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  // 滚动到指定文件
  const scrollToFile = (path: string) => {
    if (!diff) return
    const fileIdx = diff.files.findIndex(f => f.path === path)
    if (fileIdx < 0) return
    setActiveFile(path)
    setExpandedFiles(prev => new Set([...prev, path]))
    setTimeout(() => {
      const el = document.getElementById(`file-diff-${fileIdx}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  const scrollToLine = (fileIdx: number, hunkIdx: number, lineIdx: number) => {
    const id = `diff-${fileIdx}-${hunkIdx}-${lineIdx}`
    setSelectedLine(id)
    const element = document.getElementById(id)
    if (element && scrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // AI 评审相关函数
  const handleStartAIReview = async () => {
    if (!diff) return
    await performReview({
      worktreePath,
      targetBranch,
      force: false,
    })
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
      case 'added': return t('diff.statusAdded')
      case 'deleted': return t('diff.statusDeleted')
      case 'modified': return t('diff.statusModified')
      case 'renamed': return t('diff.statusRenamed')
      default: return status
    }
  }

  return (
    <div
      ref={sidebarRef}
      className="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col relative overflow-hidden"
      style={fillWidth
        ? { flex: '1 1 0%', minWidth: `${MIN_WIDTH}px` }
        : { width: `${width}px`, minWidth: `${MIN_WIDTH}px` }
      }
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
      <div className="flex items-center p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GitCompare className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 dark:text-white truncate text-sm">
            {diff?.sourceBranch || worktreeName} vs {targetBranch}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* AI 评审按钮 */}
          <button
            onClick={() => {
              if (showConfigGuide) {
                setShowAIConfig(true)
              } else if (reviewStatus !== 'loading') {
                if (reviewStatus === 'success' && currentResult) {
                  // 已有结果时强制重新评审，跳过缓存
                  reReview({ worktreePath, targetBranch })
                } else {
                  handleStartAIReview()
                }
              }
            }}
            disabled={reviewStatus === 'loading'}
            className={clsx(
              'p-1.5 rounded transition-colors flex items-center gap-1',
              reviewStatus === 'success' && currentResult
                ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20',
              reviewStatus === 'loading' && 'opacity-50 cursor-not-allowed'
            )}
            title={reviewStatus === 'success' && currentResult ? t('diff.reReview') : t('diff.aiReview')}
          >
            <Sparkles className={clsx('w-3.5 h-3.5', reviewStatus === 'loading' && 'animate-pulse')} />
            {reviewStatus === 'loading' && (
              <span className="text-xs">{t('diff.analyzing')}</span>
            )}
            {reviewStatus === 'success' && currentResult && (() => {
              const count = currentResult.issues.filter(
                i => !i.ignored && !i.file.endsWith('.md') && !i.file.endsWith('.markdown')
              ).length
              return count > 0 ? <span className="text-xs">{count}</span> : null
            })()}
          </button>

          {/* 导航按钮 */}
          <div className="flex items-center gap-1">
            <button
              onClick={jumpToPrevChange}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title={t('diff.prevChange')}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={jumpToNextChange}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rotate-180 rounded"
              title={t('diff.nextChange')}
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
              disabled={width < SPLIT_MIN_WIDTH}
              className={clsx(
                'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                viewMode === 'split'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400',
                width < SPLIT_MIN_WIDTH && 'opacity-40 cursor-not-allowed'
              )}
              title={width < SPLIT_MIN_WIDTH ? t('diff.tooNarrow') : t('diff.splitView')}
            >
              <Columns className="w-3 h-3" />
            </button>
          </div>

          {/* 文件树切换 */}
          <button
            onClick={() => setShowFileTree(!showFileTree)}
            className={clsx(
              'p-1 rounded transition-colors',
              showFileTree
                ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            )}
            title={showFileTree ? t('diff.hideFileList') : t('diff.showFileList')}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>

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
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 文件树面板 */}
        {showFileTree && !isLoading && !error && diff && diff.files.length > 0 && (
          <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
            <div className="p-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              {t('diff.files')} ({diff.files.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {fileTree.map(node => (
                <FileTreeNodeItem
                  key={node.fullPath}
                  node={node}
                  depth={0}
                  activeFile={activeFile}
                  onFileClick={scrollToFile}
                  expandedDirs={expandedDirs}
                  toggleDir={toggleDir}
                />
              ))}
            </div>
          </div>
        )}
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
                    <span className="text-gray-500">{t('diff.files')}</span>
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
                <div className="flex items-center gap-2">
                  {expandedFiles.size < diff.files.length && diff.files.length > 5 && (
                    <button
                      onClick={() => {
                        // 渐进式展开：每次展开 10 个
                        const next = new Set(expandedFiles)
                        let count = 0
                        for (const f of diff.files) {
                          if (!next.has(f.path)) {
                            next.add(f.path)
                            count++
                            if (count >= 10) break
                          }
                        }
                        setExpandedFiles(next)
                      }}
                      className="text-xs text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-0.5"
                    >
                      <ChevronsDown className="w-3 h-3" />
                      {t('diff.expandMore')}
                    </button>
                  )}
                  <button
                    onClick={toggleAll}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {expandedFiles.size === diff.files.length ? t('diff.collapseAll') : t('diff.expandAll')}
                  </button>
                </div>
              </div>
            </div>

            {/* 文件列表 */}
            {diff.files.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                <p className="text-sm">{t('diff.noDiff')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('diff.sameContent', { branch: targetBranch })}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {diff.files.map((file: FileDiff, fileIdx: number) => (
                  <div key={file.path} id={`file-diff-${fileIdx}`} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
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
                      <div className="overflow-hidden">
                        {viewMode === 'unified' ? (
                          <UnifiedDiffView
                            hunks={file.hunks}
                            fileIdx={fileIdx}
                            selectedLine={selectedLine}
                            sourceBranch={diff?.sourceBranch || worktreeName}
                            targetBranch={targetBranch}
                          />
                        ) : (
                          <SplitDiffView
                            hunks={file.hunks}
                            fileIdx={fileIdx}
                            selectedLine={selectedLine}
                            sourceBranch={diff?.sourceBranch || worktreeName}
                            targetBranch={targetBranch}
                          />
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

      {/* AI 配置面板 */}
      <AIConfigPanel isOpen={showAIConfig} onClose={() => {
        setShowAIConfig(false)
        setShowConfigGuide(false)
      }} />
    </div>
  )
}
