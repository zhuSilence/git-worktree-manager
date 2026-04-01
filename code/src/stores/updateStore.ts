import { create } from 'zustand'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export interface UpdateInfo {
  version: string
  date?: string
  body?: string
}

interface UpdateState {
  // 状态
  isChecking: boolean
  isDownloading: boolean
  isUpdateAvailable: boolean
  updateInfo: UpdateInfo | null
  downloadProgress: number
  downloaded: number
  contentLength: number
  error: string | null

  // 操作
  checkForUpdate: () => Promise<boolean>
  downloadAndInstall: () => Promise<void>
  reset: () => void
}

export const updateStore = create<UpdateState>((set, get) => ({
  // 初始状态
  isChecking: false,
  isDownloading: false,
  isUpdateAvailable: false,
  updateInfo: null,
  downloadProgress: 0,
  downloaded: 0,
  contentLength: 0,
  error: null,

  // 检查更新
  checkForUpdate: async () => {
    set({ isChecking: true, error: null })

    try {
      const update = await check()

      if (update) {
        set({
          isUpdateAvailable: true,
          updateInfo: {
            version: update.version,
            date: update.date,
            body: update.body,
          },
        })
        return true
      } else {
        set({ isUpdateAvailable: false, updateInfo: null })
        return false
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '检查更新失败' })
      return false
    } finally {
      set({ isChecking: false })
    }
  },

  // 下载并安装更新
  downloadAndInstall: async () => {
    const { updateInfo } = get()
    if (!updateInfo) return

    set({ isDownloading: true, downloadProgress: 0, error: null })

    try {
      const update = await check()

      if (update) {
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              set({ contentLength: event.data.contentLength || 0 })
              break
            case 'Progress':
              {
                const downloaded = event.data.chunkLength
                const currentDownloaded = get().downloaded + downloaded
                const contentLength = get().contentLength
                const progress = contentLength > 0 ? (currentDownloaded / contentLength) * 100 : 0
                set({
                  downloaded: currentDownloaded,
                  downloadProgress: Math.min(progress, 100),
                })
              }
              break
            case 'Finished':
              set({ downloadProgress: 100 })
              break
          }
        })

        // 安装完成后重启应用
        await relaunch()
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : '下载更新失败',
        isDownloading: false,
      })
    }
  },

  // 重置状态
  reset: () => {
    set({
      isChecking: false,
      isDownloading: false,
      isUpdateAvailable: false,
      updateInfo: null,
      downloadProgress: 0,
      downloaded: 0,
      contentLength: 0,
      error: null,
    })
  },
}))