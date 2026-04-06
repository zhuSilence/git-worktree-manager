import { useState, useEffect } from 'react'
import {
  X,
  Code,
  Terminal,
  Monitor,
  RefreshCw,
  Download,
  Bot,
  ChevronRight,
  Clock,
  Globe,
  Settings2,
  Sparkles,
  Github,
  ExternalLink,
} from 'lucide-react'
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
    autoFetchOnStart,
    setAutoFetchOnStart,
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
  const [localAutoFetch, setLocalAutoFetch] = useState(autoFetchOnStart)
  const [localLanguage, setLocalLanguage] = useState(i18n.language || 'zh-CN')

  useEffect(() => {
    setLocalIde(defaultIde)
    setLocalTerminal(defaultTerminal)
    setLocalIdePath(customIdePath || '')
    setLocalTerminalPath(customTerminalPath || '')
    setLocalEnableIdle(enableIdleDetection)
    setLocalIdleDays(idleThresholdDays)
    setLocalAutoFetch(autoFetchOnStart)
    setLocalLanguage(i18n.language || 'zh-CN')
  }, [defaultIde, defaultTerminal, customIdePath, customTerminalPath, enableIdleDetection, idleThresholdDays, autoFetchOnStart, i18n.language, isOpen])

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
    setAutoFetchOnStart(localAutoFetch)
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

  // 设置项组件 - 选择器类型
  const SettingSelect = ({
    icon: Icon,
    label,
    value,
    onChange,
    options,
    helperText,
  }: {
    icon: React.ElementType
    label: string
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
    helperText?: string
  }) => (
    <div className="group">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
        <Icon className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  )

  // 设置项组件 - 开关类型
  const SettingToggle = ({
    icon: Icon,
    label,
    checked,
    onChange,
    helperText,
  }: {
    icon: React.ElementType
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    helperText?: string
  }) => (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Icon className="w-4 h-4 text-gray-400" />
          {label}
        </label>
        {helperText && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        {/* 设置面板 */}
        <div className="relative bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Settings2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.title')}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">v{APP_VERSION}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 内容 */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 更新提示 */}
            {isUpdateAvailable && updateInfo && (
              <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white shadow-lg shadow-green-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{t('settings.newVersionFound')} v{updateInfo.version}</p>
                      <p className="text-sm text-green-100">{t('settings.updateAvailable')}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckUpdate}
                    className="px-4 py-2 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
                  >
                    {t('settings.update')}
                  </button>
                </div>
              </div>
            )}

            {/* AI 评审设置卡片 */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-500" />
                  {t('settings.aiReview', 'AI 评审')}
                </h3>
              </div>
              <div className="p-4">
                <button
                  onClick={() => setShowAIConfig(true)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {aiConfig.provider === 'openai' && (
                        <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300">O</span>
                      )}
                      {aiConfig.provider === 'claude' && (
                        <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-xs font-medium text-orange-700 dark:text-orange-300">C</span>
                      )}
                      {aiConfig.provider === 'ollama' && (
                        <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">L</span>
                      )}
                      {aiConfig.provider === 'custom' && (
                        <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                          <Globe className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {aiConfig.provider === 'openai' && 'OpenAI'}
                        {aiConfig.provider === 'claude' && 'Claude'}
                        {aiConfig.provider === 'ollama' && 'Ollama (本地)'}
                        {aiConfig.provider === 'custom' && '自定义端点'}
                      </p>
                      <p className="text-xs text-gray-500">{aiConfig.model || '未选择模型'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiConfig.apiKey || aiConfig.provider === 'ollama' ? (
                      <span className="px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-full">
                        {t('settings.configured', '已配置')}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-full">
                        {t('settings.notConfigured', '未配置')}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </div>
                </button>
              </div>
            </section>

            {/* 外观与语言卡片 */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  {t('settings.appearance', '外观与语言')}
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <SettingSelect
                  icon={Globe}
                  label={t('settings.language', '界面语言')}
                  value={localLanguage}
                  onChange={setLocalLanguage}
                  options={languageOptions}
                  helperText={t('settings.languageDesc', '选择界面显示语言')}
                />
              </div>
            </section>

            {/* 工具配置卡片 */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Code className="w-4 h-4 text-green-500" />
                  {t('settings.tools', '工具配置')}
                </h3>
              </div>
              <div className="p-4 space-y-5">
                {/* IDE 设置 */}
                <SettingSelect
                  icon={Code}
                  label={t('settings.defaultIde', '默认编辑器')}
                  value={localIde}
                  onChange={(value) => setLocalIde(value as IdeType)}
                  options={EDITOR_OPTIONS}
                  helperText={t('settings.defaultIdeDesc', '选择打开 worktree 时使用的编辑器')}
                />

                {/* 自定义 IDE 路径输入 */}
                {localIde === 'custom' && (
                  <div className="ml-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={localIdePath}
                      onChange={(e) => setLocalIdePath(e.target.value)}
                      placeholder={t('settings.enterEditorCommand', '输入编辑器命令或路径')}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      {t('settings.editorExample', '例如: code, cursor, 或完整路径')}
                    </p>
                  </div>
                )}

                {/* 终端设置 */}
                <SettingSelect
                  icon={Terminal}
                  label={t('settings.defaultTerminal', '默认终端')}
                  value={localTerminal}
                  onChange={(value) => setLocalTerminal(value as TerminalType)}
                  options={TERMINAL_OPTIONS}
                  helperText={t('settings.defaultTerminalDesc', '选择打开 worktree 时使用的终端')}
                />

                {/* 自定义终端路径输入 */}
                {localTerminal === 'custom' && (
                  <div className="ml-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={localTerminalPath}
                      onChange={(e) => setLocalTerminalPath(e.target.value)}
                      placeholder={t('settings.enterTerminalCommand', '输入终端命令或路径')}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      {t('settings.terminalExample', '例如: iterm, warp, 或完整路径')}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 行为设置卡片 */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-orange-500" />
                  {t('settings.behavior', '行为设置')}
                </h3>
              </div>
              <div className="p-4 space-y-5">
                {/* 自动 Fetch */}
                <SettingToggle
                  icon={Download}
                  label={t('settings.autoFetchOnStart', '启动时自动 Fetch')}
                  checked={localAutoFetch}
                  onChange={setLocalAutoFetch}
                  helperText={t('settings.autoFetchOnStartDesc', '切换仓库时自动获取远程分支变动')}
                />

                <div className="h-px bg-gray-200 dark:bg-gray-700" />

                {/* 空闲检测 */}
                <div className="space-y-4">
                  <SettingToggle
                    icon={Clock}
                    label={t('settings.idleDetection', '空闲 Worktree 检测')}
                    checked={localEnableIdle}
                    onChange={setLocalEnableIdle}
                    helperText={t('settings.idleDetectionDesc', '标记长时间未更新的 worktree')}
                  />

                  {localEnableIdle && (
                    <div className="ml-6">
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        {t('settings.idleThreshold', '空闲阈值')}
                      </label>
                      <select
                        value={localIdleDays}
                        onChange={(e) => setLocalIdleDays(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                      >
                        {idleThresholdOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-gray-500">{t('settings.idleThresholdDesc')}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 关于卡片 */}
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Github className="w-4 h-4 text-gray-500" />
                  {t('settings.about', '关于')}
                </h3>
              </div>
              <div className="p-4">
                {!isUpdateAvailable && (
                  <button
                    onClick={handleCheckUpdate}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{t('settings.checkUpdate')}</p>
                        <p className="text-xs text-gray-500">v{APP_VERSION} {t('settings.currentVersion')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                  </button>
                )}
                <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-500">
                  <a
                    href="https://github.com/zhuSilence/git-worktree-manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <Github className="w-3 h-3" />
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </section>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 px-6 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-500/20"
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
