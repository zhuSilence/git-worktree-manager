/**
 * Worktree 分组定义
 */
export interface WorktreeGroup {
  /** 分组唯一 ID */
  id: string
  /** 分组名称 */
  name: string
  /** 分组颜色 */
  color: string
  /** 分组描述（可选） */
  description?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 分组顺序 */
  order: number
}

/**
 * Worktree 分组关联
 * 记录每个 worktree 所属的分组
 */
export interface WorktreeGrouping {
  /** 仓库路径 */
  repoPath: string
  /** worktree ID */
  worktreeId: string
  /** 所属分组 ID（null 表示未分组） */
  groupId: string | null
}

/**
 * 分组配置（持久化）
 */
export interface GroupsConfig {
  /** 所有分组定义 */
  groups: WorktreeGroup[]
  /** worktree 分组关联记录 */
  groupings: WorktreeGrouping[]
  /** 自动分组规则（可选） */
  autoGroupRules?: AutoGroupRule[]
}

/**
 * 自动分组规则
 */
export interface AutoGroupRule {
  /** 规则 ID */
  id: string
  /** 规则名称 */
  name: string
  /** 匹配模式（正则表达式） */
  pattern: string
  /** 目标分组 ID */
  targetGroupId: string
  /** 是否启用 */
  enabled: boolean
}

/**
 * 预设颜色
 */
export const PRESET_COLORS = [
  { value: '#3b82f6', name: '蓝色', bgClass: 'bg-blue-500' },
  { value: '#10b981', name: '绿色', bgClass: 'bg-emerald-500' },
  { value: '#f59e0b', name: '橙色', bgClass: 'bg-amber-500' },
  { value: '#ef4444', name: '红色', bgClass: 'bg-red-500' },
  { value: '#8b5cf6', name: '紫色', bgClass: 'bg-violet-500' },
  { value: '#ec4899', name: '粉色', bgClass: 'bg-pink-500' },
  { value: '#06b6d4', name: '青色', bgClass: 'bg-cyan-500' },
  { value: '#84cc16', name: '黄绿', bgClass: 'bg-lime-500' },
  { value: '#64748b', name: '灰色', bgClass: 'bg-slate-500' },
]

/**
 * 默认分组
 */
export const DEFAULT_GROUPS: WorktreeGroup[] = [
  {
    id: 'feature',
    name: '功能开发',
    color: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 0,
  },
  {
    id: 'bugfix',
    name: 'Bug 修复',
    color: '#ef4444',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 1,
  },
  {
    id: 'release',
    name: '发布',
    color: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 2,
  },
  {
    id: 'other',
    name: '其他',
    color: '#64748b',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 3,
  },
]