import { useState, useEffect } from 'react'
import { X, Code, Terminal, Monitor, RefreshCw, Download, Clock, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settingsStore, IdeType, TerminalType, updateStore } from '@/stores'
import { UpdateDialog } from '@/components/UpdateDialog'

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

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { t, i18n } = useTranslation()
  const { 
    defaultIde, defaultTerminal, setDefaultIde, setDefaultTerminal,
    enableIdleDetection, setEnableIdleDetection,
    idleThresholdDays, setIdleThresholdDays
  } = settingsStore()
  const { isUpdateAvailable, updateInfo } = updateStore()
  const [localIde, setLocalIde] = useState<IdeType>(defaultIde)
  const [localTerminal, setLocalTerminal] = useState<TerminalType>(defaultTerminal)
  const [localEnableIdle, setLocalEnableIdle] = useState(enableIdleDetection)
  const [localIdleDays, setLocalIdleDays] = useState(idleThresholdDays)
  const [localLanguage, setLocalLanguage] = useState(i18n.language || 'zh-CN')
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)

  useEffect(() => {
    setLocalIde(defaultIde)
    setLocalTerminal(defaultTerminal)
    setLocalEnableIdle(enableIdleDetection)
    setLocalIdleDays(idleThresholdDays)
    setLocalLanguage(i18n.language || 'zh-CN')
  }, [defaultIde, defaultTerminal, enableIdleDetection, idleThresholdDays, i18n.language])

  const handleSave = () => {
    setDefaultIde(localIde)
    setDefaultTerminal(localTerminal)
    setEnableIdleDetection(localEnableIdle)
    setIdleThresholdDays(localIdleDays)
    i18n.changeLanguage(localLanguage)
    onClose()
  }

  const handleCheckUpdate = async () => {
    setShowUpdateDialog(true)
  }

  if (!isOpen) return null

  const ideOptions: { value: IdeType; label: string; icon: string }[] = [
    { value: 'vscode', label: t('ide.vscode'), icon: 'code' },
    { value: 'vscode-insiders', label: t('ide.vscodeInsiders'), icon: 'code' },
    { value: 'cursor', label: t('ide.cursor'), icon: 'cursor' },
    { value: 'webstorm', label: t('ide.webstorm'), icon: 'webstorm' },
    { value: 'intellij', label: t('ide.intellij'), icon: 'idea' },
  ]

  const terminalOptions: { value: TerminalType; label: string }[] = [
    { value: 'terminal', label: t('terminal.default') },
    { value: 'iterm2', label: t('terminal.iterm2') },
    { value: 'warp', label: t('terminal.warp') },
  ]

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
              {t('settings.title')}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Code className="w-4 h-4 inline mr-2" />
                {t('settings.defaultIde')}
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
                {t('settings.defaultIdeDesc')}
              </p>
            </div>
            
            {/* 终端设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Terminal className="w-4 h-4 inline mr-2" />
                {t('settings.defaultTerminal')}
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
                {t('settings.defaultTerminalDesc')}
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

      {/* 更新对话框 */}
      <UpdateDialog
        isOpen={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
      />
    </>
  )
}