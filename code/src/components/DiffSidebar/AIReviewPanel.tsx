import {
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AIReviewResult,
  ReviewIssue,
  ReviewImprovement,
  ReviewHighlight,
  Severity,
} from '@/types/ai';

interface AIReviewPanelProps {
  result: AIReviewResult | null;
  isLoading: boolean;
  error: string | null;
  onReReview: () => void;
  onNavigateToLine: (file: string, line: number) => void;
  onIgnoreIssue: (index: number) => void;
}

/**
 * AI 评审结果面板
 */
export function AIReviewPanel({
  result,
  isLoading,
  error,
  onReReview,
  onNavigateToLine,
  onIgnoreIssue,
}: AIReviewPanelProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState({
    issues: true,
    improvements: true,
    highlights: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2">
          <Bot className="w-8 h-8 text-blue-500 animate-pulse" />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t('diff.analyzing')}
          </span>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{t('diff.reviewFailed')}</span>
        </div>
        <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error}</p>
        <button
          onClick={onReReview}
          className="mt-3 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  // 无结果状态
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
        <Bot className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">点击上方按钮开始 AI 评审</p>
      </div>
    );
  }

  const activeIssues = result.issues.filter((i) => !i.ignored);

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-500" />
          <span className="font-medium text-gray-900 dark:text-white">
            AI 评审结果
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(result.timestamp).toLocaleString()}
          </span>
        </div>
        <button
          onClick={onReReview}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重新评审
        </button>
      </div>

      {/* 潜在问题 */}
      {activeIssues.length > 0 && (
        <ReviewSection
          title={t('diff.potentialIssues')}
          count={activeIssues.length}
          icon={<AlertCircle className="w-4 h-4 text-orange-500" />}
          isExpanded={expandedSections.issues}
          onToggle={() => toggleSection('issues')}
          color="orange"
        >
          <IssuesList
            issues={activeIssues}
            onNavigate={onNavigateToLine}
            onIgnore={onIgnoreIssue}
          />
        </ReviewSection>
      )}

      {/* 改进建议 */}
      {result.improvements.length > 0 && (
        <ReviewSection
          title={t('diff.suggestions')}
          count={result.improvements.length}
          icon={<Lightbulb className="w-4 h-4 text-blue-500" />}
          isExpanded={expandedSections.improvements}
          onToggle={() => toggleSection('improvements')}
          color="blue"
        >
          <ImprovementsList improvements={result.improvements} />
        </ReviewSection>
      )}

      {/* 亮点 */}
      {result.highlights.length > 0 && (
        <ReviewSection
          title={t('diff.highlights')}
          count={result.highlights.length}
          icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          isExpanded={expandedSections.highlights}
          onToggle={() => toggleSection('highlights')}
          color="green"
        >
          <HighlightsList highlights={result.highlights} />
        </ReviewSection>
      )}

      {/* 无内容提示 */}
      {activeIssues.length === 0 &&
        result.improvements.length === 0 &&
        result.highlights.length === 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p>AI 未发现明显问题，代码看起来不错！</p>
          </div>
        )}
    </div>
  );
}

// 子组件：可折叠 Section
interface ReviewSectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  color: 'orange' | 'blue' | 'green';
  children: React.ReactNode;
}

function ReviewSection({
  title,
  count,
  icon,
  isExpanded,
  onToggle,
  color,
  children,
}: ReviewSectionProps) {
  const colorClasses = {
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden ${colorClasses[color]}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {title} ({count})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {isExpanded && <div className="p-4 border-t border-current">{children}</div>}
    </div>
  );
}

// 子组件：问题列表
function IssuesList({
  issues,
  onNavigate,
  onIgnore,
}: {
  issues: ReviewIssue[];
  onNavigate: (file: string, line: number) => void;
  onIgnore: (index: number) => void;
}) {
  const { t } = useTranslation();
  const getSeverityClass = (severity: Severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
      case 'warning':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getSeverityLabel = (severity: Severity) => {
    switch (severity) {
      case 'error':
        return '错误';
      case 'warning':
        return '警告';
      case 'info':
        return '提示';
      default:
        return severity;
    }
  };

  return (
    <div className="space-y-3">
      {issues.map((issue, index) => (
        <div
          key={index}
          className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span
                className={`text-xs px-2 py-0.5 rounded ${getSeverityClass(
                  issue.severity
                )}`}
              >
                {getSeverityLabel(issue.severity)}
              </span>
              <button
                onClick={() => onNavigate(issue.file, issue.line)}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {issue.file}:{issue.line}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={() => onIgnore(index)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              title={t('diff.ignoreThisIssue')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            {issue.message}
          </p>
          <p className="mt-1 text-sm text-green-600 dark:text-green-400">
            {t('diff.suggestion')}: {issue.suggestion}
          </p>
        </div>
      ))}
    </div>
  );
}

// 子组件：改进建议列表
function ImprovementsList({
  improvements,
}: {
  improvements: ReviewImprovement[];
}) {
  return (
    <ul className="space-y-2">
      {improvements.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="text-blue-500 mt-0.5">•</span>
          <div>
            <span>{item.message}</span>
            {item.files && item.files.length > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                ({item.files.join(', ')})
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// 子组件：亮点列表
function HighlightsList({
  highlights,
}: {
  highlights: ReviewHighlight[];
}) {
  return (
    <ul className="space-y-2">
      {highlights.map((item, index) => (
        <li
          key={index}
          className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400"
        >
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <span>{item.message}</span>
            {item.files && item.files.length > 0 && (
              <span className="text-xs text-green-600/70 dark:text-green-400/70 ml-1">
                ({item.files.join(', ')})
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
