import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Columns, AlignJustify, ImageOff } from 'lucide-react'

type ViewMode = 'side-by-side' | 'swipe' | 'overlay'

interface ImageDiffProps {
  oldImageBase64?: string | null
  newImageBase64?: string | null
  filePath: string
  status: string
}

/**
 * 获取图片的 MIME 类型
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    avif: 'image/avif',
  }
  return mimeMap[ext] || 'image/png'
}

/**
 * 图片 Diff 对比组件
 * 支持三种模式：并排对比、滑动对比、叠加对比
 */
export function ImageDiff({ oldImageBase64, newImageBase64, filePath, status }: ImageDiffProps) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const [swipePosition, setSwipePosition] = useState(50)
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)

  const mimeType = useMemo(() => getMimeType(filePath), [filePath])

  const oldSrc = oldImageBase64 ? `data:${mimeType};base64,${oldImageBase64}` : null
  const newSrc = newImageBase64 ? `data:${mimeType};base64,${newImageBase64}` : null

  const isAdded = status === 'added'
  const isDeleted = status === 'deleted'
  const isModified = status === 'modified' || status === 'renamed'

  // 视图模式按钮
  const viewModeButtons = [
    { mode: 'side-by-side' as ViewMode, icon: Columns, label: t('diff.sideBySide', 'Side by Side') },
    { mode: 'swipe' as ViewMode, icon: AlignJustify, label: t('diff.swipe', 'Swipe') },
  ]

  return (
    <div className="p-4 bg-white dark:bg-gray-900">
      {/* 视图模式切换 */}
      {isModified && (
        <div className="flex gap-2 mb-4">
          {viewModeButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors',
                viewMode === mode
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 新增文件：只显示新图片 */}
      {isAdded && (
        <div className="flex justify-center">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('diff.newImage', 'New Image')}</div>
            {newSrc ? (
              <img
                src={newSrc}
                alt="New version"
                className="max-w-full max-h-[600px] border border-gray-200 dark:border-gray-700 rounded shadow-sm"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-100 dark:bg-gray-800 rounded text-gray-400">
                <ImageOff className="w-8 h-8 mb-2" />
                <span className="text-sm">{t('diff.imageNotAvailable', 'Image not available')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 删除文件：只显示旧图片 */}
      {isDeleted && (
        <div className="flex justify-center">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('diff.deletedImage', 'Deleted Image')}</div>
            {oldSrc ? (
              <img
                src={oldSrc}
                alt="Old version"
                className="max-w-full max-h-[600px] border border-gray-200 dark:border-gray-700 rounded shadow-sm opacity-60"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-100 dark:bg-gray-800 rounded text-gray-400">
                <ImageOff className="w-8 h-8 mb-2" />
                <span className="text-sm">{t('diff.imageNotAvailable', 'Image not available')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 修改/重命名：显示对比 */}
      {isModified && viewMode === 'side-by-side' && (
        <div className="flex gap-4 justify-center">
          {/* 旧图片 */}
          <div className="flex-1 text-center max-w-[50%]">
            <div className="text-xs text-red-500 dark:text-red-400 mb-2 font-medium">{t('diff.before', 'Before')}</div>
            {oldSrc ? (
              <img
                src={oldSrc}
                alt="Old version"
                className="max-w-full max-h-[500px] border border-red-200 dark:border-red-900 rounded shadow-sm mx-auto"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-100 dark:bg-gray-800 rounded text-gray-400">
                <ImageOff className="w-8 h-8 mb-2" />
                <span className="text-sm">{t('diff.noPreviousVersion', 'No previous version')}</span>
              </div>
            )}
          </div>

          {/* 新图片 */}
          <div className="flex-1 text-center max-w-[50%]">
            <div className="text-xs text-green-500 dark:text-green-400 mb-2 font-medium">{t('diff.after', 'After')}</div>
            {newSrc ? (
              <img
                src={newSrc}
                alt="New version"
                className="max-w-full max-h-[500px] border border-green-200 dark:border-green-900 rounded shadow-sm mx-auto"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-gray-100 dark:bg-gray-800 rounded text-gray-400">
                <ImageOff className="w-8 h-8 mb-2" />
                <span className="text-sm">{t('diff.fileDeleted', 'File deleted')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Swipe 模式 */}
      {isModified && viewMode === 'swipe' && (
        <div className="relative overflow-hidden border border-gray-200 dark:border-gray-700 rounded" style={{ minHeight: '300px' }}>
          {/* 底层：新图片 */}
          {newSrc && (
            <img
              src={newSrc}
              alt="New"
              className="w-full max-h-[600px] object-contain"
            />
          )}

          {/* 顶层：旧图片（通过 clip 裁剪） */}
          {oldSrc && (
            <div
              className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-purple-500"
              style={{ width: `${swipePosition}%` }}
            >
              <img
                src={oldSrc}
                alt="Old"
                className="h-full object-contain"
                style={{ width: `${100 / (swipePosition / 100)}%`, maxWidth: 'none' }}
              />
            </div>
          )}

          {/* 滑动控制条 */}
          <input
            type="range"
            min="0"
            max="100"
            value={swipePosition}
            onChange={(e) => setSwipePosition(Number(e.target.value))}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-ew-resize"
          />

          {/* 标签 */}
          <div className="absolute top-2 left-2 text-xs bg-red-500/80 text-white px-2 py-0.5 rounded">
            {t('diff.before', 'Before')}
          </div>
          <div className="absolute top-2 right-2 text-xs bg-green-500/80 text-white px-2 py-0.5 rounded">
            {t('diff.after', 'After')}
          </div>
        </div>
      )}

      {/* Overlay 模式（可选，暂不实现） */}
      {isModified && viewMode === 'overlay' && (
        <div className="relative border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
          {oldSrc && (
            <img
              src={oldSrc}
              alt="Old"
              className="w-full max-h-[600px] object-contain"
              style={{ opacity: overlayOpacity }}
            />
          )}
          {newSrc && (
            <img
              src={newSrc}
              alt="New"
              className="absolute top-0 left-0 w-full max-h-[600px] object-contain"
              style={{ opacity: 1 - overlayOpacity }}
            />
          )}
          <input
            type="range"
            min="0"
            max="100"
            value={overlayOpacity * 100}
            onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-3/4"
          />
        </div>
      )}
    </div>
  )
}

export default ImageDiff
