import { ipcMain } from 'electron';
import type { Project } from '@/types/project';
import type { Database } from 'sqlite3';
import { getRecordAfterInsert, getRecordAfterWrite } from '../../helpers';
import { IPC_CHANNELS } from '../../../src/ipc/channels';

export function registerProjectHandlers(db: Database) {
  // Create Project
  ipcMain.handle(
    IPC_CHANNELS.database.createProject,
    (_, name: string, description?: string, color?: string) => {
      return getRecordAfterInsert<Project>(function (cb) {
        db.run(
          'INSERT INTO projects (name, description, color) VALUES (?, ?, ?)',
          [name, description, color],
          cb
        );
      }, 'SELECT * FROM projects WHERE projectId = ?');
    }
  );

  // Update Project
  ipcMain.handle(
    IPC_CHANNELS.database.updateProject,
    (_, projectId: number, name: string, description: string, color: string) => {
      return getRecordAfterWrite<Project>(
        function (cb) {
          db.run(
            'UPDATE projects SET name = ?, description = ?, color = ? WHERE projectId = ?',
            [name, description, color, projectId],
            cb
          );
        },
        'SELECT * FROM projects WHERE projectId = ?',
        [projectId]
      );
    }
  );

  ipcMain.handle(IPC_CHANNELS.database.getProjects, () => {
    return new Promise<Project[]>((resolve, reject) => {
      db.all('SELECT * FROM projects ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Project[]);
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.getProject, (_, projectId: number) => {
    return new Promise<Project | undefined>((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE projectId = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? (row as Project) : undefined);
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.deleteProject, (_, id: number) => {
    return new Promise<{ changes: number }>((resolve, reject) => {
      db.run('DELETE FROM projects WHERE projectId = ?', [id], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  });
}
