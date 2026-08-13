import type sqlite3 from 'sqlite3';
import { up as migrate002 } from './migrations/002_camelcase_columns';
import { up as migrate003 } from './migrations/003_add_tag_timestamps';
import { up as migrate004 } from './migrations/004_add_project_tags';
import { logMigrationError } from './logMigrationError';

export const CURRENT_SCHEMA_VERSION = 4;

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

  const isTestEnv = process.env.NODE_ENV === 'test';
  if (!isTestEnv) {
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

    if (currentVersion < 3) {
      try {
        console.log('📦 Applying migration 003_add_tag_timestamps...');
        await migrate003(db);

        console.log('🧪 DB schema version: 3');
        await setSchemaVersion(db, 3);
      } catch (err) {
        console.log('Migration 003_add_tag_timestamps failed');
        logMigrationError('Migration 003_add_tag_timestamps failed', err as Error);
        throw err;
      }
    }

    if (currentVersion < 4) {
      try {
        console.log('📦 Applying migration 004_add_project_tags...');
        await migrate004(db);

        console.log('🧪 DB schema version: 4');
        await setSchemaVersion(db, 4);
      } catch (err) {
        console.log('Migration 004_add_project_tags failed');
        logMigrationError('Migration 004_add_project_tags failed', err as Error);
        throw err;
      }
    }

    console.log(`✅ Database schema is up to date (v${CURRENT_SCHEMA_VERSION})`);
  } else {
    console.log('🧪 Skipping migrations in test environment');

    db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', ?)`, [
      CURRENT_SCHEMA_VERSION.toString(),
    ]);
  }
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
