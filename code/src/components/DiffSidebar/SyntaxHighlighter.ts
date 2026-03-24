import type { SyntaxToken } from './types'

/**
 * 编程语言关键字集合
 */
export const KEYWORDS = new Set([
  // JavaScript/TypeScript
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else',
  'for', 'while', 'switch', 'case', 'break', 'continue', 'default', 'new', 'this',
  'class', 'extends', 'implements', 'interface', 'type', 'enum',
  'async', 'await', 'try', 'catch', 'finally', 'throw', 'yield',
  'true', 'false', 'null', 'undefined', 'void', 'typeof', 'instanceof', 'in', 'of',
  'static', 'readonly', 'private', 'public', 'protected', 'super',
  // Rust
  'struct', 'pub', 'fn', 'mod', 'use', 'self', 'mut', 'impl', 'trait', 'where',
  'match', 'loop', 'move', 'ref', 'dyn', 'unsafe', 'extern', 'crate',
])

/**
 * 语法着色类名映射
 */
export const SYNTAX_COLORS: Record<string, string> = {
  keyword: 'text-purple-600 dark:text-purple-400',
  string: 'text-amber-700 dark:text-amber-300',
  comment: 'text-gray-400 dark:text-gray-500 italic',
  number: 'text-cyan-600 dark:text-cyan-400',
  normal: '',
}

/**
 * 将代码文本分词为语法 Token 列表
 * 支持注释、字符串、数字、关键字的识别
 */
export function tokenize(text: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = []

  // 正则匹配顺序：注释 -> 字符串 -> 数字 -> 标识符 -> 其他字符
  const re = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([\s\S])/gm

  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match[1]) {
      // 注释
      tokens.push({ text: match[0], type: 'comment' })
    } else if (match[2]) {
      // 字符串
      tokens.push({ text: match[0], type: 'string' })
    } else if (match[3]) {
      // 数字
      tokens.push({ text: match[0], type: 'number' })
    } else if (match[4]) {
      // 标识符（可能是关键字）
      tokens.push({
        text: match[0],
        type: KEYWORDS.has(match[0]) ? 'keyword' : 'normal',
      })
    } else {
      // 其他字符
      tokens.push({ text: match[0], type: 'normal' })
    }
  }

  return tokens
}
