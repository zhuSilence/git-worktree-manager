import { useState, useEffect } from 'react'
import { X, Code, Terminal, Monitor, RefreshCw, Download, Bot, ChevronRight, Clock, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settingsStore, IdeType, TerminalType } from '@/stores/settingsStore'
import { updateStore } from '@/stores/updateStore'
import { UpdateDialog } from '@/components/UpdateDialog'
import { AIConfigPanel } from '@/components/AIConfigPanel'
import { aiReviewStore } from '@/stores/aiReviewStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

// 从 Vite 环境变量获取版本
const APP_VERSION = __APP_VERSION__

// 语言选项
const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
]

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
  const { t, i18n } = useTranslation()
  const {
    defaultIde,
    customIdePath,
    defaultTerminal,
    customTerminalPath,
    setDefaultIde,
    setCustomIdePath,
    setDefaultTerminal,
    setCustomTerminalPath,
    enableIdleDetection,
    setEnableIdleDetection,
    idleThresholdDays,
    setIdleThresholdDays,
  } = settingsStore()

  const { isUpdateAvailable, updateInfo } = updateStore()
  const aiConfig = aiReviewStore((state) => state.config)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [showAIConfig, setShowAIConfig] = useState(false)
  const [localIde, setLocalIde] = useState<IdeType>(defaultIde)
  const [localTerminal, setLocalTerminal] = useState<TerminalType>(defaultTerminal)
  const [localIdePath, setLocalIdePath] = useState(customIdePath || '')
  const [localTerminalPath, setLocalTerminalPath] = useState(customTerminalPath || '')
  const [localEnableIdle, setLocalEnableIdle] = useState(enableIdleDetection)
  const [localIdleDays, setLocalIdleDays] = useState(idleThresholdDays)
  const [localLanguage, setLocalLanguage] = useState(i18n.language || 'zh-CN')

  useEffect(() => {
    setLocalIde(defaultIde)
    setLocalTerminal(defaultTerminal)
    setLocalIdePath(customIdePath || '')
    setLocalTerminalPath(customTerminalPath || '')
    setLocalEnableIdle(enableIdleDetection)
    setLocalIdleDays(idleThresholdDays)
    setLocalLanguage(i18n.language || 'zh-CN')
  }, [defaultIde, defaultTerminal, customIdePath, customTerminalPath, enableIdleDetection, idleThresholdDays, i18n.language, isOpen])

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
    setEnableIdleDetection(localEnableIdle)
    setIdleThresholdDays(localIdleDays)
    i18n.changeLanguage(localLanguage)
    onClose()
  }

  const handleCheckUpdate = async () => {
    setShowUpdateDialog(true)
  }

  if (!isOpen) return null

  const idleThresholdOptions = [
    { value: 3, label: `3 ${t('settings.days')}` },
    { value: 7, label: `7 ${t('settings.days')}` },
    { value: 14, label: `14 ${t('settings.days')}` },
    { value: 30, label: `30 ${t('settings.days')}` },
  ]

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
              {t('settings.title')}
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.currentVersion')}</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">v{APP_VERSION}</p>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('settings.checkUpdate')}
                </button>
              </div>
              {isUpdateAvailable && updateInfo && (
                <div className="mt-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-md">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Download className="w-4 h-4" />
                    <span className="font-medium">{t('settings.newVersionFound')} v{updateInfo.version}</span>
                  </div>
                </div>
              )}
            </div>

            {/* AI 评审设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                {t('settings.aiReview', 'AI 评审')}
              </label>
              <button
                onClick={() => setShowAIConfig(true)}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {aiConfig.provider === 'openai' && 'OpenAI'}
                    {aiConfig.provider === 'claude' && 'Claude'}
                    {aiConfig.provider === 'ollama' && 'Ollama (本地)'}
                    {aiConfig.provider === 'custom' && '自定义端点'}
                  </span>
                  {aiConfig.apiKey || aiConfig.provider === 'ollama' ? (
                    <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                      {t('settings.configured', '已配置')}
                    </span>
                  ) : (
                    <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                      {t('settings.notConfigured', '未配置')}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.aiReviewDesc', '配置 AI 评审的 API 提供商和密钥')}
              </p>
            </div>

            {/* 语言设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                {t('settings.language', '语言')}
              </label>
              <select
                value={localLanguage}
                onChange={(e) => setLocalLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.languageDesc', '选择界面显示语言')}
              </p>
            </div>

            {/* IDE 设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Code className="w-4 h-4" />
                {t('settings.defaultIde', '默认编辑器')}
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
                    placeholder={t('settings.enterEditorCommand', '输入编辑器命令或路径')}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.editorExample', '例如: code, cursor, 或完整路径')}
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.defaultIdeDesc', '选择打开 worktree 时使用的编辑器')}
              </p>
            </div>

            {/* 终端设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                {t('settings.defaultTerminal', '默认终端')}
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
                    placeholder={t('settings.enterTerminalCommand', '输入终端命令或路径')}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.terminalExample', '例如: iterm, warp, 或完整路径')}
                  </p>
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.defaultTerminalDesc', '选择打开 worktree 时使用的终端')}
              </p>
            </div>

            {/* 空闲检测设置 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t('settings.idleDetection')}
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localEnableIdle}
                    onChange={(e) => setLocalEnableIdle(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t('settings.enable')}</span>
                </label>
              </div>
              {localEnableIdle && (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('settings.idleThreshold')}
                  </label>
                  <select
                    value={localIdleDays}
                    onChange={(e) => setLocalIdleDays(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {idleThresholdOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    {t('settings.idleThresholdDesc')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {/* AI 配置面板 */}
      <AIConfigPanel isOpen={showAIConfig} onClose={() => setShowAIConfig(false)} />

      {/* 更新对话框 */}
      <UpdateDialog isOpen={showUpdateDialog} onClose={() => setShowUpdateDialog(false)} />
    </>
  )
}
