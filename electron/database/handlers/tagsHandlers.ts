import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { TagDatabase } from '@/types/tag';
import { getRecordAfterInsert, getRecordAfterWrite, getRecordBeforeDelete } from '../../helpers';
import { IPC_CHANNELS } from '../../../src/ipc/channels';

export function registerTagHandlers(db: Database) {
  // Tag operations
  ipcMain.handle(IPC_CHANNELS.database.createTag, (_, name: string, color?: string) => {
    return getRecordAfterInsert<TagDatabase>(function (cb) {
      db.run('INSERT INTO tags (name, color) VALUES (?, ?)', [name, color], cb);
    }, 'SELECT * FROM tags WHERE tagId = ?');
  });

  ipcMain.handle(IPC_CHANNELS.database.getTags, () => {
    return new Promise<TagDatabase[]>((resolve, reject) => {
      db.all('SELECT * FROM tags ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as TagDatabase[]);
      });
    });
  });

  ipcMain.handle(
    IPC_CHANNELS.database.updateTag,
    (_, tagId: number, name: string, color?: string) => {
      return getRecordAfterWrite<TagDatabase>(
        function (cb) {
          db.run('UPDATE tags SET name = ?, color = ? WHERE tagId = ?', [name, color, tagId], cb);
        },
        'SELECT * FROM tags WHERE tagId = ?',
        [tagId]
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.database.deleteTag, (_, tagId: number) => {
    return getRecordBeforeDelete<TagDatabase>(
      'SELECT * FROM tags WHERE tagId = ?',
      [tagId],
      'DELETE FROM tags WHERE tagId = ?',
      [tagId]
    );
  });
}
