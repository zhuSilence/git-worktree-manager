/**
 * 字符级差异片段
 */
export interface CharSegment {
  text: string
  highlight: boolean
}

/**
 * 语法高亮 Token
 */
export interface SyntaxToken {
  text: string
  type: 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'function' | 'punctuation' | 'plain'
}

/**
 * Diff 视图模式
 */
export type ViewMode = 'unified' | 'split'

/**
 * 文件树节点
 */
export interface FileTreeNode {
  name: string
  fullPath: string
  isFile: boolean
  status?: string
  additions?: number
  deletions?: number
  source?: 'committed' | 'unstaged' | 'untracked'
  children: FileTreeNode[]
}

/**
 * 排序后的文件项，包含原始索引
 */
export interface SortedFile {
  file: import('@/types/worktree').FileDiff
  originalIndex: number
}

// ==================== 函数级对齐相关类型 ====================

import type { DiffLine } from '@/types/worktree'

/**
 * 函数块：表示一个完整的函数/方法
 */
export interface FunctionBlock {
  /** 函数名 */
  name: string
  /** 在 lines 数组中的起始索引 */
  startIdx: number
  /** 结束索引（不含） */
  endIdx: number
  /** 该函数包含的行 */
  lines: DiffLine[]
  /** 函数签名（用于匹配） */
  signature: string
}

/**
 * 解析后的 Diff 结构
 */
export interface ParsedDiff {
  /** 识别出的函数块 */
  functions: FunctionBlock[]
  /** 不属于任何函数的行（顶层代码） */
  orphanLines: DiffLine[]
  /** 孤儿行在原始数组中的索引 */
  orphanIndices: number[]
}

/**
 * 匹配的函数对
 */
export interface MatchedPair {
  /** 左侧函数（删除/修改） */
  left: FunctionBlock | null
  /** 右侧函数（新增/修改） */
  right: FunctionBlock | null
  /** 匹配类型 */
  type: 'matched' | 'left-only' | 'right-only'
}

/**
 * 对齐后的行
 */
export interface AlignedLine {
  /** 左侧行（可能为 null 表示占位） */
  left: DiffLine | null
  /** 右侧行（可能为 null 表示占位） */
  right: DiffLine | null
  /** 原始左侧索引（用于字符级差异） */
  leftOrigIdx: number
  /** 原始右侧索引（用于字符级差异） */
  rightOrigIdx: number
}

/**
 * 对齐后的函数对
 */
export interface AlignedFunctionPair {
  /** 左侧函数签名 */
  leftHeader: string
  /** 右侧函数签名 */
  rightHeader: string
  /** 对齐后的行序列 */
  lines: AlignedLine[]
  /** 匹配类型 */
  type: 'matched' | 'left-only' | 'right-only'
}

/**
 * 完整的对齐结果
 */
export interface AlignedDiff {
  /** 匹配后的函数对 */
  pairs: AlignedFunctionPair[]
  /** 左侧孤儿行对齐结果 */
  orphanLines: AlignedLine[]
}
