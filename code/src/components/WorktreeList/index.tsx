import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { WorktreeItem } from './WorktreeItem'
import { useWorktreeStore } from '@/stores/worktreeStore'
import { useGroupsStore } from '@/stores/groupsStore'
import { GitBranch, Plus, Search, ArrowUpDown, AlertTriangle, Trash2, PanelLeftClose, RefreshCw, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/common'
import { EmptyState } from '@/components/common'
import { GroupPanel } from '@/components/GroupPanel'
import type { Worktree, WorktreeHint } from '@/types/worktree'
import type { WorktreeGroup } from '@/types/group'
import { WorktreeStatus } from '@/types/worktree'
import { HintsPanel } from '@/components/HintsPanel'
import { BatchActions } from '@/components/BatchActions'
import { gitService } from '@/services/git'
type SortField = 'name' | 'status' | 'time'
type SortOrder = 'asc' | 'desc'

interface WorktreeListProps {
  onCreateWorktree?: () => void
  onShowDiff?: (path: string, name: string) => void
  onCollapse?: () => void
  searchInputRef?: React.RefObject<HTMLInputElement>
}

interface GroupedWorktrees {
  group: WorktreeGroup | null
  worktrees: Worktree[]
  collapsed: boolean
}

export function WorktreeList({ onCreateWorktree, onShowDiff, onCollapse, searchInputRef }: WorktreeListProps) {
  const { t } = useTranslation()
  const { worktrees, isLoading, currentRepo, refreshWorktrees } = useWorktreeStore()
  const groups = useGroupsStore(state => state.groups)
  const groupings = useGroupsStore(state => state.groupings)
  const getWorktreeGroup = useGroupsStore(state => state.getWorktreeGroup)
  const initializeDefaultGroups = useGroupsStore(state => state.initializeDefaultGroups)

  // 提取 repoPath 为独立变量，避免 currentRepo 对象引用变化导致 useMemo 重算
  const repoPath = currentRepo?.path || ''
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [showHints, setShowHints] = useState(false)
  const [showBatchActions, setShowBatchActions] = useState(false)
  const [showGroupPanel, setShowGroupPanel] = useState(false)
  const [mergedHints, setMergedHints] = useState<WorktreeHint[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // 用于竞态条件处理的请求版本号
  const requestVersionRef = useRef(0)

  // 初始化默认分组
  useEffect(() => {
    if (groups.length === 0) {
      initializeDefaultGroups()
    }
  }, [groups.length, initializeDefaultGroups])

  // 使用 useCallback 稳定 getWorktreeGroupForPath 的引用
  const getWorktreeGroupForPath = useCallback((worktreeId: string) => {
    return getWorktreeGroup(repoPath, worktreeId)
  }, [getWorktreeGroup, repoPath])

  // 获取分支列表
  const branches = currentRepo?.branches || []

  // 获取已合并提示 - 带竞态条件处理
  useEffect(() => {
    // 每次 effect 运行时增加版本号
    const currentVersion = ++requestVersionRef.current

    const fetchMergedHints = async () => {
      if (currentRepo?.mainWorktreePath) {
        try {
          const hints = await gitService.getMergedHints(
            currentRepo.mainWorktreePath,
            currentRepo.defaultBranch || 'main'
          )
          // 只有当版本号匹配时才更新状态，避免过期响应覆盖新数据
          if (currentVersion === requestVersionRef.current) {
            setMergedHints(hints)
          }
        } catch (err) {
          // 只在版本匹配时记录错误
          if (currentVersion === requestVersionRef.current) {
            console.error('Failed to fetch merged hints:', err)
          }
        }
      }
    }

    fetchMergedHints()
  }, [currentRepo?.mainWorktreePath, currentRepo?.defaultBranch])

  // 创建已合并分支的 Set 用于快速查找
  const mergedBranches = useMemo(() => {
    return new Set(mergedHints.map(h => h.branch))
  }, [mergedHints])

  // 过滤和排序
  const filteredAndSortedWorktrees = useMemo(() => {
    let result = [...worktrees]

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((wt: Worktree) =>
        wt.name.toLowerCase().includes(query) ||
        wt.branch.toLowerCase().includes(query) ||
        wt.path.toLowerCase().includes(query)
      )
    }

    // 排序
    result.sort((a: Worktree, b: Worktree) => {
      let comparison = 0

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'status': {
          // 状态优先级: conflict > dirty > detached > clean > unknown
          {
            const statusOrder: Record<string, number> = {
              [WorktreeStatus.Conflicted]: 0,
              [WorktreeStatus.Dirty]: 1,
              [WorktreeStatus.Detached]: 2,
              [WorktreeStatus.Unpushed]: 3,
              [WorktreeStatus.Clean]: 4,
              [WorktreeStatus.Unknown]: 5,
            }
            comparison = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
          }
          break
        }
        case 'time':
          // 按最后提交时间排序 (没有时间信息的按 id 排序)
          comparison = a.id.localeCompare(b.id)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [worktrees, searchQuery, sortField, sortOrder])

  // 按分组归类 worktrees
  const groupedWorktrees = useMemo((): GroupedWorktrees[] => {
    const grouped: Map<string | null, Worktree[]> = new Map()

    // 初始化所有分组
    groups.forEach(g => grouped.set(g.id, []))
    grouped.set(null, []) // 未分组

    // 归类 worktrees
    filteredAndSortedWorktrees.forEach(wt => {
      const groupId = getWorktreeGroupForPath(wt.id)?.id || null
      const list = grouped.get(groupId) || []
      list.push(wt)
      grouped.set(groupId, list)
    })

    // 构建结果
    const result: GroupedWorktrees[] = []

    // 先添加分组（按 order 排序）
    groups
      .sort((a, b) => a.order - b.order)
      .forEach(g => {
        const worktreesInGroup = grouped.get(g.id) || []
        if (worktreesInGroup.length > 0) {
          result.push({
            group: g,
            worktrees: worktreesInGroup,
            collapsed: collapsedGroups.has(g.id),
          })
        }
      })

    // 最后添加未分组
    const ungrouped = grouped.get(null) || []
    if (ungrouped.length > 0) {
      result.push({
        group: null,
        worktrees: ungrouped,
        collapsed: collapsedGroups.has('ungrouped'),
      })
    }

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredAndSortedWorktrees, groups, groupings, getWorktreeGroupForPath, collapsedGroups])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!worktrees || worktrees.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title={t('worktree.noWorktrees')}
        description={t('worktree.noWorktreesDesc')}
        className="h-64"
        action={
          onCreateWorktree && (
            <Button
              onClick={onCreateWorktree}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white"
            >
              <Plus className="w-4 h-4" />
              {t('worktree.create')}
            </Button>
          )
        }
      />
    )
  }

  return (
    <div className="p-4">
      {/* 工具栏 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* 搜索框 */}
          <div className="relative flex-shrink min-w-[120px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('worktree.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 w-full"
            />
          </div>

          {/* 排序按钮 */}
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <ArrowUpDown className="w-4 h-4" />
            <button
              onClick={() => toggleSort('name')}
              className={`px-2 py-1 rounded ${sortField === 'name' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('common.name')}
            </button>
            <button
              onClick={() => toggleSort('status')}
              className={`px-2 py-1 rounded ${sortField === 'status' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              {t('common.status')}
            </button>
          </div>

          {/* 智能提示按钮 */}
          <button
            onClick={() => setShowHints(true)}
            className="p-1.5 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t('hints.title')}
          >
            <AlertTriangle className="w-4 h-4" />
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={() => refreshWorktrees()}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            title={t('worktree.refreshList')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* 分组管理按钮 */}
          <button
            onClick={() => setShowGroupPanel(true)}
            className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={t('groups.title')}
          >
            <FolderOpen className="w-4 h-4" />
          </button>

          {/* 批量删除按钮 */}
          {worktrees.filter(w => !w.isMain).length > 1 && (
            <button
              onClick={() => setShowBatchActions(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title={t('batch.title')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            {filteredAndSortedWorktrees.length}
            {searchQuery && worktrees.length !== filteredAndSortedWorktrees.length
              ? `/${worktrees.length}`
              : ''}
          </span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title={t('worktree.collapseList')}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 分组列表 */}
      <div className="space-y-4">
        {groupedWorktrees.map(({ group, worktrees, collapsed }) => (
          <div key={group?.id || 'ungrouped'}>
            {/* 分组标题 */}
            <button
              onClick={() => toggleGroupCollapse(group?.id || 'ungrouped')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
              {group ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">{group.name}</span>
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400">{t('groups.ungrouped')}</span>
                </>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                {worktrees.length}
              </span>
            </button>

            {/* 分组内的 worktrees */}
            {!collapsed && (
              <div className="space-y-2 mt-2">
                {worktrees.map((worktree) => (
                  <WorktreeItem
                    key={worktree.path}
                    worktree={worktree}
                    branches={branches}
                    repoPath={repoPath}
                    currentGroupId={getWorktreeGroupForPath(worktree.id)?.id}
                    onShowDiff={onShowDiff}
                    isMerged={mergedBranches.has(worktree.branch)}
                    onOpenGroupPanel={() => setShowGroupPanel(true)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 无搜索结果 */}
      {searchQuery && filteredAndSortedWorktrees.length === 0 && (
        <EmptyState
          icon={Search}
          title={t('worktree.noSearchResult', { query: searchQuery })}
          size="sm"
        />
      )}

      {/* 智能提示面板 */}
      <HintsPanel
        isOpen={showHints}
        onClose={() => setShowHints(false)}
        repoPath={currentRepo?.mainWorktreePath || ''}
        mainBranch={currentRepo?.defaultBranch || 'main'}
      />

      {/* 批量操作面板 */}
      <BatchActions
        isOpen={showBatchActions}
        onClose={() => setShowBatchActions(false)}
        worktrees={worktrees}
        repoPath={currentRepo?.mainWorktreePath || ''}
      />

      {/* 分组管理面板 */}
      <GroupPanel
        isOpen={showGroupPanel}
        onClose={() => setShowGroupPanel(false)}
      />
    </div>
  )
}