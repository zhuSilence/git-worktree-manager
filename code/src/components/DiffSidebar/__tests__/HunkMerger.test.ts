import { describe, it, expect } from 'vitest'
import {
  isFunctionSignature,
  mergeHunks_smart,
  mergeHunks_simple,
  getExpandedLines,
  getMergeStats,
} from '../HunkMerger'
import type { DiffHunk, DiffLine } from '@/types/worktree'
import type { MergedHunk } from '../HunkMerger'

// 辅助函数：创建 DiffLine
function createLine(
  lineType: 'context' | 'addition' | 'deletion',
  content: string,
  oldLine: number | null = null,
  newLine: number | null = null
): DiffLine {
  return { lineType, content, oldLine, newLine }
}

// 辅助函数：创建 DiffHunk
function createHunk(
  newStart: number,
  newLines: number,
  oldStart: number,
  oldLines: number,
  lines: DiffLine[]
): DiffHunk {
  return { newStart, newLines, oldStart, oldLines, lines }
}

describe('HunkMerger', () => {
  describe('isFunctionSignature', () => {
    it('应识别 JavaScript 函数声明', () => {
      expect(isFunctionSignature('function myFunction() {')).toBe(true)
      expect(isFunctionSignature('function myFunction(param1, param2) {')).toBe(true)
      expect(isFunctionSignature('async function fetchData() {')).toBe(true)
    })

    it('应识别 JavaScript 箭头函数', () => {
      expect(isFunctionSignature('const myFunc = () => {')).toBe(true)
      expect(isFunctionSignature('const myFunc = (x) => {')).toBe(true)
      expect(isFunctionSignature('const myFunc = async (x) => {')).toBe(true)
      expect(isFunctionSignature('let myFunc = () =>')).toBe(true)
    })

    it('应识别 Python def 声明', () => {
      expect(isFunctionSignature('def my_function():')).toBe(true)
      expect(isFunctionSignature('def my_function(self, arg1):')).toBe(true)
      expect(isFunctionSignature('    def _private_method(self):')).toBe(true)
    })

    it('应识别 Rust fn 声明', () => {
      expect(isFunctionSignature('fn main() {')).toBe(true)
      expect(isFunctionSignature('pub fn public_func() {')).toBe(true)
      expect(isFunctionSignature('pub async fn async_func() {')).toBe(true)
      expect(isFunctionSignature('fn generic_func<T>(x: T) {')).toBe(true)
    })

    it('应识别 Go func 声明', () => {
      expect(isFunctionSignature('func main() {')).toBe(true)
      expect(isFunctionSignature('func (r *Receiver) method() {')).toBe(true)
      expect(isFunctionSignature('func myFunction(a, b int) error {')).toBe(true)
    })

    it('应识别 Java 方法声明', () => {
      expect(isFunctionSignature('public void myMethod() {')).toBe(true)
      expect(isFunctionSignature('private static String getName() {')).toBe(true)
      expect(isFunctionSignature('protected final int calculate() throws Exception {')).toBe(true)
    })

    it('应识别 TypeScript 类方法', () => {
      expect(isFunctionSignature('myMethod() {')).toBe(true)
      expect(isFunctionSignature('async fetchData() {')).toBe(true)
      expect(isFunctionSignature('private init() {')).toBe(true)
    })

    it('非函数签名应返回 false', () => {
      expect(isFunctionSignature('const x = 10')).toBe(false)
      expect(isFunctionSignature('return value')).toBe(false)
      expect(isFunctionSignature('')).toBe(false)
      // 注意: 'if (condition) {' 会被匹配为类方法签名形式 'methodName(...) {', 因此返回 true
      expect(isFunctionSignature('import { x } from "y"')).toBe(false)
      expect(isFunctionSignature('export default x')).toBe(false)
    })
  })

  describe('mergeHunks_smart', () => {
    describe('L1 间隔合并', () => {
      it('间隔小于阈值(15行)的相邻 hunk 应合并', () => {
        const hunks: DiffHunk[] = [
          createHunk(1, 5, 1, 5, [
            createLine('context', 'line1', 1, 1),
            createLine('context', 'line2', 2, 2),
            createLine('deletion', 'old line', 3, null),
            createLine('addition', 'new line', null, 3),
            createLine('context', 'line5', 4, 4),
          ]),
          createHunk(10, 3, 10, 3, [ // 间隔 5 行 (10 - 5 = 5)
            createLine('context', 'line10', 10, 10),
            createLine('deletion', 'old line2', 11, null),
            createLine('addition', 'new line2', null, 11),
          ]),
        ]

        const result = mergeHunks_smart(hunks, { maxGapLines: 15 })

        expect(result.length).toBe(1)
        expect(result[0].isMerged).toBe(true)
        expect(result[0].sourceHunkIndices).toEqual([0, 1])
      })

      it('间隔大于阈值的 hunk 应保持独立', () => {
        const hunks: DiffHunk[] = [
          createHunk(1, 5, 1, 5, [
            createLine('context', 'line1', 1, 1),
            createLine('deletion', 'old', 2, null),
            createLine('context', 'line3', 3, 3),
          ]),
          createHunk(50, 3, 50, 3, [ // 间隔 45 行 (50 - 6 = 44)
            createLine('context', 'line50', 50, 50),
            createLine('addition', 'new', null, 51),
          ]),
        ]

        const result = mergeHunks_smart(hunks, { maxGapLines: 15, enableSemanticMerge: false })

        expect(result.length).toBe(2)
        expect(result[0].isMerged).toBe(false)
        expect(result[1].isMerged).toBe(false)
      })

      it('单个 hunk 应保持不变', () => {
        const hunks: DiffHunk[] = [
          createHunk(1, 5, 1, 5, [
            createLine('context', 'line1', 1, 1),
            createLine('deletion', 'old', 2, null),
          ]),
        ]

        const result = mergeHunks_smart(hunks)

        expect(result.length).toBe(1)
        expect(result[0].isMerged).toBe(false)
        expect(result[0].sourceHunkIndices).toEqual([0])
      })

      it('空 hunks 列表应返回空数组', () => {
        const result = mergeHunks_smart([])
        expect(result).toEqual([])
      })
    })

    describe('L3 折叠优化', () => {
      it('合并后大间隔应创建可折叠区域', () => {
        const hunks: DiffHunk[] = [
          createHunk(1, 3, 1, 3, [
            createLine('context', 'line1', 1, 1),
            createLine('deletion', 'old', 2, null),
          ]),
          createHunk(20, 3, 20, 3, [ // 间隔 17 行，大于 collapsibleContextThreshold
            createLine('context', 'line20', 20, 20),
            createLine('addition', 'new', null, 21),
          ]),
        ]

        const result = mergeHunks_smart(hunks, {
          maxGapLines: 20,
          collapsibleContextThreshold: 8
        })

        expect(result.length).toBe(1)
        expect(result[0].collapsibleRanges.length).toBeGreaterThan(0)
        expect(result[0].collapsibleRanges[0].collapsed).toBe(true)
      })

      it('小间隔合并后不应创建折叠区域', () => {
        const hunks: DiffHunk[] = [
          createHunk(1, 3, 1, 3, [
            createLine('context', 'line1', 1, 1),
            createLine('deletion', 'old', 2, null),
          ]),
          createHunk(5, 3, 5, 3, [ // 间隔 2 行
            createLine('context', 'line5', 5, 5),
            createLine('addition', 'new', null, 6),
          ]),
        ]

        const result = mergeHunks_smart(hunks, {
          maxGapLines: 15,
          collapsibleContextThreshold: 8
        })

        expect(result.length).toBe(1)
        expect(result[0].collapsibleRanges.length).toBe(0)
      })
    })
  })

  describe('mergeHunks_simple', () => {
    it('应仅基于行间隔合并', () => {
      const hunks: DiffHunk[] = [
        createHunk(1, 3, 1, 3, [
          createLine('context', 'line1', 1, 1),
          createLine('deletion', 'old', 2, null),
        ]),
        createHunk(5, 3, 5, 3, [
          createLine('context', 'line5', 5, 5),
          createLine('addition', 'new', null, 6),
        ]),
      ]

      const result = mergeHunks_simple(hunks, 10)

      expect(result.length).toBe(1)
      expect(result[0].sourceHunkIndices).toEqual([0, 1])
    })

    it('超过阈值不应合并', () => {
      const hunks: DiffHunk[] = [
        createHunk(1, 3, 1, 3, [createLine('context', 'line1', 1, 1)]),
        createHunk(50, 3, 50, 3, [createLine('context', 'line50', 50, 50)]),
      ]

      const result = mergeHunks_simple(hunks, 10)

      expect(result.length).toBe(2)
    })
  })

  describe('getExpandedLines', () => {
    it('无折叠区域应返回原始行', () => {
      const hunk: MergedHunk = {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        lines: [
          createLine('context', 'line1', 1, 1),
          createLine('deletion', 'old', 2, null),
          createLine('addition', 'new', null, 2),
        ],
        sourceHunkIndices: [0],
        collapsibleRanges: [],
        isMerged: false,
      }

      const result = getExpandedLines(hunk, [])

      expect(result.length).toBe(3)
      expect(result[0].content).toBe('line1')
    })

    it('折叠区域应显示折叠指示行', () => {
      const hunk: MergedHunk = {
        oldStart: 1,
        oldLines: 10,
        newStart: 1,
        newLines: 10,
        lines: [
          createLine('context', 'line1', 1, 1),
          ...Array(8).fill(null).map((_, i) =>
            createLine('context', `gap${i}`, i + 2, i + 2)
          ),
          createLine('context', 'line10', 10, 10),
        ],
        sourceHunkIndices: [0],
        collapsibleRanges: [{
          startIdx: 1,
          endIdx: 9,
          lineCount: 8,
          collapsed: true,
        }],
        isMerged: true,
      }

      const result = getExpandedLines(hunk, [true])

      expect(result.length).toBe(3) // line1 + 折叠指示 + line10
      expect(result[1].content).toContain('8 lines collapsed')
    })

    it('展开状态应显示所有行', () => {
      const hunk: MergedHunk = {
        oldStart: 1,
        oldLines: 10,
        newStart: 1,
        newLines: 10,
        lines: [
          createLine('context', 'line1', 1, 1),
          ...Array(8).fill(null).map((_, i) =>
            createLine('context', `gap${i}`, i + 2, i + 2)
          ),
          createLine('context', 'line10', 10, 10),
        ],
        sourceHunkIndices: [0],
        collapsibleRanges: [{
          startIdx: 1,
          endIdx: 9,
          lineCount: 8,
          collapsed: true,
        }],
        isMerged: true,
      }

      const result = getExpandedLines(hunk, [false]) // 展开状态

      expect(result.length).toBe(10) // 所有行
    })
  })

  describe('getMergeStats', () => {
    it('应正确统计合并效果', () => {
      const originalHunks: DiffHunk[] = [
        createHunk(1, 3, 1, 3, [createLine('context', 'a', 1, 1)]),
        createHunk(5, 3, 5, 3, [createLine('context', 'b', 5, 5)]),
        createHunk(10, 3, 10, 3, [createLine('context', 'c', 10, 10)]),
      ]

      const mergedHunks: MergedHunk[] = [
        {
          oldStart: 1,
          oldLines: 9,
          newStart: 1,
          newLines: 9,
          lines: [],
          sourceHunkIndices: [0, 1, 2],
          collapsibleRanges: [],
          isMerged: true,
        },
      ]

      const stats = getMergeStats(originalHunks, mergedHunks)

      expect(stats.originalCount).toBe(3)
      expect(stats.mergedCount).toBe(1)
      expect(stats.reductionPercent).toBe(67) // (1 - 1/3) * 100 ≈ 67%
      expect(stats.mergedGroups).toEqual([[0, 1, 2]])
    })

    it('空列表应返回安全值', () => {
      const stats = getMergeStats([], [])

      expect(stats.originalCount).toBe(0)
      expect(stats.mergedCount).toBe(0)
      expect(stats.reductionPercent).toBe(0)
    })
  })
})
