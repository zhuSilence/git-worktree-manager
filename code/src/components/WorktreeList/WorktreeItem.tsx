import { useState, useEffect, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Worktree } from '@/types/worktree'
import { StatusBadge } from './StatusBadge'
import { TagBadge, getTagDef } from './TagBadge'
import { TagEditor } from './TagEditor'
import { GroupSelector } from '@/components/GroupPanel/GroupSelector'
import { Folder, ExternalLink, Terminal, Trash2, GitCompare, GitBranch, ArrowUp, ArrowDown, Check, GitMerge, Tag, MessageSquare, Clock, AlertTriangle, Copy } from 'lucide-react'
import { gitService } from '@/services/git'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { settingsStore } from '@/stores/settingsStore'
import { BranchManager } from '@/components/BranchManager'
import { getAnnotation, saveAnnotation, PRESET_TAGS } from '@/services/annotations'
import { checkIdleStatus } from '@/utils/idleDetection'
import { useErrorHandler } from '@/hooks/useToast'
import type { WorktreeAnnotation, TagDefinition } from '@/types/annotation'
import { clsx } from 'clsx'

interface WorktreeItemProps {
  worktree: Worktree
  branches: { name: string; isCurrent: boolean }[]
  repoPath: string
  currentGroupId?: string | null
  onShowDiff?: (path: string, name: string) => void
  isMerged?: boolean
  onTagsChange?: () => void
  onOpenGroupPanel?: () => void
}

export const WorktreeItem = memo(function WorktreeItem({ worktree, branches, repoPath, currentGroupId, onShowDiff, isMerged = false, onTagsChange, onOpenGroupPanel }: WorktreeItemProps) {
  const { t } = useTranslation()
  const { deleteWorktree, refreshWorktrees } = useWorktreeStore()
  const { setWorktreeGroup } = useGroupsStore()
  const { defaultIde, defaultTerminal, customIdePath, customTerminalPath, enableIdleDetection, idleThresholdDays } = settingsStore()
  const { handleError, toast } = useErrorHandler()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showBranchManager, setShowBranchManager] = useState(false)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [annotation, setAnnotation] = useState<WorktreeAnnotation | null>(null)
  const [copiedField, setCopiedField] = useState<'branch' | 'path' | null>(null)

  const handleCopy = async (text: string, field: 'branch' | 'path') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(t('common.copied'))
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      handleError(error, t('errors.copyFailed'))
    }
  }

  // 加载标注信息
  useEffect(() => {
    setAnnotation(getAnnotation(worktree.path))
  }, [worktree.path])

  // 检测空闲状态
  const idleStatus = enableIdleDetection && !worktree.isMain
    ? checkIdleStatus(worktree.lastActiveAt, idleThresholdDays)
    : null

  const handleOpenInTerminal = async () => {
    try {
      await gitService.openInTerminal(worktree.path, defaultTerminal, customTerminalPath)
    } catch (error) {
      handleError(error, t('errors.openTerminalFailed'))
    }
  }

  const handleOpenInEditor = async () => {
    try {
      await gitService.openInEditor(worktree.path, defaultIde, customIdePath)
    } catch (error) {
      handleError(error, t('errors.openEditorFailed'))
    }
  }

  const handleOpenFolder = async () => {
    try {
      // 在 Finder 中打开
      await gitService.openWorktree(worktree)
    } catch (error) {
      handleError(error, t('errors.openFolderFailed'))
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const result = await deleteWorktree(worktree.path, false)
      if (!result.success) {
        // 如果有未提交更改，尝试强制删除
        if (result.message.includes('uncommitted changes')) {
          const forceResult = await deleteWorktree(worktree.path, true)
          if (!forceResult.success) {
            setDeleteError(forceResult.message)
          } else {
            setShowDeleteConfirm(false)
          }
        } else {
          setDeleteError(result.message)
        }
      } else {
        setShowDeleteConfirm(false)
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('worktree.deleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveTags = (tags: string[], notes: string) => {
    saveAnnotation(worktree.path, { tags, notes })
    setAnnotation(getAnnotation(worktree.path))
    onTagsChange?.()
  }

  // 获取标签定义
  const tagDefs: TagDefinition[] = [...PRESET_TAGS]
  annotation?.tags.forEach(tagId => {
    if (!tagDefs.find(t => t.id === tagId)) {
      tagDefs.push({ id: tagId, name: tagId, color: '#6b7280', bgColor: '#f3f4f6', isPreset: false })
    }
  })

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors overflow-hidden">
        {/* 已合并提醒横幅 */}
        {isMerged && !worktree.isMain && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-md">
            <GitMerge className="w-3.5 h-3.5" />
            <span>{t('worktree.mergedHint')}</span>
          </div>
        )}

        <div className="flex items-start justify-between">
          {/* 左侧：分支信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <StatusBadge status={worktree.status} />
              <button
                onClick={() => worktree.branch && handleCopy(worktree.branch, 'branch')}
                className="flex items-center gap-1 font-medium text-gray-900 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                title={worktree.branch ? t('common.clickToCopy') : undefined}
                disabled={!worktree.branch}
              >
                <span className="truncate">
                  {worktree.branch || 'DETACHED'}
                </span>
                {worktree.branch && (
                  copiedField === 'branch' ? (
                    <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )
                )}
              </button>
              {worktree.isMain && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                  {t('worktree.main')}
                </span>
              )}
              {isMerged && !worktree.isMain && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded flex items-center gap-1">
                  <GitMerge className="w-3 h-3" />
                  {t('worktree.merged')}
                </span>
              )}
              {/* 同步状态 */}
              {worktree.syncStatus && worktree.syncStatus.hasRemote && (
                <div className="flex items-center gap-1 text-xs">
                  {worktree.syncStatus.ahead > 0 && (
                    <span
                      className="flex items-center gap-0.5 text-green-600 dark:text-green-400 cursor-pointer hover:underline"
                      title={t('worktree.unpushedCommits', { count: worktree.syncStatus.ahead })}
                      onClick={async () => {
                        try {
                          const result = await gitService.push(worktree.path, worktree.branch)
                          if (result.success) {
                            toast.success(t('worktree.pushSuccess'))
                            await refreshWorktrees()
                          } else {
                            toast.error(`${t('worktree.pushFailed')}: ${result.message}`)
                          }
                        } catch (error) {
                          handleError(error, t('worktree.pushFailed'))
                        }
                      }}
                    >
                      <ArrowUp className="w-3 h-3" />
                      {worktree.syncStatus.ahead}
                    </span>
                  )}
                  {worktree.syncStatus.behind > 0 && (
                    <span
                      className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400 cursor-pointer hover:underline"
                      title={t('worktree.unpulledCommits', { count: worktree.syncStatus.behind })}
                      onClick={async () => {
                        try {
                          const result = await gitService.pull(worktree.path, worktree.branch)
                          if (result.success) {
                            toast.success(t('worktree.pullSuccess'))
                            await refreshWorktrees()
                          } else {
                            toast.error(`${t('worktree.pullFailed')}: ${result.message}`)
                          }
                        } catch (error) {
                          handleError(error, t('worktree.pullFailed'))
                        }
                      }}
                    >
                      <ArrowDown className="w-3 h-3" />
                      {worktree.syncStatus.behind}
                    </span>
                  )}
                  {worktree.syncStatus.ahead === 0 && worktree.syncStatus.behind === 0 && (
                    <span className="flex items-center gap-0.5 text-gray-400 dark:text-gray-500" title={t('worktree.syncWithRemote')}>
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1 min-w-0">
              <Folder className="w-4 h-4 flex-shrink-0" />
              <button
                onClick={() => handleCopy(worktree.path, 'path')}
                className="flex items-center gap-1 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                title={t('common.clickToCopy')}
              >
                <span className="truncate">
                  {worktree.path}
                </span>
                {copiedField === 'path' ? (
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                )}
              </button>
            </div>

            {/* 最后提交信息 */}
            {worktree.lastCommit && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0" title={`${worktree.lastCommit.author} • ${worktree.lastCommit.hash}`}>
                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                  {worktree.lastCommit.hash}
                </span>
                <span className="truncate block min-w-0 flex-1">{worktree.lastCommit.message}</span>
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 text-xs" title={worktree.lastCommit.relativeTime}>
                  {worktree.lastCommit.relativeTime}
                </span>
              </div>
            )}

            {/* 标签显示 */}
            {annotation && annotation.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {annotation.tags.map(tagId => {
                  const tagDef = getTagDef(tagId, tagDefs)
                  return (
                    <TagBadge
                      key={tagId}
                      tag={tagDef}
                      size="sm"
                      onClick={() => setShowTagEditor(true)}
                    />
                  )
                })}
              </div>
            )}

            {/* 分组选择器 */}
            <div className="mt-2">
              <GroupSelector
                repoPath={repoPath}
                worktreeId={worktree.id}
                currentGroupId={currentGroupId}
                onSelect={(groupId) => setWorktreeGroup(repoPath, worktree.id, groupId)}
                onOpenPanel={onOpenGroupPanel}
              />
            </div>

            {/* 备注显示 */}
            {annotation && annotation.notes && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 rounded">
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap break-words">{annotation.notes}</span>
              </div>
            )}

            {worktree.lastActiveAt && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1" title={worktree.lastActiveAt}>
                <Clock className="w-3 h-3" />
                {t('worktree.lastActive')}: {worktree.lastActiveAt}
              </div>
            )}

            {/* 空闲检测提示 */}
            {idleStatus && idleStatus.level !== 'active' && (
              <div className={clsx(
                'mt-2 flex items-center gap-1.5 text-xs px-2 py-1 rounded',
                idleStatus.level === 'critical'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
              )}>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{idleStatus.message}</span>
                {idleStatus.isIdle && (
                  <span className="ml-1 opacity-75">{t('worktree.idleSuggestCleanup')}</span>
                )}
              </div>
            )}
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setShowTagEditor(true)}
              className={annotation?.tags.length || annotation?.notes ? 'p-2 text-purple-500 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-md transition-colors' : 'p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'}
              title={t('worktree.editTagsAndNotes')}
            >
              <Tag className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowBranchManager(true)}
              className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.branchManager')}
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <button
              onClick={() => onShowDiff?.(worktree.path, worktree.name)}
              className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.viewDiff')}
            >
              <GitCompare className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenInEditor}
              className="p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.openInIde')}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenInTerminal}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.openInTerminal')}
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenFolder}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.openInFinder')}
            >
              <Folder className="w-4 h-4" />
            </button>
            {!worktree.isMain && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title={t('worktree.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('worktree.confirmDelete')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('worktree.deleteConfirm', { branch: worktree.branch })}
            </p>
            {deleteError && (
              <div className="mb-4 p-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
              >
                {isDeleting ? t('common.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分支管理 */}
      <BranchManager
        isOpen={showBranchManager}
        onClose={() => setShowBranchManager(false)}
        worktreePath={worktree.path}
        worktreeBranch={worktree.branch}
        branches={branches}
      />

      {/* 标签编辑器 */}
      <TagEditor
        isOpen={showTagEditor}
        onClose={() => setShowTagEditor(false)}
        path={worktree.path}
        branch={worktree.branch}
        annotation={annotation}
        onSave={handleSaveTags}
      />
    </>
  )
})
