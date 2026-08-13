/// <reference types="vitest/globals" />

// Kept separate from database.test.ts because initializeDatabase reassigns the
// module-level database singleton, and these tests need to drive it themselves.

import type * as sqlite3 from 'sqlite3';
import { closeDatabase, initializeDatabase } from './database';
import { CURRENT_SCHEMA_VERSION } from './db-migrate';

vi.mock('./logMigrationError', () => ({
  logMigrationError: vi.fn(),
}));

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

describe('initializeDatabase on a brand new database', () => {
  let db: sqlite3.Database;
  let originalNodeEnv: string | undefined;

  beforeEach(async () => {
    // Migrations are skipped entirely under NODE_ENV=test, which would hide the
    // behavior these tests exist to cover.
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    db = await initializeDatabase(true);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await closeDatabase();
  });

  it('starts at the current schema version rather than replaying migrations', async () => {
    expect(await schemaVersion(db)).toBe(String(CURRENT_SCHEMA_VERSION));
  });

  it('creates the full current schema', async () => {
    const tables = await tableNames(db);

    expect(tables).toEqual(
      expect.arrayContaining([
        'projects',
        'sessions',
        'tags',
        'session_tags',
        'project_tags',
        'settings',
      ])
    );
  });

  it('leaves no half-migrated rename artifacts behind', async () => {
    const tables = await tableNames(db);

    expect(tables.filter(name => name.endsWith('_old'))).toEqual([]);
  });

  it('builds projects with camelCase columns', async () => {
    const columns = await new Promise<string[]>((resolve, reject) =>
      db.all(`PRAGMA table_info(projects)`, (err, rows) =>
        err ? reject(err) : resolve((rows as { name: string }[]).map(row => row.name))
      )
    );

    expect(columns).toEqual(['projectId', 'name', 'description', 'color', 'createdAt']);
  });
});
