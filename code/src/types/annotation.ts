/**
 * 预设标签类型
 */
export interface TagDefinition {
  /** 标签 ID */
  id: string
  /** 标签名称 */
  name: string
  /** 标签颜色 */
  color: string
  /** 标签背景色 */
  bgColor: string
  /** 是否为预设标签 */
  isPreset: boolean
}

/**
 * 预设标签列表
 */
export const PRESET_TAGS: TagDefinition[] = [
  { id: 'wip', name: 'WIP', color: '#f59e0b', bgColor: '#fef3c7', isPreset: true },
  { id: 'cr', name: '等 CR', color: '#8b5cf6', bgColor: '#ede9fe', isPreset: true },
  { id: 'blocked', name: '阻塞', color: '#ef4444', bgColor: '#fee2e2', isPreset: true },
  { id: 'high', name: '高优先级', color: '#ec4899', bgColor: '#fce7f3', isPreset: true },
  { id: 'review', name: '待审查', color: '#06b6d4', bgColor: '#cffafe', isPreset: true },
  { id: 'bug', name: 'Bug 修复', color: '#f97316', bgColor: '#ffedd5', isPreset: true },
  { id: 'feature', name: '新功能', color: '#22c55e', bgColor: '#dcfce7', isPreset: true },
  { id: 'experiment', name: '实验', color: '#6366f1', bgColor: '#e0e7ff', isPreset: true },
]

/**
 * Worktree 标注信息
 */
export interface WorktreeAnnotation {
  /** Worktree 路径（作为唯一标识） */
  path: string
  /** 标签 ID 列表 */
  tags: string[]
  /** 备注描述 */
  notes: string
  /** 更新时间 */
  updatedAt: string
}

/**
 * 所有 Worktree 标注存储结构
 */
export interface AnnotationsStore {
  /** 以 path 为 key 的标注信息 */
  [path: string]: WorktreeAnnotation
}