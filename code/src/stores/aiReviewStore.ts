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
  reviewHistory: Record<string, AIReviewResult>;
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
            set({
              currentResult: cached,
              reviewStatus: 'success',
              error: null,
            });
            return;
          }
        }

        set({ reviewStatus: 'loading', error: null });

        try {
          const response = await aiService.review(request);

          if (response.success && response.result) {
            // 更新当前结果和缓存
            const cacheKey = getCacheKey(worktreePath, targetBranch);
            set({
              currentResult: response.result,
              reviewStatus: 'success',
              error: null,
              reviewHistory: {
                ...reviewHistory,
                [cacheKey]: response.result,
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
          let errorMessage = '未知错误';
          if (err instanceof Error) {
            errorMessage = err.message;
          } else if (typeof err === 'string') {
            errorMessage = err;
          } else if (err && typeof err === 'object') {
            // 尝试提取错误信息
            errorMessage = (err as any).message || (err as any).error || JSON.stringify(err);
          }
          set({
            reviewStatus: 'error',
            error: errorMessage,
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
          set({
            currentResult: updatedResult,
            reviewHistory: {
              ...reviewHistory,
              [cacheKey]: updatedResult,
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
          set({
            currentResult: updatedResult,
            reviewHistory: {
              ...reviewHistory,
              [cacheKey]: updatedResult,
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
        return reviewHistory[cacheKey];
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
