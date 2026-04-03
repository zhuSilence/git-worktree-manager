import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateStore } from '../updateStore';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

describe('updateStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    updateStore.setState({
      isChecking: false,
      isDownloading: false,
      isUpdateAvailable: false,
      updateInfo: null,
      downloadProgress: 0,
      downloaded: 0,
      contentLength: 0,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = updateStore.getState();
      expect(state.isChecking).toBe(false);
      expect(state.isDownloading).toBe(false);
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBeNull();
      expect(state.downloadProgress).toBe(0);
      expect(state.downloaded).toBe(0);
      expect(state.contentLength).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      updateStore.setState({
        isChecking: true,
        isDownloading: true,
        isUpdateAvailable: true,
        updateInfo: { version: '2.0.0' },
        downloadProgress: 50,
        downloaded: 1000,
        contentLength: 2000,
        error: 'Some error',
      });

      updateStore.getState().reset();

      const state = updateStore.getState();
      expect(state.isChecking).toBe(false);
      expect(state.isDownloading).toBe(false);
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBeNull();
      expect(state.downloadProgress).toBe(0);
      expect(state.downloaded).toBe(0);
      expect(state.contentLength).toBe(0);
      expect(state.error).toBeNull();
    });
  });

  describe('checkForUpdate', () => {
    it('should return true and set update info when update is available', async () => {
      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        date: '2024-01-15',
        body: 'New features and bug fixes',
      } as ReturnType<typeof check>);

      const store = updateStore.getState();
      const result = await store.checkForUpdate();

      expect(result).toBe(true);
      const state = updateStore.getState();
      expect(state.isUpdateAvailable).toBe(true);
      expect(state.updateInfo).toEqual({
        version: '2.0.0',
        date: '2024-01-15',
        body: 'New features and bug fixes',
      });
      expect(state.isChecking).toBe(false);
    });

    it('should return false when no update is available', async () => {
      vi.mocked(check).mockResolvedValue(null);

      const store = updateStore.getState();
      const result = await store.checkForUpdate();

      expect(result).toBe(false);
      const state = updateStore.getState();
      expect(state.isUpdateAvailable).toBe(false);
      expect(state.updateInfo).toBeNull();
    });

    it('should set error when check fails', async () => {
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      const store = updateStore.getState();
      const result = await store.checkForUpdate();

      expect(result).toBe(false);
      const state = updateStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isChecking).toBe(false);
    });

    it('should set isChecking during check', async () => {
      let resolveCheck: (value: null) => void;
      const checkPromise = new Promise<null>((resolve) => {
        resolveCheck = resolve;
      });
      vi.mocked(check).mockReturnValue(checkPromise);

      const store = updateStore.getState();
      const checkPromiseResult = store.checkForUpdate();

      // Should be checking
      expect(updateStore.getState().isChecking).toBe(true);

      // Resolve the check
      resolveCheck!(null);
      await checkPromiseResult;

      expect(updateStore.getState().isChecking).toBe(false);
    });

    it('should clear previous error on new check', async () => {
      updateStore.setState({ error: 'Previous error' });
      vi.mocked(check).mockResolvedValue(null);

      const store = updateStore.getState();
      await store.checkForUpdate();

      expect(updateStore.getState().error).toBeNull();
    });
  });

  describe('downloadAndInstall', () => {
    it('should do nothing when no update info available', async () => {
      const store = updateStore.getState();
      await store.downloadAndInstall();

      expect(check).not.toHaveBeenCalled();
    });

    it('should download and install update successfully', async () => {
      const mockDownloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
        // Simulate download progress events
        onEvent({
          event: 'Started',
          data: { contentLength: 1000 },
        });
        onEvent({
          event: 'Progress',
          data: { chunkLength: 500 },
        });
        onEvent({
          event: 'Progress',
          data: { chunkLength: 500 },
        });
        onEvent({
          event: 'Finished',
          data: {},
        });
      });

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();

      expect(mockDownloadAndInstall).toHaveBeenCalled();
      expect(relaunch).toHaveBeenCalled();
    });

    it('should calculate download progress correctly and not exceed 100%', async () => {
      const mockDownloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
        // Simulate download events with exact progress tracking
        onEvent({
          event: 'Started',
          data: { contentLength: 1000 },
        });
        
        // First chunk: 500 bytes
        onEvent({
          event: 'Progress',
          data: { chunkLength: 500 },
        });
        
        const progress1 = updateStore.getState().downloadProgress;
        expect(progress1).toBe(50); // 500/1000 * 100 = 50%
        
        // Second chunk: 500 bytes
        onEvent({
          event: 'Progress',
          data: { chunkLength: 500 },
        });
        
        const progress2 = updateStore.getState().downloadProgress;
        expect(progress2).toBe(100); // 1000/1000 * 100 = 100%
        
        // Third chunk that would exceed 100% (edge case)
        onEvent({
          event: 'Progress',
          data: { chunkLength: 200 },
        });
        
        // Progress should be capped at 100%, not exceed it
        const progress3 = updateStore.getState().downloadProgress;
        expect(progress3).toBe(100); // Should be capped at 100%
        
        onEvent({
          event: 'Finished',
          data: {},
        });
      });

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();

      // Final progress should be exactly 100%
      expect(updateStore.getState().downloadProgress).toBe(100);
    });

    it('should handle zero contentLength gracefully', async () => {
      const mockDownloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
        onEvent({
          event: 'Started',
          data: { contentLength: 0 }, // No content length provided
        });
        
        onEvent({
          event: 'Progress',
          data: { chunkLength: 100 },
        });
        
        // Progress should be 0 when contentLength is 0
        const progress = updateStore.getState().downloadProgress;
        expect(progress).toBe(0);
        
        onEvent({
          event: 'Finished',
          data: {},
        });
      });

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();

      expect(updateStore.getState().downloadProgress).toBe(100); // Finished sets to 100
    });

    it('should set error when download fails', async () => {
      vi.mocked(check).mockRejectedValue(new Error('Download failed'));

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();

      const state = updateStore.getState();
      expect(state.error).toBe('Download failed');
      expect(state.isDownloading).toBe(false);
    });

    it('should set isDownloading during download', async () => {
      let resolveDownload: () => void;
      const downloadPromise = new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });

      const mockDownloadAndInstall = vi.fn().mockReturnValue(downloadPromise);

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      const downloadPromiseResult = store.downloadAndInstall();

      // Should be downloading
      expect(updateStore.getState().isDownloading).toBe(true);
      expect(updateStore.getState().downloadProgress).toBe(0);

      // Resolve the download
      resolveDownload!();
      await downloadPromiseResult;
    });

    it('should track downloaded bytes correctly', async () => {
      const mockDownloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
        onEvent({
          event: 'Started',
          data: { contentLength: 1000 },
        });
        
        onEvent({
          event: 'Progress',
          data: { chunkLength: 300 },
        });
        expect(updateStore.getState().downloaded).toBe(300);
        
        onEvent({
          event: 'Progress',
          data: { chunkLength: 200 },
        });
        expect(updateStore.getState().downloaded).toBe(500);
        
        onEvent({
          event: 'Finished',
          data: {},
        });
      });

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();
    });

    it('should handle missing contentLength in Started event', async () => {
      const mockDownloadAndInstall = vi.fn(async (onEvent: (event: unknown) => void) => {
        onEvent({
          event: 'Started',
          data: {}, // No contentLength
        });
        
        expect(updateStore.getState().contentLength).toBe(0);
        
        onEvent({
          event: 'Finished',
          data: {},
        });
      });

      vi.mocked(check).mockResolvedValue({
        version: '2.0.0',
        downloadAndInstall: mockDownloadAndInstall,
      } as unknown as ReturnType<typeof check>);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();
    });

    it('should handle update not available during download', async () => {
      vi.mocked(check).mockResolvedValue(null);

      updateStore.setState({
        updateInfo: { version: '2.0.0' },
      });

      const store = updateStore.getState();
      await store.downloadAndInstall();

      // Should not throw, just return early
      expect(updateStore.getState().error).toBeNull();
    });
  });
});
