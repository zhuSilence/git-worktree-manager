import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronUp, ChevronDown, RegexIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

export interface SearchOptions {
  caseSensitive: boolean
  regex: boolean
}

export interface SearchMatch {
  fileIndex: number
  hunkIndex: number
  lineIndex: number
  filePath: string
}

interface DiffSearchProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (query: string, options: SearchOptions) => void
  onNavigate: (direction: 'next' | 'prev') => void
  currentMatch: number
  totalMatches: number
}

export function DiffSearch({
  isOpen,
  onClose,
  onSearch,
  onNavigate,
  currentMatch,
  totalMatches,
}: DiffSearchProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    regex: false,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  // 自动聚焦
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isOpen])

  // 清空查询时关闭
  const handleClose = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])

  // 查询变化时触发搜索
  useEffect(() => {
    if (isOpen) {
      onSearch(query, options)
    }
  }, [query, options, isOpen, onSearch])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (e.shiftKey) {
          onNavigate('prev')
        } else {
          onNavigate('next')
        }
        break
      case 'F3':
        e.preventDefault()
        if (e.shiftKey) {
          onNavigate('prev')
        } else {
          onNavigate('next')
        }
        break
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }, [onNavigate, handleClose])

  // 切换选项
  const toggleCaseSensitive = useCallback(() => {
    setOptions(prev => ({ ...prev, caseSensitive: !prev.caseSensitive }))
  }, [])

  const toggleRegex = useCallback(() => {
    setOptions(prev => ({ ...prev, regex: !prev.regex }))
  }, [])

  if (!isOpen) return null

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-2 shadow-sm">
      <div className="flex items-center gap-2">
        {/* 搜索图标 */}
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />

        {/* 搜索输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('diff.searchPlaceholder', 'Search in diff...')}
          className="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-transparent"
        />

        {/* 大小写敏感按钮 */}
        <button
          onClick={toggleCaseSensitive}
          className={clsx(
            'p-1 rounded transition-colors text-xs font-semibold',
            options.caseSensitive
              ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
          title={t('diff.caseSensitive', 'Case sensitive')}
        >
          Aa
        </button>

        {/* 正则按钮 */}
        <button
          onClick={toggleRegex}
          className={clsx(
            'p-1 rounded transition-colors',
            options.regex
              ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
          title={t('diff.useRegex', 'Use regular expression')}
        >
          <RegexIcon className="w-4 h-4" />
        </button>

        {/* 分隔线 */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* 匹配计数 */}
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[3rem] text-center">
          {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : '0/0'}
        </span>

        {/* 上一个按钮 */}
        <button
          onClick={() => onNavigate('prev')}
          disabled={totalMatches === 0}
          className={clsx(
            'p-1 rounded transition-colors',
            totalMatches > 0
              ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          )}
          title={t('diff.prevMatch', 'Previous match')}
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* 下一个按钮 */}
        <button
          onClick={() => onNavigate('next')}
          disabled={totalMatches === 0}
          className={clsx(
            'p-1 rounded transition-colors',
            totalMatches > 0
              ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          )}
          title={t('diff.nextMatch', 'Next match')}
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={t('common.close', 'Close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
