/**
 * DiffViews 模块导出文件
 *
 * 该文件作为统一入口，导出所有 Diff 视图相关组件。
 * 各组件已拆分为独立文件以优化性能和可维护性。
 */

// 基础组件
export { CopyButton } from './CopyButton'
export { HighlightedLine } from './HighlightedLine'
export { CollapsedIndicator } from './CollapsedIndicator'

// Diff 视图组件
export { UnifiedDiffView } from './UnifiedDiffView'
export { SplitDiffView } from './SplitDiffView'
