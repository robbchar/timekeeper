import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import type { Project } from '../src/types/project';
import type { Session } from '../src/types/session';
import type { TagDatabase } from '../src/types/tag';
import type {
  CreateResponse,
  UpdateResponse,
  DeleteResponse,
  DatabaseResponse,
} from '../src/types/database-response';
import { getDatabaseConfig } from './database-config';

const { dbPath } = getDatabaseConfig();

let db: sqlite3.Database;
export const createTablesSchema = `
    CREATE TABLE IF NOT EXISTS projects (
      projectId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sessionId INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      startTime DATETIME NOT NULL,
      endTime DATETIME,
      duration INTEGER,
      notes TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      tagId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

// Initialize database with proper error handling
export function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err: Error | null) => {
      if (err) {
        console.error('Failed to open database:', err);
        reject(err);
        return;
      }

      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', function (err) {
        if (err) {
          console.error('Failed to enable foreign keys:', err);
          reject(err);
          return;
        }

        // Create tables if they don't exist
        console.log('Creating tables...');
        db.exec(createTablesSchema, function (err) {
          if (err) {
            console.error('Failed to create tables:', err);
            reject(err);
            return;
          }
          resolve(db);
        });
      });
    });
  });
}

export async function closeDatabase() {
  await new Promise<DatabaseResponse>((resolve, reject) => {
    db.close(function (err) {
      if (err) reject(err);
      else resolve({ changes: 0 });
    });
  });
}

// Set up IPC handlers
export function setupDatabaseHandlers() {
  // Project operations
  ipcMain.handle(
    'database:createProject',
    (_, name: string, description?: string, color?: string) => {
      return new Promise<CreateResponse>((resolve, reject) => {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          [name, description, color],
          function (err) {
            if (err) reject(err);
            else resolve({ itemId: this.lastID, changes: this.changes });
          }
        );
      });
    }
  );

  ipcMain.handle('database:getProjects', () => {
    return new Promise<Project[]>((resolve, reject) => {
      db.all('SELECT * FROM projects ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Project[]);
      });
    });
  });

  ipcMain.handle('database:updateProject', (_, id: number, name: string) => {
    return new Promise<UpdateResponse>((resolve, reject) => {
      db.run('UPDATE projects SET name = ? WHERE projectId = ?', [name, id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });

  ipcMain.handle('database:deleteProject', (_, id: number) => {
    return new Promise<DeleteResponse>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM sessions WHERE projectId = ?', [id], function (err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          db.run('DELETE FROM projects WHERE projectId = ?', [id], function (err) {
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

  // Session operations
  ipcMain.handle('database:createSession', (_, projectId: number, notes?: string) => {
    return new Promise<CreateResponse>((resolve, reject) => {
      db.run(
        'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)',
        [projectId, new Date().toISOString(), notes],
        function (err) {
          if (err) reject(err);
          else resolve({ itemId: this.lastID, changes: this.changes });
        }
      );
    });
  });

  ipcMain.handle('database:endSession', (_, id: number, duration: number) => {
    return new Promise<UpdateResponse>((resolve, reject) => {
      db.run(
        'UPDATE sessions SET endTime = ?, duration = ? WHERE sessionId = ?',
        [new Date().toISOString(), duration, id],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ipcMain.handle('database:getSessions', _ => {
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
    return new Promise<UpdateResponse>((resolve, reject) => {
      db.run('UPDATE sessions SET notes = ? WHERE sessionId = ?', [notes, id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });

  ipcMain.handle('database:updateSessionDuration', (_, id: number, duration: number) => {
    return new Promise<UpdateResponse>((resolve, reject) => {
      db.run(
        'UPDATE sessions SET duration = ? WHERE sessionId = ?',
        [duration, id],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  });

  // Tag operations
  ipcMain.handle('database:createTag', (_, name: string, color?: string) => {
    return new Promise<CreateResponse>((resolve, reject) => {
      db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color], function (err) {
        if (err) reject(err);
        else resolve({ itemId: this.lastID, changes: this.changes });
      });
    });
  });

  ipcMain.handle('database:getTags', () => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as TagDatabase[]);
      });
    });
  });

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
    return new Promise<UpdateResponse>((resolve, reject) => {
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

  // Test helper
  ipcMain.handle('database:reset', () => {
    return new Promise<DeleteResponse>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM session_tags', function (err) {
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
}
