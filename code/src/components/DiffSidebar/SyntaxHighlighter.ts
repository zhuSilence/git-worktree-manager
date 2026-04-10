import Prism from 'prismjs'

// 按需导入语言支持
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-toml'

// 文件扩展名到 Prism 语言的映射
const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  java: 'java',
  py: 'python',
  go: 'go',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  md: 'markdown',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  rb: 'ruby',
  php: 'php',
  scala: 'scala',
  toml: 'toml',
}

/**
 * 根据文件路径检测语言
 */
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (!ext) return null
  return EXT_TO_LANG[ext] || null
}

/**
 * 语法着色类名映射（Tailwind 类名）
 */
export const SYNTAX_COLORS: Record<string, string> = {
  keyword: 'text-purple-600 dark:text-purple-400',
  string: 'text-amber-700 dark:text-amber-300',
  comment: 'text-gray-400 dark:text-gray-500 italic',
  number: 'text-cyan-600 dark:text-cyan-400',
  operator: 'text-pink-600 dark:text-pink-400',
  function: 'text-blue-600 dark:text-blue-400',
  punctuation: 'text-gray-600 dark:text-gray-400',
  plain: '',
}

export interface SyntaxToken {
  text: string
  type: 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'function' | 'punctuation' | 'plain'
}

// 将 Prism token 扁平化为 SyntaxToken 数组
function flattenTokens(tokens: (string | Prism.Token)[]): SyntaxToken[] {
  const result: SyntaxToken[] = []
  for (const token of tokens) {
    if (typeof token === 'string') {
      result.push({ text: token, type: 'plain' })
    } else {
      // Prism.Token 可能有嵌套内容
      if (typeof token.content === 'string') {
        result.push({ text: token.content, type: normalizeTokenType(token.type) })
      } else if (Array.isArray(token.content)) {
        result.push(...flattenTokens(token.content))
      } else {
        result.push({ text: String(token.content), type: normalizeTokenType(token.type) })
      }
    }
  }
  return result
}

// 将 Prism token type 归一化为 SyntaxToken 支持的类型
function normalizeTokenType(type: string): SyntaxToken['type'] {
  const validTypes: SyntaxToken['type'][] = ['keyword', 'string', 'comment', 'number', 'operator', 'function', 'punctuation', 'plain']
  if (validTypes.includes(type as SyntaxToken['type'])) {
    return type as SyntaxToken['type']
  }
  // 映射常见 Prism token 类型
  if (type === 'builtin' || type === 'class-name') return 'function'
  if (type === 'tag' || type === 'attr-name') return 'keyword'
  if (type === 'attr-value') return 'string'
  return 'plain'
}

// 缓存已 tokenize 的结果
const tokenCache = new Map<string, SyntaxToken[]>()
const MAX_CACHE_SIZE = 5000

// 当前文件路径上下文（用于高亮时检测语言）
let currentFilePath: string | null = null

/**
 * 设置当前文件路径上下文
 */
export function setCurrentFilePath(filePath: string | null): void {
  currentFilePath = filePath
}

/**
 * 对单行代码进行语法分词
 * @param text 代码行文本
 * @param filePath 可选的文件路径，用于语言检测（优先于 setCurrentFilePath 设置的上下文）
 */
export function tokenize(text: string, filePath?: string): SyntaxToken[] {
  const path = filePath || currentFilePath
  if (!path) {
    return [{ text, type: 'plain' as const }]
  }

  const cacheKey = `${path}:${text}`
  if (tokenCache.has(cacheKey)) {
    return tokenCache.get(cacheKey)!
  }

  const lang = detectLanguage(path)
  if (!lang || !Prism.languages[lang]) {
    return [{ text, type: 'plain' as const }]
  }

  const tokens = Prism.tokenize(text, Prism.languages[lang])
  const result = flattenTokens(tokens)

  // 缓存管理
  if (tokenCache.size >= MAX_CACHE_SIZE) {
    // 清除一半缓存
    const keys = Array.from(tokenCache.keys())
    for (let i = 0; i < keys.length / 2; i++) {
      tokenCache.delete(keys[i])
    }
  }
  tokenCache.set(cacheKey, result)

  return result
}

/**
 * 清除 token 缓存
 */
export function clearTokenCache(): void {
  tokenCache.clear()
}
