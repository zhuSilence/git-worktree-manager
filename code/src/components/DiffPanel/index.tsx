import { useState, useEffect } from 'react'
import { X, FileText, Plus, Minus, RefreshCw, GitCompare } from 'lucide-react'
import { gitService } from '@/services/git'
import type { DiffResponse, DiffStats } from '@/types/worktree'
import { clsx } from 'clsx'

interface DiffPanelProps {
  isOpen: boolean
  onClose: () => void
  worktreePath: string
  worktreeName: string
}

export function DiffPanel({ isOpen, onClose, worktreePath, worktreeName }: DiffPanelProps) {
  const [diff, setDiff] = useState<DiffResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetBranch, setTargetBranch] = useState('main')

  useEffect(() => {
    if (isOpen) {
      fetchDiff()
    }
  }, [isOpen, worktreePath, targetBranch])

  const fetchDiff = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await gitService.getDiff(worktreePath, targetBranch)
      setDiff(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取 diff 失败')
    } finally {
      setIsLoading(false)
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
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            {worktreeName} vs {targetBranch}
          </h2>
          <div className="flex items-center gap-2">
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
        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}
          
          {!isLoading && !error && diff && (
            <>
              {/* 统计概览 */}
              <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-1 text-sm">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{diff.filesChanged}</span>
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
              
              {/* 文件列表 */}
              {diff.files.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <GitCompare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>没有发现差异</p>
                  <p className="text-sm">当前分支与 {targetBranch} 相同</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {diff.files.map((file: DiffStats, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={clsx('text-xs font-medium px-1.5 py-0.5 rounded', getStatusColor(file.status), 'bg-current/10')}>
                          {getStatusLabel(file.status)}
                        </span>
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300" title={file.path}>
                          {file.path}
                        </span>
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
                        {file.additions === 0 && file.deletions === 0 && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* 底部 */}
        {!isLoading && !error && diff && diff.files.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              共 {diff.filesChanged} 个文件变更，+{diff.totalAdditions} 行，-{diff.totalDeletions} 行
            </p>
          </div>
        )}
      </div>
    </div>
  )
}