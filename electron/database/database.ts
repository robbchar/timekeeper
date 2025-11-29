import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import { getDatabaseConfig } from './database-config';
import { setDatabaseInstance } from '../helpers';
import { runMigrations } from './db-migrate';
import { registerProjectHandlers } from './handlers/projectsHandlers';
import { registerSessionHandlers } from './handlers/sessionsHandlers';
import { registerTagHandlers } from './handlers/tagsHandlers';

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

  registerProjectHandlers({ db });
  registerSessionHandlers({ db });
  registerTagHandlers({ db });

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
