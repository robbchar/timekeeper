import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as sqlite3 from 'sqlite3';
import { closeDatabase, initializeDatabase } from './database';
import { getRecordAfterInsert, getRecordAfterWrite, getRecordBeforeDelete } from '../helpers';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import type { TagDatabase } from '@/types/tag';

describe('Database Operations', () => {
  let db: sqlite3.Database;

  beforeAll(async () => {
    db = await initializeDatabase(true);
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
    let projectId: number;
    let sessionId: number;

    beforeAll(async () => {
      // Ensure there is a project to attach sessions to
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          ['Session Project', 'Project for session tests', '#00ff00'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            projectId = this.lastID;
            resolve();
          }
        );
      });
    });

    it('should create a session', async () => {
      return new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)',
          [projectId, new Date().toISOString(), 'Test session'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.lastID).toBeDefined();
            sessionId = this.lastID;
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
          [endTime, duration, sessionId],
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
          [projectId],
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

  describe('Database response helpers', () => {
    it('getRecordAfterInsert returns itemId, changes, and record', async () => {
      const result = await getRecordAfterInsert<Project>(
        cb =>
          db.run(
            'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
            ['Helper Project', 'Project created via helper', '#abcdef'],
            cb
          ),
        'SELECT * FROM projects WHERE projectId = ?'
      );

      expect(result.itemId).toBeDefined();
      expect(result.changes).toBe(1);
      expect(result.record).toBeDefined();
      expect(result.record.name).toBe('Helper Project');
    });

    it('getRecordAfterWrite returns changes and updated record', async () => {
      let projectId!: number;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          ['Writable Project', 'Project to update via helper', '#123456'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            projectId = this.lastID;
            resolve();
          }
        );
      });

      const result = await getRecordAfterWrite<Project>(
        cb =>
          db.run(
            'UPDATE projects SET name = ? WHERE projectId = ?',
            ['Updated Project via helper', projectId],
            cb
          ),
        'SELECT * FROM projects WHERE projectId = ?',
        [projectId]
      );

      expect(result.changes).toBe(1);
      expect(result.record).toBeDefined();
      expect(result.record.name).toBe('Updated Project via helper');
    });

    it('getRecordBeforeDelete returns changes and deleted record', async () => {
      let tagId!: number;

      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO tags (name, color) VALUES (?, ?)',
          ['Helper Tag', '#fedcba'],
          function (err: Error | null) {
            if (err) {
              reject(err);
              return;
            }
            tagId = this.lastID;
            resolve();
          }
        );
      });

      const result = await getRecordBeforeDelete<TagDatabase>(
        'SELECT * FROM tags WHERE tagId = ?',
        [tagId],
        'DELETE FROM tags WHERE tagId = ?',
        [tagId]
      );

      expect(result.changes).toBe(1);
      expect(result.deleted).toBeDefined();
      expect(result.deleted.name).toBe('Helper Tag');
    });
  });
});
