import { describe, it, expect } from 'vitest'
import {
  findLineMatches,
  alignLines,
  alignDiff,
  alignLinesSimple,
  supportsFunctionAlign,
} from '../LineAligner'
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

describe('LineAligner', () => {
  describe('supportsFunctionAlign', () => {
    it('应支持 .ts/.js/.jsx/.tsx 扩展名', () => {
      expect(supportsFunctionAlign('file.ts')).toBe(true)
      expect(supportsFunctionAlign('file.js')).toBe(true)
      expect(supportsFunctionAlign('file.jsx')).toBe(true)
      expect(supportsFunctionAlign('file.tsx')).toBe(true)
      expect(supportsFunctionAlign('/path/to/file.ts')).toBe(true)
      expect(supportsFunctionAlign('./src/utils/helper.js')).toBe(true)
    })

    it('应支持 .py 扩展名', () => {
      expect(supportsFunctionAlign('script.py')).toBe(true)
      expect(supportsFunctionAlign('/app/main.py')).toBe(true)
    })

    it('应支持 .go 扩展名', () => {
      expect(supportsFunctionAlign('main.go')).toBe(true)
      expect(supportsFunctionAlign('/pkg/server.go')).toBe(true)
    })

    it('应支持 .rs 扩展名', () => {
      expect(supportsFunctionAlign('lib.rs')).toBe(true)
      expect(supportsFunctionAlign('/src/main.rs')).toBe(true)
    })

    it('应支持 .java 扩展名', () => {
      expect(supportsFunctionAlign('Main.java')).toBe(true)
      expect(supportsFunctionAlign('/src/com/example/App.java')).toBe(true)
    })

    it('应支持其他常见编程语言扩展名', () => {
      expect(supportsFunctionAlign('file.c')).toBe(true)
      expect(supportsFunctionAlign('file.cpp')).toBe(true)
      expect(supportsFunctionAlign('file.kt')).toBe(true)
      expect(supportsFunctionAlign('file.kts')).toBe(true)
      expect(supportsFunctionAlign('file.swift')).toBe(true)
      expect(supportsFunctionAlign('file.rb')).toBe(true)
      expect(supportsFunctionAlign('file.php')).toBe(true)
      expect(supportsFunctionAlign('file.scala')).toBe(true)
      expect(supportsFunctionAlign('file.cs')).toBe(true)
    })

    it('应不支持 .txt/.md/.json 等扩展名', () => {
      expect(supportsFunctionAlign('readme.txt')).toBe(false)
      expect(supportsFunctionAlign('README.md')).toBe(false)
      expect(supportsFunctionAlign('config.json')).toBe(false)
      expect(supportsFunctionAlign('styles.css')).toBe(false)
      expect(supportsFunctionAlign('data.yaml')).toBe(false)
      expect(supportsFunctionAlign('data.yml')).toBe(false)
    })

    it('无扩展名应返回 false', () => {
      expect(supportsFunctionAlign('Makefile')).toBe(false)
      expect(supportsFunctionAlign('Dockerfile')).toBe(false)
    })

    it('空字符串应返回 false', () => {
      expect(supportsFunctionAlign('')).toBe(false)
    })
  })

  describe('findLineMatches', () => {
    it('context 行应作为锚点匹配', () => {
      const leftLines: DiffLine[] = [
        createLine('context', 'unchanged line', 1, 1),
        createLine('deletion', 'old line', 2, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('context', 'unchanged line', 1, 1),
        createLine('addition', 'new line', null, 2),
      ]

      const matches = findLineMatches(leftLines, rightLines)

      expect(matches.has(0)).toBe(true)
      expect(matches.get(0)).toBe(0) // 左侧第0行匹配右侧第0行
    })

    it('相似的 deletion/addition 行应匹配', () => {
      const leftLines: DiffLine[] = [
        createLine('deletion', 'const value = 10', 1, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('addition', 'const value = 20', null, 1),
      ]

      const matches = findLineMatches(leftLines, rightLines)

      expect(matches.has(0)).toBe(true)
      expect(matches.get(0)).toBe(0)
    })

    it('不相似的行不应匹配', () => {
      const leftLines: DiffLine[] = [
        createLine('deletion', 'AAA BBB CCC DDD EEE FFF GGG HHH', 1, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('addition', 'XXX YYY ZZZ 111 222 333 444 555', null, 1),
      ]

      const matches = findLineMatches(leftLines, rightLines)

      // 相似度应该低于 0.6 阈值，不匹配
      expect(matches.has(0)).toBe(false)
    })

    it('空数组应返回空映射', () => {
      const matches = findLineMatches([], [])
      expect(matches.size).toBe(0)
    })
  })

  describe('alignLines', () => {
    it('匹配行应在同一水平位置', () => {
      const leftLines: DiffLine[] = [
        createLine('context', 'header', 1, 1),
        createLine('deletion', 'old', 2, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('context', 'header', 1, 1),
        createLine('addition', 'new', null, 2),
      ]

      const result = alignLines(leftLines, rightLines)

      // 第一行应该匹配
      expect(result[0].left).not.toBeNull()
      expect(result[0].right).not.toBeNull()
      expect(result[0].left?.content).toBe('header')
      expect(result[0].right?.content).toBe('header')
    })

    it('无匹配的左侧行应有 null 右侧', () => {
      const leftLines: DiffLine[] = [
        createLine('deletion', 'AAA BBB CCC DDD EEE FFF GGG HHH III', 1, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('addition', 'XXX YYY ZZZ 111 222 333 444 555 666', null, 1),
      ]

      const result = alignLines(leftLines, rightLines)

      // 两行不匹配，应该分别显示
      // 左侧独占一行（right 为 null），右侧独占一行（left 为 null）
      const leftOnlyCount = result.filter(r => r.left !== null && r.right === null).length
      const rightOnlyCount = result.filter(r => r.left === null && r.right !== null).length

      expect(leftOnlyCount).toBe(1)
      expect(rightOnlyCount).toBe(1)
    })

    it('空输入应返回空结果', () => {
      const result = alignLines([], [])
      expect(result).toEqual([])
    })

    it('应正确处理多行场景', () => {
      const leftLines: DiffLine[] = [
        createLine('context', 'line 1', 1, 1),
        createLine('deletion', 'old line', 2, null),
        createLine('context', 'line 3', 3, 3),
      ]
      const rightLines: DiffLine[] = [
        createLine('context', 'line 1', 1, 1),
        createLine('addition', 'new line', null, 2),
        createLine('context', 'line 3', 3, 3),
      ]

      const result = alignLines(leftLines, rightLines)

      // 第一行和第三行应该匹配
      expect(result[0].left?.content).toBe('line 1')
      expect(result[0].right?.content).toBe('line 1')

      // 中间的删除/新增行
      expect(result.some(r => r.left?.content === 'old line')).toBe(true)
      expect(result.some(r => r.right?.content === 'new line')).toBe(true)
    })
  })

  describe('alignLinesSimple', () => {
    it('应直接对齐行', () => {
      const leftLines: DiffLine[] = [
        createLine('deletion', 'old line', 1, null),
      ]
      const rightLines: DiffLine[] = [
        createLine('addition', 'new line', null, 1),
      ]

      const result = alignLinesSimple(leftLines, rightLines)

      expect(result.length).toBeGreaterThan(0)
    })

    it('空输入应返回空结果', () => {
      const result = alignLinesSimple([], [])
      expect(result).toEqual([])
    })
  })

  describe('alignDiff', () => {
    it('空输入应返回空结果', () => {
      const result = alignDiff([], [])

      expect(result.pairs).toEqual([])
      expect(result.orphanLines).toEqual([])
    })

    it('应正确处理包含函数签名的代码', () => {
      // 创建包含函数签名的测试数据
      const leftLines: DiffLine[] = [
        createLine('context', 'function myFunc() {', 1, 1),
        createLine('deletion', '  const x = 1;', 2, null),
        createLine('context', '}', 3, 3),
      ]
      const rightLines: DiffLine[] = [
        createLine('context', 'function myFunc() {', 1, 1),
        createLine('addition', '  const x = 2;', null, 2),
        createLine('context', '}', 3, 3),
      ]

      const result = alignDiff(leftLines, rightLines)

      // 应该有函数对或孤儿行
      expect(result.pairs.length + result.orphanLines.length).toBeGreaterThan(0)
    })

    it('应分离孤儿行和函数块', () => {
      // 顶层代码（孤儿行）和函数混合
      const leftLines: DiffLine[] = [
        createLine('deletion', 'const a = 1;', 1, null), // 孤儿行
        createLine('context', 'function test() {', 2, 2),
        createLine('deletion', '  return 1;', 3, null),
        createLine('context', '}', 4, 4),
      ]
      const rightLines: DiffLine[] = [
        createLine('addition', 'const a = 2;', null, 1), // 孤儿行
        createLine('context', 'function test() {', 2, 2),
        createLine('addition', '  return 2;', null, 3),
        createLine('context', '}', 4, 4),
      ]

      const result = alignDiff(leftLines, rightLines)

      // 结果应该包含对齐后的内容
      expect(result).toBeDefined()
      expect(Array.isArray(result.pairs)).toBe(true)
      expect(Array.isArray(result.orphanLines)).toBe(true)
    })
  })
})
