import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import { IPC_CHANNELS } from '../../../src/ipc/channels';

export function registerSettingsHandlers(db: Database) {
  // Settings operations
  ipcMain.handle(IPC_CHANNELS.database.getSetting, (_, key: string) => {
    return new Promise<string | undefined>((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? (row as { value: string }).value : undefined);
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.setSetting, (_, key: string, value: string) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  });
}
