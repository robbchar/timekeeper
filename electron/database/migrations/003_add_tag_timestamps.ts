// migrations/003_add_tag_timestamps.ts
import type sqlite3 from 'sqlite3';

export async function up(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Add createdAt and updatedAt columns with defaults
      db.run(`ALTER TABLE tags ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP`, err => {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }

        db.run(`ALTER TABLE tags ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP`, err2 => {
          if (err2) {
            db.run('ROLLBACK');
            return reject(err2);
          }

          // For existing rows, set updatedAt = createdAt (or now if createdAt is null)
          db.run(
            `UPDATE tags SET 
                  createdAt = COALESCE(createdAt, CURRENT_TIMESTAMP),
                  updatedAt = COALESCE(updatedAt, createdAt, CURRENT_TIMESTAMP)`,
            err3 => {
              if (err3) {
                db.run('ROLLBACK');
                return reject(err3);
              }

              db.run('COMMIT', err4 => {
                if (err4) {
                  return reject(err4);
                }
                resolve();
              });
            }
          );
        });
      });
    });
  });
}
