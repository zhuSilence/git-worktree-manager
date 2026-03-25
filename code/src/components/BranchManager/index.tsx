import { useState, useRef, useEffect, useMemo } from 'react'
import { X, GitBranch, Plus, Download, RefreshCw, Search, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { gitService } from '@/services/git'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { clsx } from 'clsx'

interface BranchManagerProps {
  isOpen: boolean
  onClose: () => void
  worktreePath: string
  worktreeBranch: string
  branches: { name: string; isCurrent: boolean }[]
}

// ─── 可搜索的分支下拉组件 ─────────────────────────────────────────
interface BranchComboBoxProps {
  value: string
  onChange: (value: string) => void
  branches: { name: string; isCurrent: boolean }[]
  placeholder?: string
  excludeCurrent?: boolean
}

function BranchComboBox({ value, onChange, branches, placeholder, excludeCurrent = false }: BranchComboBoxProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 同步外部 value
  useEffect(() => { setQuery(value) }, [value])

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    let list = excludeCurrent ? branches.filter(b => !b.isCurrent) : branches
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(b => b.name.toLowerCase().includes(q))
    }
    return list
  }, [branches, query, excludeCurrent])

  const handleSelect = (name: string) => {
    setQuery(name)
    onChange(name)
    setIsOpen(false)
  }

  const handleInputChange = (text: string) => {
    setQuery(text)
    onChange(text)
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || t('branchManager.inputOrSelect')}
          className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={() => { setIsOpen(!isOpen); inputRef.current?.focus() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronDown className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">{t('branchManager.noMatch')}</div>
          ) : (
            filtered.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => handleSelect(b.name)}
                className={clsx(
                  'w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors truncate',
                  b.name === value
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'text-gray-700 dark:text-gray-300'
                )}
              >
                {b.name}
                {b.isCurrent && <span className="ml-2 text-xs text-gray-400">{t('branchManager.current')}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function BranchManager({ isOpen, onClose, worktreePath, worktreeBranch, branches }: BranchManagerProps) {
  const { t } = useTranslation()
  const { refreshWorktrees } = useWorktreeStore()
  const [mode, setMode] = useState<'switch' | 'create' | 'fetch'>('switch')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [remoteBranch, setRemoteBranch] = useState('')
  const [localBranchName, setLocalBranchName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!isOpen) return null

  const handleSwitchBranch = async () => {
    if (!selectedBranch) return
    setIsLoading(true)
    setMessage(null)
    try {
      const result = await gitService.switchBranch(worktreePath, selectedBranch)
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await refreshWorktrees()
        setTimeout(onClose, 1500)
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('branchManager.switchFailed') })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateBranch = async () => {
    if (!newBranchName) return
    setIsLoading(true)
    setMessage(null)
    try {
      const result = await gitService.createBranch(worktreePath, newBranchName, baseBranch || undefined)
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await refreshWorktrees()
        setTimeout(onClose, 1500)
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('branchManager.createFailed') })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFetchRemoteBranch = async () => {
    if (!remoteBranch) return
    setIsLoading(true)
    setMessage(null)
    try {
      const result = await gitService.fetchRemoteBranch(worktreePath, remoteBranch, localBranchName || undefined)
      if (result.success) {
        setMessage({ type: 'success', text: result.message })
        await refreshWorktrees()
        setTimeout(onClose, 1500)
      } else {
        setMessage({ type: 'error', text: result.message })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('branchManager.fetchFailed') })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            {t('branchManager.title')}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setMode('switch')}
            className={clsx(
              'flex-1 py-2 text-sm font-medium transition-colors',
              mode === 'switch'
                ? 'text-green-600 dark:text-green-400 border-b-2 border-green-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t('branchManager.switchBranch')}
          </button>
          <button
            onClick={() => setMode('create')}
            className={clsx(
              'flex-1 py-2 text-sm font-medium transition-colors',
              mode === 'create'
                ? 'text-green-600 dark:text-green-400 border-b-2 border-green-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t('branchManager.createBranch')}
          </button>
          <button
            onClick={() => setMode('fetch')}
            className={clsx(
              'flex-1 py-2 text-sm font-medium transition-colors',
              mode === 'fetch'
                ? 'text-green-600 dark:text-green-400 border-b-2 border-green-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t('branchManager.fetchRemote')}
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {mode === 'switch' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('branchManager.selectBranch')}
                </label>
                <BranchComboBox
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  branches={branches}
                  excludeCurrent
                  placeholder={t('branchManager.inputOrSelect')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('branchManager.currentBranch')}: {worktreeBranch}
                </p>
              </div>
              <button
                onClick={handleSwitchBranch}
                disabled={!selectedBranch || isLoading}
                className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                {t('branchManager.switch')}
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('branchManager.newBranchName')}
                </label>
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/new-feature"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('branchManager.baseBranchOptional')}
                </label>
                <BranchComboBox
                  value={baseBranch}
                  onChange={setBaseBranch}
                  branches={branches}
                  placeholder={`${t('branchManager.default')}: ${worktreeBranch}`}
                />
              </div>
              <button
                onClick={handleCreateBranch}
                disabled={!newBranchName || isLoading}
                className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('branchManager.createAndSwitch')}
              </button>
            </div>
          )}

          {mode === 'fetch' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('branchManager.remoteBranchName')}
                </label>
                <input
                  type="text"
                  value={remoteBranch}
                  onChange={(e) => setRemoteBranch(e.target.value)}
                  placeholder="origin/feature"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('branchManager.localBranchNameOptional')}
                </label>
                <input
                  type="text"
                  value={localBranchName}
                  onChange={(e) => setLocalBranchName(e.target.value)}
                  placeholder={t('branchManager.defaultRemoteName')}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={handleFetchRemoteBranch}
                disabled={!remoteBranch || isLoading}
                className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t('branchManager.fetchAndSwitch')}
              </button>
            </div>
          )}

          {/* 消息 */}
          {message && (
            <div className={clsx(
              'mt-4 p-3 rounded-lg text-sm',
              message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            )}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}