/**
 * 字符级差异片段
 */
export interface CharSegment {
  text: string
  highlight: boolean
}

/**
 * 语法高亮 Token
 */
export interface SyntaxToken {
  text: string
  type: 'keyword' | 'string' | 'comment' | 'number' | 'normal'
}

/**
 * Diff 视图模式
 */
export type ViewMode = 'unified' | 'split'

/**
 * 文件树节点
 */
export interface FileTreeNode {
  name: string
  fullPath: string
  isFile: boolean
  status?: string
  additions?: number
  deletions?: number
  source?: 'committed' | 'unstaged' | 'untracked'
  children: FileTreeNode[]
}
