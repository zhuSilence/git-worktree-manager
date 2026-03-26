import { useState, useRef, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, X, MessageSquare, GripHorizontal } from 'lucide-react';
import { ReviewIssue, AIReviewResult } from '@/types/ai';
import { clsx } from 'clsx';
import { getHighestSeverity } from '@/utils/aiReview';

interface InlineReviewMarkerProps {
  issues: ReviewIssue[];
  filePath: string;
  lineNum: number;
  onNavigateToIssue?: (issue: ReviewIssue) => void;
}

/**
 * 行内评审问题标记
 * 显示在行号旁边，点击展开问题详情（支持拖动）
 */
export function InlineReviewMarker({
  issues,
  filePath,
  lineNum,
  onNavigateToIssue,
}: InlineReviewMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // 点击外部关闭（拖动时不触发）
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDragging) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isDragging]);

  // 打开时初始化位置
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanelPos({ x: rect.left, y: rect.bottom + 4 });
    } else if (!isOpen) {
      setPanelPos(null);
    }
  }, [isOpen]);

  // 拖动事件
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      setPanelPos({ x: dragStartRef.current.px + dx, y: dragStartRef.current.py + dy });
    };

    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!panelPos) return;
    dragStartRef.current = { mx: e.clientX, my: e.clientY, px: panelPos.x, py: panelPos.y };
    setIsDragging(true);
  };

  if (issues.length === 0) return null;

  const highestSeverity = getHighestSeverity(issues);

  const severityConfig = {
    error: {
      icon: AlertCircle,
      bgClass: 'bg-red-100 dark:bg-red-900/40',
      textClass: 'text-red-700 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-800',
      badgeClass: 'bg-red-500',
    },
    warning: {
      icon: AlertTriangle,
      bgClass: 'bg-orange-100 dark:bg-orange-900/40',
      textClass: 'text-orange-700 dark:text-orange-400',
      borderClass: 'border-orange-200 dark:border-orange-800',
      badgeClass: 'bg-orange-500',
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-100 dark:bg-blue-900/40',
      textClass: 'text-blue-700 dark:text-blue-400',
      borderClass: 'border-blue-200 dark:border-blue-800',
      badgeClass: 'bg-blue-500',
    },
  };

  const config = severityConfig[highestSeverity as keyof typeof severityConfig] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* 标记按钮 - 紧凑版 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center justify-center w-4 h-4 rounded-full transition-all',
          config.badgeClass,
          'text-white text-[8px] font-bold',
          'hover:scale-110',
          isOpen && 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-900',
          isOpen && config.badgeClass
        )}
      >
        {issues.length > 1 ? issues.length : ''}
      </button>

      {/* 弹出详情面板（可拖动） */}
      {isOpen && panelPos && (
        <div
          className={clsx(
            'fixed z-[100] w-80',
            'bg-white dark:bg-gray-800 rounded-lg shadow-xl',
            'border',
            config.borderClass,
            isDragging && 'select-none'
          )}
          style={{ top: panelPos.y, left: panelPos.x }}
        >
          <div
            className={clsx(
              'flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing',
              config.borderClass,
              isDragging && 'cursor-grabbing'
            )}
            onMouseDown={handleHeaderMouseDown}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-3 h-3 text-gray-400" />
              <Icon className={clsx('w-4 h-4', config.textClass)} />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {issues.length} 个问题
              </span>
            </div>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-2 space-y-2">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs"
              >
                <div className="flex items-start gap-2">
                  <SeverityBadge severity={issue.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {issue.message}
                    </p>
                    {issue.suggestion && (
                      <div className="mt-1.5 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-green-600 dark:text-green-400">
                          {issue.suggestion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 严重程度徽章
 */
function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    error: { class: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: '错误' },
    warning: { class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', label: '警告' },
    info: { class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', label: '提示' },
  };

  const { class: className, label } = config[severity as keyof typeof config] || config.info;

  return (
    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0', className)}>
      {label}
    </span>
  );
}

interface FileReviewSummaryProps {
  result: AIReviewResult | null;
  filePath: string;
}

/**
 * 文件评审摘要
 * 显示在文件头部
 */
export function FileReviewSummary({ result, filePath }: FileReviewSummaryProps) {
  if (!result || !result.issues) return null;
  // 文档文件不展示评审摘要
  if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) return null;

  const fileIssues = result.issues.filter(
    (i) => i.file === filePath && !i.ignored
      && !i.file.endsWith('.md') && !i.file.endsWith('.markdown')
  );

  if (fileIssues.length === 0) return null;

  const errors = fileIssues.filter((i) => i.severity === 'error').length;
  const warnings = fileIssues.filter((i) => i.severity === 'warning').length;
  const infos = fileIssues.filter((i) => i.severity === 'info').length;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {errors > 0 && (
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3" />
          {errors}
        </span>
      )}
      {warnings > 0 && (
        <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
          <AlertTriangle className="w-3 h-3" />
          {warnings}
        </span>
      )}
      {infos > 0 && (
        <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
          <Info className="w-3 h-3" />
          {infos}
        </span>
      )}
    </div>
  );
}
