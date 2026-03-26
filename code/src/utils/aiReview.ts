import { ReviewIssue, AIReviewResult } from '@/types/ai';

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
 * 支持行号范围匹配（如果AI返回的行号不完全匹配，在附近几行内也认为是匹配的）
 */
export function getLineIssues(
  result: AIReviewResult | null,
  filePath: string,
  lineNum: number
): ReviewIssue[] {
  if (!result || !result.issues) return [];

  // 先找完全匹配
  const exactMatches = result.issues.filter(
    (issue) => isFilePathMatch(issue.file, filePath) && issue.line === lineNum && !issue.ignored
      && !issue.file.endsWith('.md') && !issue.file.endsWith('.markdown')
  );

  if (exactMatches.length > 0) return exactMatches;

  // 如果没有完全匹配，找附近3行内的（AI可能返回的是hunk开始行或粗略估计）
  const nearbyMatches = result.issues.filter(
    (issue) => {
      if (!isFilePathMatch(issue.file, filePath) || issue.ignored) return false;
      if (issue.file.endsWith('.md') || issue.file.endsWith('.markdown')) return false;
      const lineDiff = Math.abs(issue.line - lineNum);
      return lineDiff <= 3; // 允许3行的误差
    }
  );

  return nearbyMatches;
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
