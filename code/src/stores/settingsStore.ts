import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { AppConfig, AppState, RepoConfig, ThemeConfig } from '@/types/config'
import { DEFAULT_CONFIG, DEFAULT_APP_STATE } from '@/types/config'

interface SettingsState extends AppConfig, AppState {
  // 配置操作
  updateConfig: (config: Partial<AppConfig>) => void
  updateTheme: (theme: Partial<ThemeConfig>) => void

  // 仓库操作
  addRecentRepo: (repo: RepoConfig) => void
  removeRecentRepo: (repoPath: string) => void
  setCurrentRepo: (repoPath: string | null) => void
  updateRepoFavorite: (repoPath: string, isFavorite: boolean) => void

  // 重置
  resetSettings: () => void
  resetState: () => void
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // 初始配置
        ...DEFAULT_CONFIG,
        ...DEFAULT_APP_STATE,

        updateConfig: (config) => {
          set((state) => ({ ...state, ...config }))
        },

        updateTheme: (theme) => {
          set((state) => ({
            theme: { ...state.theme, ...theme },
          }))
        },

        addRecentRepo: (repo) => {
          const { recentRepos } = get()
          const existingIndex = recentRepos.findIndex((r) => r.path === repo.path)

          let newRepos: RepoConfig[]
          if (existingIndex >= 0) {
            // 更新已存在的仓库
            newRepos = [
              { ...recentRepos[existingIndex], ...repo, lastAccessedAt: new Date().toISOString() },
              ...recentRepos.filter((_, i) => i !== existingIndex),
            ]
          } else {
            // 添加新仓库
            newRepos = [
              { ...repo, lastAccessedAt: new Date().toISOString() },
              ...recentRepos,
            ].slice(0, 20) // 最多保留 20 个
          }

          set({ recentRepos: newRepos })
        },

        removeRecentRepo: (repoPath) => {
          set((state) => ({
            recentRepos: state.recentRepos.filter((r) => r.path !== repoPath),
          }))
        },

        setCurrentRepo: (repoPath) => {
          set({ currentRepoPath: repoPath })

          // 更新最近访问时间
          if (repoPath) {
            const { recentRepos, addRecentRepo } = get()
            const existing = recentRepos.find((r) => r.path === repoPath)
            if (existing) {
              addRecentRepo(existing)
            }
          }
        },

        updateRepoFavorite: (repoPath, isFavorite) => {
          set((state) => ({
            recentRepos: state.recentRepos.map((r) =>
              r.path === repoPath ? { ...r, isFavorite } : r
            ),
          }))
        },

        resetSettings: () => {
          set(DEFAULT_CONFIG)
        },

        resetState: () => {
          set(DEFAULT_APP_STATE)
        },
      }),
      {
        name: 'worktree-manager-settings',
        partialize: (state) => ({
          // 只持久化这些字段
          defaultWorktreeDir: state.defaultWorktreeDir,
          confirmBeforeDelete: state.confirmBeforeDelete,
          forceDeleteUnpushed: state.forceDeleteUnpushed,
          theme: state.theme,
          externalEditor: state.externalEditor,
          externalTerminal: state.externalTerminal,
          recentRepos: state.recentRepos,
        }),
      }
    ),
    { name: 'settings-store' }
  )
)