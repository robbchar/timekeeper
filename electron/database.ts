import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import type { Project } from '../src/types/project';
import type { Session } from '../src/types/session';
import type { TagDatabase } from '../src/types/tag';
import type { CreateResponse, UpdateResponse } from '../src/types/database-response';
import { getDatabaseConfig } from '../src/utils/database-config';

const { dbPath } = getDatabaseConfig();

let db: sqlite3.Database;
export const createTablesSchema = `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS session_tags (
      session_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
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
      db.run('PRAGMA foreign_keys = ON', err => {
        if (err) {
          console.error('Failed to enable foreign keys:', err);
          reject(err);
          return;
        }

        // Create tables if they don't exist
        console.log('Creating tables...');
        db.exec(createTablesSchema, err => {
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
  await new Promise<void>((resolve, reject) => {
    db.close(err => {
      if (err) reject(err);
      else resolve();
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
    return new Promise<void>((resolve, reject) => {
      db.run('UPDATE projects SET name = ? WHERE id = ?', [name, id], err => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  ipcMain.handle('database:deleteProject', (_, id: number) => {
    return new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM sessions WHERE project_id = ?', [id], err => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          db.run('DELETE FROM projects WHERE id = ?', [id], err => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('COMMIT', err => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      });
    });
  });

  // Session operations
  ipcMain.handle(
    'database:createSession',
    (_, projectId: number, notes?: string, tags?: number[]) => {
      return new Promise<CreateResponse>((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (project_id, start_time, notes, tags) VALUES (?, ?, ?, ?)',
          [projectId, new Date().toISOString(), notes, tags ? JSON.stringify(tags) : '[]'],
          function (err) {
            if (err) reject(err);
            else resolve({ itemId: this.lastID, changes: this.changes });
          }
        );
      });
    }
  );

  ipcMain.handle('database:endSession', (_, sessionId: number, duration: number) => {
    return new Promise<UpdateResponse>((resolve, reject) => {
      db.run(
        'UPDATE sessions SET end_time = ?, duration = ? WHERE id = ?',
        [new Date().toISOString(), duration, sessionId],
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

      query += ' ORDER BY start_time DESC';
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Session[]);
      });
    });
  });

  ipcMain.handle('database:getSessionsForProject', (_, projectId: number) => {
    return new Promise<Session[]>((resolve, reject) => {
      db.all(
        'SELECT * FROM sessions WHERE project_id = ? ORDER BY start_time DESC',
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Session[]);
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
    return new Promise<void>((resolve, reject) => {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value], err => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  // Test helper
  ipcMain.handle('database:reset', () => {
    return new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM session_tags', err => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          db.run('DELETE FROM sessions', err => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('DELETE FROM tags', err => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              db.run('DELETE FROM projects', err => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                db.run('DELETE FROM settings', err => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  db.run('COMMIT', err => {
                    if (err) reject(err);
                    else resolve();
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
