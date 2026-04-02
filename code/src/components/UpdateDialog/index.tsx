import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Download, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { updateStore } from '@/stores/updateStore'

interface UpdateDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function UpdateDialog({ isOpen, onClose }: UpdateDialogProps) {
  const { t } = useTranslation()
  const {
    isDownloading,
    updateInfo,
    downloadProgress,
    error,
    checkForUpdate,
    downloadAndInstall,
    reset,
  } = updateStore()

  const [step, setStep] = useState<'checking' | 'available' | 'downloading' | 'no-update' | 'error'>('checking')

  useEffect(() => {
    if (isOpen) {
      setStep('checking')
      checkForUpdate().then((hasUpdate) => {
        if (hasUpdate) {
          setStep('available')
        } else if (!error) {
          // 没有更新，显示提示
          setStep('no-update')
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkForUpdate is stable from store, error checked separately in another useEffect
  }, [isOpen])

  useEffect(() => {
    if (error) {
      setStep('error')
    }
  }, [error])

  useEffect(() => {
    if (isDownloading) {
      setStep('downloading')
    }
  }, [isDownloading])

  const handleInstall = async () => {
    await downloadAndInstall()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* 对话框 */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            {t('settings.checkUpdate')}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 检查中 */}
          {step === 'checking' && (
            <div className="flex flex-col items-center justify-center py-8">
              <RefreshCw className="w-12 h-12 text-green-500 animate-spin mb-4" />
              <p className="text-gray-600 dark:text-gray-300">{t('update.checking')}</p>
            </div>
          )}

          {/* 有新版本 */}
          {step === 'available' && updateInfo && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <Download className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('settings.newVersionFound')} v{updateInfo.version}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.currentVersion')} v{__APP_VERSION__}
                  </p>
                </div>
              </div>

              {updateInfo.body && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {updateInfo.body}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t('settings.checkUpdate')}
                </button>
              </div>
            </div>
          )}

          {/* 无新版本 */}
          {step === 'no-update' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <p className="text-gray-900 dark:text-white font-medium mb-1">{t('update.latestVersion')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">v{__APP_VERSION__}</p>
              </div>
              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('common.close')}
              </button>
            </div>
          )}

          {/* 下载中 */}
          {step === 'downloading' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <Download className="w-12 h-12 text-green-500 animate-bounce" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>{t('update.downloading')}</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                下载完成后将自动安装并重启应用
              </p>
            </div>
          )}

          {/* 错误 */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t('update.failed')}</p>
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={() => {
                    reset()
                    setStep('checking')
                    checkForUpdate()
                  }}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                >
                  {t('common.refresh')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}