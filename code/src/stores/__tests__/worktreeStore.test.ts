import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWorktreeStore } from '../worktreeStore';
import { gitService } from '@/services/git';

// Mock the git service
vi.mock('@/services/git', () => ({
  gitService: {
    isGitRepo: vi.fn(),
    listWorktrees: vi.fn(),
    listBranches: vi.fn(),
    createWorktree: vi.fn(),
    deleteWorktree: vi.fn(),
  },
}));

describe('useWorktreeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWorktreeStore.setState({
      worktrees: [],
      currentRepo: null,
      currentRepoPath: null,
      isLoading: false,
      error: null,
      pendingOperations: [],
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useWorktreeStore.getState();
      expect(state.worktrees).toEqual([]);
      expect(state.currentRepo).toBeNull();
      expect(state.currentRepoPath).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.pendingOperations).toEqual([]);
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useWorktreeStore.setState({ error: 'Some error' });
      expect(useWorktreeStore.getState().error).toBe('Some error');

      useWorktreeStore.getState().clearError();
      expect(useWorktreeStore.getState().error).toBeNull();
    });
  });

  describe('loadRepository', () => {
    it('should set error when path is not a git repo', async () => {
      vi.mocked(gitService.isGitRepo).mockResolvedValue(false);

      const store = useWorktreeStore.getState();
      await store.loadRepository('/invalid/path');

      const state = useWorktreeStore.getState();
      expect(state.error).toBe('选择的目录不是 Git 仓库');
      expect(state.currentRepo).toBeNull();
      expect(state.worktrees).toEqual([]);
    });

    it('should load repository successfully', async () => {
      const mockWorktrees = [
        {
          path: '/test/repo',
          branch: 'main',
          head: 'abc123',
          detached: false,
          prunable: false,
          locked: false,
        },
      ];
      const mockBranches = [
        { name: 'main', isCurrent: true },
        { name: 'develop', isCurrent: false },
      ];

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      vi.mocked(gitService.listWorktrees).mockResolvedValue({
        worktrees: mockWorktrees,
      });
      vi.mocked(gitService.listBranches).mockResolvedValue({
        branches: mockBranches,
      });

      const store = useWorktreeStore.getState();
      await store.loadRepository('/test/repo');

      const state = useWorktreeStore.getState();
      expect(state.error).toBeNull();
      expect(state.currentRepoPath).toBe('/test/repo');
      expect(state.currentRepo).not.toBeNull();
      expect(state.currentRepo?.name).toBe('repo');
      expect(state.currentRepo?.currentBranch).toBe('main');
      expect(state.worktrees).toEqual(mockWorktrees);
    });

    it('should handle listBranches failure gracefully', async () => {
      const mockWorktrees = [
        {
          path: '/test/repo',
          branch: 'main',
          head: 'abc123',
          detached: false,
          prunable: false,
          locked: false,
        },
      ];

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      vi.mocked(gitService.listWorktrees).mockResolvedValue({
        worktrees: mockWorktrees,
      });
      vi.mocked(gitService.listBranches).mockRejectedValue(new Error('Failed'));

      const store = useWorktreeStore.getState();
      await store.loadRepository('/test/repo');

      const state = useWorktreeStore.getState();
      expect(state.error).toBeNull();
      expect(state.currentRepo).not.toBeNull();
      expect(state.currentRepo?.defaultBranch).toBe('main');
    });
  });

  describe('refreshWorktrees', () => {
    it('should do nothing when no repo path is set', async () => {
      const store = useWorktreeStore.getState();
      await store.refreshWorktrees();

      expect(gitService.listWorktrees).not.toHaveBeenCalled();
    });

    it('should refresh worktrees list', async () => {
      const mockWorktrees = [
        {
          path: '/test/repo',
          branch: 'main',
          head: 'abc123',
          detached: false,
          prunable: false,
          locked: false,
        },
        {
          path: '/test/repo-feature',
          branch: 'feature',
          head: 'def456',
          detached: false,
          prunable: false,
          locked: false,
        },
      ];

      useWorktreeStore.setState({ currentRepoPath: '/test/repo' });
      vi.mocked(gitService.listWorktrees).mockResolvedValue({
        worktrees: mockWorktrees,
      });

      const store = useWorktreeStore.getState();
      await store.refreshWorktrees();

      const state = useWorktreeStore.getState();
      expect(state.worktrees).toEqual(mockWorktrees);
    });
  });

  describe('createWorktree', () => {
    it('should return error when no repo is selected', async () => {
      const store = useWorktreeStore.getState();
      const result = await store.createWorktree({
        name: 'test-feature',
        baseBranch: 'main',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('未选择仓库');
    });

    it('should create worktree successfully', async () => {
      useWorktreeStore.setState({ currentRepoPath: '/test/repo' });

      vi.mocked(gitService.createWorktree).mockResolvedValue({
        success: true,
        message: 'Created',
      });
      vi.mocked(gitService.listWorktrees).mockResolvedValue({
        worktrees: [],
      });

      const store = useWorktreeStore.getState();
      const result = await store.createWorktree({
        name: 'test-feature',
        baseBranch: 'main',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteWorktree', () => {
    it('should return error when no repo is selected', async () => {
      const store = useWorktreeStore.getState();
      const result = await store.deleteWorktree('/test/worktree');

      expect(result.success).toBe(false);
      expect(result.message).toBe('未选择仓库');
    });

    it('should delete worktree successfully', async () => {
      useWorktreeStore.setState({
        currentRepoPath: '/test/repo',
        worktrees: [
          {
            path: '/test/worktree',
            branch: 'feature',
            head: 'abc123',
            detached: false,
            prunable: false,
            locked: false,
          },
        ],
      });

      vi.mocked(gitService.deleteWorktree).mockResolvedValue({
        success: true,
        message: 'Deleted',
      });
      vi.mocked(gitService.listWorktrees).mockResolvedValue({
        worktrees: [],
      });

      const store = useWorktreeStore.getState();
      const result = await store.deleteWorktree('/test/worktree');

      expect(result.success).toBe(true);
    });

    it('should rollback on delete failure', async () => {
      const originalWorktrees = [
        {
          path: '/test/worktree',
          branch: 'feature',
          head: 'abc123',
          detached: false,
          prunable: false,
          locked: false,
        },
      ];

      useWorktreeStore.setState({
        currentRepoPath: '/test/repo',
        worktrees: originalWorktrees,
      });

      vi.mocked(gitService.deleteWorktree).mockResolvedValue({
        success: false,
        message: 'Delete failed',
      });

      const store = useWorktreeStore.getState();
      const result = await store.deleteWorktree('/test/worktree');

      expect(result.success).toBe(false);
      expect(useWorktreeStore.getState().error).toBe('Delete failed');
    });
  });
});
