import type { DiffLine } from '@/types/worktree'
import type { FunctionBlock, ParsedDiff } from './types'

/**
 * 函数签名检测模式（支持多种语言）
 * 每个模式返回捕获组中的函数名
 */
const FUNCTION_PATTERNS: Array<{ pattern: RegExp; nameGroup: number }> = [
  // Java/Kotlin: public void methodName(...) {
  {
    pattern: /^\s*(?:public|protected|private|static|final|abstract|synchronized|\s)*\s*(?:void|[A-Z]\w*(?:<[^>]*>)?|\w+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[^{]+)?\s*\{?\s*$/,
    nameGroup: 1,
  },
  // JavaScript/TypeScript: function name(...) / async function name(...)
  {
    pattern: /^\s*(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/,
    nameGroup: 1,
  },
  // Arrow functions: const name = (...) => / const name = async (...) =>
  {
    pattern: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
    nameGroup: 1,
  },
  // Class methods: methodName(...) { / async methodName(...) {
  {
    pattern: /^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{?\s*$/,
    nameGroup: 1,
  },
  // Python: def method_name(...):
  {
    pattern: /^\s*def\s+(\w+)\s*\([^)]*\)\s*:/,
    nameGroup: 1,
  },
  // Go: func (r *Receiver) methodName(...) / func methodName(...)
  {
    pattern: /^\s*func\s*(?:\([^)]+\))?\s*(\w+)\s*\([^)]*\)/,
    nameGroup: 1,
  },
  // Rust: fn method_name(...) / pub fn method_name(...)
  {
    pattern: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*[<(]/,
    nameGroup: 1,
  },
  // C/C++: returnType methodName(...) {
  {
    pattern: /^\s*(?:\w+\s*\*?\s+)+(\w+)\s*\([^)]*\)\s*(?:const)?\s*\{?\s*$/,
    nameGroup: 1,
  },
]

/**
 * 检测函数签名并提取函数名
 * @param line 代码行内容
 * @returns 函数名和签名，或 null（非函数行）
 */
export function detectFunctionStart(line: string): { name: string; signature: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  for (const { pattern, nameGroup } of FUNCTION_PATTERNS) {
    const match = trimmed.match(pattern)
    if (match && match[nameGroup]) {
      return {
        name: match[nameGroup],
        signature: trimmed,
      }
    }
  }

  return null
}

/**
 * 获取行的缩进级别（用于 Python 等基于缩进的语言）
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/)
  return match ? match[1].length : 0
}

/**
 * 计算行中的大括号平衡值
 * @param line 代码行
 * @returns 大括号增量（正数为开括号多，负数为闭括号多）
 */
function countBraceBalance(line: string): number {
  let balance = 0
  let inString = false
  let stringChar = ''
  let prevChar = ''

  for (const char of line) {
    // 处理字符串
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true
      stringChar = char
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false
    } else if (!inString) {
      if (char === '{') balance++
      else if (char === '}') balance--
    }
    prevChar = char
  }

  return balance
}

/**
 * 检测函数结束位置（基于大括号匹配或缩进）
 * @param lines diff 行数组
 * @param startIdx 函数开始的索引
 * @returns 函数结束的索引（不含）
 */
export function detectFunctionEnd(lines: DiffLine[], startIdx: number): number {
  if (startIdx >= lines.length) return startIdx + 1

  const startLine = lines[startIdx].content
  const isPython = /^\s*def\s+/.test(startLine)

  if (isPython) {
    // Python: 基于缩进检测
    const baseIndent = getIndentLevel(startLine)
    let i = startIdx + 1

    while (i < lines.length) {
      const line = lines[i].content
      const trimmed = line.trim()

      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) {
        i++
        continue
      }

      const currentIndent = getIndentLevel(line)
      // 如果缩进回到或低于基础缩进，函数结束
      if (currentIndent <= baseIndent) {
        break
      }
      i++
    }

    return i
  } else {
    // 其他语言: 基于大括号匹配
    let braceCount = 0
    let foundOpenBrace = false
    let i = startIdx

    while (i < lines.length) {
      const line = lines[i].content
      const balance = countBraceBalance(line)
      braceCount += balance

      if (balance > 0) foundOpenBrace = true

      // 如果已经找到开括号，且括号平衡，函数结束
      if (foundOpenBrace && braceCount <= 0) {
        return i + 1
      }

      i++
    }

    // 如果没有找到匹配的闭括号，返回到末尾
    return lines.length
  }
}

/**
 * 检测是否是类/接口/枚举定义（不是函数）
 */
function isClassDefinition(line: string): boolean {
  const trimmed = line.trim()
  return /^\s*(?:public|private|protected|abstract|final|static|\s)*\s*(?:class|interface|enum|struct|trait)\s+\w+/.test(trimmed)
}

/**
 * 解析一侧的 diff 行，提取函数块
 * @param lines diff 行数组
 * @returns 解析结果，包含函数块和孤儿行
 */
export function parseFunctionBlocks(lines: DiffLine[]): ParsedDiff {
  const functions: FunctionBlock[] = []
  const orphanLines: DiffLine[] = []
  const orphanIndices: number[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const funcInfo = detectFunctionStart(line.content)

    // 检测到函数签名且不是类定义
    if (funcInfo && !isClassDefinition(line.content)) {
      const endIdx = detectFunctionEnd(lines, i)

      functions.push({
        name: funcInfo.name,
        startIdx: i,
        endIdx,
        lines: lines.slice(i, endIdx),
        signature: funcInfo.signature,
      })

      i = endIdx
    } else {
      // 非函数行，记录为孤儿行
      orphanLines.push(line)
      orphanIndices.push(i)
      i++
    }
  }

  return { functions, orphanLines, orphanIndices }
}

/**
 * 检查一行是否是函数签名（简单版本，用于快速判断）
 */
export function isFunctionSignature(line: string): boolean {
  return detectFunctionStart(line) !== null
}
