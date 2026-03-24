import { X } from 'lucide-react'
import { clsx } from 'clsx'
import type { TagDefinition } from '@/types/annotation'

interface TagBadgeProps {
  tag: TagDefinition
  size?: 'sm' | 'md'
  removable?: boolean
  onRemove?: () => void
  onClick?: () => void
}

export function TagBadge({ tag, size = 'md', removable = false, onRemove, onClick }: TagBadgeProps) {
  const sizeClasses = size === 'sm' 
    ? 'px-1.5 py-0.5 text-[10px]' 
    : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded font-medium transition-colors',
        sizeClasses,
        onClick && 'cursor-pointer hover:opacity-80'
      )}
      style={{
        color: tag.color,
        backgroundColor: tag.bgColor,
      }}
      onClick={onClick}
      title={tag.name}
    >
      <span className="truncate max-w-[80px]">{tag.name}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-70"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

/**
 * 根据标签 ID 获取标签定义
 */
export function getTagDef(tagId: string, definitions: TagDefinition[]): TagDefinition {
  return definitions.find(t => t.id === tagId) || {
    id: tagId,
    name: tagId,
    color: '#6b7280',
    bgColor: '#f3f4f6',
    isPreset: false,
  }
}