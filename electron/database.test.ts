import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Use a temporary database file for testing
const testDbPath = path.join(__dirname, 'test-timekeeper.db');

function cleanupTestDb() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

describe('Main Process Database', () => {
  let db: Database.Database;

  beforeEach(() => {
    cleanupTestDb();
    db = new Database(testDbPath);
    // Re-run schema creation for each test
    db.exec(`
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
    `);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb();
  });

  describe('Projects', () => {
    it('should create and retrieve a project', () => {
      const stmt = db.prepare('INSERT INTO projects (name, description, color) VALUES (?, ?, ?)');
      const result = stmt.run('Test Project', 'A test project', '#ff0000');
      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const getStmt = db.prepare('SELECT * FROM projects WHERE id = ?');
      const project = getStmt.get(result.lastInsertRowid) as {
        name: string;
        description: string;
        color: string;
      };
      expect(project).toMatchObject({
        name: 'Test Project',
        description: 'A test project',
        color: '#ff0000',
      });
    });

    it('should return all projects', () => {
      db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project 1');
      db.prepare('INSERT INTO projects (name) VALUES (?)').run('Project 2');
      const stmt = db.prepare('SELECT * FROM projects ORDER BY name');
      const projects = stmt.all();
      expect(projects.length).toBe(2);
      expect((projects[0] as { name: string }).name).toBe('Project 1');
      expect((projects[1] as { name: string }).name).toBe('Project 2');
    });
  });

  describe('Sessions', () => {
    let projectId: number;

    beforeEach(() => {
      // Create a test project for session tests
      const result = db.prepare('INSERT INTO projects (name) VALUES (?)').run('Test Project');
      projectId = result.lastInsertRowid as number;
    });

    it('should create and retrieve a session', () => {
      const startTime = new Date().toISOString();
      const stmt = db.prepare(
        'INSERT INTO sessions (project_id, start_time, notes) VALUES (?, ?, ?)'
      );
      const result = stmt.run(projectId, startTime, 'Test session notes');
      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
      const session = getStmt.get(result.lastInsertRowid) as {
        project_id: number;
        start_time: string;
        notes: string;
      };
      expect(session).toMatchObject({
        project_id: projectId,
        start_time: startTime,
        notes: 'Test session notes',
      });
    });

    it('should end a session and update duration', () => {
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour later
      const duration = 3600; // 1 hour in seconds

      // Create session
      const createResult = db
        .prepare('INSERT INTO sessions (project_id, start_time) VALUES (?, ?)')
        .run(projectId, startTime);
      const sessionId = createResult.lastInsertRowid as number;

      // End session
      const updateStmt = db.prepare('UPDATE sessions SET end_time = ?, duration = ? WHERE id = ?');
      const updateResult = updateStmt.run(endTime, duration, sessionId);
      expect(updateResult.changes).toBe(1);

      // Verify session was updated
      const getStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
      const session = getStmt.get(sessionId) as {
        end_time: string;
        duration: number;
      };
      expect(session).toMatchObject({
        end_time: endTime,
        duration: duration,
      });
    });

    it('should return all sessions for a project', () => {
      const startTime1 = new Date().toISOString();
      const startTime2 = new Date(Date.now() + 3600000).toISOString();

      db.prepare('INSERT INTO sessions (project_id, start_time) VALUES (?, ?)').run(
        projectId,
        startTime1
      );
      db.prepare('INSERT INTO sessions (project_id, start_time) VALUES (?, ?)').run(
        projectId,
        startTime2
      );

      const stmt = db.prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY start_time');
      const sessions = stmt.all(projectId);
      expect(sessions.length).toBe(2);
      expect((sessions[0] as { start_time: string }).start_time).toBe(startTime1);
      expect((sessions[1] as { start_time: string }).start_time).toBe(startTime2);
    });
  });

  describe('Tags', () => {
    it('should create and retrieve a tag', () => {
      const stmt = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
      const result = stmt.run('Urgent', '#ff0000');
      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const getStmt = db.prepare('SELECT * FROM tags WHERE id = ?');
      const tag = getStmt.get(result.lastInsertRowid) as {
        name: string;
        color: string;
      };
      expect(tag).toMatchObject({
        name: 'Urgent',
        color: '#ff0000',
      });
    });

    it('should not allow duplicate tag names', () => {
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('UniqueTag');
      expect(() => {
        db.prepare('INSERT INTO tags (name) VALUES (?)').run('UniqueTag');
      }).toThrow();
    });

    it('should return all tags', () => {
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('Tag1');
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('Tag2');
      const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
      const tags = stmt.all();
      expect(tags.length).toBe(2);
      expect((tags[0] as { name: string }).name).toBe('Tag1');
      expect((tags[1] as { name: string }).name).toBe('Tag2');
    });
  });
});
