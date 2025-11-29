import * as sqlite3 from 'sqlite3';
import { ipcMain } from 'electron';
import type { TagDatabase } from '@/types/tag';
import { getRecordAfterInsert, getRecordAfterWrite, getRecordBeforeDelete } from '../../helpers';

export function registerTagHandlers({ db }: { db: sqlite3.Database }) {
  // Tag operations
  ipcMain.handle('database:createTag', (_, name: string, color?: string) => {
    return getRecordAfterInsert<TagDatabase>(function (cb) {
      db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color], cb);
    }, 'SELECT * FROM tags WHERE tagId = ?');
  });

  ipcMain.handle('database:getTags', () => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as TagDatabase[]);
      });
    });
  });

  ipcMain.handle('database:updateTag', (_, tagId: number, name: string, color?: string) => {
    return getRecordAfterWrite<TagDatabase>(
      function (cb) {
        db.run('UPDATE tags SET name = ?, color = ? WHERE tagId = ?', [name, color, tagId], cb);
      },
      'SELECT * FROM tags WHERE tagId = ?',
      [tagId]
    );
  });

  ipcMain.handle('database:deleteTag', (_, tagId: number) => {
    return getRecordBeforeDelete<TagDatabase>(
      'SELECT * FROM tags WHERE tagId = ?',
      [tagId],
      'DELETE FROM tags WHERE tagId = ?',
      [tagId]
    );
  });

  // Project–Tag relationship operations
  ipcMain.handle('database:getTagsForProject', (_, projectId: number) => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all(
        `SELECT t.*
         FROM tags t
         INNER JOIN project_tags pt ON pt.tagId = t.tagId
         WHERE pt.projectId = ?
         ORDER BY t.name`,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as TagDatabase[]);
        }
      );
    });
  });

  ipcMain.handle('database:setProjectTags', (_, projectId: number, tagIds: number[]) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run('DELETE FROM project_tags WHERE projectId = ?', [projectId], function (err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          const deleteChanges = this.changes ?? 0;

          if (!tagIds.length) {
            db.run('COMMIT', commitErr => {
              if (commitErr) {
                reject(commitErr);
              } else {
                resolve({ changes: deleteChanges });
              }
            });
            return;
          }

          const stmt = db.prepare(
            'INSERT INTO project_tags (projectId, tagId) VALUES (?, ?)',
            err2 => {
              if (err2) {
                db.run('ROLLBACK');
                reject(err2);
              }
            }
          );

          let insertChanges = 0;

          const insertNext = (index: number) => {
            if (index >= tagIds.length) {
              stmt.finalize(errFinalize => {
                if (errFinalize) {
                  db.run('ROLLBACK');
                  reject(errFinalize);
                  return;
                }

                db.run('COMMIT', commitErr => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    resolve({ changes: deleteChanges + insertChanges });
                  }
                });
              });
              return;
            }

            stmt.run([projectId, tagIds[index]], function (errRun) {
              if (errRun) {
                db.run('ROLLBACK');
                reject(errRun);
                return;
              }

              insertChanges += this.changes ?? 0;
              insertNext(index + 1);
            });
          };

          insertNext(0);
        });
      });
    });
  });
}
