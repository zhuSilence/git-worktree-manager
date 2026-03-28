import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CollapsibleRange } from './HunkMerger'
import { COLLAPSE_INDICATOR_BG_CLASS } from './constants'

interface CollapsedIndicatorProps {
  range: CollapsibleRange
  isCollapsed: boolean
  onToggle: () => void
}

/**
 * 可折叠区域指示器组件
 */
export function CollapsedIndicator({
  range,
  isCollapsed,
  onToggle,
}: CollapsedIndicatorProps) {
  return (
    <div
      className={`flex items-center h-[22px] cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border-y border-blue-200 dark:border-blue-800 ${COLLAPSE_INDICATOR_BG_CLASS}`}
      onClick={onToggle}
    >
      <span className="w-12 px-1 text-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {isCollapsed ? <ChevronRight className="w-3 h-3 mx-auto" /> : <ChevronDown className="w-3 h-3 mx-auto" />}
      </span>
      <span className="w-12 px-1 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700" />
      <span className="w-5" />
      <span className="flex-1 px-2 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
        {isCollapsed
          ? `↓ 展开 ${range.lineCount} 行上下文`
          : `↑ 折叠 ${range.lineCount} 行`
        }
      </span>
    </div>
  )
}
