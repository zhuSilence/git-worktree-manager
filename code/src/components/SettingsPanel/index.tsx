import { useState, useEffect } from 'react'
import { X, Code, Terminal, Monitor } from 'lucide-react'
import { settingsStore, IdeType, TerminalType } from '@/stores/settingsStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { defaultIde, defaultTerminal, setDefaultIde, setDefaultTerminal } = settingsStore()
  const [localIde, setLocalIde] = useState<IdeType>(defaultIde)
  const [localTerminal, setLocalTerminal] = useState<TerminalType>(defaultTerminal)

  useEffect(() => {
    setLocalIde(defaultIde)
    setLocalTerminal(defaultTerminal)
  }, [defaultIde, defaultTerminal])

  const handleSave = () => {
    setDefaultIde(localIde)
    setDefaultTerminal(localTerminal)
    onClose()
  }

  if (!isOpen) return null

  const ideOptions: { value: IdeType; label: string; icon: string }[] = [
    { value: 'vscode', label: 'VS Code', icon: 'code' },
    { value: 'vscode-insiders', label: 'VS Code Insiders', icon: 'code' },
    { value: 'cursor', label: 'Cursor', icon: 'cursor' },
    { value: 'webstorm', label: 'WebStorm', icon: 'webstorm' },
    { value: 'intellij', label: 'IntelliJ IDEA', icon: 'idea' },
  ]

  const terminalOptions: { value: TerminalType; label: string }[] = [
    { value: 'terminal', label: 'Terminal (默认)' },
    { value: 'iterm2', label: 'iTerm2' },
    { value: 'warp', label: 'Warp' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* 设置面板 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            设置
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 内容 */}
        <div className="p-4 space-y-6">
          {/* IDE 设置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Code className="w-4 h-4 inline mr-2" />
              默认编辑器
            </label>
            <select
              value={localIde}
              onChange={(e) => setLocalIde(e.target.value as IdeType)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {ideOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              选择打开 worktree 时使用的编辑器
            </p>
          </div>
          
          {/* 终端设置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Terminal className="w-4 h-4 inline mr-2" />
              默认终端
            </label>
            <select
              value={localTerminal}
              onChange={(e) => setLocalTerminal(e.target.value as TerminalType)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {terminalOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              选择打开 worktree 时使用的终端
            </p>
          </div>
        </div>
        
        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}