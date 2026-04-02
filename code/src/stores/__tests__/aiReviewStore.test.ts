import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiReviewStore } from '../aiReviewStore';

// Mock AI service
vi.mock('@/services/ai', () => ({
  aiService: {
    review: vi.fn(),
  },
}));

import { aiService } from '@/services/ai';

describe('aiReviewStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    aiReviewStore.setState({
      config: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o-mini',
        language: 'zh',
        autoReview: false,
      },
      reviewStatus: 'idle',
      currentResult: null,
      error: null,
      showConfigGuide: false,
      reviewHistory: {},
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = aiReviewStore.getState();
      expect(state.reviewStatus).toBe('idle');
      expect(state.currentResult).toBeNull();
      expect(state.error).toBeNull();
      expect(state.showConfigGuide).toBe(false);
      expect(state.reviewHistory).toEqual({});
      expect(state.config.provider).toBe('openai');
      expect(state.config.apiKey).toBe('');
    });
  });

  describe('setConfig', () => {
    it('should set the entire config', () => {
      const newConfig = {
        provider: 'claude' as const,
        apiKey: 'test-key',
        model: 'claude-3',
        language: 'en' as const,
        autoReview: true,
      };

      const store = aiReviewStore.getState();
      store.setConfig(newConfig);

      const state = aiReviewStore.getState();
      expect(state.config).toEqual(newConfig);
    });
  });

  describe('updateConfig', () => {
    it('should partially update config', () => {
      const store = aiReviewStore.getState();
      store.updateConfig({ apiKey: 'new-key', model: 'gpt-4' });

      const state = aiReviewStore.getState();
      expect(state.config.apiKey).toBe('new-key');
      expect(state.config.model).toBe('gpt-4');
      expect(state.config.provider).toBe('openai'); // Unchanged
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      aiReviewStore.setState({ error: 'Some error' });
      expect(aiReviewStore.getState().error).toBe('Some error');

      aiReviewStore.getState().clearError();
      expect(aiReviewStore.getState().error).toBeNull();
    });
  });

  describe('clearResult', () => {
    it('should clear current result and reset status', () => {
      aiReviewStore.setState({
        currentResult: {
          id: 'test-id',
          timestamp: Date.now(),
          worktreePath: '/test',
          targetBranch: 'main',
          issues: [],
          improvements: [],
          highlights: [],
        },
        reviewStatus: 'success',
        error: 'Some error',
      });

      aiReviewStore.getState().clearResult();

      const state = aiReviewStore.getState();
      expect(state.currentResult).toBeNull();
      expect(state.reviewStatus).toBe('idle');
      expect(state.error).toBeNull();
    });
  });

  describe('setShowConfigGuide', () => {
    it('should set showConfigGuide flag', () => {
      const store = aiReviewStore.getState();
      store.setShowConfigGuide(true);

      expect(aiReviewStore.getState().showConfigGuide).toBe(true);

      store.setShowConfigGuide(false);

      expect(aiReviewStore.getState().showConfigGuide).toBe(false);
    });
  });

  describe('performReview', () => {
    it('should show config guide when API key is not configured', async () => {
      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.showConfigGuide).toBe(true);
      expect(state.error).toBe('请先配置 AI API Key');
      expect(state.reviewStatus).toBe('error');
    });

    it('should not require API key for ollama provider', async () => {
      aiReviewStore.setState({
        config: {
          provider: 'ollama',
          apiKey: '',
          model: 'llama2',
          language: 'zh',
          autoReview: false,
        },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: true,
        result: {
          id: 'test-id',
          timestamp: Date.now(),
          worktreePath: '/test/repo',
          targetBranch: 'main',
          issues: [],
          improvements: [],
          highlights: [],
        },
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.showConfigGuide).toBe(false);
      expect(state.reviewStatus).toBe('success');
    });

    it('should return cached result when available', async () => {
      const cachedResult = {
        id: 'cached-id',
        timestamp: Date.now() - 1000,
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [{ severity: 'warning' as const, file: 'test.ts', line: 1, message: 'Test', suggestion: 'Fix' }],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
        reviewHistory: {
          '/test/repo:main': cachedResult,
        },
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      // Should not call AI service when cache exists
      expect(aiService.review).not.toHaveBeenCalled();
      expect(aiReviewStore.getState().currentResult).toEqual(cachedResult);
      expect(aiReviewStore.getState().reviewStatus).toBe('success');
    });

    it('should force re-review when force is true', async () => {
      const cachedResult = {
        id: 'cached-id',
        timestamp: Date.now() - 1000,
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [],
        improvements: [],
        highlights: [],
      };

      const newResult = {
        id: 'new-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
        reviewHistory: {
          '/test/repo:main': cachedResult,
        },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: true,
        result: newResult,
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
        force: true,
      });

      // Should call AI service even with cache
      expect(aiService.review).toHaveBeenCalled();
      expect(aiReviewStore.getState().currentResult).toEqual(newResult);
    });

    it('should perform review successfully', async () => {
      const mockResult = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [
          { severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix it' },
          { severity: 'warning' as const, file: 'test2.ts', line: 20, message: 'Warning', suggestion: 'Consider' },
        ],
        improvements: [{ message: 'Improve performance' }],
        highlights: [{ message: 'Good code structure' }],
      };

      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: true,
        result: mockResult,
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.reviewStatus).toBe('success');
      expect(state.currentResult).toEqual(mockResult);
      expect(state.error).toBeNull();
      // Should cache the result
      expect(state.reviewHistory['/test/repo:main']).toEqual(mockResult);
    });

    it('should handle review failure with error message', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: false,
        error: 'API request failed',
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.reviewStatus).toBe('error');
      expect(state.error).toBe('API request failed');
    });

    it('should handle review failure with default error message', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: false,
      });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.error).toBe('评审失败');
    });

    it('should handle thrown errors with Error instance', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockRejectedValue(new Error('Network error'));

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.reviewStatus).toBe('error');
      expect(state.error).toBe('Network error');
    });

    it('should handle thrown errors with string', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockRejectedValue('Something went wrong');

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.error).toBe('Something went wrong');
    });

    it('should handle thrown errors with object', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockRejectedValue({ message: 'Object error' });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.error).toBe('Object error');
    });

    it('should handle thrown errors with object containing error field', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockRejectedValue({ error: 'Custom error field' });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.error).toBe('Custom error field');
    });

    it('should handle thrown errors with unknown object', async () => {
      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockRejectedValue({ code: 500, details: 'Unknown' });

      const store = aiReviewStore.getState();
      await store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      const state = aiReviewStore.getState();
      expect(state.error).toContain('Unknown');
    });

    it('should set loading status during review', async () => {
      let resolveReview: (value: unknown) => void;
      const reviewPromise = new Promise((resolve) => {
        resolveReview = resolve;
      });
      vi.mocked(aiService.review).mockReturnValue(reviewPromise);

      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      const store = aiReviewStore.getState();
      const performPromise = store.performReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      expect(aiReviewStore.getState().reviewStatus).toBe('loading');

      resolveReview!({ success: true, result: { id: 'test', timestamp: 0, worktreePath: '', targetBranch: '', issues: [], improvements: [], highlights: [] } });
      await performPromise;

      expect(aiReviewStore.getState().reviewStatus).toBe('success');
    });
  });

  describe('reReview', () => {
    it('should call performReview with force=true', async () => {
      const mockResult = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        config: { ...aiReviewStore.getState().config, apiKey: 'test-key' },
      });

      vi.mocked(aiService.review).mockResolvedValue({
        success: true,
        result: mockResult,
      });

      const store = aiReviewStore.getState();
      await store.reReview({
        worktreePath: '/test/repo',
        targetBranch: 'main',
      });

      expect(aiService.review).toHaveBeenCalledWith(
        expect.objectContaining({ force: true })
      );
    });
  });

  describe('ignoreIssue', () => {
    it('should mark issue as ignored', () => {
      const result = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [
          { severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix' },
          { severity: 'warning' as const, file: 'test2.ts', line: 20, message: 'Warning', suggestion: 'Consider' },
        ],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({ currentResult: result });

      const store = aiReviewStore.getState();
      store.ignoreIssue(0);

      const state = aiReviewStore.getState();
      expect(state.currentResult?.issues[0].ignored).toBe(true);
      expect(state.currentResult?.issues[1].ignored).toBeUndefined();
    });

    it('should update cache when ignoring issue', () => {
      const result = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [
          { severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix' },
        ],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        currentResult: result,
        reviewHistory: {
          '/test/repo:main': result,
        },
      });

      const store = aiReviewStore.getState();
      store.ignoreIssue(0);

      const state = aiReviewStore.getState();
      expect(state.reviewHistory['/test/repo:main'].issues[0].ignored).toBe(true);
    });

    it('should do nothing when no current result', () => {
      const store = aiReviewStore.getState();
      // Should not throw
      store.ignoreIssue(0);
    });

    it('should do nothing when index is out of bounds', () => {
      const result = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [{ severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix' }],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({ currentResult: result });

      const store = aiReviewStore.getState();
      // Should not throw
      store.ignoreIssue(99);
    });
  });

  describe('restoreIssue', () => {
    it('should restore ignored issue', () => {
      const result = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [
          { severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix', ignored: true },
        ],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({ currentResult: result });

      const store = aiReviewStore.getState();
      store.restoreIssue(0);

      const state = aiReviewStore.getState();
      expect(state.currentResult?.issues[0].ignored).toBe(false);
    });

    it('should update cache when restoring issue', () => {
      const result = {
        id: 'test-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [
          { severity: 'error' as const, file: 'test.ts', line: 10, message: 'Error', suggestion: 'Fix', ignored: true },
        ],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        currentResult: result,
        reviewHistory: {
          '/test/repo:main': result,
        },
      });

      const store = aiReviewStore.getState();
      store.restoreIssue(0);

      const state = aiReviewStore.getState();
      expect(state.reviewHistory['/test/repo:main'].issues[0].ignored).toBe(false);
    });
  });

  describe('getCachedReview', () => {
    it('should return cached result for worktree and branch', () => {
      const cachedResult = {
        id: 'cached-id',
        timestamp: Date.now(),
        worktreePath: '/test/repo',
        targetBranch: 'main',
        issues: [],
        improvements: [],
        highlights: [],
      };

      aiReviewStore.setState({
        reviewHistory: {
          '/test/repo:main': cachedResult,
        },
      });

      const store = aiReviewStore.getState();
      const result = store.getCachedReview('/test/repo', 'main');

      expect(result).toEqual(cachedResult);
    });

    it('should return undefined when no cache exists', () => {
      const store = aiReviewStore.getState();
      const result = store.getCachedReview('/test/repo', 'main');

      expect(result).toBeUndefined();
    });
  });

  describe('clearHistory', () => {
    it('should clear all review history', () => {
      aiReviewStore.setState({
        reviewHistory: {
          '/test/repo:main': { id: '1', timestamp: 0, worktreePath: '', targetBranch: '', issues: [], improvements: [], highlights: [] },
          '/test/repo:develop': { id: '2', timestamp: 0, worktreePath: '', targetBranch: '', issues: [], improvements: [], highlights: [] },
        },
      });

      const store = aiReviewStore.getState();
      store.clearHistory();

      expect(aiReviewStore.getState().reviewHistory).toEqual({});
    });
  });
});
