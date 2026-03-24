/**
 * Worktree 标注持久化存储服务
 * 使用 localStorage 存储 worktree 的标签和备注
 */

import type { AnnotationsStore, WorktreeAnnotation, TagDefinition } from '@/types/annotation'
import { PRESET_TAGS } from '@/types/annotation'

const STORAGE_KEY = 'worktree-annotations'

/**
 * 获取所有标注
 */
export function getAnnotations(): AnnotationsStore {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

/**
 * 获取单个 worktree 的标注
 */
export function getAnnotation(path: string): WorktreeAnnotation | null {
  const annotations = getAnnotations()
  return annotations[path] || null
}

/**
 * 保存单个 worktree 的标注
 */
export function saveAnnotation(path: string, annotation: Partial<WorktreeAnnotation>): void {
  const annotations = getAnnotations()
  annotations[path] = {
    path,
    tags: annotation.tags || [],
    notes: annotation.notes || '',
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations))
}

/**
 * 更新标签
 */
export function updateTags(path: string, tags: string[]): void {
  const existing = getAnnotation(path)
  saveAnnotation(path, {
    ...existing,
    tags,
  })
}

/**
 * 更新备注
 */
export function updateNotes(path: string, notes: string): void {
  const existing = getAnnotation(path)
  saveAnnotation(path, {
    ...existing,
    tags: existing?.tags || [],
    notes,
  })
}

/**
 * 删除标注
 */
export function deleteAnnotation(path: string): void {
  const annotations = getAnnotations()
  delete annotations[path]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations))
}

/**
 * 获取标签定义（包含预设和自定义）
 */
export function getTagDefinitions(): TagDefinition[] {
  // 预设标签 + 用户自定义标签（从已有标注中收集）
  const annotations = getAnnotations()
  const customTagIds = new Set<string>()

  for (const annotation of Object.values(annotations)) {
    for (const tagId of annotation.tags) {
      if (!PRESET_TAGS.some(t => t.id === tagId)) {
        customTagIds.add(tagId)
      }
    }
  }

  // TODO: 未来可以支持用户自定义标签的颜色
  const customTags: TagDefinition[] = Array.from(customTagIds).map(id => ({
    id,
    name: id,
    color: '#6b7280',
    bgColor: '#f3f4f6',
    isPreset: false,
  }))

  return [...PRESET_TAGS, ...customTags]
}

/**
 * 按标签筛选 worktree paths
 */
export function filterByTag(tagId: string): string[] {
  const annotations = getAnnotations()
  return Object.entries(annotations)
    .filter(([, annotation]) => annotation.tags.includes(tagId))
    .map(([path]) => path)
}

// 导出预设标签供其他模块使用
export { PRESET_TAGS } from '@/types/annotation'