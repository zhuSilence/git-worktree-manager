import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, FileText, RefreshCw, GitCompare, GitMerge, ChevronDown, ChevronRight, Columns, AlignLeft, ArrowUp, GripVertical, ChevronsDown, LayoutList, Sparkles, SplitSquareVertical, File, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gitService } from '@/services/git'
import type { DetailedDiffResponse } from '@/types/worktree'
import { WorktreeStatus } from '@/types/worktree'
import { clsx } from 'clsx'
import { aiReviewStore } from '@/stores/aiReviewStore'
import { AIConfigPanel } from '@/components/AIConfigPanel'
import { MergePanel } from '@/components/MergePanel'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { diffCache } from '@/utils/diffCache'

// 拆分的子模块
import type {
  ViewMode,
  FileTreeNode,
} from './types'

import { ImageDiff } from './ImageDiff'

type WhitespaceMode = 'none' | 'all' | 'change'
import {
  buildFileTree,
  FileTreeNodeItem,
  sortFilesForDisplay,
} from './FileTree'
import { UnifiedDiffView, SplitDiffView } from './DiffViews'
import { FileReviewSummary } from './InlineReviewMarker'
import { AIReviewPanel } from './AIReviewPanel'
import { LazyRender } from './LazyRender'
import { DiffSearch } from './DiffSearch'
import type { SearchOptions, SearchMatch } from './DiffSearch'

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

import {
  MIN_SIDEBAR_WIDTH as MIN_WIDTH,
  MAX_SIDEBAR_WIDTH as MAX_WIDTH,
  DEFAULT_SIDEBAR_WIDTH as DEFAULT_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY as STORAGE_KEY,
  SPLIT_MIN_WIDTH,
  PROGRESSIVE_EXPAND_COUNT,
  FILE_STATUS_COLOR_MAP,
  FILE_STATUS_BG_COLOR_MAP,
} from './constants'

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
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(maxW, Math.max(MIN_WIDTH, parsed))
      }
    }
    return DEFAULT_WIDTH
  })
  const [isDragging, setIsDragging] = useState(false)
  const [showFileTree, setShowFileTree] = useState(true)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [showMergePanel, setShowMergePanel] = useState(false)
  const [enableFunctionAlign, setEnableFunctionAlign] = useState(true)
  // 空白过滤模式
  const [whitespaceMode, setWhitespaceMode] = useState<WhitespaceMode>('none')
  // 搜索状态
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  // 快捷键帮助面板状态
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  // 用于保存 setTimeout 的 timer ID，组件卸载时清理
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // 获取当前仓库信息
  const { currentRepo, worktrees, refreshWorktrees } = useWorktreeStore()

  // AI 评审状态
  const reviewStatus = aiReviewStore((state) => state.reviewStatus)
  const currentResult = aiReviewStore((state) => state.currentResult)
  const performReview = aiReviewStore((state) => state.performReview)
  const reReview = aiReviewStore((state) => state.reReview)
  const showConfigGuide = aiReviewStore((state) => state.showConfigGuide)
  const setShowConfigGuide = aiReviewStore((state) => state.setShowConfigGuide)
  const ignoreIssue = aiReviewStore((state) => state.ignoreIssue)
  const [showAIReviewPanel, setShowAIReviewPanel] = useState(false)

  // 清理所有 scroll timer（防止内存泄漏）
  useEffect(() => {
    return () => {
      scrollTimerRef.current.forEach(clearTimeout)
      scrollTimerRef.current = []
    }
  }, [])

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

  useEffect(() => {
    if (isOpen) {
      fetchDiff()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDiff defined below, stable due to its dependencies being in this array
  }, [isOpen, worktreePath, targetBranch, refreshToken, whitespaceMode])

  const fetchDiff = useCallback(async (forceRefresh = false) => {
    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
      const cached = diffCache.get(worktreePath, targetBranch, whitespaceMode)
      if (cached) {
        setDiff(cached)
        setExpandedFiles(new Set())
        return
      }
    }

    setIsLoading(true)
    setError(null)
    setSelectedLine(null)
    try {
      const result = await gitService.getDetailedDiff(worktreePath, targetBranch, whitespaceMode)
      setDiff(result)
      // 默认全部收起，避免大量文件同时渲染卡顿
      setExpandedFiles(new Set())

      // 存入缓存
      diffCache.set(worktreePath, targetBranch, whitespaceMode, result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('diff.fetchFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [worktreePath, targetBranch, whitespaceMode, t])

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(path)) {
        newExpanded.delete(path)
      } else {
        newExpanded.add(path)
      }
      return newExpanded
    })
  }, [])

  // 对文件进行排序，与文件树显示顺序一致
  const sortedFiles = useMemo(() => {
    if (!diff) return []
    return sortFilesForDisplay(diff.files)
  }, [diff])

  // 构建文件树
  const fileTree = useMemo(() => {
    if (!diff) return []
    return buildFileTree(diff.files)
  }, [diff])

  const toggleAll = useCallback(() => {
    setExpandedFiles(prev => {
      if (diff) {
        if (prev.size === sortedFiles.length) {
          return new Set()
        } else {
          return new Set(sortedFiles.map(({ file }) => file.path))
        }
      }
      return prev
    })
  }, [diff, sortedFiles])

  // diff 变为 null 时重置展开状态
  useEffect(() => {
    if (!diff) {
      setExpandedDirs(new Set())
    }
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
    const timerId = setTimeout(() => {
      const el = document.getElementById(`file-diff-${fileIdx}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
    scrollTimerRef.current.push(timerId)
  }

  const scrollToLine = (fileIdx: number, hunkIdx: number, lineIdx: number) => {
    const id = `diff-${fileIdx}-${hunkIdx}-${lineIdx}`
    setSelectedLine(id)

    // 尝试滚动到目标元素，支持懒加载场景的重试
    const tryScroll = (attempts = 0) => {
      const element = document.getElementById(id)
      if (element && scrollRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return true
      }
      // 元素可能还未渲染（懒加载中），最多重试 10 次（约 500ms）
      if (attempts < 10) {
        const timerId = setTimeout(() => tryScroll(attempts + 1), 50)
        scrollTimerRef.current.push(timerId)
      }
      return false
    }

    // 先立即尝试一次
    if (!tryScroll()) {
      // 如果立即失败，延迟一点再试（给 IntersectionObserver 触发渲染的时间）
      const timerId = setTimeout(() => tryScroll(0), 100)
      scrollTimerRef.current.push(timerId)
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

  // 导航到指定文件和行
  const navigateToFileLine = (filePath: string, _line: number) => {
    if (!diff) return
    // 使用更精确的路径匹配：完整匹配或带路径分隔符的后缀匹配
    const fileIdx = diff.files.findIndex(f =>
      f.path === filePath ||
      f.path.endsWith('/' + filePath) ||
      filePath.endsWith('/' + f.path)
    )
    if (fileIdx < 0) return

    const file = diff.files[fileIdx]
    // 展开文件
    setExpandedFiles(prev => new Set([...prev, file.path]))
    setActiveFile(file.path)

    // 滚动到文件
    const timerId = setTimeout(() => {
      const el = document.getElementById(`file-diff-${fileIdx}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
    scrollTimerRef.current.push(timerId)
  }

  const jumpToNextChange = useCallback(() => {
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
  }, [diff, selectedLine])

  const jumpToPrevChange = useCallback(() => {
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
  }, [diff, selectedLine])

  // 跳转到下一个/上一个文件
  const jumpToNextFile = useCallback(() => {
    if (!diff || sortedFiles.length === 0) return

    // 找到当前选中行所在的文件索引
    let currentFileIdx = -1
    if (selectedLine) {
      const match = selectedLine.match(/diff-(\d+)-/)
      if (match) {
        currentFileIdx = parseInt(match[1], 10)
      }
    }

    // 找到 sortedFiles 中当前文件的位置，跳到下一个
    let sortedIdx = -1
    for (let i = 0; i < sortedFiles.length; i++) {
      if (sortedFiles[i].originalIndex === currentFileIdx) {
        sortedIdx = i
        break
      }
    }

    const nextIdx = sortedIdx + 1 < sortedFiles.length ? sortedIdx + 1 : 0
    const nextFile = sortedFiles[nextIdx]

    if (nextFile) {
      setExpandedFiles(prev => new Set([...prev, nextFile.file.path]))
      setActiveFile(nextFile.file.path)
      const timerId = setTimeout(() => {
        const el = document.getElementById(`file-diff-${nextFile.originalIndex}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
      scrollTimerRef.current.push(timerId)
    }
  }, [diff, sortedFiles, selectedLine])

  const jumpToPrevFile = useCallback(() => {
    if (!diff || sortedFiles.length === 0) return

    // 找到当前选中行所在的文件索引
    let currentFileIdx = -1
    if (selectedLine) {
      const match = selectedLine.match(/diff-(\d+)-/)
      if (match) {
        currentFileIdx = parseInt(match[1], 10)
      }
    }

    // 找到 sortedFiles 中当前文件的位置，跳到上一个
    let sortedIdx = -1
    for (let i = 0; i < sortedFiles.length; i++) {
      if (sortedFiles[i].originalIndex === currentFileIdx) {
        sortedIdx = i
        break
      }
    }

    const prevIdx = sortedIdx > 0 ? sortedIdx - 1 : sortedFiles.length - 1
    const prevFile = sortedFiles[prevIdx]

    if (prevFile) {
      setExpandedFiles(prev => new Set([...prev, prevFile.file.path]))
      setActiveFile(prevFile.file.path)
      const timerId = setTimeout(() => {
        const el = document.getElementById(`file-diff-${prevFile.originalIndex}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
      scrollTimerRef.current.push(timerId)
    }
  }, [diff, sortedFiles, selectedLine])

  // 跳转到下一个/上一个 Hunk
  const jumpToNextHunk = useCallback(() => {
    if (!diff) return

    // 解析当前位置
    let currentFIdx = -1, currentHIdx = -1
    if (selectedLine) {
      const match = selectedLine.match(/diff-(\d+)-(\d+)-/)
      if (match) {
        currentFIdx = parseInt(match[1], 10)
        currentHIdx = parseInt(match[2], 10)
      }
    }

    // 遍历所有文件的 hunks，找到当前位置之后的下一个 hunk
    for (let fIdx = 0; fIdx < diff.files.length; fIdx++) {
      const file = diff.files[fIdx]
      const startHIdx = (fIdx === currentFIdx && currentHIdx >= 0) ? currentHIdx + 1 : 0

      for (let hIdx = startHIdx; hIdx < file.hunks.length; hIdx++) {
        // 找到了下一个 hunk，滚动到它的 header
        setExpandedFiles(prev => new Set([...prev, file.path]))
        setActiveFile(file.path)
        const timerId = setTimeout(() => {
          const el = document.getElementById(`file-diff-${fIdx}`)
          if (el) {
            // 尝试找到 hunk 的 header 元素
            const hunkHeader = el.querySelector(`[data-hunk-idx="${hIdx}"]`)
            if (hunkHeader) {
              hunkHeader.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }, 50)
        scrollTimerRef.current.push(timerId)
        return
      }
    }

    // 如果到末尾了，回到第一个 hunk
    if (diff.files.length > 0 && diff.files[0].hunks.length > 0) {
      const firstFile = diff.files[0]
      setExpandedFiles(prev => new Set([...prev, firstFile.path]))
      setActiveFile(firstFile.path)
      const timerId = setTimeout(() => {
        const el = document.getElementById(`file-diff-0`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 50)
      scrollTimerRef.current.push(timerId)
    }
  }, [diff, selectedLine])

  const jumpToPrevHunk = useCallback(() => {
    if (!diff) return

    // 解析当前位置
    let currentFIdx = -1, currentHIdx = -1
    if (selectedLine) {
      const match = selectedLine.match(/diff-(\d+)-(\d+)-/)
      if (match) {
        currentFIdx = parseInt(match[1], 10)
        currentHIdx = parseInt(match[2], 10)
      }
    }

    // 从后往前遍历所有文件的 hunks，找到当前位置之前的上一个 hunk
    for (let fIdx = diff.files.length - 1; fIdx >= 0; fIdx--) {
      const file = diff.files[fIdx]
      const endHIdx = (fIdx === currentFIdx && currentHIdx >= 0) ? currentHIdx - 1 : file.hunks.length - 1

      for (let hIdx = endHIdx; hIdx >= 0; hIdx--) {
        // 找到了上一个 hunk
        setExpandedFiles(prev => new Set([...prev, file.path]))
        setActiveFile(file.path)
        const timerId = setTimeout(() => {
          const el = document.getElementById(`file-diff-${fIdx}`)
          if (el) {
            const hunkHeader = el.querySelector(`[data-hunk-idx="${hIdx}"]`)
            if (hunkHeader) {
              hunkHeader.scrollIntoView({ behavior: 'smooth', block: 'start' })
            } else {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }
        }, 50)
        scrollTimerRef.current.push(timerId)
        return
      }
    }

    // 如果到开头了，回到最后一个 hunk
    const lastFIdx = diff.files.length - 1
    const lastFile = diff.files[lastFIdx]
    if (lastFile && lastFile.hunks.length > 0) {
      const lastHIdx = lastFile.hunks.length - 1
      setExpandedFiles(prev => new Set([...prev, lastFile.path]))
      setActiveFile(lastFile.path)
      const timerId = setTimeout(() => {
        const el = document.getElementById(`file-diff-${lastFIdx}`)
        if (el) {
          const hunkHeader = el.querySelector(`[data-hunk-idx="${lastHIdx}"]`)
          if (hunkHeader) {
            hunkHeader.scrollIntoView({ behavior: 'smooth', block: 'start' })
          } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }
      }, 50)
      scrollTimerRef.current.push(timerId)
    }
  }, [diff, selectedLine])

  // 搜索功能
  const performSearch = useCallback((query: string, options: SearchOptions) => {
    if (!query || !diff) {
      setSearchMatches([])
      setCurrentMatchIndex(0)
      return
    }

    const matches: SearchMatch[] = []
    let searchRegex: RegExp

    try {
      if (options.regex) {
        searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi')
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        searchRegex = new RegExp(escaped, options.caseSensitive ? 'g' : 'gi')
      }
    } catch {
      // 无效正则，静默忽略
      setSearchMatches([])
      setCurrentMatchIndex(0)
      return
    }

    diff.files.forEach((file, fIdx) => {
      file.hunks.forEach((hunk, hIdx) => {
        hunk.lines.forEach((line, lIdx) => {
          if (searchRegex.test(line.content)) {
            matches.push({
              fileIndex: fIdx,
              hunkIndex: hIdx,
              lineIndex: lIdx,
              filePath: file.path,
            })
          }
          searchRegex.lastIndex = 0 // 重置 lastIndex
        })
      })
    })

    setSearchMatches(matches)
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1)

    // 自动展开包含匹配的文件
    if (matches.length > 0) {
      const filePaths = new Set(matches.map((m) => m.filePath))
      setExpandedFiles((prev) => new Set([...prev, ...filePaths]))
    }
  }, [diff])

  // 导航到搜索匹配项
  const navigateToSearchMatch = useCallback((direction: 'next' | 'prev') => {
    if (searchMatches.length === 0) return

    let newIndex: number
    if (direction === 'next') {
      newIndex = (currentMatchIndex + 1) % searchMatches.length
    } else {
      newIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length
    }

    const match = searchMatches[newIndex]
    setCurrentMatchIndex(newIndex)

    // 展开文件
    setExpandedFiles((prev) => new Set([...prev, match.filePath]))

    // 滚动到匹配行
    scrollToLine(match.fileIndex, match.hunkIndex, match.lineIndex)
  }, [searchMatches, currentMatchIndex])

  // 键盘快捷键 - 必须在所有回调函数定义之后
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + F 打开搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      // 搜索框打开时的快捷键
      if (searchOpen) {
        if (e.key === 'F3') {
          e.preventDefault()
          if (e.shiftKey) {
            navigateToSearchMatch('prev')
          } else {
            navigateToSearchMatch('next')
          }
          return
        }
        // Escape 在搜索框组件内处理
        return
      }

      // 在 input/textarea/select 或可编辑元素中不触发
      const target = e.target as HTMLElement
      const tagName = target.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) {
        return
      }
      switch (e.key) {
        case 'n': jumpToNextChange(); break
        case 'p': jumpToPrevChange(); break
        case 'e': toggleAll(); break
        case 'Escape':
          if (showShortcutHelp) {
            setShowShortcutHelp(false)
          } else {
            onClose()
          }
          break
        case 'f':
        case 'F':
          // Shift+F: 上一个文件
          if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            jumpToPrevFile()
          }
          // F (无修饰键): 下一个文件
          else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            jumpToNextFile()
          }
          break
        case '[':
          e.preventDefault()
          jumpToPrevHunk()
          break
        case ']':
          e.preventDefault()
          jumpToNextHunk()
          break
        case '?':
          e.preventDefault()
          setShowShortcutHelp(prev => !prev)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, jumpToNextChange, jumpToPrevChange, toggleAll, searchOpen, navigateToSearchMatch, jumpToNextFile, jumpToPrevFile, jumpToNextHunk, jumpToPrevHunk, showShortcutHelp])

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    return FILE_STATUS_COLOR_MAP[status] || 'text-gray-500'
  }

  const getStatusBgColor = (status: string) => {
    return FILE_STATUS_BG_COLOR_MAP[status] || 'bg-gray-500/10'
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
                  // 已有结果时切换显示评审面板
                  setShowAIReviewPanel(!showAIReviewPanel)
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
            title={reviewStatus === 'success' && currentResult ? t('diff.toggleReviewPanel') : t('diff.aiReview')}
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

          {/* 合并按钮 */}
          <button
            onClick={() => setShowMergePanel(true)}
            className="p-1.5 rounded transition-colors flex items-center gap-1 text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            title={t('diff.mergeToTarget', { branch: targetBranch })}
          >
            <GitMerge className="w-3.5 h-3.5" />
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

          {/* 空白过滤下拉 */}
          <select
            value={whitespaceMode}
            onChange={(e) => setWhitespaceMode(e.target.value as WhitespaceMode)}
            className="text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300"
            title={t('diff.whitespaceFilter')}
          >
            <option value="none">{t('diff.showWhitespace')}</option>
            <option value="change">{t('diff.ignoreWhitespaceChange')}</option>
            <option value="all">{t('diff.ignoreAllWhitespace')}</option>
          </select>

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

          {/* 函数对齐开关 */}
          {viewMode === 'split' && (
            <button
              onClick={() => setEnableFunctionAlign(!enableFunctionAlign)}
              className={clsx(
                'p-1 rounded transition-colors',
                enableFunctionAlign
                  ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              )}
              title={enableFunctionAlign ? t('diff.disableFunctionAlign', '关闭函数对齐') : t('diff.enableFunctionAlign', '开启函数对齐')}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
          )}

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
            onClick={() => {
              diffCache.invalidate(worktreePath, targetBranch, whitespaceMode)
              fetchDiff(true)
            }}
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

      {/* 快捷键帮助面板 */}
      {showShortcutHelp && (
        <div className="absolute top-16 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-64">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('diff.keyboardShortcuts')}</h3>
            <button onClick={() => setShowShortcutHelp(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">n</kbd><span>{t('diff.nextChange')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">p</kbd><span>{t('diff.prevChange')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">f</kbd><span>{t('diff.nextFile')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">Shift+F</kbd><span>{t('diff.prevFile')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">]</kbd><span>{t('diff.nextHunk')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">[</kbd><span>{t('diff.prevHunk')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">e</kbd><span>{t('diff.toggleAll')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">Ctrl+F</kbd><span>{t('diff.search')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">?</kbd><span>{t('diff.showHelp')}</span></div>
            <div className="flex justify-between items-center"><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-900 dark:text-gray-100">Esc</kbd><span>{t('diff.close')}</span></div>
          </div>
        </div>
      )}

      {/* 内容 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 文件树面板 */}
        {showFileTree && !isLoading && !error && diff && sortedFiles.length > 0 && (
          <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
            <div className="p-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              {t('diff.files')} ({sortedFiles.length})
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
        {/* 搜索组件 */}
        <DiffSearch
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={performSearch}
          onNavigate={navigateToSearchMatch}
          currentMatch={currentMatchIndex}
          totalMatches={searchMatches.length}
        />
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
            <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              {/* 第一行：文件数、行数变更、比例条 */}
              <div className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 text-xs">
                  {/* 文件数 */}
                  <div className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    <span className="font-medium">{sortedFiles.length}</span>
                    <span className="text-gray-500">{t('diff.files')}</span>
                  </div>
                  {/* 行数变更 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-green-600 dark:text-green-400 font-medium">+{diff.totalAdditions}</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">-{diff.totalDeletions}</span>
                  </div>
                  {/* 变更比例条 */}
                  <div className="flex h-2 w-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                    <div
                      className="bg-green-500 h-full transition-all duration-300"
                      style={{ width: `${(diff.totalAdditions / (diff.totalAdditions + diff.totalDeletions || 1)) * 100}%` }}
                    />
                    <div
                      className="bg-red-500 h-full transition-all duration-300"
                      style={{ width: `${(diff.totalDeletions / (diff.totalAdditions + diff.totalDeletions || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {expandedFiles.size < sortedFiles.length && sortedFiles.length > 5 && (
                    <button
                      onClick={() => {
                        // 渐进式展开：每次展开固定数量（按排序后的顺序）
                        setExpandedFiles(prev => {
                          const next = new Set(prev)
                          let count = 0
                          for (const { file } of sortedFiles) {
                            if (!next.has(file.path)) {
                              next.add(file.path)
                              count++
                              if (count >= PROGRESSIVE_EXPAND_COUNT) break
                            }
                          }
                          return next
                        })
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
                    {expandedFiles.size === sortedFiles.length ? t('diff.collapseAll') : t('diff.expandAll')}
                  </button>
                </div>
              </div>
              {/* 第二行：文件类型计数 */}
              <div className="flex items-center gap-3 px-2 py-1 text-xs">
                {(() => {
                  const addedFiles = diff.files.filter(f => f.status === 'added').length
                  const modifiedFiles = diff.files.filter(f => f.status === 'modified').length
                  const deletedFiles = diff.files.filter(f => f.status === 'deleted').length
                  const renamedFiles = diff.files.filter(f => f.status === 'renamed').length
                  return (
                    <>
                      {addedFiles > 0 && (
                        <span className="text-green-600 dark:text-green-400">
                          <span className="font-medium">{addedFiles}</span> {t('diff.added')}
                        </span>
                      )}
                      {modifiedFiles > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          <span className="font-medium">{modifiedFiles}</span> {t('diff.modified')}
                        </span>
                      )}
                      {deletedFiles > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          <span className="font-medium">{deletedFiles}</span> {t('diff.deleted')}
                        </span>
                      )}
                      {renamedFiles > 0 && (
                        <span className="text-blue-600 dark:text-blue-400">
                          <span className="font-medium">{renamedFiles}</span> {t('diff.renamed')}
                        </span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>

            {/* 文件列表 */}
            {sortedFiles.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <GitCompare className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                <p className="text-sm">{t('diff.noDiff')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('diff.sameContent', { branch: targetBranch })}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedFiles.map(({ file, originalIndex }) => (
                  <div key={file.path} id={`file-diff-${originalIndex}`} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
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
                        {/* 变更来源标签 */}
                        {file.source && file.source !== 'committed' && (
                          <span className={clsx(
                            'text-xs px-1 py-0.5 rounded whitespace-nowrap flex-shrink-0',
                            file.source === 'untracked'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          )}>
                            {file.source === 'untracked' ? t('diff.statusUntracked') : t('diff.statusWorkspace')}
                          </span>
                        )}
                        {/* 二进制文件标签 */}
                        {file.isBinary && (
                          <span className="text-xs px-1 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            binary
                          </span>
                        )}
                        <span className="truncate text-xs text-gray-700 dark:text-gray-300 font-medium" title={file.path}>
                          {file.path}
                        </span>
                        {/* 文件评审摘要 */}
                        <FileReviewSummary result={currentResult} filePath={file.path} />

                      </div>
                      <div className="flex items-center gap-2 text-xs ml-3">
                        {file.additions > 0 && (
                          <span className="text-green-500">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-red-500">-{file.deletions}</span>
                        )}
                        {/* 文件变更比例条 */}
                        {(file.additions > 0 || file.deletions > 0) && (
                          <div className="flex h-1.5 w-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 ml-1">
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: `${(file.additions / (file.additions + file.deletions || 1)) * 100}%` }}
                            />
                            <div
                              className="bg-red-500 h-full"
                              style={{ width: `${(file.deletions / (file.additions + file.deletions || 1)) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 文件内容 */}
                    {expandedFiles.has(file.path) && (
                      <div className="overflow-hidden">
                        {file.isImage ? (
                          <ImageDiff
                            oldImageBase64={file.oldImageBase64}
                            newImageBase64={file.newImageBase64}
                            filePath={file.path}
                            status={file.status}
                          />
                        ) : file.isTooLarge ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <AlertTriangle className="w-6 h-6 mb-2 text-amber-500" />
                            <span className="text-sm">{t('diff.fileTooLarge')}</span>
                            <span className="text-xs mt-1 text-gray-400">{t('diff.fileTooLargeHint')}</span>
                          </div>
                        ) : file.isBinary ? (
                          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <File className="w-5 h-5 mr-2" />
                            <span className="text-sm">{t('diff.binaryFileChanged', 'Binary file changed')}</span>
                          </div>
                        ) : (
                          <LazyRender
                            estimatedHeight={Math.min(file.hunks.reduce((sum, h) => sum + 28 + h.lines.length * 22, 0), 800)}
                            rootMargin="300px"
                            keepOnceRendered={true}
                          >
                            {viewMode === 'unified' ? (
                              <UnifiedDiffView
                                hunks={file.hunks}
                                fileIdx={originalIndex}
                                selectedLine={selectedLine}
                                sourceBranch={diff?.sourceBranch || worktreeName}
                                targetBranch={targetBranch}
                                reviewResult={currentResult}
                                filePath={file.path}
                              />
                            ) : (
                              <SplitDiffView
                                hunks={file.hunks}
                                fileIdx={originalIndex}
                                selectedLine={selectedLine}
                                sourceBranch={diff?.sourceBranch || worktreeName}
                                targetBranch={targetBranch}
                                reviewResult={currentResult}
                                filePath={file.path}
                                enableFunctionAlign={enableFunctionAlign}
                              />
                            )}
                          </LazyRender>
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

      {/* AI 评审结果面板 */}
      {showAIReviewPanel && currentResult && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-30 overflow-auto shadow-lg">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between">
            <span className="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              AI 评审结果
            </span>
            <button
              onClick={() => setShowAIReviewPanel(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-3">
            <AIReviewPanel
              result={currentResult}
              isLoading={reviewStatus === 'loading'}
              error={aiReviewStore.getState().error}
              onReReview={() => reReview({ worktreePath, targetBranch })}
              onNavigateToLine={navigateToFileLine}
              onIgnoreIssue={ignoreIssue}
            />
          </div>
        </div>
      )}

      {/* AI 配置面板 */}
      <AIConfigPanel isOpen={showAIConfig} onClose={() => {
        setShowAIConfig(false)
        setShowConfigGuide(false)
      }} />

      {/* 合并面板 */}
      {currentRepo && (
        <MergePanel
          isOpen={showMergePanel}
          onClose={() => setShowMergePanel(false)}
          repoPath={currentRepo.path}
          sourceWorktree={{
            id: worktreePath,
            name: worktreeName,
            branch: diff?.sourceBranch || worktreeName,
            path: worktreePath,
            status: WorktreeStatus.Clean,
            lastCommit: { hash: '', message: '', author: '', timestamp: 0 },
            lastActiveAt: null,
            isMain: false,
            syncStatus: { ahead: 0, behind: 0, hasRemote: false },
          }}
          targetWorktrees={worktrees.filter(w => w.path !== worktreePath)}
          onMergeComplete={() => {
            refreshWorktrees()
            fetchDiff()
          }}
        />
      )}
    </div>
  )
}
