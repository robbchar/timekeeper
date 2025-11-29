import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import type { SessionDatabase } from '@/types/session';
import { getRecordAfterInsert, getRecordAfterWrite } from '../../helpers';
import { IPC_CHANNELS } from '@/ipc/channels';

export function registerSessionHandlers({ db }: { db: sqlite3.Database }) {
  // Session operations
  ipcMain.handle(IPC_CHANNELS.database.createSession, (_, projectId: number, notes?: string) => {
    return getRecordAfterInsert<SessionDatabase>(function (cb) {
      db.run(
        'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)',
        [projectId, new Date().toISOString(), notes],
        cb
      );
    }, 'SELECT * FROM sessions WHERE sessionId = ?');
  });

  ipcMain.handle(IPC_CHANNELS.database.endSession, (_, id: number, duration: number) => {
    return getRecordAfterWrite<SessionDatabase>(
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

  ipcMain.handle(IPC_CHANNELS.database.getSessions, () => {
    return new Promise<SessionDatabase[]>((resolve, reject) => {
      let query = 'SELECT * FROM sessions';
      const params: string[] = [];

      query += ' ORDER BY startTime DESC';
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as SessionDatabase[]);
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.getSessionsForProject, (_, projectId: number) => {
    return new Promise<SessionDatabase[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM sessions WHERE projectId = ? ORDER BY startTime DESC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as SessionDatabase[]);
        }
      );
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.updateSessionNotes, (_, id: number, notes: string) => {
    return getRecordAfterWrite<SessionDatabase>(
      function (cb) {
        db.run('UPDATE sessions SET notes = ? WHERE sessionId = ?', [notes, id], cb);
      },
      'SELECT * FROM sessions WHERE sessionId = ?',
      [id]
    );
  });

  ipcMain.handle(IPC_CHANNELS.database.updateSessionDuration, (_, id: number, duration: number) => {
    return getRecordAfterWrite<SessionDatabase>(
      function (cb) {
        db.run('UPDATE sessions SET duration = ? WHERE sessionId = ?', [duration, id], cb);
      },
      'SELECT * FROM sessions WHERE sessionId = ?',
      [id]
    );
  });

  ipcMain.handle(IPC_CHANNELS.database.deleteSession, (_, id: number) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.run('DELETE FROM sessions WHERE sessionId = ?', [id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });
}
