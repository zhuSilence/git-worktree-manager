import type { DiffHunk, DiffLine } from '@/types/worktree'

/**
 * Hunk 合并配置
 */
export interface HunkMergeConfig {
  /** 
   * 两个 hunk 之间的最大间隔行数，小于此值时自动合并
   * 默认 15 行（覆盖大多数中小型函数）
   */
  maxGapLines: number
  
  /**
   * 是否启用语义边界检测（基于函数/方法签名）
   * 开启后会尝试将同一函数内的所有修改合并
   */
  enableSemanticMerge: boolean
  
  /**
   * 合并后的 hunk 中，连续上下文行超过此数量时可折叠
   */
  collapsibleContextThreshold: number
}

/**
 * 合并后的 Hunk，包含可折叠区域信息
 */
export interface MergedHunk extends DiffHunk {
  /** 原始 hunk 索引列表（用于追踪来源） */
  sourceHunkIndices: number[]
  /** 可折叠的上下文区域 */
  collapsibleRanges: CollapsibleRange[]
  /** 是否由多个原始 hunk 合并而来 */
  isMerged: boolean
}

/**
 * 可折叠的上下文区域
 */
export interface CollapsibleRange {
  /** 在 lines 数组中的起始索引 */
  startIdx: number
  /** 在 lines 数组中的结束索引（不含） */
  endIdx: number
  /** 该区域的行数 */
  lineCount: number
  /** 是否已折叠 */
  collapsed: boolean
}

// 函数/方法签名的正则模式（支持多种语言）
const FUNCTION_PATTERNS = [
  // Java/Kotlin: protected void methodName(...) {
  /^\s*(public|protected|private|static|final|abstract|synchronized|\s)*\s*(void|[A-Z]\w*<[^>]*>|\w+)\s+(\w+)\s*\([^)]*\)\s*(throws\s+[^{]+)?\s*\{?\s*$/,
  // JavaScript/TypeScript: function name(...) / async function name(...)
  /^\s*(async\s+)?function\s+(\w+)\s*\([^)]*\)/,
  // Arrow functions: const name = (...) => / const name = async (...) =>
  /^\s*(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
  // Class methods: methodName(...) { / async methodName(...) {
  /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{?\s*$/,
  // Python: def method_name(...):
  /^\s*def\s+(\w+)\s*\([^)]*\)\s*:/,
  // Go: func (r *Receiver) methodName(...) / func methodName(...)
  /^\s*func\s*(\([^)]+\))?\s*(\w+)\s*\([^)]*\)/,
  // Rust: fn method_name(...) / pub fn method_name(...)
  /^\s*(pub\s+)?(async\s+)?fn\s+(\w+)\s*[<(]/,
  // C/C++: returnType methodName(...) {
  /^\s*(\w+\s*\*?\s+)+(\w+)\s*\([^)]*\)\s*(const)?\s*\{?\s*$/,
]

/**
 * 检测一行是否是函数/方法签名
 */
export function isFunctionSignature(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  
  return FUNCTION_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * 从一组行中提取函数签名（如果存在）
 */
function extractFunctionSignature(lines: DiffLine[]): string | null {
  // 检查前 5 行是否有函数签名
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (isFunctionSignature(lines[i].content)) {
      return lines[i].content.trim()
    }
  }
  return null
}

/**
 * 计算两个 hunk 之间的间隔行数
 */
function calculateGap(hunk1: DiffHunk, hunk2: DiffHunk): number {
  // 使用新文件行号计算间隔
  const hunk1End = hunk1.newStart + hunk1.newLines
  const hunk2Start = hunk2.newStart
  return hunk2Start - hunk1End
}

// 以下函数保留以便将来获取完整上下文时使用
// function _generateContextLines(
//   startLine: number,
//   endLine: number,
//   _existingLines: DiffLine[]
// ): DiffLine[] {
//   const fillerLines: DiffLine[] = []
//   for (let lineNum = startLine; lineNum < endLine; lineNum++) {
//     fillerLines.push({
//       lineType: 'context',
//       oldLine: lineNum,
//       newLine: lineNum,
//       content: '',
//     })
//   }
//   return fillerLines
// }

/**
 * 合并两个 hunk
 */
function mergeTwoHunks(hunk1: MergedHunk, hunk2: MergedHunk, config: HunkMergeConfig): MergedHunk {
  const gap = calculateGap(hunk1, hunk2)
  
  // 生成中间的上下文行
  const gapStartLine = hunk1.newStart + hunk1.newLines
  const gapLines: DiffLine[] = []
  
  // 创建表示间隔区域的上下文行
  for (let i = 0; i < gap; i++) {
    gapLines.push({
      lineType: 'context',
      oldLine: hunk1.oldStart + hunk1.oldLines + i,
      newLine: gapStartLine + i,
      content: `... (${gap} lines hidden) ...`, // 占位符
    })
  }
  
  // 合并后的行
  const mergedLines = [...hunk1.lines, ...gapLines, ...hunk2.lines]
  
  // 记录可折叠区域（间隔部分）
  const collapsibleRanges: CollapsibleRange[] = [...hunk1.collapsibleRanges]
  
  if (gap > config.collapsibleContextThreshold) {
    collapsibleRanges.push({
      startIdx: hunk1.lines.length,
      endIdx: hunk1.lines.length + gapLines.length,
      lineCount: gap,
      collapsed: true, // 默认折叠
    })
  }
  
  return {
    oldStart: hunk1.oldStart,
    oldLines: hunk1.oldLines + gap + hunk2.oldLines,
    newStart: hunk1.newStart,
    newLines: hunk1.newLines + gap + hunk2.newLines,
    lines: mergedLines,
    sourceHunkIndices: [...hunk1.sourceHunkIndices, ...hunk2.sourceHunkIndices],
    collapsibleRanges,
    isMerged: true,
  }
}

/**
 * 智能合并 Hunks
 * 
 * 核心算法：
 * 1. 遍历所有 hunk，计算相邻 hunk 之间的间隔
 * 2. 如果间隔小于阈值，或者两个 hunk 属于同一函数，则合并
 * 3. 对于合并后较长的上下文区域，标记为可折叠
 */
export function mergeHunks_smart(
  hunks: DiffHunk[],
  config: Partial<HunkMergeConfig> = {}
): MergedHunk[] {
  const fullConfig: HunkMergeConfig = {
    maxGapLines: 15,
    enableSemanticMerge: true,
    collapsibleContextThreshold: 8,
    ...config,
  }
  
  if (hunks.length === 0) return []
  if (hunks.length === 1) {
    return [{
      ...hunks[0],
      sourceHunkIndices: [0],
      collapsibleRanges: [],
      isMerged: false,
    }]
  }
  
  const result: MergedHunk[] = []
  
  // 初始化第一个 hunk
  let current: MergedHunk = {
    ...hunks[0],
    sourceHunkIndices: [0],
    collapsibleRanges: [],
    isMerged: false,
  }
  
  for (let i = 1; i < hunks.length; i++) {
    const next = hunks[i]
    const gap = calculateGap(current, next)
    
    let shouldMerge = false
    
    // 条件1: 间隔小于阈值
    if (gap <= fullConfig.maxGapLines) {
      shouldMerge = true
    }
    
    // 条件2: 语义合并 - 检测是否属于同一函数
    if (!shouldMerge && fullConfig.enableSemanticMerge) {
      const currentFn = extractFunctionSignature(current.lines)
      const nextFn = extractFunctionSignature(next.lines)
      
      // 如果下一个 hunk 没有新的函数签名，可能仍在同一函数内
      if (currentFn && !nextFn && gap <= fullConfig.maxGapLines * 2) {
        shouldMerge = true
      }
    }
    
    if (shouldMerge) {
      current = mergeTwoHunks(current, { ...next, sourceHunkIndices: [i], collapsibleRanges: [], isMerged: false }, fullConfig)
    } else {
      result.push(current)
      current = {
        ...next,
        sourceHunkIndices: [i],
        collapsibleRanges: [],
        isMerged: false,
      }
    }
  }
  
  result.push(current)
  
  return result
}

/**
 * 简化版合并：仅基于行间隔合并，不使用语义分析
 * 适用于性能敏感场景
 */
export function mergeHunks_simple(
  hunks: DiffHunk[],
  maxGapLines: number = 10
): MergedHunk[] {
  return mergeHunks_smart(hunks, {
    maxGapLines,
    enableSemanticMerge: false,
    collapsibleContextThreshold: 5,
  })
}

/**
 * 带折叠状态管理的 Hunk 处理
 */
export interface HunkWithCollapse extends MergedHunk {
  /** 当前各折叠区域的展开状态 */
  collapseStates: boolean[]
}

/**
 * 获取展开后的行（处理折叠区域）
 */
export function getExpandedLines(
  hunk: MergedHunk,
  collapseStates: boolean[]
): DiffLine[] {
  if (hunk.collapsibleRanges.length === 0) {
    return hunk.lines
  }
  
  const result: DiffLine[] = []
  let currentIdx = 0
  
  for (let i = 0; i < hunk.collapsibleRanges.length; i++) {
    const range = hunk.collapsibleRanges[i]
    const isCollapsed = collapseStates[i] ?? range.collapsed
    
    // 添加折叠区域之前的行
    while (currentIdx < range.startIdx) {
      result.push(hunk.lines[currentIdx])
      currentIdx++
    }
    
    if (isCollapsed) {
      // 添加折叠指示行
      result.push({
        lineType: 'context',
        oldLine: null,
        newLine: null,
        content: `⋯ ${range.lineCount} lines collapsed ⋯`,
      })
    } else {
      // 展开：添加所有行
      while (currentIdx < range.endIdx) {
        result.push(hunk.lines[currentIdx])
        currentIdx++
      }
    }
    
    currentIdx = range.endIdx
  }
  
  // 添加最后一个折叠区域之后的行
  while (currentIdx < hunk.lines.length) {
    result.push(hunk.lines[currentIdx])
    currentIdx++
  }
  
  return result
}

/**
 * 统计合并效果
 */
export function getMergeStats(originalHunks: DiffHunk[], mergedHunks: MergedHunk[]): {
  originalCount: number
  mergedCount: number
  reductionPercent: number
  mergedGroups: number[][]
} {
  const originalCount = originalHunks.length
  const mergedCount = mergedHunks.length
  const reductionPercent = originalCount > 0 
    ? Math.round((1 - mergedCount / originalCount) * 100) 
    : 0
  
  const mergedGroups = mergedHunks.map(h => h.sourceHunkIndices)
  
  return {
    originalCount,
    mergedCount,
    reductionPercent,
    mergedGroups,
  }
}
