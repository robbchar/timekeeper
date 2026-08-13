/// <reference types="vitest/globals" />

import fs from 'fs';
import path from 'path';
import * as sqlite3 from 'sqlite3';
import { CURRENT_SCHEMA_VERSION, runMigrations } from './db-migrate';

// logMigrationError reaches for Electron's `app.getPath`, which does not exist
// outside the Electron runtime. Stub it so a failing migration surfaces as the
// underlying SQLite error rather than a crash inside the logger.
vi.mock('./logMigrationError', () => ({
  logMigrationError: vi.fn(),
}));

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/** Schema as it stood at version 3 — everything except the project_tags table. */
const schemaAtVersion3 = `
  CREATE TABLE projects (
    projectId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE tags (
    tagId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const exec = (db: sqlite3.Database, sql: string) =>
  new Promise<void>((resolve, reject) => db.exec(sql, err => (err ? reject(err) : resolve())));

const run = (db: sqlite3.Database, sql: string, params: unknown[] = []) =>
  new Promise<void>((resolve, reject) =>
    db.run(sql, params, err => (err ? reject(err) : resolve()))
  );

const tableNames = (db: sqlite3.Database) =>
  new Promise<string[]>((resolve, reject) =>
    db.all(`SELECT name FROM sqlite_master WHERE type = 'table'`, (err, rows) =>
      err ? reject(err) : resolve((rows as { name: string }[]).map(row => row.name))
    )
  );

const schemaVersion = (db: sqlite3.Database) =>
  new Promise<string | undefined>((resolve, reject) =>
    db.get(`SELECT value FROM settings WHERE key = 'schema_version'`, (err, row) =>
      err ? reject(err) : resolve((row as { value: string } | undefined)?.value)
    )
  );

describe('runMigrations', () => {
  let db: sqlite3.Database;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    // runMigrations short-circuits when NODE_ENV is 'test', which is exactly the
    // branch we do not want to exercise here.
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    db = new sqlite3.Database(':memory:');
    await exec(db, schemaAtVersion3);
    await run(db, `INSERT INTO settings (key, value) VALUES ('schema_version', '3')`);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await new Promise<void>(resolve => db.close(() => resolve()));
  });

  it('applies migration 004 to a version 3 database', async () => {
    expect(await tableNames(db)).not.toContain('project_tags');

    await runMigrations(db);

    expect(await tableNames(db)).toContain('project_tags');
  });

  it('records the new schema version after migrating', async () => {
    await runMigrations(db);

    expect(await schemaVersion(db)).toBe(String(CURRENT_SCHEMA_VERSION));
  });

  it('creates project_tags with the expected columns', async () => {
    await runMigrations(db);

    const columns = await new Promise<string[]>((resolve, reject) =>
      db.all(`PRAGMA table_info(project_tags)`, (err, rows) =>
        err ? reject(err) : resolve((rows as { name: string }[]).map(row => row.name))
      )
    );

    expect(columns).toEqual(['projectTagId', 'projectId', 'tagId']);
  });

  it('is a no-op when the database is already up to date', async () => {
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.toBeUndefined();

    expect(await schemaVersion(db)).toBe(String(CURRENT_SCHEMA_VERSION));
  });
});

/** Schema as it stood before versioning: snake_case columns, no project_tags. */
const legacySchema = `
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INTEGER,
    notes TEXT
  );

  CREATE TABLE tags (
    tagId INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT
  );

  CREATE TABLE session_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const columnNames = (db: sqlite3.Database, table: string) =>
  new Promise<string[]>((resolve, reject) =>
    db.all(`PRAGMA table_info(${table})`, (err, rows) =>
      err ? reject(err) : resolve((rows as { name: string }[]).map(row => row.name))
    )
  );

describe('runMigrations on a legacy database', () => {
  let db: sqlite3.Database;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    db = new sqlite3.Database(':memory:');
    await exec(db, legacySchema);
    await run(db, `INSERT INTO projects (id, name, color, created_at) VALUES (?, ?, ?, ?)`, [
      1,
      'Legacy Project',
      '#ff0000',
      '2025-01-01 00:00:00',
    ]);
    await run(
      db,
      `INSERT INTO sessions (id, project_id, start_time, duration, notes) VALUES (?, ?, ?, ?, ?)`,
      [1, 1, '2025-01-01 09:00:00', 3600, 'Legacy session']
    );
    await run(db, `INSERT INTO tags (tagId, name, color) VALUES (?, ?, ?)`, [
      1,
      'legacy',
      '#00ff00',
    ]);
    await run(db, `INSERT INTO session_tags (id, session_id, tag_id) VALUES (?, ?, ?)`, [1, 1, 1]);
    await run(db, `INSERT INTO settings (key, value) VALUES ('schema_version', '1')`);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await new Promise<void>(resolve => db.close(() => resolve()));
  });

  it('replays the whole chain up to the current version', async () => {
    await runMigrations(db);

    expect(await schemaVersion(db)).toBe(String(CURRENT_SCHEMA_VERSION));
  });

  it('converts projects to camelCase columns', async () => {
    await runMigrations(db);

    expect(await columnNames(db, 'projects')).toEqual([
      'projectId',
      'name',
      'description',
      'color',
      'createdAt',
    ]);
  });

  it('preserves project data across the rename', async () => {
    await runMigrations(db);

    const project = await new Promise<{ projectId: number; name: string; color: string }>(
      (resolve, reject) =>
        db.get(`SELECT * FROM projects WHERE projectId = 1`, (err, row) =>
          err ? reject(err) : resolve(row as { projectId: number; name: string; color: string })
        )
    );

    expect(project.name).toBe('Legacy Project');
    expect(project.color).toBe('#ff0000');
  });

  it('preserves session data across the rename', async () => {
    await runMigrations(db);

    const session = await new Promise<{ projectId: number; duration: number; notes: string }>(
      (resolve, reject) =>
        db.get(`SELECT * FROM sessions WHERE sessionId = 1`, (err, row) =>
          err ? reject(err) : resolve(row as { projectId: number; duration: number; notes: string })
        )
    );

    expect(session.projectId).toBe(1);
    expect(session.duration).toBe(3600);
    expect(session.notes).toBe('Legacy session');
  });

  it('adds tag timestamps and the project_tags table', async () => {
    await runMigrations(db);

    expect(await columnNames(db, 'tags')).toEqual(
      expect.arrayContaining(['createdAt', 'updatedAt'])
    );
    expect(await tableNames(db)).toContain('project_tags');
  });

  it('drops the renamed _old tables', async () => {
    await runMigrations(db);

    expect((await tableNames(db)).filter(name => name.endsWith('_old'))).toEqual([]);
  });
});

describe('migration 002 failure handling', () => {
  let db: sqlite3.Database;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // A legacy database missing `sessions` makes migration 002 fail partway,
    // after it has already renamed `projects`.
    db = new sqlite3.Database(':memory:');
    await exec(
      db,
      `CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, color TEXT, created_at DATETIME);
       CREATE TABLE session_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, tag_id INTEGER);
       CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
    );
    await run(db, `INSERT INTO settings (key, value) VALUES ('schema_version', '1')`);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await new Promise<void>(resolve => db.close(() => resolve()));
  });

  it('rejects instead of silently committing a partial migration', async () => {
    await expect(runMigrations(db)).rejects.toThrow();
  });

  it('rolls back the renames it had already applied', async () => {
    await runMigrations(db).catch(() => undefined);

    const tables = await tableNames(db);
    expect(tables).toContain('projects');
    expect(tables).not.toContain('projects_old');
  });

  it('does not advance the schema version', async () => {
    await runMigrations(db).catch(() => undefined);

    expect(await schemaVersion(db)).toBe('1');
  });
});

describe('migration registration', () => {
  // Migration 004 shipped as a file but was never imported by db-migrate, so it
  // silently never ran. This guards against the next one going the same way.
  it('registers every migration file in the migrations directory', () => {
    const highestMigrationOnDisk = fs
      .readdirSync(MIGRATIONS_DIR)
      .map(fileName => Number(fileName.match(/^(\d+)_/)?.[1]))
      .filter(migrationNumber => !Number.isNaN(migrationNumber))
      .reduce((highest, migrationNumber) => Math.max(highest, migrationNumber), 0);

    expect(CURRENT_SCHEMA_VERSION).toBe(highestMigrationOnDisk);
  });
});
