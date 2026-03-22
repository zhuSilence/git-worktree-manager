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
  /** 默认 IDE */
  defaultIde: IdeType
  /** 自定义 IDE 路径 */
  customIdePath?: string
  /** 默认终端 */
  defaultTerminal: TerminalType
  /** 自定义终端路径 */
  customTerminalPath?: string
  /** 主题 */
  theme: 'light' | 'dark' | 'system'
  /** 自动刷新间隔 (秒), 0 为禁用 */
  autoRefreshInterval: number
}

interface SettingsState extends AppSettings {
  setDefaultIde: (ide: IdeType) => void
  setCustomIdePath: (path: string) => void
  setDefaultTerminal: (terminal: TerminalType) => void
  setCustomTerminalPath: (path: string) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setAutoRefreshInterval: (interval: number) => void
}

const defaultSettings: AppSettings = {
  defaultIde: 'vscode',
  defaultTerminal: 'terminal',
  theme: 'system',
  autoRefreshInterval: 0,
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
    }),
    {
      name: 'worktree-manager-settings',
    }
  )
)
