import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AIConfig,
  AIReviewResult,
  AIReviewRequest,
  ReviewStatus,
  defaultAIConfig,
} from '@/types/ai';
import { aiService } from '@/services/ai';

/**
 * 缓存过期时间（30分钟）
 */
const CACHE_TTL = 30 * 60 * 1000;

/**
 * 缓存的评审结果
 */
interface CachedReview {
  result: AIReviewResult;
  timestamp: number;
}

/**
 * 解析错误信息
 */
function parseError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
  }
  return 'Unknown error occurred';
}

/**
 * 生成缓存键
 */
const getCacheKey = (worktreePath: string, branch: string): string =>
  `${worktreePath}:${branch}`;

/**
 * AI 评审 Store 状态
 */
interface AIReviewStoreState {
  // 配置状态
  config: AIConfig;

  // 评审状态
  reviewStatus: ReviewStatus;
  currentResult: AIReviewResult | null;
  error: string | null;
  showConfigGuide: boolean;

  // 评审历史缓存
  reviewHistory: Record<string, CachedReview>;
}

/**
 * AI 评审 Store 操作
 */
interface AIReviewStoreActions {
  // 配置操作
  setConfig: (config: AIConfig) => void;
  updateConfig: (partial: Partial<AIConfig>) => void;

  // 评审操作
  performReview: (request: AIReviewRequest) => Promise<void>;
  reReview: (request: AIReviewRequest) => Promise<void>;
  clearResult: () => void;
  clearError: () => void;

  // 问题操作
  ignoreIssue: (index: number) => void;
  restoreIssue: (index: number) => void;

  // 配置引导
  setShowConfigGuide: (show: boolean) => void;

  // 缓存操作
  getCachedReview: (worktreePath: string, branch: string) => AIReviewResult | undefined;
  clearHistory: () => void;
}

/**
 * AI 评审 Store
 */
export const aiReviewStore = create<AIReviewStoreState & AIReviewStoreActions>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: defaultAIConfig,
      reviewStatus: 'idle',
      currentResult: null,
      error: null,
      showConfigGuide: false,
      reviewHistory: {},

      // 配置操作
      setConfig: (config) => {
        set({ config });
      },

      updateConfig: (partial) => {
        set((state) => ({
          config: { ...state.config, ...partial },
        }));
      },

      // 评审操作
      performReview: async (request) => {
        const { force, worktreePath, targetBranch } = request;
        const { config, reviewHistory } = get();

        // 检查是否已配置 API Key
        if (config.provider !== 'ollama' && !config.apiKey) {
          set({
            showConfigGuide: true,
            error: '请先配置 AI API Key',
            reviewStatus: 'error',
          });
          return;
        }

        // 检查缓存
        if (!force) {
          const cacheKey = getCacheKey(worktreePath, targetBranch);
          const cached = reviewHistory[cacheKey];
          if (cached) {
            // 检查缓存是否过期
            const isExpired = Date.now() - cached.timestamp > CACHE_TTL;
            if (!isExpired) {
              set({
                currentResult: cached.result,
                reviewStatus: 'success',
                error: null,
              });
              return;
            }
          }
        }

        set({ reviewStatus: 'loading', error: null });

        try {
          const response = await aiService.review(request);

          if (response.success && response.result) {
            // 更新当前结果和缓存
            const cacheKey = getCacheKey(worktreePath, targetBranch);
            const cachedReview: CachedReview = {
              result: response.result,
              timestamp: Date.now(),
            };
            set({
              currentResult: response.result,
              reviewStatus: 'success',
              error: null,
              reviewHistory: {
                ...reviewHistory,
                [cacheKey]: cachedReview,
              },
            });
          } else {
            set({
              reviewStatus: 'error',
              error: response.error || '评审失败',
            });
          }
        } catch (err) {
          console.error('[AI Review] Error:', err);
          set({
            reviewStatus: 'error',
            error: parseError(err),
          });
        }
      },

      reReview: (request) => {
        return get().performReview({ ...request, force: true });
      },

      clearResult: () => {
        set({
          currentResult: null,
          reviewStatus: 'idle',
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      // 问题操作
      ignoreIssue: (index) => {
        const { currentResult, reviewHistory } = get();
        if (!currentResult) return;

        const newIssues = [...currentResult.issues];
        if (newIssues[index]) {
          newIssues[index] = { ...newIssues[index], ignored: true };
          const updatedResult = { ...currentResult, issues: newIssues };

          // 更新当前结果和缓存
          const cacheKey = getCacheKey(currentResult.worktreePath, currentResult.targetBranch);
          const existingCache = reviewHistory[cacheKey];
          const cachedReview: CachedReview = {
            result: updatedResult,
            timestamp: existingCache?.timestamp ?? Date.now(),
          };
          set({
            currentResult: updatedResult,
            reviewHistory: {
              ...reviewHistory,
              [cacheKey]: cachedReview,
            },
          });
        }
      },

      restoreIssue: (index) => {
        const { currentResult, reviewHistory } = get();
        if (!currentResult) return;

        const newIssues = [...currentResult.issues];
        if (newIssues[index]) {
          newIssues[index] = { ...newIssues[index], ignored: false };
          const updatedResult = { ...currentResult, issues: newIssues };

          // 更新当前结果和缓存
          const cacheKey = getCacheKey(currentResult.worktreePath, currentResult.targetBranch);
          const existingCache = reviewHistory[cacheKey];
          const cachedReview: CachedReview = {
            result: updatedResult,
            timestamp: existingCache?.timestamp ?? Date.now(),
          };
          set({
            currentResult: updatedResult,
            reviewHistory: {
              ...reviewHistory,
              [cacheKey]: cachedReview,
            },
          });
        }
      },

      // 配置引导
      setShowConfigGuide: (show) => {
        set({ showConfigGuide: show });
      },

      // 缓存操作
      getCachedReview: (worktreePath, branch) => {
        const { reviewHistory } = get();
        const cacheKey = getCacheKey(worktreePath, branch);
        const cached = reviewHistory[cacheKey];
        if (!cached) return undefined;
        // 检查缓存是否过期
        if (Date.now() - cached.timestamp > CACHE_TTL) {
          return undefined;
        }
        return cached.result;
      },

      clearHistory: () => {
        set({ reviewHistory: {} });
      },
    }),
    {
      name: 'ai-review-storage',
      partialize: (state) => ({
        config: state.config,
        reviewHistory: state.reviewHistory,
      }),
    }
  )
);
