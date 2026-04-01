import { describe, it, expect, beforeEach } from 'vitest';
import { settingsStore } from '../settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    settingsStore.setState({
      defaultIde: 'vscode',
      customIdePath: undefined,
      defaultTerminal: 'terminal',
      customTerminalPath: undefined,
      theme: 'system',
      autoRefreshInterval: 0,
      enableIdleDetection: true,
      idleThresholdDays: 7,
      autoFetchOnStart: true,
    });
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = settingsStore.getState();
      expect(state.defaultIde).toBe('vscode');
      expect(state.defaultTerminal).toBe('terminal');
      expect(state.theme).toBe('system');
      expect(state.autoRefreshInterval).toBe(0);
      expect(state.enableIdleDetection).toBe(true);
      expect(state.idleThresholdDays).toBe(7);
      expect(state.autoFetchOnStart).toBe(true);
      expect(state.customIdePath).toBeUndefined();
      expect(state.customTerminalPath).toBeUndefined();
    });
  });

  describe('setDefaultIde', () => {
    it('should update defaultIde', () => {
      const store = settingsStore.getState();
      store.setDefaultIde('cursor');

      expect(settingsStore.getState().defaultIde).toBe('cursor');
    });

    it('should support all IDE types', () => {
      const ideTypes = ['vscode', 'vscode-insiders', 'cursor', 'webstorm', 'intellij', 'custom'] as const;

      ideTypes.forEach((ide) => {
        settingsStore.getState().setDefaultIde(ide);
        expect(settingsStore.getState().defaultIde).toBe(ide);
      });
    });
  });

  describe('setCustomIdePath', () => {
    it('should update customIdePath', () => {
      const store = settingsStore.getState();
      store.setCustomIdePath('/usr/local/bin/cursor');

      expect(settingsStore.getState().customIdePath).toBe('/usr/local/bin/cursor');
    });

    it('should allow clearing customIdePath', () => {
      settingsStore.setState({ customIdePath: '/some/path' });
      settingsStore.getState().setCustomIdePath('');

      expect(settingsStore.getState().customIdePath).toBe('');
    });
  });

  describe('setDefaultTerminal', () => {
    it('should update defaultTerminal', () => {
      const store = settingsStore.getState();
      store.setDefaultTerminal('iterm2');

      expect(settingsStore.getState().defaultTerminal).toBe('iterm2');
    });

    it('should support all terminal types', () => {
      const terminalTypes = ['terminal', 'iterm2', 'warp', 'custom'] as const;

      terminalTypes.forEach((terminal) => {
        settingsStore.getState().setDefaultTerminal(terminal);
        expect(settingsStore.getState().defaultTerminal).toBe(terminal);
      });
    });
  });

  describe('setCustomTerminalPath', () => {
    it('should update customTerminalPath', () => {
      const store = settingsStore.getState();
      store.setCustomTerminalPath('/Applications/Warp.app');

      expect(settingsStore.getState().customTerminalPath).toBe('/Applications/Warp.app');
    });
  });

  describe('setTheme', () => {
    it('should update theme', () => {
      const store = settingsStore.getState();
      store.setTheme('dark');

      expect(settingsStore.getState().theme).toBe('dark');
    });

    it('should support all theme options', () => {
      const themes = ['light', 'dark', 'system'] as const;

      themes.forEach((theme) => {
        settingsStore.getState().setTheme(theme);
        expect(settingsStore.getState().theme).toBe(theme);
      });
    });
  });

  describe('setAutoRefreshInterval', () => {
    it('should update autoRefreshInterval', () => {
      const store = settingsStore.getState();
      store.setAutoRefreshInterval(5000);

      expect(settingsStore.getState().autoRefreshInterval).toBe(5000);
    });

    it('should allow zero value (disabled)', () => {
      settingsStore.setState({ autoRefreshInterval: 10000 });
      settingsStore.getState().setAutoRefreshInterval(0);

      expect(settingsStore.getState().autoRefreshInterval).toBe(0);
    });
  });

  describe('setEnableIdleDetection', () => {
    it('should update enableIdleDetection', () => {
      const store = settingsStore.getState();
      store.setEnableIdleDetection(false);

      expect(settingsStore.getState().enableIdleDetection).toBe(false);
    });

    it('should toggle between true and false', () => {
      settingsStore.getState().setEnableIdleDetection(false);
      expect(settingsStore.getState().enableIdleDetection).toBe(false);

      settingsStore.getState().setEnableIdleDetection(true);
      expect(settingsStore.getState().enableIdleDetection).toBe(true);
    });
  });

  describe('setIdleThresholdDays', () => {
    it('should update idleThresholdDays', () => {
      const store = settingsStore.getState();
      store.setIdleThresholdDays(14);

      expect(settingsStore.getState().idleThresholdDays).toBe(14);
    });

    it('should accept different threshold values', () => {
      const thresholds = [1, 7, 14, 30, 90];

      thresholds.forEach((days) => {
        settingsStore.getState().setIdleThresholdDays(days);
        expect(settingsStore.getState().idleThresholdDays).toBe(days);
      });
    });
  });

  describe('setAutoFetchOnStart', () => {
    it('should update autoFetchOnStart', () => {
      const store = settingsStore.getState();
      store.setAutoFetchOnStart(false);

      expect(settingsStore.getState().autoFetchOnStart).toBe(false);
    });

    it('should toggle between true and false', () => {
      settingsStore.getState().setAutoFetchOnStart(false);
      expect(settingsStore.getState().autoFetchOnStart).toBe(false);

      settingsStore.getState().setAutoFetchOnStart(true);
      expect(settingsStore.getState().autoFetchOnStart).toBe(true);
    });
  });

  describe('multiple settings update', () => {
    it('should handle multiple sequential updates correctly', () => {
      const store = settingsStore.getState();
      
      store.setDefaultIde('cursor');
      store.setTheme('dark');
      store.setAutoRefreshInterval(5000);
      store.setEnableIdleDetection(false);
      store.setIdleThresholdDays(14);

      const state = settingsStore.getState();
      expect(state.defaultIde).toBe('cursor');
      expect(state.theme).toBe('dark');
      expect(state.autoRefreshInterval).toBe(5000);
      expect(state.enableIdleDetection).toBe(false);
      expect(state.idleThresholdDays).toBe(14);
    });
  });
});
