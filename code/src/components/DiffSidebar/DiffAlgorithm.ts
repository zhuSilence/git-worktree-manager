import type { CharSegment } from './types'
import type { DiffLine } from '@/types/worktree'

/**
 * 计算两个字符串之间的字符级差异
 * 使用公共前缀/后缀算法快速定位差异区域
 */
export function computeIntraLineDiff(
  oldStr: string,
  newStr: string
): { oldSegments: CharSegment[]; newSegments: CharSegment[] } {
  // 找公共前缀
  let prefix = 0
  while (prefix < oldStr.length && prefix < newStr.length && oldStr[prefix] === newStr[prefix]) {
    prefix++
  }

  // 找公共后缀
  let oldEnd = oldStr.length
  let newEnd = newStr.length
  while (oldEnd > prefix && newEnd > prefix && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd--
    newEnd--
  }

  const oldSegments: CharSegment[] = []
  const newSegments: CharSegment[] = []

  // 公共前缀
  if (prefix > 0) {
    oldSegments.push({ text: oldStr.slice(0, prefix), highlight: false })
    newSegments.push({ text: newStr.slice(0, prefix), highlight: false })
  }

  // 差异部分
  if (oldEnd > prefix) {
    oldSegments.push({ text: oldStr.slice(prefix, oldEnd), highlight: true })
  }
  if (newEnd > prefix) {
    newSegments.push({ text: newStr.slice(prefix, newEnd), highlight: true })
  }

  // 公共后缀
  if (oldEnd < oldStr.length) {
    oldSegments.push({ text: oldStr.slice(oldEnd), highlight: false })
    newSegments.push({ text: newStr.slice(newEnd), highlight: false })
  }

  return { oldSegments, newSegments }
}

/**
 * 将 hunk 中连续的 deletion/addition 配对，计算字符级 diff
 * 返回一个 Map，key 为行索引，value 为该行的字符级差异片段
 */
export function pairHunkLines(lines: DiffLine[]): Map<number, CharSegment[]> {
  const charMap = new Map<number, CharSegment[]>()
  let i = 0

  while (i < lines.length) {
    // 收集连续删除行
    const delStart = i
    while (i < lines.length && lines[i].lineType === 'deletion') i++
    const delEnd = i

    // 收集连续新增行
    const addStart = i
    while (i < lines.length && lines[i].lineType === 'addition') i++
    const addEnd = i

    // 1:1 配对计算字符级差异
    const pairCount = Math.min(delEnd - delStart, addEnd - addStart)
    for (let p = 0; p < pairCount; p++) {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        lines[delStart + p].content,
        lines[addStart + p].content
      )
      charMap.set(delStart + p, oldSegments)
      charMap.set(addStart + p, newSegments)
    }

    // 跳过 context 行
    if (i === delStart) i++
  }

  return charMap
}
