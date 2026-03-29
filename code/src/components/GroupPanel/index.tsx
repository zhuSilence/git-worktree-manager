import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupsStore } from '@/stores/groupsStore'
import { PRESET_COLORS, type WorktreeGroup } from '@/types/group'
import { X, Plus, Palette, Trash2, Edit2, Check, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'

interface GroupPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function GroupPanel({ isOpen, onClose }: GroupPanelProps) {
  const { t } = useTranslation()
  const { groups, createGroup, updateGroup, deleteGroup, initializeDefaultGroups } = useGroupsStore()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0].value)
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // 初始化默认分组
  if (groups.length === 0) {
    initializeDefaultGroups()
  }

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return
    createGroup(newGroupName.trim(), newGroupColor, newGroupDesc.trim() || undefined)
    setNewGroupName('')
    setNewGroupColor(PRESET_COLORS[0].value)
    setNewGroupDesc('')
    setShowCreateForm(false)
  }

  const handleStartEdit = (group: WorktreeGroup) => {
    setEditingGroupId(group.id)
    setEditName(group.name)
    setEditColor(group.color)
    setEditDesc(group.description || '')
  }

  const handleSaveEdit = () => {
    if (!editingGroupId || !editName.trim()) return
    updateGroup(editingGroupId, {
      name: editName.trim(),
      color: editColor,
      description: editDesc.trim() || undefined,
    })
    setEditingGroupId(null)
  }

  const handleDeleteGroup = (id: string) => {
    if (window.confirm(t('groups.confirmDelete'))) {
      deleteGroup(id)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            {t('groups.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* 分组列表 */}
          <div className="space-y-2 mb-4">
            {groups.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                {t('groups.noGroups')}
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                >
                  {editingGroupId === group.id ? (
                    // 编辑模式
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          placeholder={t('groups.groupName')}
                        />
                        <div className="flex gap-1">
                          {PRESET_COLORS.slice(0, 5).map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setEditColor(c.value)}
                              className={clsx(
                                'w-5 h-5 rounded-full transition-all',
                                c.bgClass,
                                editColor === c.value ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                              )}
                              title={c.name}
                            />
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        placeholder={t('groups.groupDesc')}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="px-2 py-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // 显示模式
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {group.name}
                          </div>
                          {group.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {group.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(group)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 创建新分组 */}
          {showCreateForm ? (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={t('groups.groupName')}
                autoFocus
              />
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  <Palette className="w-3 h-3 inline mr-1" />
                  {t('groups.selectColor')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewGroupColor(c.value)}
                      className={clsx(
                        'w-6 h-6 rounded-full transition-all',
                        c.bgClass,
                        newGroupColor === c.value ? 'ring-2 ring-offset-2 ring-blue-400' : 'hover:scale-110'
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={t('groups.groupDescOptional')}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('groups.createGroup')}
            </button>
          )}
        </div>

        {/* 提示 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {t('groups.helpText')}
        </div>
      </div>
    </div>
  )
}