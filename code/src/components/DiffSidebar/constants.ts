/**
 * DiffSidebar 组件常量定义
 * 集中管理所有硬编码的魔数、样式常量
 */

// ==================== 尺寸常量 ====================
/** 行高 */
export const LINE_HEIGHT = 22

/** 行号列宽度 */
export const LINE_NUMBER_WIDTH = 12

/** 标记列宽度 */
export const MARKER_WIDTH = 24

/** 行类型标记列宽度 */
export const LINE_TYPE_WIDTH = 20

/** 分支名称最大显示长度 */
export const BRANCH_MAX_DISPLAY_LENGTH = 6

/** 分支名称截断后缀 */
export const BRANCH_TRUNCATE_SUFFIX = '…'

// ==================== 时间常量 ====================
/** 复制成功提示显示时间 (ms) */
export const COPY_SUCCESS_DURATION = 1500

/** 对话框自动关闭延迟 (ms) */
export const DIALOG_AUTO_CLOSE_DELAY = 1500

/** 滚动到文件延迟 (ms) */
export const SCROLL_TO_FILE_DELAY = 50

/** 弹窗就绪延迟 (ms) */
export const DIALOG_READY_DELAY = 50

// ==================== Diff 视图常量 ====================
/** 默认启用智能 Hunk 合并 */
export const DEFAULT_ENABLE_SMART_MERGE = true

/** Hunk 合并最大间隔行数 */
export const DEFAULT_MAX_GAP_LINES = 15

/** 默认折叠状态 */
export const DEFAULT_COLLAPSED = true

/** 渐进式展开文件数量 */
export const PROGRESSIVE_EXPAND_COUNT = 10

/** Split 视图最小宽度 */
export const SPLIT_MIN_WIDTH = 700

/** 默认侧边栏宽度 */
export const DEFAULT_SIDEBAR_WIDTH = 600

/** 最小侧边栏宽度 */
export const MIN_SIDEBAR_WIDTH = 400

/** 最大侧边栏宽度 */
export const MAX_SIDEBAR_WIDTH = 1200

/** 侧边栏宽度存储键 */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'diff-sidebar-width'

// ==================== 样式类名常量 ====================
/** 添加行背景色 - 加深 */
export const ADDITION_BG_CLASS = 'bg-green-200 dark:bg-green-900/60'

/** 删除行背景色 - 加深 */
export const DELETION_BG_CLASS = 'bg-red-200 dark:bg-red-900/60'

/** 添加行号背景色 - 加深 */
export const ADDITION_LINE_NUMBER_BG_CLASS = 'bg-green-300 dark:bg-green-900/60'

/** 删除行号背景色 - 加深 */
export const DELETION_LINE_NUMBER_BG_CLASS = 'bg-red-300 dark:bg-red-900/60'

/** 添加行文字色 */
export const ADDITION_TEXT_CLASS = 'text-green-800 dark:text-green-300'

/** 删除行文字色 */
export const DELETION_TEXT_CLASS = 'text-red-800 dark:text-red-300'

/** 添加行标记色 */
export const ADDITION_MARKER_CLASS = 'text-green-500 font-bold'

/** 删除行标记色 */
export const DELETION_MARKER_CLASS = 'text-red-500 font-bold'

/** 选中行高亮 */
export const SELECTED_LINE_CLASS = 'ring-2 ring-purple-500 ring-inset'

/** Hunk 头部背景色 */
export const HUNK_HEADER_BG_CLASS = 'bg-blue-50 dark:bg-blue-900/20'

/** Hunk 头部文字色 */
export const HUNK_HEADER_TEXT_CLASS = 'text-blue-600 dark:text-blue-400'

/** 折叠指示器背景色 */
export const COLLAPSE_INDICATOR_BG_CLASS = 'bg-blue-50 dark:bg-blue-900/30'

/** 字符级高亮 - 删除 - 加深 */
export const CHAR_DELETION_HIGHLIGHT_CLASS = 'bg-red-400 dark:bg-red-700/90 rounded-sm px-[1px]'

/** 字符级高亮 - 添加 - 加深 */
export const CHAR_ADDITION_HIGHLIGHT_CLASS = 'bg-green-400 dark:bg-green-700/90 rounded-sm px-[1px]'

// ==================== 文件状态样式映射 ====================
export const FILE_STATUS_COLOR_MAP: Record<string, string> = {
  added: 'text-green-500',
  deleted: 'text-red-500',
  modified: 'text-yellow-500',
  renamed: 'text-blue-500',
}

export const FILE_STATUS_BG_COLOR_MAP: Record<string, string> = {
  added: 'bg-green-500/10',
  deleted: 'bg-red-500/10',
  modified: 'bg-yellow-500/10',
  renamed: 'bg-blue-500/10',
}
