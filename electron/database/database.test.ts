import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as sqlite3 from 'sqlite3';
import { closeDatabase, initializeDatabase } from './database';
import type { Project } from '../../src/types/project';
import type { Session } from '../../src/types/session';
import type { TagDatabase } from '../../src/types/tag';

describe('Database Operations', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = await initializeDatabase(true);
    (window as unknown as { database: sqlite3.Database }).database = db;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Project Operations', () => {
    it('should create a project', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          ['Test Project', 'A test project', '#ff0000'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.lastID).toBeDefined();
            resolve();
          }
        );
      });
    });

    it('should get all projects', async () => {
      return new Promise<void>((resolve, reject) => {
        db.all('SELECT * FROM projects ORDER BY name', (err: Error | null, rows: Project[]) => {
          if (err) {
            reject(err);
            return;
          }
          expect(Array.isArray(rows)).toBe(true);
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0]).toHaveProperty('name');
          expect(rows[0]).toHaveProperty('description');
          expect(rows[0]).toHaveProperty('color');
          resolve();
        });
      });
    });

    it('should update a project', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'UPDATE projects SET name = ? WHERE projectId = ?',
          ['Updated Project', 1],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.changes).toBe(1);
            resolve();
          }
        );
      });
    });

    it('should delete a project', async () => {
      return new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          db.run('DELETE FROM sessions WHERE projectId = ?', [1], (err: Error | null) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
            db.run('DELETE FROM projects WHERE projectId = ?', [1], function (err: Error | null) {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }
              db.run('COMMIT', (err: Error | null) => {
                if (err) {
                  reject(err);
                  return;
                }
                expect(this.changes).toBe(1);
                resolve();
              });
            });
          });
        });
      });
    });
  });

  describe('Session Operations', () => {
    it('should create a session', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)',
          [1, new Date().toISOString(), 'Test session'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.lastID).toBeDefined();
            resolve();
          }
        );
      });
    });

    it('should end a session', async () => {
      return new Promise<void>((resolve, reject) => {
        const endTime = new Date().toISOString();
        const duration = 3600;
        db.run(
          'UPDATE sessions SET endTime = ?, duration = ? WHERE sessionId = ?',
          [endTime, duration, 1],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.changes).toBe(1);
            resolve();
          }
        );
      });
    });

    it('should get sessions for a project', async () => {
      return new Promise<void>((resolve, reject) => {
        db.all(
          'SELECT * FROM sessions WHERE projectId = ? ORDER BY startTime DESC',
          [1],
          (err: Error | null, rows: Session[]) => {
            if (err) {
              reject(err);
              return;
            }
            expect(Array.isArray(rows)).toBe(true);
            expect(rows.length).toBeGreaterThan(0);
            expect(rows[0]).toHaveProperty('projectId');
            expect(rows[0]).toHaveProperty('startTime');
            expect(rows[0]).toHaveProperty('endTime');
            resolve();
          }
        );
      });
    });
  });

  describe('Tag Operations', () => {
    it('should create a tag', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tags (name, color) VALUES (?, ?)',
          ['Urgent', '#ff0000'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.lastID).toBeDefined();
            resolve();
          }
        );
      });
    });

    it('should get all tags', async () => {
      return new Promise<void>((resolve, reject) => {
        db.all('SELECT * FROM tags ORDER BY name', (err: Error | null, rows: TagDatabase[]) => {
          if (err) {
            reject(err);
            return;
          }
          expect(Array.isArray(rows)).toBe(true);
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0]).toHaveProperty('name');
          expect(rows[0]).toHaveProperty('color');
          resolve();
        });
      });
    });
  });

  describe('Settings Operations', () => {
    it('should set a setting', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['theme', 'dark'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.changes).toBe(1);
            resolve();
          }
        );
      });
    });

    it('should get a setting', async () => {
      return new Promise<void>((resolve, reject) => {
        db.get(
          'SELECT value FROM settings WHERE key = ?',
          ['theme'],
          (err: Error | null, row: { value: string }) => {
            if (err) {
              reject(err);
              return;
            }
            expect(row).toBeDefined();
            expect(row.value).toBe('dark');
            resolve();
          }
        );
      });
    });
  });
});
