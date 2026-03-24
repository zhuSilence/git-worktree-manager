import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * IDE 类型
 */
export type IdeType = 
  | 'vscode'
  | 'vscode-insiders'
  | 'cursor'
  | 'webstorm'
  | 'intellij'

/**
 * 终端类型
 */
export type TerminalType = 
  | 'terminal'
  | 'iterm2'
  | 'warp'

/**
 * 应用设置
 */
export interface AppSettings {
  /** 默认 IDE */
  defaultIde: IdeType
  /** 默认终端 */
  defaultTerminal: TerminalType
  /** 主题 */
  theme: 'light' | 'dark' | 'system'
  /** 自动刷新间隔 (秒), 0 为禁用 */
  autoRefreshInterval: number
  /** 是否启用空闲检测 */
  enableIdleDetection: boolean
  /** 空闲阈值 (天) */
  idleThresholdDays: number
}

interface SettingsState extends AppSettings {
  setDefaultIde: (ide: IdeType) => void
  setDefaultTerminal: (terminal: TerminalType) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setAutoRefreshInterval: (interval: number) => void
  setEnableIdleDetection: (enabled: boolean) => void
  setIdleThresholdDays: (days: number) => void
}

const defaultSettings: AppSettings = {
  defaultIde: 'vscode',
  defaultTerminal: 'terminal',
  theme: 'system',
  autoRefreshInterval: 0,
  enableIdleDetection: true,
  idleThresholdDays: 7,
}

export const settingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      
      setDefaultIde: (ide) => set({ defaultIde: ide }),
      setDefaultTerminal: (terminal) => set({ defaultTerminal: terminal }),
      setTheme: (theme) => set({ theme }),
      setAutoRefreshInterval: (interval) => set({ autoRefreshInterval: interval }),
      setEnableIdleDetection: (enabled) => set({ enableIdleDetection: enabled }),
      setIdleThresholdDays: (days) => set({ idleThresholdDays: days }),
    }),
    {
      name: 'worktree-manager-settings',
    }
  )
)