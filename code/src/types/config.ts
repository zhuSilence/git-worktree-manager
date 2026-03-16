/**
 * 应用配置
 */
export interface AppConfig {
  /** 默认 Worktree 存储目录 */
  defaultWorktreeDir: string
  /** 是否在删除前确认 */
  confirmBeforeDelete: boolean
  /** 是否在删除时强制删除未推送的分支 */
  forceDeleteUnpushed: boolean
  /** 主题设置 */
  theme: ThemeConfig
  /** 外部编辑器路径 */
  externalEditor?: string
  /** 外部终端路径 */
  externalTerminal?: string
}

/**
 * 主题配置
 */
export interface ThemeConfig {
  /** 主题模式 */
  mode: 'light' | 'dark' | 'system'
  /** 强调色 */
  accentColor?: string
}

/**
 * 仓库配置
 */
export interface RepoConfig {
  /** 仓库路径 */
  path: string
  /** 仓库名称 */
  name: string
  /** 是否为收藏 */
  isFavorite: boolean
  /** 最后访问时间 */
  lastAccessedAt: string
}

/**
 * 应用状态
 */
export interface AppState {
  /** 是否已初始化 */
  initialized: boolean
  /** 当前版本 */
  version: string
  /** 最近的仓库列表 */
  recentRepos: RepoConfig[]
  /** 当前选中的仓库路径 */
  currentRepoPath: string | null
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: AppConfig = {
  defaultWorktreeDir: '',
  confirmBeforeDelete: true,
  forceDeleteUnpushed: false,
  theme: {
    mode: 'system',
  },
}

/**
 * 默认应用状态
 */
export const DEFAULT_APP_STATE: AppState = {
  initialized: false,
  version: '0.1.0',
  recentRepos: [],
  currentRepoPath: null,
}