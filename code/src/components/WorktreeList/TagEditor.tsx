import { useState, useEffect } from 'react'
import { X, Check, Plus, Tag, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import type { TagDefinition, WorktreeAnnotation } from '@/types/annotation'
import { PRESET_TAGS } from '@/types/annotation'
import { TagBadge } from './TagBadge'

interface TagEditorProps {
  isOpen: boolean
  onClose: () => void
  path: string
  branch: string
  annotation: WorktreeAnnotation | null
  onSave: (tags: string[], notes: string) => void
}

export function TagEditor({ isOpen, onClose, path: _path, branch, annotation, onSave }: TagEditorProps) {
  const { t } = useTranslation()
  const [selectedTags, setSelectedTags] = useState<string[]>(annotation?.tags || [])
  const [notes, setNotes] = useState(annotation?.notes || '')
  const [customTagInput, setCustomTagInput] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSelectedTags(annotation?.tags || [])
      setNotes(annotation?.notes || '')
    }
  }, [isOpen, annotation])

  if (!isOpen) return null

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim()
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags(prev => [...prev, trimmed])
      setCustomTagInput('')
    }
  }

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagId))
  }

  const handleSave = () => {
    onSave(selectedTags, notes)
    onClose()
  }

  // 找出已选但不在预设中的自定义标签
  const customTags: TagDefinition[] = selectedTags
    .filter(id => !PRESET_TAGS.some(t => t.id === id))
    .map(id => ({ id, name: id, color: '#6b7280', bgColor: '#f3f4f6', isPreset: false }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('tagEditor.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 分支信息 */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('tagEditor.branch')}: <span className="font-medium text-gray-700 dark:text-gray-300">{branch}</span>
          </div>

          {/* 已选标签 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tagEditor.selectedTags')}
            </label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-gray-50 dark:bg-gray-900 rounded-md">
              {selectedTags.length === 0 ? (
                <span className="text-xs text-gray-400">{t('tagEditor.clickToAdd')}</span>
              ) : (
                selectedTags.map(tagId => {
                  const tagDef = PRESET_TAGS.find(t => t.id === tagId) ||
                    { id: tagId, name: tagId, color: '#6b7280', bgColor: '#f3f4f6', isPreset: false }
                  return (
                    <TagBadge
                      key={tagId}
                      tag={tagDef}
                      size="sm"
                      removable
                      onRemove={() => handleRemoveTag(tagId)}
                    />
                  )
                })
              )}
            </div>
          </div>

          {/* 预设标签选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tagEditor.presetTags')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={clsx(
                      'px-2 py-0.5 text-xs rounded font-medium transition-all',
                      'border-2',
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-500/20'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                    style={{
                      color: tag.color,
                      backgroundColor: tag.bgColor,
                    }}
                  >
                    {tag.name}
                    {isSelected && <Check className="inline w-3 h-3 ml-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 自定义标签 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('tagEditor.customTags')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTag()}
                placeholder={t('tagEditor.customTagPlaceholder')}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleAddCustomTag}
                disabled={!customTagInput.trim()}
                className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                {t('tagEditor.add')}
              </button>
            </div>
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customTags.map(tag => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    size="sm"
                    removable
                    onRemove={() => handleRemoveTag(tag.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 备注输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              {t('tagEditor.notesLabel')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('tagEditor.notesPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            />
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
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 flex items-center gap-1"
          >
            <Check className="w-4 h-4" />
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}