import * as sqlite3 from 'sqlite3';
import { getDatabaseConfig } from './database-config';
import { setDatabaseInstance } from '../helpers';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './db-migrate';
import { registerProjectHandlers } from './handlers/projects.handlers';
import { registerSessionHandlers } from './handlers/sessions.handlers';
import { registerTagHandlers } from './handlers/tags.handlers';
import { registerSettingsHandlers } from './handlers/settings.handlers';
import { registerTestHandlers } from './handlers/test.handlers';

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

const run = (database: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> =>
  new Promise((resolve, reject) =>
    database.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()))
  );

const exec = (database: sqlite3.Database, sql: string): Promise<void> =>
  new Promise((resolve, reject) =>
    database.exec(sql, (err: Error | null) => (err ? reject(err) : resolve()))
  );

/** Counts application tables, ignoring SQLite's own internal bookkeeping tables. */
const countUserTables = (database: sqlite3.Database): Promise<number> =>
  new Promise((resolve, reject) =>
    database.get(
      `SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
      (err: Error | null, row) => (err ? reject(err) : resolve((row as { count: number }).count))
    )
  );

/** Runs `work`, logging which step failed before letting the error propagate. */
async function withFailureLog<T>(context: string, work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    console.error(`${context}:`, error);
    throw error;
  }
}

// Initialize database with proper error handling
export async function initializeDatabase(memory = false): Promise<sqlite3.Database> {
  const dbPath = memory ? ':memory:' : getDatabaseConfig().dbPath;

  db = await withFailureLog(
    'Failed to open database',
    new Promise<sqlite3.Database>((resolve, reject) => {
      const instance = new sqlite3.Database(dbPath, (err: Error | null) =>
        err ? reject(err) : resolve(instance)
      );
    })
  );

  await withFailureLog('Failed to enable foreign keys', run(db, 'PRAGMA foreign_keys = ON'));

  // Whether this database predates `createTablesSchema` determines which schema
  // version it starts at, so it has to be measured before any tables exist.
  const isNewDatabase = (await countUserTables(db)) === 0;

  // Create tables if they don't exist
  console.log('Creating tables...');
  await withFailureLog('Failed to create tables', exec(db, createTablesSchema));

  // A new database is built from the current schema, so it starts at the current
  // version with nothing to migrate. An existing database carrying no version
  // stamp predates versioning and must replay the migration chain from the start.
  await run(db, `INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', ?)`, [
    isNewDatabase ? CURRENT_SCHEMA_VERSION.toString() : '1',
  ]);

  console.log('📤 Running migrations...');
  await withFailureLog('Failed to run migrations', runMigrations(db));

  setDatabaseInstance(db);
  return db;
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

  registerProjectHandlers(db);
  registerSessionHandlers(db);
  registerTagHandlers(db);
  registerSettingsHandlers(db);
  registerTestHandlers(db);
}
