/**
 * AI 评审相关类型定义
 */

/**
 * AI 提供商类型
 */
export type AIProvider = 'openai' | 'claude' | 'ollama' | 'custom';

/**
 * AI 配置
 */
export interface AIConfig {
  /** AI 提供商 */
  provider: AIProvider;
  /** API Key（加密存储） */
  apiKey: string;
  /** API 基础 URL（自定义端点使用） */
  baseUrl?: string;
  /** 模型名称 */
  model: string;
  /** 评审语言 */
  language: 'zh' | 'en';
  /** 是否启用自动评审 */
  autoReview: boolean;
}

/**
 * AI 配置的默认值
 */
export const defaultAIConfig: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  language: 'zh',
  autoReview: false,
};

/**
 * 问题严重程度
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * 评审问题项
 */
export interface ReviewIssue {
  /** 严重程度 */
  severity: Severity;
  /** 文件路径 */
  file: string;
  /** 行号 */
  line: number;
  /** 问题描述 */
  message: string;
  /** 改进建议 */
  suggestion: string;
  /** 是否被忽略 */
  ignored?: boolean;
}

/**
 * 改进建议
 */
export interface ReviewImprovement {
  /** 建议内容 */
  message: string;
  /** 相关文件（可选） */
  files?: string[];
}

/**
 * 代码亮点
 */
export interface ReviewHighlight {
  /** 亮点描述 */
  message: string;
  /** 相关文件（可选） */
  files?: string[];
}

/**
 * AI 评审结果
 */
export interface AIReviewResult {
  /** 唯一标识 */
  id: string;
  /** 评审时间戳 */
  timestamp: number;
  /** 工作树路径 */
  worktreePath: string;
  /** 目标分支 */
  targetBranch: string;
  /** 潜在问题列表 */
  issues: ReviewIssue[];
  /** 改进建议列表 */
  improvements: ReviewImprovement[];
  /** 亮点列表 */
  highlights: ReviewHighlight[];
  /** 原始响应（调试用） */
  rawResponse?: string;
}

/**
 * AI 评审请求
 */
export interface AIReviewRequest {
  /** 工作树路径 */
  worktreePath: string;
  /** 目标分支 */
  targetBranch: string;
  /** 是否强制重新评审 */
  force?: boolean;
}

/**
 * AI 评审响应
 */
export interface AIReviewResponse {
  /** 是否成功 */
  success: boolean;
  /** 评审结果 */
  result?: AIReviewResult;
  /** 错误信息 */
  error?: string;
}

/**
 * AI 测试连接响应
 */
export interface AITestConnectionResponse {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 评审状态
 */
export type ReviewStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * AI 评审状态（Store 用）
 */
export interface AIReviewState {
  /** 当前评审状态 */
  reviewStatus: ReviewStatus;
  /** 当前评审结果 */
  currentResult: AIReviewResult | null;
  /** 错误信息 */
  error: string | null;
  /** 是否显示配置引导 */
  showConfigGuide: boolean;
}

/**
 * AI 评审用的 Diff 统计信息
 */
export interface ReviewDiffStats {
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 修改文件数 */
  changedFiles: number;
}

/**
 * AI 命名建议请求
 */
export interface AINamingRequest {
  /** 仓库路径 */
  repoPath: string;
  /** 用户输入（可选） */
  userInput?: string;
  /** 最近提交数量 */
  commitCount?: number;
}

/**
 * AI 命名建议
 */
export interface AINamingSuggestion {
  /** 建议的名称 */
  name: string;
  /** 建议类型 */
  suggestionType: string;
  /** 理由/说明 */
  reason: string;
}

/**
 * AI 命名建议响应
 */
export interface AINamingResponse {
  /** 是否成功 */
  success: boolean;
  /** 建议列表 */
  suggestions?: AINamingSuggestion[];
  /** 错误信息 */
  error?: string;
}
