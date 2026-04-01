import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRepositoryStore } from '../repositoryStore';
import { gitService } from '@/services/git';

// Mock the git service
vi.mock('@/services/git', () => ({
  gitService: {
    isGitRepo: vi.fn(),
    getRepositoryInfo: vi.fn(),
  },
}));

describe('useRepositoryStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useRepositoryStore.setState({
      repositories: [],
      activeRepoId: null,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useRepositoryStore.getState();
      expect(state.repositories).toEqual([]);
      expect(state.activeRepoId).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useRepositoryStore.setState({ error: 'Some error' });
      expect(useRepositoryStore.getState().error).toBe('Some error');

      useRepositoryStore.getState().clearError();
      expect(useRepositoryStore.getState().error).toBeNull();
    });
  });

  describe('addRepository', () => {
    it('should set error when path is not a git repo', async () => {
      vi.mocked(gitService.isGitRepo).mockResolvedValue(false);

      const store = useRepositoryStore.getState();
      const result = await store.addRepository('/invalid/path');

      expect(result).toBeNull();
      const state = useRepositoryStore.getState();
      expect(state.error).toBe('选择的目录不是 Git 仓库');
      expect(state.isLoading).toBe(false);
    });

    it('should add repository successfully', async () => {
      const mockRepoInfo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: '2024-01-01T00:00:00Z',
      };

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      vi.mocked(gitService.getRepositoryInfo).mockResolvedValue(mockRepoInfo);

      const store = useRepositoryStore.getState();
      const result = await store.addRepository('/test/repo');

      expect(result).toEqual(mockRepoInfo);
      const state = useRepositoryStore.getState();
      expect(state.repositories).toHaveLength(1);
      expect(state.repositories[0]).toEqual(mockRepoInfo);
      expect(state.activeRepoId).toBe('/test/repo');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should return existing repository if path already exists', async () => {
      const existingRepo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: '2024-01-01T00:00:00Z',
      };

      useRepositoryStore.setState({
        repositories: [existingRepo],
        activeRepoId: null,
      });

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);

      const store = useRepositoryStore.getState();
      const result = await store.addRepository('/test/repo');

      expect(result).toEqual(existingRepo);
      expect(useRepositoryStore.getState().activeRepoId).toBe('/test/repo');
      // getRepositoryInfo should not be called for existing repos
      expect(gitService.getRepositoryInfo).not.toHaveBeenCalled();
    });

    it('should handle errors and rollback activeRepoId', async () => {
      useRepositoryStore.setState({ activeRepoId: '/existing/repo' });

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      vi.mocked(gitService.getRepositoryInfo).mockRejectedValue(new Error('Failed to get info'));

      const store = useRepositoryStore.getState();
      const result = await store.addRepository('/test/repo');

      expect(result).toBeNull();
      const state = useRepositoryStore.getState();
      expect(state.error).toBe('Failed to get info');
      expect(state.activeRepoId).toBe('/existing/repo'); // Should rollback
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to true during operation', async () => {
      let resolveIsGitRepo: (value: boolean) => void;
      const isGitRepoPromise = new Promise<boolean>((resolve) => {
        resolveIsGitRepo = resolve;
      });
      vi.mocked(gitService.isGitRepo).mockReturnValue(isGitRepoPromise);

      const store = useRepositoryStore.getState();
      const addPromise = store.addRepository('/test/repo');

      // Check loading state during operation
      expect(useRepositoryStore.getState().isLoading).toBe(true);

      // Resolve the promise
      resolveIsGitRepo!(false);
      await addPromise;

      expect(useRepositoryStore.getState().isLoading).toBe(false);
    });
  });

  describe('removeRepository', () => {
    it('should remove repository by id', () => {
      const repo1 = {
        id: '/test/repo1',
        name: 'repo1',
        path: '/test/repo1',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };
      const repo2 = {
        id: '/test/repo2',
        name: 'repo2',
        path: '/test/repo2',
        currentBranch: 'develop',
        worktreeCount: 2,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo1, repo2],
        activeRepoId: '/test/repo1',
      });

      const store = useRepositoryStore.getState();
      store.removeRepository('/test/repo1');

      const state = useRepositoryStore.getState();
      expect(state.repositories).toHaveLength(1);
      expect(state.repositories[0].id).toBe('/test/repo2');
      // Should set active to remaining repo
      expect(state.activeRepoId).toBe('/test/repo2');
    });

    it('should set activeRepoId to null when removing the last repository', () => {
      const repo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo],
        activeRepoId: '/test/repo',
      });

      const store = useRepositoryStore.getState();
      store.removeRepository('/test/repo');

      const state = useRepositoryStore.getState();
      expect(state.repositories).toHaveLength(0);
      expect(state.activeRepoId).toBeNull();
    });

    it('should not change activeRepoId when removing inactive repository', () => {
      const repo1 = {
        id: '/test/repo1',
        name: 'repo1',
        path: '/test/repo1',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };
      const repo2 = {
        id: '/test/repo2',
        name: 'repo2',
        path: '/test/repo2',
        currentBranch: 'develop',
        worktreeCount: 2,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo1, repo2],
        activeRepoId: '/test/repo1',
      });

      const store = useRepositoryStore.getState();
      store.removeRepository('/test/repo2');

      const state = useRepositoryStore.getState();
      expect(state.activeRepoId).toBe('/test/repo1');
    });
  });

  describe('setActiveRepository', () => {
    it('should set activeRepoId', () => {
      const store = useRepositoryStore.getState();
      store.setActiveRepository('/test/repo');

      expect(useRepositoryStore.getState().activeRepoId).toBe('/test/repo');
    });

    it('should allow changing activeRepoId', () => {
      useRepositoryStore.setState({ activeRepoId: '/test/repo1' });

      const store = useRepositoryStore.getState();
      store.setActiveRepository('/test/repo2');

      expect(useRepositoryStore.getState().activeRepoId).toBe('/test/repo2');
    });
  });

  describe('validateRepositories', () => {
    it('should do nothing when no repositories', async () => {
      const store = useRepositoryStore.getState();
      await store.validateRepositories();

      expect(gitService.isGitRepo).not.toHaveBeenCalled();
    });

    it('should mark valid repositories', async () => {
      const repo1 = {
        id: '/test/repo1',
        name: 'repo1',
        path: '/test/repo1',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };
      const repo2 = {
        id: '/test/repo2',
        name: 'repo2',
        path: '/test/repo2',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo1, repo2],
      });

      vi.mocked(gitService.isGitRepo)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const store = useRepositoryStore.getState();
      await store.validateRepositories();

      const state = useRepositoryStore.getState();
      expect(state.repositories[0].isPathValid).toBe(true);
      expect(state.repositories[1].isPathValid).toBe(false);
    });

    it('should mark repository as invalid when isGitRepo throws', async () => {
      const repo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo],
      });

      vi.mocked(gitService.isGitRepo).mockRejectedValue(new Error('Access denied'));

      const store = useRepositoryStore.getState();
      await store.validateRepositories();

      const state = useRepositoryStore.getState();
      expect(state.repositories[0].isPathValid).toBe(false);
    });
  });

  describe('removeInvalidRepositories', () => {
    it('should remove repositories marked as invalid', () => {
      const validRepo = {
        id: '/valid/repo',
        name: 'valid',
        path: '/valid/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
        isPathValid: true,
      };
      const invalidRepo = {
        id: '/invalid/repo',
        name: 'invalid',
        path: '/invalid/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
        isPathValid: false,
      };
      const unknownRepo = {
        id: '/unknown/repo',
        name: 'unknown',
        path: '/unknown/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
        // isPathValid is undefined (not validated yet)
      };

      useRepositoryStore.setState({
        repositories: [validRepo, invalidRepo, unknownRepo],
        activeRepoId: '/invalid/repo',
      });

      const store = useRepositoryStore.getState();
      store.removeInvalidRepositories();

      const state = useRepositoryStore.getState();
      expect(state.repositories).toHaveLength(2);
      expect(state.repositories.find(r => r.id === '/invalid/repo')).toBeUndefined();
      // Active should be set to first valid repo
      expect(state.activeRepoId).toBe('/valid/repo');
    });

    it('should not change activeRepoId if it is still valid', () => {
      const validRepo1 = {
        id: '/valid/repo1',
        name: 'valid1',
        path: '/valid/repo1',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
        isPathValid: true,
      };
      const invalidRepo = {
        id: '/invalid/repo',
        name: 'invalid',
        path: '/invalid/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
        isPathValid: false,
      };

      useRepositoryStore.setState({
        repositories: [validRepo1, invalidRepo],
        activeRepoId: '/valid/repo1',
      });

      const store = useRepositoryStore.getState();
      store.removeInvalidRepositories();

      expect(useRepositoryStore.getState().activeRepoId).toBe('/valid/repo1');
    });
  });

  describe('refreshRepositories', () => {
    it('should do nothing when no repositories', async () => {
      const store = useRepositoryStore.getState();
      await store.refreshRepositories();

      expect(gitService.isGitRepo).not.toHaveBeenCalled();
    });

    it('should refresh all repositories', async () => {
      const repo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };

      const updatedRepoInfo = {
        id: '/test/repo',
        name: 'repo-updated',
        path: '/test/repo',
        currentBranch: 'develop',
        worktreeCount: 2,
        lastActive: '2024-01-02T00:00:00Z',
      };

      useRepositoryStore.setState({
        repositories: [repo],
      });

      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      vi.mocked(gitService.getRepositoryInfo).mockResolvedValue(updatedRepoInfo);

      const store = useRepositoryStore.getState();
      await store.refreshRepositories();

      const state = useRepositoryStore.getState();
      expect(state.repositories[0].name).toBe('repo-updated');
      expect(state.repositories[0].currentBranch).toBe('develop');
      expect(state.repositories[0].isPathValid).toBe(true);
    });

    it('should handle refresh errors gracefully', async () => {
      const repo = {
        id: '/test/repo',
        name: 'repo',
        path: '/test/repo',
        currentBranch: 'main',
        worktreeCount: 1,
        lastActive: null,
      };

      useRepositoryStore.setState({
        repositories: [repo],
      });

      vi.mocked(gitService.isGitRepo).mockRejectedValue(new Error('Refresh failed'));

      const store = useRepositoryStore.getState();
      await store.refreshRepositories();

      const state = useRepositoryStore.getState();
      expect(state.repositories[0].isPathValid).toBe(false);
    });
  });
});
