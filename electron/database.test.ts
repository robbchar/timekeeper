import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import * as sqlite3 from 'sqlite3';
import { closeDatabase, createTablesSchema, initializeDatabase } from './database';

describe('Main Process Database', () => {
  let db: sqlite3.Database;
  let statements: sqlite3.Statement[] = [];

  beforeEach(async () => {
    db = await initializeDatabase();
    statements = [];
    // Re-run schema creation for each test
    await new Promise<void>((resolve, reject) => {
      db.exec(createTablesSchema, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  afterEach(async () => {
    // Finalize all tracked statements
    for (const stmt of statements) {
      try {
        stmt.finalize();
      } catch (e) {
        // Ignore errors from already finalized statements
        console.error(e);
      }
    }
    statements = [];
    await closeDatabase();
  });

  // Helper function to prepare statements and track them
  function prepareStatement(sql: string): sqlite3.Statement {
    const stmt = db.prepare(sql);
    statements.push(stmt);
    return stmt;
  }

  describe('Projects', () => {
    it('should create and retrieve a project', () => {
      return new Promise<void>((resolve, reject) => {
        const stmt = prepareStatement(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)'
        );
        stmt.run('Test Project', 'A test project', '#ff0000', function (err) {
          if (err) {
            reject(err);
            return;
          }
          const projectId = this.lastID;
          expect(projectId).toBeGreaterThan(0);

          const getStmt = prepareStatement('SELECT * FROM projects WHERE id = ?');
          getStmt.get(projectId, (err, project) => {
            if (err) {
              reject(err);
              return;
            }
            expect(project).toMatchObject({
              name: 'Test Project',
              description: 'A test project',
              color: '#ff0000',
            });
            resolve();
          });
        });
      });
    });

    it('should return all projects', () => {
      return new Promise<void>((resolve, reject) => {
        const insertStmt = prepareStatement('INSERT INTO projects (name) VALUES (?)');
        insertStmt.run('Project 1', err => {
          if (err) {
            reject(err);
            return;
          }
          insertStmt.run('Project 2', err => {
            if (err) {
              reject(err);
              return;
            }
            const stmt = prepareStatement('SELECT * FROM projects ORDER BY name');
            stmt.all((err, projects) => {
              if (err) {
                reject(err);
                return;
              }
              expect(projects).toHaveLength(2);
              expect(projects[0]).toMatchObject({ name: 'Project 1' });
              expect(projects[1]).toMatchObject({ name: 'Project 2' });
              resolve();
            });
          });
        });
      });
    });
  });

  describe('Sessions', () => {
    let projectId: number;

    beforeEach(() => {
      return new Promise<void>((resolve, reject) => {
        // Create a test project for session tests
        const stmt = prepareStatement('INSERT INTO projects (name) VALUES (?)');
        stmt.run('Test Project', function (err) {
          if (err) {
            reject(err);
            return;
          }
          projectId = this.lastID;
          resolve();
        });
      });
    });

    it('should create and retrieve a session', () => {
      return new Promise<void>((resolve, reject) => {
        const startTime = new Date().toISOString();
        const stmt = prepareStatement(
          'INSERT INTO sessions (projectId, startTime, notes) VALUES (?, ?, ?)'
        );
        stmt.run(projectId, startTime, 'Test session notes', function (err) {
          if (err) {
            reject(err);
            return;
          }
          const sessionId = this.lastID;
          expect(sessionId).toBeGreaterThan(0);

          const getStmt = prepareStatement('SELECT * FROM sessions WHERE id = ?');
          getStmt.get(sessionId, (err, session) => {
            if (err) {
              reject(err);
              return;
            }
            expect(session).toMatchObject({
              projectId: projectId,
              startTime: startTime,
              notes: 'Test session notes',
            });
            resolve();
          });
        });
      });
    });

    it('should end a session and update duration', () => {
      return new Promise<void>((resolve, reject) => {
        const startTime = new Date().toISOString();
        const endTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour later
        const duration = 3600; // 1 hour in seconds

        // Create session
        const createStmt = prepareStatement(
          'INSERT INTO sessions (projectId, startTime) VALUES (?, ?)'
        );
        createStmt.run(projectId, startTime, function (err) {
          if (err) {
            reject(err);
            return;
          }
          const sessionId = this.lastID;

          // End session
          const updateStmt = prepareStatement(
            'UPDATE sessions SET endTime = ?, duration = ? WHERE id = ?'
          );
          updateStmt.run(endTime, duration, sessionId, function (err) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.changes).toBe(1);

            // Verify session was updated
            const getStmt = prepareStatement('SELECT * FROM sessions WHERE id = ?');
            getStmt.get(sessionId, (err, session) => {
              if (err) {
                reject(err);
                return;
              }
              expect(session).toMatchObject({
                endTime: endTime,
                duration: duration,
              });
              resolve();
            });
          });
        });
      });
    });

    it('should return all sessions for a project', () => {
      return new Promise<void>((resolve, reject) => {
        const startTime1 = new Date().toISOString();
        const startTime2 = new Date(Date.now() + 3600000).toISOString();

        const insertStmt = prepareStatement(
          'INSERT INTO sessions (projectId, startTime) VALUES (?, ?)'
        );
        insertStmt.run(projectId, startTime1, err => {
          if (err) {
            reject(err);
            return;
          }
          insertStmt.run(projectId, startTime2, err => {
            if (err) {
              reject(err);
              return;
            }
            const stmt = prepareStatement(
              'SELECT * FROM sessions WHERE projectId = ? ORDER BY startTime'
            );
            stmt.all(projectId, (err, sessions) => {
              if (err) {
                reject(err);
                return;
              }
              expect(sessions).toHaveLength(2);
              expect(sessions[0]).toMatchObject({ startTime: startTime1 });
              expect(sessions[1]).toMatchObject({ startTime: startTime2 });
              resolve();
            });
          });
        });
      });
    });
  });

  describe('Tags', () => {
    it('should return all tags', () => {
      return new Promise<void>((resolve, reject) => {
        const insertStmt = prepareStatement('INSERT INTO tags (name) VALUES (?)');
        insertStmt.run('Tag1', err => {
          if (err) {
            reject(err);
            return;
          }
          insertStmt.run('Tag2', err => {
            if (err) {
              reject(err);
              return;
            }
            const stmt = prepareStatement('SELECT * FROM tags ORDER BY name');
            stmt.all((err, tags) => {
              if (err) {
                reject(err);
                return;
              }
              expect(tags).toHaveLength(2);
              expect(tags[0]).toMatchObject({ name: 'Tag1' });
              expect(tags[1]).toMatchObject({ name: 'Tag2' });
              resolve();
            });
          });
        });
      });
    });

    it('should create and retrieve a tag', () => {
      return new Promise<void>((resolve, reject) => {
        const stmt = prepareStatement('INSERT INTO tags (name, color) VALUES (?, ?)');
        stmt.run('Urgent', '#ff0000', function (err) {
          if (err) {
            reject(err);
            return;
          }
          const tagId = this.lastID;
          expect(tagId).toBeGreaterThan(0);

          const getStmt = prepareStatement('SELECT * FROM tags WHERE id = ?');
          getStmt.get(tagId, (err, tag) => {
            if (err) {
              reject(err);
              return;
            }
            expect(tag).toMatchObject({
              name: 'Urgent',
              color: '#ff0000',
            });
            resolve();
          });
        });
      });
    });

    it('should not allow duplicate tag names', () => {
      return new Promise<void>((resolve, reject) => {
        const stmt = prepareStatement('INSERT INTO tags (name) VALUES (?)');
        stmt.run('UniqueTag', err => {
          if (err) {
            reject(err);
            return;
          }
          // Try to insert the same tag again
          const duplicateStmt = prepareStatement('INSERT INTO tags (name) VALUES (?)');
          duplicateStmt.run('UniqueTag', err => {
            expect(err).toBeTruthy();
            expect(err?.message).toContain('UNIQUE constraint failed');
            resolve();
          });
        });
      });
    });
  });

  describe('Settings', () => {
    it('should set and get a setting', () => {
      return new Promise<void>((resolve, reject) => {
        const stmt = prepareStatement('INSERT INTO settings (key, value) VALUES (?, ?)');
        stmt.run('theme', 'dark', err => {
          if (err) {
            reject(err);
            return;
          }
          const getStmt = prepareStatement('SELECT value FROM settings WHERE key = ?');
          getStmt.get('theme', (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            expect((result as { value: string }).value).toBe('dark');
            resolve();
          });
        });
      });
    });

    it('should update a setting', () => {
      return new Promise<void>((resolve, reject) => {
        // First insert the setting
        const insertStmt = prepareStatement('INSERT INTO settings (key, value) VALUES (?, ?)');
        insertStmt.run('timer', '25', err => {
          if (err) {
            reject(err);
            return;
          }
          // Then update it
          const updateStmt = prepareStatement('UPDATE settings SET value = ? WHERE key = ?');
          updateStmt.run('30', 'timer', function (err) {
            if (err) {
              reject(err);
              return;
            }
            expect(this.changes).toBe(1);

            // Verify the update
            const getStmt = prepareStatement('SELECT value FROM settings WHERE key = ?');
            getStmt.get('timer', (err, result) => {
              if (err) {
                reject(err);
                return;
              }
              expect(result).toMatchObject({ value: '30' });
              resolve();
            });
          });
        });
      });
    });

    it('should return undefined for non-existent setting', () => {
      return new Promise<void>((resolve, reject) => {
        const getStmt = prepareStatement('SELECT value FROM settings WHERE key = ?');
        getStmt.get('nonexistent', (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          expect(result).toBeUndefined();
          resolve();
        });
      });
    });
  });
});
