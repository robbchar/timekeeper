import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { Session } from '@/types/session';
import { getRecordAfterInsert, getRecordAfterWrite } from '../../helpers';

export function registerSessionHandlers(db: Database) {
  ipcMain.handle('database:createSession', (_, projectId: number, notes?: string) => {
    return getRecordAfterInsert<Session>(function (cb) {
      db.run(
        'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)',
        [projectId, new Date().toISOString(), notes],
        cb
      );
    }, 'SELECT * FROM sessions WHERE sessionId = ?');
  });

  ipcMain.handle('database:endSession', (_, id: number, duration: number) => {
    return getRecordAfterWrite<Session>(
      function (cb) {
        db.run(
          'UPDATE sessions SET endTime = ?, duration = ? WHERE sessionId = ?',
          [new Date().toISOString(), duration, id],
          cb
        );
      },
      'SELECT * FROM sessions WHERE sessionId = ?',
      [id]
    );
  });

  ipcMain.handle('database:getSessions', () => {
    return new Promise<Session[]>((resolve, reject) => {
      let query = 'SELECT * FROM sessions';
      const params: string[] = [];

      query += ' ORDER BY startTime DESC';
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Session[]);
      });
    });
  });

  ipcMain.handle('database:getSessionsForProject', (_, projectId: number) => {
    return new Promise<Session[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM sessions WHERE projectId = ? ORDER BY startTime DESC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Session[]);
        }
      );
    });
  });

  ipcMain.handle('database:updateSessionNotes', (_, id: number, notes: string) => {
    return getRecordAfterWrite<Session>(
      function (cb) {
        db.run('UPDATE sessions SET notes = ? WHERE sessionId = ?', [notes, id], cb);
      },
      'SELECT * FROM sessions WHERE sessionId = ?',
      [id]
    );
  });

  ipcMain.handle('database:updateSessionDuration', (_, id: number, duration: number) => {
    return getRecordAfterWrite<Session>(
      function (cb) {
        db.run('UPDATE sessions SET duration = ? WHERE sessionId = ?', [duration, id], cb);
      },
      'SELECT * FROM sessions WHERE sessionId = ?',
      [id]
    );
  });

  ipcMain.handle('database:deleteSession', (_, id: number) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.run('DELETE FROM sessions WHERE sessionId = ?', [id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });
}
