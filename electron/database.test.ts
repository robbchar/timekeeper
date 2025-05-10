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

describe('Main Process Database (Projects)', () => {
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
    `);
  });

  afterEach(() => {
    db.close();
    cleanupTestDb();
  });

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
