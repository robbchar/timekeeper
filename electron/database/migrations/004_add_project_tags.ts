// migrations/004_add_project_tags.ts
import type sqlite3 from 'sqlite3';

export async function up(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `CREATE TABLE IF NOT EXISTS project_tags (
          projectTagId INTEGER PRIMARY KEY AUTOINCREMENT,
          projectId INTEGER NOT NULL,
          tagId INTEGER NOT NULL,
          FOREIGN KEY (projectId) REFERENCES projects(projectId) ON DELETE CASCADE,
          FOREIGN KEY (tagId) REFERENCES tags(tagId) ON DELETE CASCADE
        );`,
        err => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          db.run('COMMIT', err2 => {
            if (err2) {
              return reject(err2);
            }
            resolve();
          });
        }
      );
    });
  });
}
