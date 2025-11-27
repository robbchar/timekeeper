import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { ProjectDatabase } from '@/types/project';
import { IPC_CHANNELS } from '@/types/ipcChannels';
import { getRecordAfterInsert, getRecordAfterWrite } from '../../helpers';

export function registerProjectHandlers(db: Database) {
  // Project operations
  // Create Project
  ipcMain.handle(
    IPC_CHANNELS.database.createProject,
    (_, name: string, description?: string, color?: string) => {
      return getRecordAfterInsert<ProjectDatabase>(function (cb) {
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
      return getRecordAfterWrite<ProjectDatabase>(
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
    return new Promise<ProjectDatabase[]>((resolve, reject) => {
      db.all('SELECT * FROM projects ORDER BY name', (err, rows) => {
        if (err) reject(err);
        else resolve(rows as ProjectDatabase[]);
      });
    });
  });

  ipcMain.handle(IPC_CHANNELS.database.getProject, (_, projectId: number) => {
    return new Promise<ProjectDatabase | undefined>((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE projectId = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row as ProjectDatabase | undefined);
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
