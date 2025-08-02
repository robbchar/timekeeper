// migrations/002_camelcase_columns.ts
import type sqlite3 from 'sqlite3';

export async function up(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = OFF');

      db.run('BEGIN TRANSACTION');

      // Step 1: Rename old tables
      db.run(`ALTER TABLE projects RENAME TO projects_old`);
      db.run(`ALTER TABLE sessions RENAME TO sessions_old`);
      db.run(`ALTER TABLE session_tags RENAME TO session_tags_old`);

      db.run(`
        CREATE TABLE projects (
          projectId INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      db.run(`
        INSERT INTO projects (projectId, name, description, color, createdAt)
        SELECT id, name, description, color, created_at FROM projects_old;
      `);

      // Step 2: Recreate sessions table with camelCase columns
      db.run(
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

      // Step 3: Recreate session_tags table with camelCase columns
      db.run(
        `CREATE TABLE session_tags (
          sessionTagId INTEGER PRIMARY KEY AUTOINCREMENT,
          sessionId INTEGER NOT NULL,
          tagId INTEGER NOT NULL,
          FOREIGN KEY (sessionId) REFERENCES sessions(sessionId) ON DELETE CASCADE,
          FOREIGN KEY (tagId) REFERENCES tags(tagId) ON DELETE CASCADE
        );`
      );

      // Step 4: Copy data from sessions_old to sessions
      db.run(
        `INSERT INTO sessions (sessionId, projectId, startTime, endTime, duration, notes)
         SELECT id, project_id, start_time, end_time, duration, notes
         FROM sessions_old;`
      );

      // Step 5: Copy data from session_tags_old to session_tags
      db.run(
        `INSERT INTO session_tags (sessionTagId, sessionId, tagId)
         SELECT id, session_id, tag_id
         FROM session_tags_old;`
      );

      // Step 6: Drop old tables
      db.run(`DROP TABLE projects_old`);
      db.run(`DROP TABLE sessions_old`);
      db.run(`DROP TABLE session_tags_old`);

      // Step 7: Commit
      db.run('COMMIT', err => {
        if (err) {
          console.error('❌ Commit failed in migration 002:', err);
          return reject(err);
        }

        // Step 8: Re-enable foreign keys
        db.run('PRAGMA foreign_keys = ON', err => {
          if (err) {
            console.error('❌ Failed to re-enable foreign keys:', err);
            return reject(err);
          }

          console.log('✅ Migration 002_camelcase_columns completed successfully');
          resolve();
        });
      });
    });
  });
}
