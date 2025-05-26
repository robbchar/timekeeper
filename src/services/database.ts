import type { DatabaseAPI } from '@/types/database';
import { initializeDatabase } from '../../electron/database';

// Initialize database
const db = await initializeDatabase();

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
