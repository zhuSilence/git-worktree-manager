import { ReviewIssue, AIReviewResult, AINamingRequest, AINamingResponse } from '@/types/ai';
import type { AINamingSuggestion } from '@/types/ai';
export type { AINamingSuggestion };
import { invoke } from '@tauri-apps/api/core';

/**
 * 规范化文件路径（去除开头的 code/ 等前缀）
 */
function normalizeFilePath(filePath: string): string {
  // 去除常见的路径前缀
  return filePath.replace(/^(code\/|\.\/)/, '');
}

/**
 * 检查文件路径是否匹配（支持部分匹配）
 */
function isFilePathMatch(issuePath: string, diffPath: string): boolean {
  const normalizedIssue = normalizeFilePath(issuePath);
  const normalizedDiff = normalizeFilePath(diffPath);

  // 完全匹配
  if (normalizedIssue === normalizedDiff) return true;
  // 一个包含另一个
  if (normalizedIssue.endsWith(normalizedDiff)) return true;
  if (normalizedDiff.endsWith(normalizedIssue)) return true;
  // 比较最后部分
  const issueParts = normalizedIssue.split('/');
  const diffParts = normalizedDiff.split('/');
  return issueParts[issueParts.length - 1] === diffParts[diffParts.length - 1];
}

/**
 * 检查两个问题是否相同（用于去重）
 */
function isSameIssue(a: ReviewIssue, b: ReviewIssue): boolean {
  return a.message === b.message && a.severity === b.severity;
}

/**
 * 合并连续行的相同问题，返回每个问题应该显示的行号范围
 * 只在第一行显示标记，并显示覆盖的行数
 */
export interface MergedIssue extends ReviewIssue {
  /** 原始起始行 */
  startLine: number;
  /** 原始结束行 */
  endLine: number;
  /** 影响的行数 */
  lineCount: number;
}

/**
 * 合并文件中连续行的相同问题
 */
export function mergeConsecutiveIssues(issues: ReviewIssue[]): MergedIssue[] {
  if (issues.length === 0) return [];

  // 按行号排序
  const sorted = [...issues].sort((a, b) => a.line - b.line);
  const merged: MergedIssue[] = [];

  let current: MergedIssue | null = null;

  for (const issue of sorted) {
    if (!current) {
      current = {
        ...issue,
        startLine: issue.line,
        endLine: issue.line,
        lineCount: 1,
      };
    } else if (
      isSameIssue(current, issue) &&
      issue.line <= current.endLine + 3 // 允许3行的间距也认为是连续的
    ) {
      // 合并到当前问题
      current.endLine = issue.line;
      current.lineCount = current.endLine - current.startLine + 1;
    } else {
      // 保存当前问题，开始新的
      merged.push(current);
      current = {
        ...issue,
        startLine: issue.line,
        endLine: issue.line,
        lineCount: 1,
      };
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * 按文件和行号组织评审问题
 */
export function organizeIssuesByFileAndLine(result: AIReviewResult | null): Map<string, Map<number, ReviewIssue[]>> {
  const map = new Map<string, Map<number, ReviewIssue[]>>();

  if (!result || !result.issues) return map;

  result.issues.forEach((issue) => {
    if (issue.ignored) return;

    const filePath = issue.file;
    const lineNum = issue.line;

    if (!map.has(filePath)) {
      map.set(filePath, new Map());
    }
    const fileMap = map.get(filePath)!;

    if (!fileMap.has(lineNum)) {
      fileMap.set(lineNum, []);
    }
    fileMap.get(lineNum)!.push(issue);
  });

  return map;
}

/**
 * 获取指定文件的所有问题
 */
export function getFileIssues(result: AIReviewResult | null, filePath: string): ReviewIssue[] {
  if (!result || !result.issues) return [];
  return result.issues.filter(
    (issue) => isFilePathMatch(issue.file, filePath) && !issue.ignored
      && !issue.file.endsWith('.md') && !issue.file.endsWith('.markdown')
  );
}

/**
 * 获取指定文件和行的问题
 * 只返回精确匹配的问题，不再返回附近行的问题
 * 连续行的相同问题只在第一行显示
 */
export function getLineIssues(
  result: AIReviewResult | null,
  filePath: string,
  lineNum: number
): MergedIssue[] {
  if (!result || !result.issues) return [];

  // 获取文件的所有问题
  const fileIssues = result.issues.filter(
    (issue) => isFilePathMatch(issue.file, filePath) && !issue.ignored
      && !issue.file.endsWith('.md') && !issue.file.endsWith('.markdown')
  );

  // 合并连续行的相同问题
  const mergedIssues = mergeConsecutiveIssues(fileIssues);

  // 只返回当前行是问题起始行的问题（避免重复显示）
  return mergedIssues.filter(issue => issue.startLine === lineNum);
}

/**
 * 根据严重程度排序问题
 */
export function sortIssuesBySeverity(issues: ReviewIssue[]): ReviewIssue[] {
  const severityOrder = { error: 0, warning: 1, info: 2 };
  return [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * 获取问题的最高严重程度
 */
export function getHighestSeverity(issues: ReviewIssue[]): string | null {
  if (issues.length === 0) return null;
  const severities = issues.map((i) => i.severity);
  if (severities.includes('error')) return 'error';
  if (severities.includes('warning')) return 'warning';
  return 'info';
}

/**
 * 获取文件评审摘要
 */
export function getFileReviewSummary(result: AIReviewResult | null, filePath: string): {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
} {
  const issues = getFileIssues(result, filePath);
  return {
    total: issues.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
  };
}

/**
 * 获取 AI 命名建议
 */
export async function getAINamingSuggestions(request: AINamingRequest): Promise<AINamingResponse> {
  return await invoke<AINamingResponse>('ai_naming_suggestion', { request });
}
