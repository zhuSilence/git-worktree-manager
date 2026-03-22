import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { X, FileText, Plus, Minus, RefreshCw, GitCompare, ChevronDown, ChevronRight, Columns, AlignLeft, ArrowUp, GripVertical, Copy, Check, ChevronsDown, LayoutList, Folder, FolderOpen } from 'lucide-react'
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
  fillWidth?: boolean
}

type ViewMode = 'unified' | 'split'

const MIN_WIDTH = 400
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 600
const STORAGE_KEY = 'diff-sidebar-width'
const SPLIT_MIN_WIDTH = 700

// ─── 字符级差异算法 ───────────────────────────────────────────────
interface CharSegment {
  text: string
  highlight: boolean
}

function computeIntraLineDiff(oldStr: string, newStr: string): { oldSegments: CharSegment[]; newSegments: CharSegment[] } {
  // 找公共前缀
  let prefix = 0
  while (prefix < oldStr.length && prefix < newStr.length && oldStr[prefix] === newStr[prefix]) prefix++
  // 找公共后缀
  let oldEnd = oldStr.length
  let newEnd = newStr.length
  while (oldEnd > prefix && newEnd > prefix && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  const oldSegments: CharSegment[] = []
  const newSegments: CharSegment[] = []
  if (prefix > 0) {
    oldSegments.push({ text: oldStr.slice(0, prefix), highlight: false })
    newSegments.push({ text: newStr.slice(0, prefix), highlight: false })
  }
  if (oldEnd > prefix) oldSegments.push({ text: oldStr.slice(prefix, oldEnd), highlight: true })
  if (newEnd > prefix) newSegments.push({ text: newStr.slice(prefix, newEnd), highlight: true })
  if (oldEnd < oldStr.length) {
    oldSegments.push({ text: oldStr.slice(oldEnd), highlight: false })
    newSegments.push({ text: newStr.slice(newEnd), highlight: false })
  }
  return { oldSegments, newSegments }
}

/** 将 hunk 中连续的 deletion/addition 配对，计算字符级 diff */
function pairHunkLines(lines: DiffLine[]): Map<number, CharSegment[]> {
  const charMap = new Map<number, CharSegment[]>()
  let i = 0
  while (i < lines.length) {
    // 收集连续删除行
    const delStart = i
    while (i < lines.length && lines[i].lineType === 'deletion') i++
    const delEnd = i
    // 收集连续新增行
    const addStart = i
    while (i < lines.length && lines[i].lineType === 'addition') i++
    const addEnd = i
    // 1:1 配对
    const pairCount = Math.min(delEnd - delStart, addEnd - addStart)
    for (let p = 0; p < pairCount; p++) {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        lines[delStart + p].content,
        lines[addStart + p].content
      )
      charMap.set(delStart + p, oldSegments)
      charMap.set(addStart + p, newSegments)
    }
    // 跳过 context 行
    if (i === delStart) i++
  }
  return charMap
}

// ─── 简易语法着色 ─────────────────────────────────────────────────
interface SyntaxToken { text: string; type: 'keyword' | 'string' | 'comment' | 'number' | 'normal' }

const KEYWORDS = new Set([
  'import','export','from','const','let','var','function','return','if','else',
  'for','while','switch','case','break','continue','default','new','this',
  'class','extends','implements','interface','type','enum','struct','pub',
  'fn','mod','use','async','await','try','catch','finally','throw','yield',
  'true','false','null','undefined','void','typeof','instanceof','in','of',
  'static','readonly','private','public','protected','super','self','mut',
])

function tokenize(text: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = []
  // Regex: comments, strings, numbers, words, rest
  const re = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([\s\S])/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[1]) tokens.push({ text: m[0], type: 'comment' })
    else if (m[2]) tokens.push({ text: m[0], type: 'string' })
    else if (m[3]) tokens.push({ text: m[0], type: 'number' })
    else if (m[4]) tokens.push({ text: m[0], type: KEYWORDS.has(m[0]) ? 'keyword' : 'normal' })
    else tokens.push({ text: m[0], type: 'normal' })
  }
  return tokens
}

const syntaxColors: Record<string, string> = {
  keyword: 'text-purple-600 dark:text-purple-400',
  string: 'text-amber-700 dark:text-amber-300',
  comment: 'text-gray-400 dark:text-gray-500 italic',
  number: 'text-cyan-600 dark:text-cyan-400',
  normal: '',
}

// ─── 文件树数据结构 ──────────────────────────────────────────────
interface FileTreeNode {
  name: string
  fullPath: string
  isFile: boolean
  status?: string
  additions?: number
  deletions?: number
  children: FileTreeNode[]
}

function buildFileTree(files: FileDiff[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', fullPath: '', isFile: false, children: [] }

  for (const file of files) {
    const parts = file.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      let child = current.children.find(c => c.name === parts[i] && c.isFile === isLast)
      if (!child) {
        child = {
          name: parts[i],
          fullPath: parts.slice(0, i + 1).join('/'),
          isFile: isLast,
          children: [],
          ...(isLast ? { status: file.status, additions: file.additions, deletions: file.deletions } : {}),
        }
        current.children.push(child)
      }
      current = child
    }
  }

  // 压缩只有单个子目录的中间节点: a/ -> b/ -> c 变成 a/b/ -> c
  function compact(node: FileTreeNode): FileTreeNode {
    if (!node.isFile && node.children.length === 1 && !node.children[0].isFile) {
      const child = node.children[0]
      return compact({
        ...child,
        name: node.name ? `${node.name}/${child.name}` : child.name,
        children: child.children,
      })
    }
    return { ...node, children: node.children.map(compact) }
  }

  // 排序：目录在前，文件在后，同类按名称排序
  function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .map(n => ({ ...n, children: sortTree(n.children) }))
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }

  return sortTree(root.children.map(compact))
}

// ─── 文件树节点组件 ──────────────────────────────────────────────
function FileTreeNodeItem({
  node, depth, activeFile, onFileClick, expandedDirs, toggleDir,
}: {
  node: FileTreeNode
  depth: number
  activeFile: string | null
  onFileClick: (path: string) => void
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
}) {
  if (node.isFile) {
    return (
      <button
        onClick={() => onFileClick(node.fullPath)}
        className={clsx(
          'w-full text-left py-1 pr-2 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 transition-colors',
          activeFile === node.fullPath && 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.fullPath}
      >
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          node.status === 'added' && 'bg-green-500',
          node.status === 'deleted' && 'bg-red-500',
          node.status === 'modified' && 'bg-yellow-500',
          node.status === 'renamed' && 'bg-blue-500',
        )} />
        <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="truncate font-medium">{node.name}</span>
      </button>
    )
  }

  const isExpanded = expandedDirs.has(node.fullPath)
  return (
    <div>
      <button
        onClick={() => toggleDir(node.fullPath)}
        className="w-full text-left py-1 pr-2 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-400 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0 text-gray-400" />
        )}
        {isExpanded ? (
          <FolderOpen className="w-3 h-3 flex-shrink-0 text-yellow-500" />
        ) : (
          <Folder className="w-3 h-3 flex-shrink-0 text-yellow-500" />
        )}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
          {countFiles(node)}
        </span>
      </button>
      {isExpanded && node.children.map(child => (
        <FileTreeNodeItem
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onFileClick={onFileClick}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
        />
      ))}
    </div>
  )
}

function countFiles(node: FileTreeNode): number {
  if (node.isFile) return 1
  return node.children.reduce((sum, c) => sum + countFiles(c), 0)
}

export function DiffSidebar({ isOpen, onClose, worktreePath, worktreeName, branches = [], defaultBranch = 'main', fillWidth = false }: DiffSidebarProps) {
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
  }, [isOpen, worktreePath, targetBranch])

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
              disabled={width < SPLIT_MIN_WIDTH}
              className={clsx(
                'px-2 py-0.5 text-xs rounded flex items-center gap-1',
                viewMode === 'split'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400',
                width < SPLIT_MIN_WIDTH && 'opacity-40 cursor-not-allowed'
              )}
              title={width < SPLIT_MIN_WIDTH ? '窗口太窄，请拖宽后使用' : '拆分视图'}
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
            title={showFileTree ? '隐藏文件列表' : '显示文件列表'}
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
              文件 ({diff.files.length})
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
                      展开更多
                    </button>
                  )}
                  <button
                    onClick={toggleAll}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {expandedFiles.size === diff.files.length ? '全部收起' : '全部展开'}
                  </button>
                </div>
              </div>
            </div>

            {/* 文件列表 */}
            {diff.files.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                <p className="text-sm">没有发现差异</p>
                <p className="text-xs text-gray-400 mt-1">当前分支与 {targetBranch} 内容相同</p>
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
                          <UnifiedDiffView hunks={file.hunks} fileIdx={fileIdx} selectedLine={selectedLine} />
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
    </div>
  )
}

// 统一视图组件 — memo 避免其他文件展开/收起时重渲
const UnifiedDiffView = memo(function UnifiedDiffView({ hunks, fileIdx, selectedLine }: { hunks: DiffHunk[], fileIdx: number, selectedLine: string | null }) {
  return (
    <div className="font-mono text-xs overflow-x-auto">
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
                    isChange && 'hover:bg-opacity-80',
                  )}
                >
                  <span className={clsx(
                    'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                    line.lineType === 'deletion' ? 'bg-red-100 dark:bg-red-900/30 text-red-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                  )}>
                    {line.oldLine ?? ''}
                  </span>
                  <span className={clsx(
                    'w-12 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                    line.lineType === 'addition' ? 'bg-green-100 dark:bg-green-900/30 text-green-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                  )}>
                    {line.newLine ?? ''}
                  </span>
                  <span
                    className={clsx(
                      'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                      line.lineType === 'addition' && 'text-green-500 font-bold',
                      line.lineType === 'deletion' && 'text-red-500 font-bold',
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

// 拆分视图组件 — memo 避免其他文件展开/收起时重渲，支持左右同步滚动
const SplitDiffView = memo(function SplitDiffView({ hunks, fileIdx, selectedLine, sourceBranch, targetBranch }: { hunks: DiffHunk[], fileIdx: number, selectedLine: string | null, sourceBranch: string, targetBranch: string }) {
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
        // 先计算 char-level diff
        const charMap = pairHunkLines(hunk.lines)
        // 分离删除行和新增行，记录原始索引
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
              {/* Left side (old/target branch) */}
              <div className="w-1/2 flex flex-col">
                {/* 分支名称标识 */}
                <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
                  {targetBranch}
                </div>
                <div
                  ref={leftRef}
                  className="overflow-x-auto flex-1"
                  onScroll={() => handleScroll('left')}
                >
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
                          isSelected && 'ring-2 ring-purple-500 ring-inset',
                        )}
                      >
                        <span className={clsx(
                          'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                          line?.lineType === 'deletion' ? 'bg-red-100 dark:bg-red-900/30 text-red-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                        )}>
                          {line?.oldLine ?? ''}
                        </span>
                        <span
                          className={clsx(
                            'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                            line?.lineType === 'deletion' && 'text-red-500 font-bold',
                          )}
                        >
                          {line?.lineType === 'deletion' ? '-' : ' '}
                        </span>
                        <span className="flex-1 px-1 whitespace-pre text-[11px] leading-[22px] relative">
                          {line ? <HighlightedLine content={line.content} lineType={line.lineType} charSegments={segments} /> : ''}
                          {line && <CopyButton text={line.content} />}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Divider */}
              <div className="w-[3px] flex-shrink-0 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
              {/* Right side (new/source branch) */}
              <div className="w-1/2 flex flex-col">
                {/* 分支名称标识 */}
                <div className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 truncate">
                  {sourceBranch}
                </div>
                <div
                  ref={rightRef}
                  className="overflow-x-auto flex-1"
                  onScroll={() => handleScroll('right')}
                >
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
                        isSelected && 'ring-2 ring-purple-500 ring-inset',
                      )}
                    >
                      <span className={clsx(
                        'w-10 px-1 text-right text-[11px] leading-[22px] select-none border-r border-gray-200 dark:border-gray-700 font-mono',
                        line?.lineType === 'addition' ? 'bg-green-100 dark:bg-green-900/30 text-green-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
                      )}>
                        {line?.newLine ?? ''}
                      </span>
                      <span
                        className={clsx(
                          'w-5 px-0.5 text-center select-none text-[10px] leading-[22px]',
                          line?.lineType === 'addition' && 'text-green-500 font-bold',
                        )}
                      >
                        {line?.lineType === 'addition' ? '+' : ' '}
                      </span>
                      <span className="flex-1 px-1 whitespace-pre text-[11px] leading-[22px] relative">
                        {line ? <HighlightedLine content={line.content} lineType={line.lineType} charSegments={segments} /> : ''}
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

// 行内复制按钮
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
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

// 高亮行组件 - 支持字符级差异高亮 + 语法着色
function HighlightedLine({ content, lineType, charSegments }: { content: string; lineType: string; charSegments?: CharSegment[] }) {
  // 如果有字符级 diff segments，优先用它
  if (charSegments && charSegments.length > 0) {
    const hlClass = lineType === 'deletion'
      ? 'bg-red-200 dark:bg-red-800/60 rounded-sm px-[1px]'
      : 'bg-green-200 dark:bg-green-800/60 rounded-sm px-[1px]'
    const textClass = lineType === 'deletion'
      ? 'text-red-800 dark:text-red-300'
      : 'text-green-800 dark:text-green-300'
    return (
      <span className={textClass}>
        {charSegments.map((seg, i) => (
          <span key={i} className={seg.highlight ? hlClass : undefined}>{seg.text}</span>
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
          const color = syntaxColors[t.type]
          return color ? <span key={i} className={color}>{t.text}</span> : <span key={i}>{t.text}</span>
        })}
      </span>
    )
  }

  // addition / deletion 无 char-level 时——语法着色 + 基础色
  const baseClass = lineType === 'addition'
    ? 'text-green-800 dark:text-green-300'
    : lineType === 'deletion'
      ? 'text-red-800 dark:text-red-300'
      : ''
  const tokens = tokenize(content)
  return (
    <span className={baseClass}>
      {tokens.map((t, i) => {
        const color = syntaxColors[t.type]
        return color ? <span key={i} className={color}>{t.text}</span> : <span key={i}>{t.text}</span>
      })}
    </span>
  )
}