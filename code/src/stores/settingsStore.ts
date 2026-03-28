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
  | 'custom'

/**
 * 终端类型
 */
export type TerminalType =
  | 'terminal'
  | 'iterm2'
  | 'warp'
  | 'custom'

/**
 * 应用设置
 */
export interface AppSettings {
  defaultIde: IdeType
  customIdePath?: string
  defaultTerminal: TerminalType
  customTerminalPath?: string
  theme: 'light' | 'dark' | 'system'
  autoRefreshInterval: number
  enableIdleDetection: boolean
  idleThresholdDays: number
  autoFetchOnStart: boolean
}

interface SettingsState extends AppSettings {
  setDefaultIde: (ide: IdeType) => void
  setCustomIdePath: (path: string) => void
  setDefaultTerminal: (terminal: TerminalType) => void
  setCustomTerminalPath: (path: string) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setAutoRefreshInterval: (interval: number) => void
  setEnableIdleDetection: (enabled: boolean) => void
  setIdleThresholdDays: (days: number) => void
  setAutoFetchOnStart: (enabled: boolean) => void
}

const defaultSettings: AppSettings = {
  defaultIde: 'vscode',
  defaultTerminal: 'terminal',
  theme: 'system',
  autoRefreshInterval: 0,
  enableIdleDetection: true,
  idleThresholdDays: 7,
  autoFetchOnStart: true,
}

export const settingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setDefaultIde: (ide) => set({ defaultIde: ide }),
      setCustomIdePath: (path) => set({ customIdePath: path }),
      setDefaultTerminal: (terminal) => set({ defaultTerminal: terminal }),
      setCustomTerminalPath: (path) => set({ customTerminalPath: path }),
      setTheme: (theme) => set({ theme }),
      setAutoRefreshInterval: (interval) => set({ autoRefreshInterval: interval }),
      setEnableIdleDetection: (enabled) => set({ enableIdleDetection: enabled }),
      setIdleThresholdDays: (days) => set({ idleThresholdDays: days }),
      setAutoFetchOnStart: (enabled) => set({ autoFetchOnStart: enabled }),
    }),
    {
      name: 'worktree-manager-settings',
    }
  )
)
