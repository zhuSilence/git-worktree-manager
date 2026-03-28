import { tokenize, SYNTAX_COLORS } from './SyntaxHighlighter'
import type { CharSegment } from './types'
import {
  ADDITION_TEXT_CLASS,
  DELETION_TEXT_CLASS,
  CHAR_ADDITION_HIGHLIGHT_CLASS,
  CHAR_DELETION_HIGHLIGHT_CLASS,
} from './constants'

interface HighlightedLineProps {
  content: string
  lineType: string
  charSegments?: CharSegment[]
}

/**
 * 高亮行组件 - 支持字符级差异高亮 + 语法着色
 */
export function HighlightedLine({ content, lineType, charSegments }: HighlightedLineProps) {
  // 如果有字符级 diff segments，优先用它
  if (charSegments && charSegments.length > 0) {
    const hlClass =
      lineType === 'deletion' ? CHAR_DELETION_HIGHLIGHT_CLASS : CHAR_ADDITION_HIGHLIGHT_CLASS
    const textClass =
      lineType === 'deletion' ? DELETION_TEXT_CLASS : ADDITION_TEXT_CLASS

    return (
      <span className={textClass}>
        {charSegments.map((seg, i) => (
          <span key={i} className={seg.highlight ? hlClass : undefined}>
            {seg.text}
          </span>
        ))}
      </span>
    )
  }

  // context 行：应用语法着色
  if (lineType === 'context') {
    const tokens = tokenize(content)
    return (
      <span className="text-gray-700 dark:text-gray-300">
        {tokens.map((t, i) => {
          const color = SYNTAX_COLORS[t.type]
          return color ? (
            <span key={i} className={color}>
              {t.text}
            </span>
          ) : (
            <span key={i}>{t.text}</span>
          )
        })}
      </span>
    )
  }

  // addition / deletion 无 char-level 时——语法着色 + 基础色
  const baseClass =
    lineType === 'addition'
      ? ADDITION_TEXT_CLASS
      : lineType === 'deletion'
        ? DELETION_TEXT_CLASS
        : ''

  const tokens = tokenize(content)
  return (
    <span className={baseClass}>
      {tokens.map((t, i) => {
        const color = SYNTAX_COLORS[t.type]
        return color ? (
          <span key={i} className={color}>
            {t.text}
          </span>
        ) : (
          <span key={i}>{t.text}</span>
        )
      })}
    </span>
  )
}
