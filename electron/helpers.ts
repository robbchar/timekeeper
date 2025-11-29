import type { DatabaseAPI } from '@/types/database';
import type { CreateResponse, DeleteResponse, UpdateResponse } from '@/types/database-response';
import { IPC_CHANNELS, type DatabaseIpcChannel } from '@/types/ipc-channels';
import type { Database, RunResult } from 'sqlite3';

let db: Database;
export function setDatabaseInstance(instance: Database) {
  db = instance;
}

/**
 * Helper to perform an UPDATE and return the updated record.
 */
export function getRecordAfterWrite<T>(
  runQuery: (cb: (this: RunResult, err: Error | null) => void) => void,
  getQuery: string,
  getParams: unknown[]
): Promise<UpdateResponse<T>> {
  return new Promise((resolve, reject) => {
    runQuery.call(null, function (err) {
      if (err) return reject(err);
      db.get(getQuery, getParams, (err, row) => {
        if (err) return reject(err);
        resolve({ changes: this.changes, record: row as T });
      });
    });
  });
}

/**
 * Helper to perform an INSERT and return the inserted record.
 */
export function getRecordAfterInsert<T>(
  runQuery: (cb: (this: RunResult, err: Error | null) => void) => void,
  getQuery: string
): Promise<CreateResponse<T>> {
  return new Promise((resolve, reject) => {
    runQuery(function (err) {
      if (err) return reject(err);
      const id = this.lastID;
      db.get(getQuery, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error(`Row not found after insert (id: ${id})`));
        resolve({ itemId: id, changes: this.changes, record: row as T });
      });
    });
  });
}

export function getRecordBeforeDelete<T>(
  getQuery: string,
  getParams: unknown[],
  deleteQuery: string,
  deleteParams: unknown[]
): Promise<DeleteResponse<T>> {
  return new Promise((resolve, reject) => {
    db.get(getQuery, getParams, (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Record not found'));

      db.run(deleteQuery, deleteParams, function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes, deleted: row as T });
      });
    });
  });
}

type ApiMethodName = keyof DatabaseAPI;
type ApiReturn<M extends ApiMethodName> = Awaited<ReturnType<DatabaseAPI[M]>>;
type IpcInvoke = <T>(channel: DatabaseIpcChannel, ...args: unknown[]) => Promise<T>;

export const makeDbShape = (invoke: IpcInvoke): DatabaseAPI => ({
  // Project operations
  createProject: (name: string, description?: string, color?: string) =>
    invoke<ApiReturn<'createProject'>>(
      IPC_CHANNELS.database.createProject,
      name,
      description,
      color
    ),

  getProject: (projectId: number) =>
    invoke<ApiReturn<'getProject'>>(IPC_CHANNELS.database.getProject, projectId),

  getProjects: () => invoke<ApiReturn<'getProjects'>>(IPC_CHANNELS.database.getProjects),

  updateProject: (projectId: number, name: string, description?: string, color?: string) =>
    invoke<ApiReturn<'updateProject'>>(
      IPC_CHANNELS.database.updateProject,
      projectId,
      name,
      description,
      color
    ),

  deleteProject: (id: number) =>
    invoke<ApiReturn<'deleteProject'>>(IPC_CHANNELS.database.deleteProject, id),

  // Session operations
  createSession: (projectId: number, notes?: string) =>
    invoke<ApiReturn<'createSession'>>(IPC_CHANNELS.database.createSession, projectId, notes),

  endSession: (id: number, duration: number) =>
    invoke<ApiReturn<'endSession'>>(IPC_CHANNELS.database.endSession, id, duration),

  getSessions: () => invoke<ApiReturn<'getSessions'>>(IPC_CHANNELS.database.getSessions),

  getSessionsForProject: (projectId: number) =>
    invoke<ApiReturn<'getSessionsForProject'>>(
      IPC_CHANNELS.database.getSessionsForProject,
      projectId
    ),

  updateSessionNotes: (id: number, notes: string) =>
    invoke<ApiReturn<'updateSessionNotes'>>(IPC_CHANNELS.database.updateSessionNotes, id, notes),

  updateSessionDuration: (id: number, duration: number) =>
    invoke<ApiReturn<'updateSessionDuration'>>(
      IPC_CHANNELS.database.updateSessionDuration,
      id,
      duration
    ),

  deleteSession: (id: number) =>
    invoke<ApiReturn<'deleteSession'>>(IPC_CHANNELS.database.deleteSession, id),

  // Tag operations
  createTag: (name: string, color?: string) =>
    invoke<ApiReturn<'createTag'>>(IPC_CHANNELS.database.createTag, name, color),

  getTags: () => invoke<ApiReturn<'getTags'>>(IPC_CHANNELS.database.getTags),
  updateTag: (id: number, name: string, color?: string) =>
    invoke<ApiReturn<'updateTag'>>(IPC_CHANNELS.database.updateTag, id, name, color),

  deleteTag: (id: number) => invoke<ApiReturn<'deleteTag'>>(IPC_CHANNELS.database.deleteTag, id),

  // Project–Tag relationship operations
  getTagsForProject: (projectId: number) =>
    invoke<ApiReturn<'getTagsForProject'>>(IPC_CHANNELS.database.getTagsForProject, projectId),
  setProjectTags: (projectId: number, tagIds: number[]) =>
    invoke<ApiReturn<'setProjectTags'>>(IPC_CHANNELS.database.setProjectTags, projectId, tagIds),

  // Settings operations
  getSetting: (key: string) =>
    invoke<ApiReturn<'getSetting'>>(IPC_CHANNELS.database.getSetting, key),

  setSetting: (key: string, value: string) =>
    invoke<ApiReturn<'setSetting'>>(IPC_CHANNELS.database.setSetting, key, value),

  // Test helper
  reset: () => invoke<ApiReturn<'reset'>>(IPC_CHANNELS.database.reset),
});
