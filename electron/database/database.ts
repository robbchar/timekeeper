import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import type { TagDatabase } from '@/types/tag';
import { getDatabaseConfig } from './database-config';
import {
  getRecordAfterInsert,
  getRecordAfterWrite,
  getRecordBeforeDelete,
  setDatabaseInstance,
} from '../helpers';
import { runMigrations } from './db-migrate';

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
      FOREIGN KEY (projectId) REFERENCES projects(projectId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      tagId INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_tags (
      sessionTagId INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(sessionId) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(tagId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_tags (
      projectTagId INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      tagId INTEGER NOT NULL,
      FOREIGN KEY (projectId) REFERENCES projects(projectId) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(tagId) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

// Initialize database with proper error handling
export function initializeDatabase(memory = false): Promise<sqlite3.Database> {
  const dbPath = memory ? ':memory:' : getDatabaseConfig().dbPath;
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
        db.exec(createTablesSchema, async function (err) {
          if (err) {
            console.error('Failed to create tables:', err);
            reject(err);
            return;
          }

          db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '1')`);

          console.log('📤 Running migrations...');
          await runMigrations(db).catch(err => {
            console.error('Failed to run migrations:', err);
            reject(err);
          });

          setDatabaseInstance(db);
          resolve(db);
        });
      });
    });
  });
}

export async function closeDatabase() {
  await new Promise<{ changes: number }>((resolve, reject) => {
    if (db) {
      db.close(function (err) {
        if (err) reject(err);
        else resolve({ changes: 0 });
      });
    } else {
      resolve({ changes: 0 });
    }
  });
}

let handlersRegistered = false;

// Set up IPC handlers
export function setupDatabaseHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  // Project operations
  // Create Project
  ipcMain.handle(
    'database:createProject',
    (_, name: string, description?: string, color?: string) => {
      return getRecordAfterInsert<Project>(function (cb) {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          [name, description, color],
          cb
        );
      }, 'SELECT * FROM projects WHERE projectId = ?');
    }
  );

  // Update Project
  ipcMain.handle(
    'database:updateProject',
    (_, projectId: number, name: string, description: string, color: string) => {
      return getRecordAfterWrite<Project>(
        function (cb) {
          db.run(
            'UPDATE projects SET name = ?, description = ?, color = ? WHERE projectId = ?',
            [name, description, color, projectId],
            cb
          );
        },
        'SELECT * FROM projects WHERE projectId = ?',
        [projectId]
      );
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

  ipcMain.handle('database:getProject', (_, projectId: number) => {
    return new Promise<Project | undefined>((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE projectId = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row as Project | undefined);
      });
    });
  });

  ipcMain.handle('database:deleteProject', (_, id: number) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.run('DELETE FROM projects WHERE projectId = ?', [id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });

  // Session operations
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

  // Tag operations
  ipcMain.handle('database:createTag', (_, name: string, color?: string) => {
    return getRecordAfterInsert<TagDatabase>(function (cb) {
      db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color], cb);
    }, 'SELECT * FROM tags WHERE tagId = ?');
  });

  ipcMain.handle('database:getTags', () => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as TagDatabase[]);
      });
    });
  });

  ipcMain.handle('database:updateTag', (_, tagId: number, name: string, color?: string) => {
    return getRecordAfterWrite<TagDatabase>(
      function (cb) {
        db.run('UPDATE tags SET name = ?, color = ? WHERE tagId = ?', [name, color, tagId], cb);
      },
      'SELECT * FROM tags WHERE tagId = ?',
      [tagId]
    );
  });

  ipcMain.handle('database:deleteTag', (_, tagId: number) => {
    return getRecordBeforeDelete<TagDatabase>(
      'SELECT * FROM tags WHERE tagId = ?',
      [tagId],
      'DELETE FROM tags WHERE tagId = ?',
      [tagId]
    );
  });

  // Project–Tag relationship operations
  ipcMain.handle('database:getTagsForProject', (_, projectId: number) => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all(
        `SELECT t.*
         FROM tags t
         INNER JOIN project_tags pt ON pt.tagId = t.tagId
         WHERE pt.projectId = ?
         ORDER BY t.name`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as TagDatabase[]);
        }
      );
    });
  });

  ipcMain.handle('database:setProjectTags', (_, projectId: number, tagIds: number[]) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run('DELETE FROM project_tags WHERE projectId = ?', [projectId], function (err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          const deleteChanges = this.changes ?? 0;

          if (!tagIds.length) {
            db.run('COMMIT', commitErr => {
              if (commitErr) {
                reject(commitErr);
              } else {
                resolve({ changes: deleteChanges });
              }
            });
            return;
          }

          const stmt = db.prepare(
            'INSERT INTO project_tags (projectId, tagId) VALUES (?, ?)',
            err2 => {
              if (err2) {
                db.run('ROLLBACK');
                reject(err2);
              }
            }
          );

          let insertChanges = 0;

          const insertNext = (index: number) => {
            if (index >= tagIds.length) {
              stmt.finalize(errFinalize => {
                if (errFinalize) {
                  db.run('ROLLBACK');
                  reject(errFinalize);
                  return;
                }

                db.run('COMMIT', commitErr => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    resolve({ changes: deleteChanges + insertChanges });
                  }
                });
              });
              return;
            }

            stmt.run([projectId, tagIds[index]], function (errRun) {
              if (errRun) {
                db.run('ROLLBACK');
                reject(errRun);
                return;
              }

              insertChanges += this.changes ?? 0;
              insertNext(index + 1);
            });
          };

          insertNext(0);
        });
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
