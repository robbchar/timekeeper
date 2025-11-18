import { mockIpcMain } from './ipc-test-helper';
import { makeDbShape } from '../../electron/helpers';
import { setupDatabaseHandlers } from '../../electron/database/database';
import { initializeDatabase, closeDatabase } from '../../electron/database/database';
import type { DatabaseAPI } from '@/types/database';
import type sqlite3 from 'sqlite3';

export async function setupTestDatabase(): Promise<sqlite3.Database> {
  const db = await initializeDatabase(true);
  if (typeof global.window === 'undefined') {
    (globalThis as unknown as { window: { database: DatabaseAPI } }).window = {
      database: makeDbShape(mockIpcMain.__invoke),
    };
  }
  (window as unknown as { database: DatabaseAPI }).database = makeDbShape(mockIpcMain.__invoke);
  setupDatabaseHandlers();
  return db;
}

export async function teardownTestDatabase() {
  await closeDatabase();
}
