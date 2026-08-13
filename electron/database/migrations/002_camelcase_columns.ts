// migrations/002_camelcase_columns.ts
import type sqlite3 from 'sqlite3';

export async function up(db: sqlite3.Database): Promise<void> {
  const run = (sql: string): Promise<void> =>
    new Promise((resolve, reject) => db.run(sql, err => (err ? reject(err) : resolve())));

  // Foreign keys must be disabled outside the transaction: the rename-and-copy
  // below leaves references dangling until every table has been rebuilt.
  await run('PRAGMA foreign_keys = OFF');
  await run('BEGIN TRANSACTION');

  try {
    // Step 1: Rename old tables
    await run(`ALTER TABLE projects RENAME TO projects_old`);
    await run(`ALTER TABLE sessions RENAME TO sessions_old`);
    await run(`ALTER TABLE session_tags RENAME TO session_tags_old`);

    // Step 2: Recreate projects table with camelCase columns
    await run(`
      CREATE TABLE projects (
        projectId INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await run(`
      INSERT INTO projects (projectId, name, description, color, createdAt)
      SELECT id, name, description, color, created_at FROM projects_old;
    `);

    // Step 3: Recreate sessions table with camelCase columns
    await run(
      `CREATE TABLE sessions (
        sessionId INTEGER PRIMARY KEY AUTOINCREMENT,
        projectId INTEGER NOT NULL,
        startTime DATETIME NOT NULL,
        endTime DATETIME,
        duration INTEGER,
        notes TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(projectId) ON DELETE CASCADE
      );`
    );
    await run(
      `INSERT INTO sessions (sessionId, projectId, startTime, endTime, duration, notes)
       SELECT id, project_id, start_time, end_time, duration, notes
       FROM sessions_old;`
    );

    // Step 4: Recreate session_tags table with camelCase columns
    await run(
      `CREATE TABLE session_tags (
        sessionTagId INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        tagId INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(sessionId) ON DELETE CASCADE,
        FOREIGN KEY (tagId) REFERENCES tags(tagId) ON DELETE CASCADE
      );`
    );
    await run(
      `INSERT INTO session_tags (sessionTagId, sessionId, tagId)
       SELECT id, session_id, tag_id
       FROM session_tags_old;`
    );

    // Step 5: Drop old tables
    await run(`DROP TABLE projects_old`);
    await run(`DROP TABLE sessions_old`);
    await run(`DROP TABLE session_tags_old`);

    await run('COMMIT');
  } catch (error) {
    console.error('❌ Migration 002_camelcase_columns failed, rolling back:', error);
    await run('ROLLBACK').catch(rollbackError =>
      console.error('❌ Rollback failed in migration 002:', rollbackError)
    );
    throw error;
  } finally {
    await run('PRAGMA foreign_keys = ON').catch(err =>
      console.error('❌ Failed to re-enable foreign keys:', err)
    );
  }

  console.log('✅ Migration 002_camelcase_columns completed successfully');
}
