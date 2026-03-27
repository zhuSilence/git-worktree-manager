import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { COPY_SUCCESS_DURATION } from './constants'

interface CopyButtonProps {
  text: string
}

/**
 * 行内复制按钮
 */
export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_SUCCESS_DURATION)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute right-1 top-0 bottom-0 my-auto h-5 w-5 items-center justify-center rounded opacity-0 group-hover/line:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-opacity flex"
      title="复制行内容"
    >
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
    </button>
  )
}
