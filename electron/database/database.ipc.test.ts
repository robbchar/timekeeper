import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockIpcMain } from '@/test-utils/ipc-test-helper';

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

describe('database IPC handlers', () => {
  beforeEach(() => {
    mockIpcMain.reset();
    vi.resetModules();
  });

  it('registers getProject handler', async () => {
    const mod = await import('./database');
    mod.setupDatabaseHandlers();

    expect(mockIpcMain.__handlers.has('database:getProject')).toBe(true);
  });
});
