import { useState, useEffect } from 'react'
import { X, Code, Terminal, Monitor, RefreshCw, Download } from 'lucide-react'
import { settingsStore, IdeType, TerminalType } from '@/stores/settingsStore'
import { UpdateDialog } from '@/components/UpdateDialog'
import { updateStore } from '@/stores/updateStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

// 从 Vite 环境变量获取版本
const APP_VERSION = __APP_VERSION__

// 所有支持的编辑器
const EDITOR_OPTIONS: { value: IdeType; label: string }[] = [
  { value: 'vscode', label: 'VS Code' },
  { value: 'vscode-insiders', label: 'VS Code Insiders' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'webstorm', label: 'WebStorm' },
  { value: 'intellij', label: 'IntelliJ IDEA' },
  { value: 'custom', label: '自定义...' },
]

// 所有支持的终端
const TERMINAL_OPTIONS: { value: TerminalType; label: string }[] = [
  { value: 'terminal', label: 'Terminal (默认)' },
  { value: 'iterm2', label: 'iTerm2' },
  { value: 'warp', label: 'Warp' },
  { value: 'custom', label: '自定义...' },
]

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    defaultIde,
    customIdePath,
    defaultTerminal,
    customTerminalPath,
    setDefaultIde,
    setCustomIdePath,
    setDefaultTerminal,
    setCustomTerminalPath,
  } = settingsStore()

  const { isUpdateAvailable, updateInfo } = updateStore()
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [localIde, setLocalIde] = useState<IdeType>(defaultIde)
  const [localTerminal, setLocalTerminal] = useState<TerminalType>(defaultTerminal)
  const [localIdePath, setLocalIdePath] = useState(customIdePath || '')
  const [localTerminalPath, setLocalTerminalPath] = useState(customTerminalPath || '')

  useEffect(() => {
    setLocalIde(defaultIde)
    setLocalTerminal(defaultTerminal)
    setLocalIdePath(customIdePath || '')
    setLocalTerminalPath(customTerminalPath || '')
  }, [defaultIde, defaultTerminal, customIdePath, customTerminalPath, isOpen])

  const handleSave = () => {
    setDefaultIde(localIde)
    setDefaultTerminal(localTerminal)
    if (localIde === 'custom') {
      setCustomIdePath(localIdePath)
    } else {
      setCustomIdePath('')
    }
    if (localTerminal === 'custom') {
      setCustomTerminalPath(localTerminalPath)
    } else {
      setCustomTerminalPath('')
    }
    onClose()
  }

  const handleCheckUpdate = async () => {
    setShowUpdateDialog(true)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* 设置面板 */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-auto">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              设置
            </h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容 */}
          <div className="p-4 space-y-6">
            {/* 版本信息 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">当前版本</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">v{APP_VERSION}</p>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  检查更新
                </button>
              </div>
              {isUpdateAvailable && updateInfo && (
                <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Download className="w-4 h-4" />
                    <span className="font-medium">发现新版本 v{updateInfo.version}</span>
                  </div>
                </div>
              )}
            </div>

            {/* IDE 设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Code className="w-4 h-4" />
                默认编辑器
              </label>
              <select
                value={localIde}
                onChange={(e) => setLocalIde(e.target.value as IdeType)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {EDITOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* 自定义 IDE 路径输入 */}
              {localIde === 'custom' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={localIdePath}
                    onChange={(e) => setLocalIdePath(e.target.value)}
                    placeholder="输入编辑器命令或路径"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    例如: code, cursor, 或完整路径
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                选择打开 worktree 时使用的编辑器
              </p>
            </div>

            {/* 终端设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                默认终端
              </label>
              <select
                value={localTerminal}
                onChange={(e) => setLocalTerminal(e.target.value as TerminalType)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {TERMINAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* 自定义终端路径输入 */}
              {localTerminal === 'custom' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={localTerminalPath}
                    onChange={(e) => setLocalTerminalPath(e.target.value)}
                    placeholder="输入终端命令或路径"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    例如: iterm, warp, 或完整路径
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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

      {/* 更新对话框 */}
      <UpdateDialog isOpen={showUpdateDialog} onClose={() => setShowUpdateDialog(false)} />
    </>
  )
}
