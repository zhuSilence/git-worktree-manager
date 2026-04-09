import { describe, it, expect } from 'vitest'
import { computeIntraLineDiff, pairHunkLines } from '../DiffAlgorithm'
import type { DiffLine } from '@/types/worktree'

// 辅助函数：创建 DiffLine
function createLine(
  lineType: 'context' | 'addition' | 'deletion',
  content: string,
  oldLine: number | null = null,
  newLine: number | null = null
): DiffLine {
  return { lineType, content, oldLine, newLine }
}

describe('DiffAlgorithm', () => {
  describe('computeIntraLineDiff', () => {
    it('完全相同的行应无差异', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'const x = 10',
        'const x = 10'
      )

      expect(oldSegments.length).toBe(1)
      expect(newSegments.length).toBe(1)
      expect(oldSegments[0].text).toBe('const x = 10')
      expect(oldSegments[0].highlight).toBe(false)
      expect(newSegments[0].text).toBe('const x = 10')
      expect(newSegments[0].highlight).toBe(false)
    })

    it('完全不同的行应标记全部差异', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'abc',
        'xyz'
      )

      expect(oldSegments.length).toBe(1)
      expect(newSegments.length).toBe(1)
      expect(oldSegments[0].text).toBe('abc')
      expect(oldSegments[0].highlight).toBe(true)
      expect(newSegments[0].text).toBe('xyz')
      expect(newSegments[0].highlight).toBe(true)
    })

    it('只有中间部分不同应正确标记', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'const foo = 10',
        'const bar = 10'
      )

      // 公共前缀 "const "
      expect(oldSegments[0].text).toBe('const ')
      expect(oldSegments[0].highlight).toBe(false)

      // 差异部分 "foo" vs "bar"
      expect(oldSegments[1].text).toBe('foo')
      expect(oldSegments[1].highlight).toBe(true)
      expect(newSegments[1].text).toBe('bar')
      expect(newSegments[1].highlight).toBe(true)

      // 公共后缀 " = 10"
      expect(oldSegments[2].text).toBe(' = 10')
      expect(oldSegments[2].highlight).toBe(false)
    })

    it('公共前缀和后缀应正确识别', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'function getValue() {',
        'function setValue() {'
      )

      // 检查公共前缀 "function "
      expect(oldSegments[0].text).toBe('function ')
      expect(oldSegments[0].highlight).toBe(false)

      // 公共前缀后，剩余部分：old="getValue() {" new="setValue() {"
      // 从剩余部分找公共后缀："etValue() {"
      // 差异部分："g" vs "s"
      // 所以 oldSegments: ["function ", "g", "etValue() {"]
      //     newSegments: ["function ", "s", "etValue() {"]

      expect(oldSegments[1].text).toBe('g')
      expect(oldSegments[1].highlight).toBe(true)
      expect(newSegments[1].text).toBe('s')
      expect(newSegments[1].highlight).toBe(true)

      // 检查公共后缀 "etValue() {"
      expect(oldSegments[2].text).toBe('etValue() {')
      expect(oldSegments[2].highlight).toBe(false)
      expect(newSegments[2].text).toBe('etValue() {')
      expect(newSegments[2].highlight).toBe(false)
    })

    it('空行处理', () => {
      // 空字符串 vs 非空
      const result1 = computeIntraLineDiff('', 'new content')
      expect(result1.oldSegments.length).toBe(0)
      expect(result1.newSegments.length).toBe(1)
      expect(result1.newSegments[0].text).toBe('new content')
      expect(result1.newSegments[0].highlight).toBe(true)

      // 非空 vs 空字符串
      const result2 = computeIntraLineDiff('old content', '')
      expect(result2.oldSegments.length).toBe(1)
      expect(result2.oldSegments[0].text).toBe('old content')
      expect(result2.oldSegments[0].highlight).toBe(true)
      expect(result2.newSegments.length).toBe(0)

      // 两个空字符串
      const result3 = computeIntraLineDiff('', '')
      expect(result3.oldSegments.length).toBe(0)
      expect(result3.newSegments.length).toBe(0)
    })

    it('一侧有公共前缀但另一侧无公共后缀', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'hello',
        'hello world'
      )

      // old: "hello" - 公共前缀，无差异
      expect(oldSegments.length).toBe(1)
      expect(oldSegments[0].text).toBe('hello')
      expect(oldSegments[0].highlight).toBe(false)

      // new: "hello" + " world"
      expect(newSegments.length).toBe(2)
      expect(newSegments[0].text).toBe('hello')
      expect(newSegments[0].highlight).toBe(false)
      expect(newSegments[1].text).toBe(' world')
      expect(newSegments[1].highlight).toBe(true)
    })

    it('只有后缀相同', () => {
      const { oldSegments, newSegments } = computeIntraLineDiff(
        'old_value;',
        'new_value;'
      )

      // 无公共前缀
      // 公共后缀 "_value;"
      // 差异部分 "old" vs "new"
      expect(oldSegments[0].text).toBe('old')
      expect(oldSegments[0].highlight).toBe(true)
      expect(oldSegments[1].text).toBe('_value;')
      expect(oldSegments[1].highlight).toBe(false)

      expect(newSegments[0].text).toBe('new')
      expect(newSegments[0].highlight).toBe(true)
      expect(newSegments[1].text).toBe('_value;')
      expect(newSegments[1].highlight).toBe(false)
    })
  })

  describe('pairHunkLines', () => {
    it('等数量的删除和新增行应正确配对', () => {
      const lines: DiffLine[] = [
        createLine('deletion', 'const a = 1', 1, null),
        createLine('deletion', 'const b = 2', 2, null),
        createLine('addition', 'const a = 10', null, 1),
        createLine('addition', 'const b = 20', null, 2),
      ]

      const result = pairHunkLines(lines)

      // 应该有 4 个条目（2 删除 + 2 新增）
      expect(result.size).toBe(4)

      // 检查删除行的字符级差异
      expect(result.has(0)).toBe(true)
      expect(result.has(1)).toBe(true)

      // 检查新增行的字符级差异
      expect(result.has(2)).toBe(true)
      expect(result.has(3)).toBe(true)
    })

    it('不等数量应优先配对相似行', () => {
      const lines: DiffLine[] = [
        createLine('deletion', 'const a = 1', 1, null),
        createLine('deletion', 'const b = 2', 2, null),
        createLine('addition', 'const a = 10', null, 1), // 与第1行相似
        // 第2行删除无配对
      ]

      const result = pairHunkLines(lines)

      // 应该有 2 个条目（第1个删除配对第1个新增）
      expect(result.size).toBe(2)
      expect(result.has(0)).toBe(true)
      expect(result.has(2)).toBe(true)
    })

    it('只有删除行应返回空映射', () => {
      const lines: DiffLine[] = [
        createLine('deletion', 'const a = 1', 1, null),
        createLine('deletion', 'const b = 2', 2, null),
      ]

      const result = pairHunkLines(lines)

      // 无配对时应该返回空 Map（因为没有新增行来配对）
      expect(result.size).toBe(0)
    })

    it('只有新增行应返回空映射', () => {
      const lines: DiffLine[] = [
        createLine('addition', 'const a = 1', null, 1),
        createLine('addition', 'const b = 2', null, 2),
      ]

      const result = pairHunkLines(lines)

      expect(result.size).toBe(0)
    })

    it('包含 context 行应跳过', () => {
      const lines: DiffLine[] = [
        createLine('context', '// header', 1, 1),
        createLine('deletion', 'const a = 1', 2, null),
        createLine('addition', 'const a = 10', null, 2),
        createLine('context', '// footer', 3, 3),
      ]

      const result = pairHunkLines(lines)

      // 只有删除和新增行会被配对
      expect(result.size).toBe(2)
      expect(result.has(1)).toBe(true)
      expect(result.has(2)).toBe(true)
    })

    it('多组删除/新增块应分别配对', () => {
      const lines: DiffLine[] = [
        createLine('deletion', 'old line 1', 1, null),
        createLine('addition', 'new line 1', null, 1),
        createLine('context', 'unchanged', 2, 2),
        createLine('deletion', 'old line 2', 3, null),
        createLine('addition', 'new line 2', null, 3),
      ]

      const result = pairHunkLines(lines)

      expect(result.size).toBe(4)
      expect(result.has(0)).toBe(true) // old line 1
      expect(result.has(1)).toBe(true) // new line 1
      expect(result.has(3)).toBe(true) // old line 2
      expect(result.has(4)).toBe(true) // new line 2
    })

    it('空数组应返回空映射', () => {
      const result = pairHunkLines([])
      expect(result.size).toBe(0)
    })
  })
})
