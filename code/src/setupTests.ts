import '@testing-library/jest-dom';

// Mock Tauri API for testing
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));
