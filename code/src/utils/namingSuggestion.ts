/**
 * 智能命名建议工具
 */

export interface NamingSuggestion {
  label: string
  value: string
  source: 'issue' | 'prefix' | 'convention'
}

/**
 * 命名前缀建议
 */
export const BRANCH_PREFIXES = [
  { prefix: 'feature/', label: '功能', description: '新功能开发' },
  { prefix: 'bugfix/', label: '修复', description: 'Bug 修复' },
  { prefix: 'hotfix/', label: '热修复', description: '紧急修复' },
  { prefix: 'release/', label: '发布', description: '发布分支' },
  { prefix: 'experiment/', label: '实验', description: '实验性功能' },
  { prefix: 'docs/', label: '文档', description: '文档更新' },
  { prefix: 'refactor/', label: '重构', description: '代码重构' },
  { prefix: 'test/', label: '测试', description: '测试相关' },
]

/**
 * 解析 GitHub Issue 链接
 * 支持格式: https://github.com/owner/repo/issues/123
 */
export function parseGitHubIssue(input: string): { owner: string; repo: string; number: number } | null {
  const match = input.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i)
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3], 10),
    }
  }
  return null
}

/**
 * 解析 Jira Issue 链接
 * 支持格式: https://company.atlassian.net/browse/PROJ-123
 */
export function parseJiraIssue(input: string): { key: string } | null {
  const match = input.match(/browse\/([A-Z]+-\d+)/i)
  if (match) {
    return { key: match[1].toUpperCase() }
  }
  // 也支持直接输入 Jira key
  const keyMatch = input.match(/^([A-Z]+-\d+)$/i)
  if (keyMatch) {
    return { key: keyMatch[1].toUpperCase() }
  }
  return null
}

/**
 * 生成命名建议
 */
export function generateSuggestions(input: string): NamingSuggestion[] {
  const suggestions: NamingSuggestion[] = []

  if (!input.trim()) {
    // 没有输入时，提供前缀建议
    return BRANCH_PREFIXES.map(p => ({
      label: `${p.prefix}${p.label}`,
      value: p.prefix,
      source: 'prefix' as const,
    }))
  }

  // 尝试解析 GitHub Issue
  const ghIssue = parseGitHubIssue(input)
  if (ghIssue) {
    suggestions.push({
      label: `GitHub #${ghIssue.number}`,
      value: `issue-${ghIssue.number}`,
      source: 'issue',
    })
    suggestions.push({
      label: `feature/issue-${ghIssue.number}`,
      value: `feature/issue-${ghIssue.number}`,
      source: 'issue',
    })
  }

  // 尝试解析 Jira Issue
  const jiraIssue = parseJiraIssue(input)
  if (jiraIssue) {
    suggestions.push({
      label: `Jira ${jiraIssue.key}`,
      value: jiraIssue.key.toLowerCase(),
      source: 'issue',
    })
    suggestions.push({
      label: `feature/${jiraIssue.key.toLowerCase()}`,
      value: `feature/${jiraIssue.key.toLowerCase()}`,
      source: 'issue',
    })
  }

  // 如果输入看起来像是数字（可能是 issue 号）
  const issueNumber = parseInt(input, 10)
  if (!isNaN(issueNumber) && issueNumber > 0) {
    suggestions.push({
      label: `Issue #${issueNumber}`,
      value: `issue-${issueNumber}`,
      source: 'issue',
    })
    suggestions.push({
      label: `feature/issue-${issueNumber}`,
      value: `feature/issue-${issueNumber}`,
      source: 'issue',
    })
  }

  // 为已有输入添加前缀建议
  const cleanInput = input.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (cleanInput && !cleanInput.includes('/')) {
    BRANCH_PREFIXES.slice(0, 3).forEach(p => {
      suggestions.push({
        label: `${p.prefix}${cleanInput}`,
        value: `${p.prefix}${cleanInput}`,
        source: 'convention',
      })
    })
  }

  return suggestions
}

/**
 * 验证分支名称
 */
export function validateBranchName(name: string): { valid: boolean; message?: string } {
  if (!name.trim()) {
    return { valid: false, message: '名称不能为空' }
  }

  // 检查非法字符
  if (/[^\w/.-]/.test(name)) {
    return { valid: false, message: '包含非法字符，只允许字母、数字、-、_、/' }
  }

  // 检查开头
  if (/^[.-]/.test(name)) {
    return { valid: false, message: '名称不能以 . 或 - 开头' }
  }

  // 检查连续斜杠
  if (/\/{2,}/.test(name)) {
    return { valid: false, message: '不能包含连续的斜杠' }
  }

  // 检查结尾
  if (/[./]$/.test(name)) {
    return { valid: false, message: '名称不能以 . 或 / 结尾' }
  }

  return { valid: true }
}

/**
 * 格式化分支名称
 */
export function formatBranchName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9/-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}