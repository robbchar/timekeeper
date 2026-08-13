// migrations/003_add_tag_timestamps.ts
import type sqlite3 from 'sqlite3';

/**
 * Adds createdAt/updatedAt to `tags`.
 *
 * SQLite rejects `ALTER TABLE ... ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP`
 * ("Cannot add a column with non-constant default"), so the table is rebuilt
 * instead. Rebuilding also keeps the result identical to `createTablesSchema`,
 * which a plain ADD COLUMN could not do — new rows would have no default.
 */
export async function up(db: sqlite3.Database): Promise<void> {
  const run = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => db.run(sql, err => (err ? reject(err) : resolve())));

  // session_tags and project_tags reference tags(tagId).
  await run('PRAGMA foreign_keys = OFF');
  await run('BEGIN TRANSACTION');

  try {
    await run(`ALTER TABLE tags RENAME TO tags_old`);

    await run(
      `CREATE TABLE tags (
        tagId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );`
    );

    // Existing tags have no recorded timestamps, so they are stamped as of the
    // migration. Selecting literals keeps this working whether or not the old
    // table happened to carry the columns already.
    await run(
      `INSERT INTO tags (tagId, name, color, createdAt, updatedAt)
       SELECT tagId, name, color, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM tags_old;`
    );

    await run(`DROP TABLE tags_old`);

    await run('COMMIT');
  } catch (error) {
    console.error('❌ Migration 003_add_tag_timestamps failed, rolling back:', error);
    await run('ROLLBACK').catch(rollbackError =>
      console.error('❌ Rollback failed in migration 003:', rollbackError)
    );
    throw error;
  } finally {
    await run('PRAGMA foreign_keys = ON').catch(err =>
      console.error('❌ Failed to re-enable foreign keys:', err)
    );
  }

  console.log('✅ Migration 003_add_tag_timestamps completed successfully');
}
