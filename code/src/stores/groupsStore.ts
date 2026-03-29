import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorktreeGroup, WorktreeGrouping, GroupsConfig, AutoGroupRule } from '@/types/group'
import { DEFAULT_GROUPS } from '@/types/group'

interface GroupsState {
  /** 所有分组定义 */
  groups: WorktreeGroup[]
  /** worktree 分组关联记录 */
  groupings: WorktreeGrouping[]
  /** 自动分组规则 */
  autoGroupRules: AutoGroupRule[]
  /** 是否初始化过默认分组 */
  initialized: boolean

  // 分组管理
  createGroup: (name: string, color: string, description?: string) => WorktreeGroup
  updateGroup: (id: string, updates: Partial<WorktreeGroup>) => void
  deleteGroup: (id: string) => void
  reorderGroups: (groupIds: string[]) => void

  // Worktree 分组
  setWorktreeGroup: (repoPath: string, worktreeId: string, groupId: string | null) => void
  getWorktreeGroup: (repoPath: string, worktreeId: string) => WorktreeGroup | null
  getGroupWorktrees: (repoPath: string, groupId: string) => string[]
  getUngroupedWorktrees: (repoPath: string, worktreeIds: string[]) => string[]

  // 自动分组
  applyAutoGrouping: (repoPath: string, worktreeId: string, branchName: string) => string | null
  addAutoGroupRule: (rule: Omit<AutoGroupRule, 'id'>) => AutoGroupRule
  updateAutoGroupRule: (id: string, updates: Partial<AutoGroupRule>) => void
  deleteAutoGroupRule: (id: string) => void

  // 工具函数
  initializeDefaultGroups: () => void
  clearRepoGroupings: (repoPath: string) => void
}

const generateId = () => `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const useGroupsStore = create<GroupsState>()(
  persist(
    (set, get) => ({
      groups: [],
      groupings: [],
      autoGroupRules: [],
      initialized: false,

      // 创建分组
      createGroup: (name: string, color: string, description?: string) => {
        const newGroup: WorktreeGroup = {
          id: generateId(),
          name,
          color,
          description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: get().groups.length,
        }
        set((state) => ({
          groups: [...state.groups, newGroup],
        }))
        return newGroup
      },

      // 更新分组
      updateGroup: (id: string, updates: Partial<WorktreeGroup>) => {
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id
              ? { ...g, ...updates, updatedAt: new Date().toISOString() }
              : g
          ),
        }))
      },

      // 删除分组
      deleteGroup: (id: string) => {
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
          // 同时清除该分组的所有关联
          groupings: state.groupings.map((g) =>
            g.groupId === id ? { ...g, groupId: null } : g
          ),
        }))
      },

      // 重排序分组
      reorderGroups: (groupIds: string[]) => {
        set((state) => ({
          groups: state.groups
            .map((g, index) => ({
              ...g,
              order: groupIds.indexOf(g.id) >= 0 ? groupIds.indexOf(g.id) : index,
            }))
            .sort((a, b) => a.order - b.order),
        }))
      },

      // 设置 worktree 所属分组
      setWorktreeGroup: (repoPath: string, worktreeId: string, groupId: string | null) => {
        set((state) => {
          const existing = state.groupings.find(
            (g) => g.repoPath === repoPath && g.worktreeId === worktreeId
          )
          if (existing) {
            return {
              groupings: state.groupings.map((g) =>
                g.repoPath === repoPath && g.worktreeId === worktreeId
                  ? { ...g, groupId }
                  : g
              ),
            }
          }
          return {
            groupings: [
              ...state.groupings,
              { repoPath, worktreeId, groupId },
            ],
          }
        })
      },

      // 获取 worktree 所属分组
      getWorktreeGroup: (repoPath: string, worktreeId: string) => {
        const state = get()
        const grouping = state.groupings.find(
          (g) => g.repoPath === repoPath && g.worktreeId === worktreeId
        )
        if (!grouping?.groupId) return null
        return state.groups.find((g) => g.id === grouping.groupId) || null
      },

      // 获取分组下的所有 worktree IDs
      getGroupWorktrees: (repoPath: string, groupId: string) => {
        return get()
          .groupings.filter((g) => g.repoPath === repoPath && g.groupId === groupId)
          .map((g) => g.worktreeId)
      },

      // 获取未分组的 worktree IDs
      getUngroupedWorktrees: (repoPath: string, worktreeIds: string[]) => {
        const groupedIds = get()
          .groupings.filter((g) => g.repoPath === repoPath && g.groupId !== null)
          .map((g) => g.worktreeId)
        return worktreeIds.filter((id) => !groupedIds.includes(id))
      },

      // 自动分组（根据分支名匹配规则）
      applyAutoGrouping: (repoPath: string, worktreeId: string, branchName: string) => {
        const state = get()
        const enabledRules = state.autoGroupRules.filter((r) => r.enabled)

        for (const rule of enabledRules) {
          try {
            const regex = new RegExp(rule.pattern, 'i')
            if (regex.test(branchName)) {
              // 应用自动分组
              set((s) => {
                const existing = s.groupings.find(
                  (g) => g.repoPath === repoPath && g.worktreeId === worktreeId
                )
                if (existing) {
                  return {
                    groupings: s.groupings.map((g) =>
                      g.repoPath === repoPath && g.worktreeId === worktreeId
                        ? { ...g, groupId: rule.targetGroupId }
                        : g
                    ),
                  }
                }
                return {
                  groupings: [
                    ...s.groupings,
                    { repoPath, worktreeId, groupId: rule.targetGroupId },
                  ],
                }
              })
              return rule.targetGroupId
            }
          } catch {
            // 正则表达式无效，跳过
          }
        }
        return null
      },

      // 添加自动分组规则
      addAutoGroupRule: (rule: Omit<AutoGroupRule, 'id'>) => {
        const newRule: AutoGroupRule = {
          ...rule,
          id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }
        set((state) => ({
          autoGroupRules: [...state.autoGroupRules, newRule],
        }))
        return newRule
      },

      // 更新自动分组规则
      updateAutoGroupRule: (id: string, updates: Partial<AutoGroupRule>) => {
        set((state) => ({
          autoGroupRules: state.autoGroupRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
      },

      // 删除自动分组规则
      deleteAutoGroupRule: (id: string) => {
        set((state) => ({
          autoGroupRules: state.autoGroupRules.filter((r) => r.id !== id),
        }))
      },

      // 初始化默认分组
      initializeDefaultGroups: () => {
        const state = get()
        if (state.initialized || state.groups.length > 0) return

        set({
          groups: DEFAULT_GROUPS,
          initialized: true,
        })
      },

      // 清除某个仓库的所有分组关联
      clearRepoGroupings: (repoPath: string) => {
        set((state) => ({
          groupings: state.groupings.filter((g) => g.repoPath !== repoPath),
        }))
      },
    }),
    {
      name: 'worktree-groups-storage',
      partialize: (state) => ({
        groups: state.groups,
        groupings: state.groupings,
        autoGroupRules: state.autoGroupRules,
        initialized: state.initialized,
      }),
    }
  )
)