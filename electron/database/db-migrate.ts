import type sqlite3 from 'sqlite3';
import { up as migrate002 } from './migrations/002_camelcase_columns';
import { logMigrationError } from './logMigrationError';

const CURRENT_SCHEMA_VERSION = 2;

export async function runMigrations(db: sqlite3.Database): Promise<void> {
  // Ensure settings table exists (just in case)
  await new Promise<void>((resolve, reject) => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
      err => (err ? reject(err) : resolve())
    );
  });

  const versionRow = await new Promise<{ value?: string }>((resolve, reject) => {
    db.get(`SELECT value FROM settings WHERE key = 'schema_version'`, (err, row) => {
      if (err) reject(err);
      else resolve(row || {});
    });
  });

  const currentVersion = parseInt(versionRow?.value || '0', 10);
  console.log(`🧪 DB schema version: ${currentVersion}`);

  // Sequential migrations
  if (currentVersion < 2) {
    try {
      console.log('📦 Applying migration 002_camelcase_columns...');
      await migrate002(db);

      console.log('🧪 DB schema version: 2');
      await setSchemaVersion(db, 2);
    } catch (err) {
      console.log('Migration 002_camelcase_columns failed');
      logMigrationError('Migration 002_camelcase_columns failed', err as Error);
      throw err; // Let it propagate or handle as needed
    }
  }

  // Future migrations here:
  // if (currentVersion < 3) {
  //   await migrate003(db);
  //   await setSchemaVersion(db, 3);
  // }

  console.log(`✅ Database schema is up to date (v${CURRENT_SCHEMA_VERSION})`);
}

async function setSchemaVersion(db: sqlite3.Database, version: number) {
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)`,
      [version.toString()],
      err => (err ? reject(err) : resolve())
    );
  });
}
