import { mockIpcMain } from './ipc-test-helper';
import { makeDbShape } from '../../electron/helpers';
import { setupDatabaseHandlers } from '../../electron/database';
import { initializeDatabase, closeDatabase } from '../../electron/database';
import type { DatabaseAPI } from '@/types/database';

export async function setupTestDatabase() {
  await initializeDatabase(true);
  if (typeof global.window === 'undefined') {
    (globalThis as unknown as { window: { database: DatabaseAPI } }).window = {
      database: makeDbShape(mockIpcMain.__invoke),
    };
  }
  (window as unknown as { database: DatabaseAPI }).database = makeDbShape(mockIpcMain.__invoke);
  setupDatabaseHandlers();
}

export async function teardownTestDatabase() {
  await closeDatabase();
}
