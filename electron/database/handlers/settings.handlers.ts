import type { IpcMain } from 'electron';
import type { Database } from 'sqlite3';

export function registerSettingsHandlers(ipcMain: IpcMain, db: Database) {
  // Settings operations
  ipcMain.handle('database:getSetting', (_, key: string) => {
    return new Promise<string | undefined>((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? (row as { value: string }).value : undefined);
      });
    });
  });

  ipcMain.handle('database:setSetting', (_, key: string, value: string) => {
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
