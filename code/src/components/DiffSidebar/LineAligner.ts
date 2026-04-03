import type { DiffLine } from '@/types/worktree'
import type { AlignedLine, AlignedFunctionPair, MatchedPair, AlignedDiff } from './types'
import { parseFunctionBlocks } from './FunctionParser'
import { matchFunctions } from './FunctionMatcher'

/**
 * 计算两行内容的相似度 (0-1)
 * 使用简单的字符级比较
 */
function lineSimilarity(line1: string, line2: string): number {
  if (line1 === line2) return 1
  if (!line1 || !line2) return 0

  const s1 = line1.trim()
  const s2 = line2.trim()

  if (s1 === s2) return 0.95 // 仅空白差异

  // 计算公共字符数
  const set1 = new Set(s1.split(''))
  const set2 = new Set(s2.split(''))
  let common = 0
  for (const char of set1) {
    if (set2.has(char)) common++
  }

  return (2 * common) / (set1.size + set2.size)
}

/**
 * 使用 LCS 变体找到最佳行匹配
 * @param leftLines 左侧行数组
 * @param rightLines 右侧行数组
 * @returns 匹配映射 (leftIdx -> rightIdx)
 */
export function findLineMatches(
  leftLines: DiffLine[],
  rightLines: DiffLine[]
): Map<number, number> {
  const matches = new Map<number, number>()
  const usedRight = new Set<number>()

  // 首先匹配 context 行（作为锚点）
  for (let li = 0; li < leftLines.length; li++) {
    const leftLine = leftLines[li]
    if (leftLine.lineType !== 'context') continue

    for (let ri = 0; ri < rightLines.length; ri++) {
      if (usedRight.has(ri)) continue
      const rightLine = rightLines[ri]

      if (rightLine.lineType === 'context' && leftLine.content === rightLine.content) {
        matches.set(li, ri)
        usedRight.add(ri)
        break
      }
    }
  }

  // 然后尝试匹配 deletion/addition 行（基于内容相似度）
  const SIMILARITY_THRESHOLD = 0.6

  for (let li = 0; li < leftLines.length; li++) {
    if (matches.has(li)) continue
    const leftLine = leftLines[li]
    if (leftLine.lineType !== 'deletion') continue

    let bestMatch = -1
    let bestSimilarity = SIMILARITY_THRESHOLD

    for (let ri = 0; ri < rightLines.length; ri++) {
      if (usedRight.has(ri)) continue
      const rightLine = rightLines[ri]

      if (rightLine.lineType !== 'addition') continue

      const similarity = lineSimilarity(leftLine.content, rightLine.content)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = ri
      }
    }

    if (bestMatch !== -1) {
      matches.set(li, bestMatch)
      usedRight.add(bestMatch)
    }
  }

  return matches
}

/**
 * 对齐两组行（函数内部或孤儿行）
 * @param leftLines 左侧行数组
 * @param rightLines 右侧行数组
 * @param leftBaseIdx 左侧行在原始数组中的基础索引
 * @param rightBaseIdx 右侧行在原始数组中的基础索引
 * @returns 对齐后的行数组
 */
export function alignLines(
  leftLines: DiffLine[],
  rightLines: DiffLine[],
  leftBaseIdx: number = 0,
  rightBaseIdx: number = 0
): AlignedLine[] {
  const result: AlignedLine[] = []
  const matches = findLineMatches(leftLines, rightLines)

  // 构建反向映射
  const reverseMatches = new Map<number, number>()
  for (const [li, ri] of matches) {
    reverseMatches.set(ri, li)
  }

  // 双指针遍历
  let li = 0
  let ri = 0

  while (li < leftLines.length || ri < rightLines.length) {
    // 如果当前左右行匹配
    if (li < leftLines.length && matches.has(li) && matches.get(li) === ri) {
      result.push({
        left: leftLines[li],
        right: rightLines[ri],
        leftOrigIdx: leftBaseIdx + li,
        rightOrigIdx: rightBaseIdx + ri,
      })
      li++
      ri++
    }
    // 左侧行没有匹配
    else if (li < leftLines.length && !matches.has(li)) {
      result.push({
        left: leftLines[li],
        right: null,
        leftOrigIdx: leftBaseIdx + li,
        rightOrigIdx: -1,
      })
      li++
    }
    // 右侧行没有匹配
    else if (ri < rightLines.length && !reverseMatches.has(ri)) {
      result.push({
        left: null,
        right: rightLines[ri],
        leftOrigIdx: -1,
        rightOrigIdx: rightBaseIdx + ri,
      })
      ri++
    }
    // 匹配位置不对应，先处理较小的
    else {
      const matchedRi = li < leftLines.length ? matches.get(li) : Infinity
      const matchedLi = ri < rightLines.length ? reverseMatches.get(ri) : Infinity

      if (matchedRi !== undefined && matchedRi > ri) {
        // 右侧需要先输出
        result.push({
          left: null,
          right: rightLines[ri],
          leftOrigIdx: -1,
          rightOrigIdx: rightBaseIdx + ri,
        })
        ri++
      } else if (matchedLi !== undefined && matchedLi > li) {
        // 左侧需要先输出
        result.push({
          left: leftLines[li],
          right: null,
          leftOrigIdx: leftBaseIdx + li,
          rightOrigIdx: -1,
        })
        li++
      } else {
        // 兜底：同时输出
        result.push({
          left: li < leftLines.length ? leftLines[li] : null,
          right: ri < rightLines.length ? rightLines[ri] : null,
          leftOrigIdx: li < leftLines.length ? leftBaseIdx + li : -1,
          rightOrigIdx: ri < rightLines.length ? rightBaseIdx + ri : -1,
        })
        if (li < leftLines.length) li++
        if (ri < rightLines.length) ri++
      }
    }
  }

  return result
}

/**
 * 对齐一个函数对
 */
export function alignFunctionPair(pair: MatchedPair): AlignedFunctionPair {
  const leftLines = pair.left?.lines ?? []
  const rightLines = pair.right?.lines ?? []
  const leftBaseIdx = pair.left?.startIdx ?? 0
  const rightBaseIdx = pair.right?.startIdx ?? 0

  return {
    leftHeader: pair.left?.signature ?? '',
    rightHeader: pair.right?.signature ?? '',
    lines: alignLines(leftLines, rightLines, leftBaseIdx, rightBaseIdx),
    type: pair.type,
  }
}

/**
 * 完整的函数级对齐流程
 * 将一个 hunk 的行分离、解析、匹配、对齐
 *
 * @param leftLines 左侧行（deletion + context）
 * @param rightLines 右侧行（addition + context）
 * @returns 对齐后的完整结果
 */
export function alignDiff(
  leftLines: DiffLine[],
  rightLines: DiffLine[]
): AlignedDiff {
  // 解析函数块
  const leftParsed = parseFunctionBlocks(leftLines)
  const rightParsed = parseFunctionBlocks(rightLines)

  // 匹配函数
  const matchedPairs = matchFunctions(leftParsed.functions, rightParsed.functions)

  // 对齐每个函数对
  const alignedPairs = matchedPairs.map(pair => alignFunctionPair(pair))

  // 对齐孤儿行
  const orphanLines = alignLines(
    leftParsed.orphanLines,
    rightParsed.orphanLines,
    0,
    0
  )

  return {
    pairs: alignedPairs,
    orphanLines,
  }
}

/**
 * 简化的对齐：不进行函数解析，直接行级对齐
 * 用于无法解析函数的文件（如 JSON、配置文件）
 */
export function alignLinesSimple(
  leftLines: DiffLine[],
  rightLines: DiffLine[]
): AlignedLine[] {
  return alignLines(leftLines, rightLines, 0, 0)
}

/**
 * 检查文件是否适合进行函数级对齐
 * @param filePath 文件路径
 * @returns 是否支持函数对齐
 */
export function supportsFunctionAlign(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const supportedExtensions = [
    'js', 'jsx', 'ts', 'tsx',  // JavaScript/TypeScript
    'java', 'kt', 'kts',       // Java/Kotlin
    'py',                       // Python
    'go',                       // Go
    'rs',                       // Rust
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',  // C/C++
    'cs',                       // C#
    'rb',                       // Ruby
    'php',                      // PHP
    'swift',                    // Swift
    'scala',                    // Scala
  ]
  return ext ? supportedExtensions.includes(ext) : false
}
