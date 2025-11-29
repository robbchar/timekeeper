import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';

export function registerTestHandlers({ db }: { db: sqlite3.Database }) {
  // Test helper
  ipcMain.handle('database:reset', () => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM session_tags', function (err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          db.run('DELETE FROM project_tags', function (err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('DELETE FROM sessions', function (err) {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              db.run('DELETE FROM tags', function (err) {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                db.run('DELETE FROM projects', function (err) {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  db.run('DELETE FROM settings', function (err) {
                    if (err) {
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }
                    db.run('COMMIT', function (err) {
                      if (err) reject(err);
                      else resolve({ changes: this.changes });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
