import sqlite3 from 'sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import type { DatabaseAPI } from '@/types/database';

// Get the path to the user data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'timekeeper.db');

// Create data directory if it doesn't exist
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables if they don't exist
function initializeDatabase() {
  // Projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // Tags table
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    )
  `);

  // Session tags junction table
  db.run(`
    CREATE TABLE IF NOT EXISTS session_tags (
      session_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )
  `);

  // Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

// Initialize the database
initializeDatabase();

// Helper function to promisify database operations
function runAsync(
  sql: string,
  params: (string | number | null | undefined)[] = []
): Promise<{ lastInsertRowid: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function getAsync<T>(
  sql: string,
  params: (string | number | null | undefined)[] = []
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function allAsync<T>(
  sql: string,
  params: (string | number | null | undefined)[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

// Export database instance and helper functions
export const database: DatabaseAPI = {
  // Project operations
  createProject: async (name: string, description?: string, color?: string) => {
    const result = await runAsync(
      'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
      [name, description, color]
    );
    return { ...result, itemId: result.lastInsertRowid };
  },

  getProjects: async () => {
    return allAsync('SELECT * FROM projects ORDER BY created_at DESC');
  },

  deleteProject: async (id: number) => {
    return runAsync('DELETE FROM projects WHERE id = ?', [id]);
  },

  updateProject: async (id: number, name: string) => {
    return runAsync('UPDATE projects SET name = ? WHERE id = ?', [name, id]);
  },

  // Session operations
  createSession: async (projectId: number, startTime: string, notes?: string) => {
    const result = await runAsync(
      'INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)',
      [projectId, startTime, notes]
    );
    return { ...result, itemId: result.lastInsertRowid };
  },

  endSession: async (sessionId: number, endTime: string, duration: number) => {
    return runAsync('UPDATE sessions SET end_time = ?, duration = ? WHERE id = ?', [
      endTime,
      duration,
      sessionId,
    ]);
  },

  getSessions: async (startDate?: string, endDate?: string) => {
    let sql = 'SELECT * FROM sessions';
    const params: string[] = [];

    if (startDate || endDate) {
      sql += ' WHERE';
      if (startDate) {
        sql += ' start_time >= ?';
        params.push(startDate);
      }
      if (startDate && endDate) {
        sql += ' AND';
      }
      if (endDate) {
        sql += ' start_time <= ?';
        params.push(endDate);
      }
    }

    sql += ' ORDER BY start_time DESC';
    return allAsync(sql, params);
  },

  // Tag operations
  createTag: async (name: string, color?: string) => {
    const result = await runAsync('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color]);
    return { ...result, itemId: result.lastInsertRowid };
  },

  getTags: async () => {
    return allAsync('SELECT * FROM tags ORDER BY name');
  },

  // Settings operations
  getSetting: async (key: string) => {
    const result = await getAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      key,
    ]);
    return result?.value;
  },

  setSetting: async (key: string, value: string) => {
    return runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  },

  // Test helper
  reset: async () => {
    await runAsync('DELETE FROM session_tags');
    await runAsync('DELETE FROM sessions');
    await runAsync('DELETE FROM tags');
    await runAsync('DELETE FROM projects');
    await runAsync('DELETE FROM settings');
  },
};
