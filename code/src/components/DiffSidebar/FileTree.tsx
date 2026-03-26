import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'
import type { FileTreeNode } from './types'
import type { FileDiff } from '@/types/worktree'

/**
 * 构建文件树结构
 * 将扁平的文件列表转换为树形结构，并进行路径压缩和排序
 */
export function buildFileTree(files: FileDiff[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', fullPath: '', isFile: false, children: [] }

  // 构建树结构
  for (const file of files) {
    const parts = file.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      let child = current.children.find(c => c.name === parts[i] && c.isFile === isLast)

      if (!child) {
        child = {
          name: parts[i],
          fullPath: parts.slice(0, i + 1).join('/'),
          isFile: isLast,
          children: [],
          ...(isLast ? { status: file.status, additions: file.additions, deletions: file.deletions } : {}),
        }
        current.children.push(child)
      }
      current = child
    }
  }

  // 压缩只有单个子目录的中间节点: a/ -> b/ -> c 变成 a/b/ -> c
  function compact(node: FileTreeNode): FileTreeNode {
    if (!node.isFile && node.children.length === 1 && !node.children[0].isFile) {
      const child = node.children[0]
      return compact({
        ...child,
        name: node.name ? `${node.name}/${child.name}` : child.name,
        children: child.children,
      })
    }
    return { ...node, children: node.children.map(compact) }
  }

  // 排序：目录在前，文件在后，同类按名称排序
  function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .map(n => ({ ...n, children: sortTree(n.children) }))
      .sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }

  return sortTree(root.children.map(compact))
}

/**
 * 计算节点下的文件数量
 */
export function countFiles(node: FileTreeNode): number {
  if (node.isFile) return 1
  return node.children.reduce((sum, c) => sum + countFiles(c), 0)
}

interface FileTreeNodeItemProps {
  node: FileTreeNode
  depth: number
  activeFile: string | null
  onFileClick: (path: string) => void
  expandedDirs: Set<string>
  toggleDir: (path: string) => void
}

/**
 * 文件树节点组件
 */
export function FileTreeNodeItem({
  node,
  depth,
  activeFile,
  onFileClick,
  expandedDirs,
  toggleDir,
}: FileTreeNodeItemProps) {
  if (node.isFile) {
    return (
      <button
        onClick={() => onFileClick(node.fullPath)}
        className={clsx(
          'w-full text-left py-1 pr-2 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 transition-colors',
          activeFile === node.fullPath && 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        title={node.fullPath}
      >
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            node.status === 'added' && 'bg-green-500',
            node.status === 'deleted' && 'bg-red-500',
            node.status === 'modified' && 'bg-yellow-500',
            node.status === 'renamed' && 'bg-blue-500'
          )}
        />
        <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="truncate font-medium">{node.name}</span>
      </button>
    )
  }

  const isExpanded = expandedDirs.has(node.fullPath)

  return (
    <div>
      <button
        onClick={() => toggleDir(node.fullPath)}
        className="w-full text-left py-1 pr-2 text-[11px] hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1 text-gray-600 dark:text-gray-400 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0 text-gray-400" />
        )}
        {isExpanded ? (
          <FolderOpen className="w-3 h-3 flex-shrink-0 text-yellow-500" />
        ) : (
          <Folder className="w-3 h-3 flex-shrink-0 text-yellow-500" />
        )}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">
          {countFiles(node)}
        </span>
      </button>
      {isExpanded &&
        node.children.map(child => (
          <FileTreeNodeItem
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            activeFile={activeFile}
            onFileClick={onFileClick}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
          />
        ))}
    </div>
  )
}
