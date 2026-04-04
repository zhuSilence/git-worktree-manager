import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'
import type { FileTreeNode, SortedFile } from './types'
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
          ...(isLast ? { status: file.status, additions: file.additions, deletions: file.deletions, source: file.source } : {}),
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
 * 排序文件列表，与文件树显示顺序保持一致
 * 返回带原始索引的文件列表，用于保持滚动定位正确
 */
export function sortFilesForDisplay(files: FileDiff[]): SortedFile[] {
  return files
    .map((file, originalIndex) => ({ file, originalIndex }))
    .sort((a, b) => {
      const partsA = a.file.path.split('/')
      const partsB = b.file.path.split('/')
      const minLen = Math.min(partsA.length, partsB.length)

      // 逐层比较路径
      for (let i = 0; i < minLen; i++) {
        const partA = partsA[i]
        const partB = partsB[i]

        // 如果当前层级相同，继续比较下一层
        if (partA === partB) continue

        // 判断是否是最后一层（文件）
        const isFileA = i === partsA.length - 1
        const isFileB = i === partsB.length - 1

        // 如果一个是目录一个是文件，目录在前
        if (isFileA !== isFileB) {
          return isFileA ? 1 : -1
        }

        // 同类按名称排序
        return partA.localeCompare(partB)
      }

      // 如果前面都一样，短的在前（目录优先）
      return partsA.length - partsB.length
    })
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
        {/* 变更来源标签 */}
        {node.source && node.source !== 'committed' && (
          <span className={clsx(
            'text-[10px] px-1 rounded ml-1',
            node.source === 'untracked'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          )}>
            {node.source === 'untracked' ? '未跟踪' : '工作区'}
          </span>
        )}
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
