import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupsStore } from '@/stores/groupsStore'
import type { WorktreeGroup } from '@/types/group'
import { FolderOpen, Check, X, Plus, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface GroupSelectorProps {
  repoPath: string
  worktreeId: string
  currentGroupId: string | null
  onSelect: (groupId: string | null) => void
  onOpenPanel?: () => void
}

export function GroupSelector({
  repoPath,
  worktreeId,
  currentGroupId,
  onSelect,
  onOpenPanel,
}: GroupSelectorProps) {
  const { t } = useTranslation()
  const { groups, setWorktreeGroup, initializeDefaultGroups } = useGroupsStore()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 初始化默认分组
  useEffect(() => {
    if (groups.length === 0) {
      initializeDefaultGroups()
    }
  }, [groups.length, initializeDefaultGroups])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentGroup = groups.find((g) => g.id === currentGroupId)

  const handleSelect = (groupId: string | null) => {
    setWorktreeGroup(repoPath, worktreeId, groupId)
    onSelect(groupId)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* 当前分组显示 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
          currentGroup
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
        title={currentGroup ? t('groups.changeGroup') : t('groups.setGroup')}
      >
        {currentGroup ? (
          <>
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: currentGroup.color }}
            />
            <span className="truncate max-w-[80px]">{currentGroup.name}</span>
          </>
        ) : (
          <>
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{t('groups.noGroup')}</span>
          </>
        )}
        <ChevronRight className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-90')} />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]">
          {/* 未分组选项 */}
          <button
            onClick={() => handleSelect(null)}
            className={clsx(
              'w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between',
              !currentGroupId ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
            )}
          >
            <span className="flex items-center gap-2">
              <X className="w-3.5 h-3.5" />
              {t('groups.ungrouped')}
            </span>
            {!currentGroupId && <Check className="w-3.5 h-3.5" />}
          </button>

          {/* 分组列表 */}
          {groups.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          )}
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => handleSelect(group.id)}
              className={clsx(
                'w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between',
                currentGroupId === group.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
              )}
            >
              <span className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="truncate">{group.name}</span>
              </span>
              {currentGroupId === group.id && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}

          {/* 管理分组 */}
          {onOpenPanel && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          )}
          {onOpenPanel && (
            <button
              onClick={() => {
                setIsOpen(false)
                onOpenPanel()
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('groups.manageGroups')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}