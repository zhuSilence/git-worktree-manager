import { describe, it, expect, beforeEach } from 'vitest'
import {
  detectLanguage,
  tokenize,
  setCurrentFilePath,
  clearTokenCache,
  SYNTAX_COLORS,
} from '../SyntaxHighlighter'

describe('SyntaxHighlighter', () => {
  beforeEach(() => {
    clearTokenCache()
    setCurrentFilePath(null)
  })

  describe('detectLanguage', () => {
    it('应正确识别 JavaScript 文件扩展名', () => {
      expect(detectLanguage('app.js')).toBe('javascript')
      expect(detectLanguage('/path/to/file.js')).toBe('javascript')
    })

    it('应正确识别 TypeScript 文件扩展名', () => {
      expect(detectLanguage('app.ts')).toBe('typescript')
      expect(detectLanguage('component.tsx')).toBe('tsx')
    })

    it('应正确识别 JSX 文件扩展名', () => {
      expect(detectLanguage('component.jsx')).toBe('jsx')
    })

    it('应正确识别 Python 文件扩展名', () => {
      expect(detectLanguage('script.py')).toBe('python')
      expect(detectLanguage('/src/main.py')).toBe('python')
    })

    it('应正确识别 Go 文件扩展名', () => {
      expect(detectLanguage('main.go')).toBe('go')
    })

    it('应正确识别 Rust 文件扩展名', () => {
      expect(detectLanguage('lib.rs')).toBe('rust')
    })

    it('应正确识别 Java 文件扩展名', () => {
      expect(detectLanguage('Main.java')).toBe('java')
    })

    it('应正确识别 C/C++ 文件扩展名', () => {
      expect(detectLanguage('main.c')).toBe('c')
      expect(detectLanguage('main.cpp')).toBe('cpp')
      expect(detectLanguage('header.h')).toBe('c')
      expect(detectLanguage('header.hpp')).toBe('cpp')
    })

    it('应正确识别其他语言扩展名', () => {
      expect(detectLanguage('style.css')).toBe('css')
      expect(detectLanguage('data.json')).toBe('json')
      expect(detectLanguage('config.yaml')).toBe('yaml')
      expect(detectLanguage('config.yml')).toBe('yaml')
      expect(detectLanguage('script.sh')).toBe('bash')
      expect(detectLanguage('query.sql')).toBe('sql')
      expect(detectLanguage('readme.md')).toBe('markdown')
      expect(detectLanguage('App.kt')).toBe('kotlin')
      expect(detectLanguage('build.kts')).toBe('kotlin')
      expect(detectLanguage('main.swift')).toBe('swift')
      expect(detectLanguage('app.rb')).toBe('ruby')
      expect(detectLanguage('index.php')).toBe('php')
      expect(detectLanguage('Main.scala')).toBe('scala')
      expect(detectLanguage('Cargo.toml')).toBe('toml')
      expect(detectLanguage('Program.cs')).toBe('csharp')
    })

    it('未知扩展名应返回 null', () => {
      expect(detectLanguage('file.xyz')).toBeNull()
      expect(detectLanguage('file.unknown')).toBeNull()
    })

    it('无扩展名应返回 null', () => {
      expect(detectLanguage('Makefile')).toBeNull()
      expect(detectLanguage('Dockerfile')).toBeNull()
    })

    it('空字符串应返回 null', () => {
      expect(detectLanguage('')).toBeNull()
    })

    it('应忽略大小写', () => {
      expect(detectLanguage('APP.JS')).toBe('javascript')
      expect(detectLanguage('Script.PY')).toBe('python')
      expect(detectLanguage('MAIN.GO')).toBe('go')
    })
  })

  describe('tokenize', () => {
    it('无文件路径时应返回 plain token', () => {
      const tokens = tokenize('const x = 10')

      expect(tokens.length).toBe(1)
      expect(tokens[0].text).toBe('const x = 10')
      expect(tokens[0].type).toBe('plain')
    })

    it('通过 setCurrentFilePath 设置上下文时应正确分词', () => {
      setCurrentFilePath('test.js')
      const tokens = tokenize('const x = 10')

      // JavaScript 代码应该被分词
      expect(tokens.length).toBeGreaterThan(1)
      // const 应该被识别为关键字
      expect(tokens.some(t => t.text === 'const' && t.type === 'keyword')).toBe(true)
    })

    it('通过参数传递文件路径时应正确分词', () => {
      const tokens = tokenize('const x = 10', 'test.js')

      expect(tokens.length).toBeGreaterThan(1)
      expect(tokens.some(t => t.text === 'const' && t.type === 'keyword')).toBe(true)
    })

    it('JavaScript 关键字应正确识别', () => {
      const tokens = tokenize('const let var function async await', 'test.js')

      expect(tokens.some(t => t.type === 'keyword')).toBe(true)
    })

    it('字符串应正确识别', () => {
      const tokens = tokenize('const str = "hello world"', 'test.js')

      expect(tokens.some(t => t.type === 'string' && t.text.includes('hello'))).toBe(true)
    })

    it('单行注释应正确识别', () => {
      const tokens = tokenize('// This is a comment', 'test.js')

      expect(tokens.some(t => t.type === 'comment')).toBe(true)
    })

    it('数字应正确识别', () => {
      const tokens = tokenize('const x = 42', 'test.js')

      expect(tokens.some(t => t.text === '42' && t.type === 'number')).toBe(true)
    })

    it('未知语言应返回 plain token', () => {
      const tokens = tokenize('some random text', 'file.xyz')

      expect(tokens.length).toBe(1)
      expect(tokens[0].type).toBe('plain')
    })

    it('Python 代码应正确分词', () => {
      const tokens = tokenize('def my_function():', 'test.py')

      // def 应该被识别为关键字
      expect(tokens.some(t => t.text === 'def' && t.type === 'keyword')).toBe(true)
    })

    it('Rust 代码应正确分词', () => {
      const tokens = tokenize('fn main() {}', 'test.rs')

      // fn 应该被识别
      expect(tokens.some(t => t.text === 'fn')).toBe(true)
    })

    it('Go 代码应正确分词', () => {
      const tokens = tokenize('func main() {}', 'test.go')

      // func 应该被识别
      expect(tokens.some(t => t.text === 'func')).toBe(true)
    })

    it('Java 代码应正确分词', () => {
      const tokens = tokenize('public class Main {}', 'Main.java')

      // public 和 class 应该被识别
      expect(tokens.some(t => t.text === 'public' || t.text === 'class')).toBe(true)
    })
  })

  describe('tokenize 缓存', () => {
    it('相同输入应返回相同结果（缓存生效）', () => {
      const tokens1 = tokenize('const x = 10', 'test.js')
      const tokens2 = tokenize('const x = 10', 'test.js')

      // 两次调用的结果应该相同
      expect(tokens1).toEqual(tokens2)
    })

    it('clearTokenCache 应清除缓存', () => {
      // 先分词建立缓存
      tokenize('const x = 10', 'test.js')

      // 清除缓存
      clearTokenCache()

      // 再次分词应该重新计算（虽然结果相同）
      const tokens = tokenize('const x = 10', 'test.js')
      expect(tokens.length).toBeGreaterThan(0)
    })
  })

  describe('SYNTAX_COLORS', () => {
    it('应包含所有必需的颜色映射', () => {
      expect(SYNTAX_COLORS.keyword).toBeDefined()
      expect(SYNTAX_COLORS.string).toBeDefined()
      expect(SYNTAX_COLORS.comment).toBeDefined()
      expect(SYNTAX_COLORS.number).toBeDefined()
      expect(SYNTAX_COLORS.operator).toBeDefined()
      expect(SYNTAX_COLORS.function).toBeDefined()
      expect(SYNTAX_COLORS.punctuation).toBeDefined()
      expect(SYNTAX_COLORS.plain).toBeDefined()
    })

    it('关键字颜色应包含 purple', () => {
      expect(SYNTAX_COLORS.keyword).toContain('purple')
    })

    it('字符串颜色应包含 amber', () => {
      expect(SYNTAX_COLORS.string).toContain('amber')
    })

    it('注释颜色应包含 gray', () => {
      expect(SYNTAX_COLORS.comment).toContain('gray')
    })
  })

  describe('setCurrentFilePath', () => {
    it('应正确设置当前文件路径', () => {
      setCurrentFilePath('app.ts')
      const tokens = tokenize('const x: number = 10')

      // TypeScript 应该正确分词
      expect(tokens.length).toBeGreaterThan(1)
    })

    it('设置为 null 应重置上下文', () => {
      setCurrentFilePath('app.js')
      setCurrentFilePath(null)

      const tokens = tokenize('const x = 10')

      // 没有文件路径上下文，应返回 plain token
      expect(tokens.length).toBe(1)
      expect(tokens[0].type).toBe('plain')
    })
  })

  describe('边界情况', () => {
    it('空字符串应返回空数组或单个 plain token', () => {
      const tokens = tokenize('', 'test.js')
      // 空字符串应该返回空数组或一个空文本的 plain token
      expect(tokens.length).toBeLessThanOrEqual(1)
    })

    it('只有空白字符应正确处理', () => {
      const tokens = tokenize('   ', 'test.js')
      expect(tokens.length).toBeLessThanOrEqual(1)
    })

    it('复杂代码块应正确分词', () => {
      const code = `
function calculate(a, b) {
  // Add numbers
  return a + b;
}
      `.trim()

      const tokens = tokenize(code, 'test.js')

      // 应该识别出多个 token
      expect(tokens.length).toBeGreaterThan(1)
    })

    it('JSON 文件应正确分词', () => {
      const tokens = tokenize('{"key": "value"}', 'data.json')

      // JSON 应该被分词
      expect(tokens.length).toBeGreaterThan(0)
    })

    it('YAML 文件应正确分词', () => {
      const tokens = tokenize('key: value', 'config.yaml')

      expect(tokens.length).toBeGreaterThan(0)
    })
  })
})
