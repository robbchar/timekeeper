import type { DatabaseAPI } from '@/types/database';
import type { CreateResponse, DeleteResponse, UpdateResponse } from '@/types/database-response';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeDbShape = (invoke: (channel: string, ...args: any[]) => any): DatabaseAPI => ({
  // Project operations
  createProject: (name: string, description?: string, color?: string) =>
    invoke('database:createProject', name, description, color),

  getProjects: () => invoke('database:getProjects'),

  updateProject: (projectId: number, name: string, description?: string, color?: string) =>
    invoke('database:updateProject', projectId, name, description, color),

  deleteProject: (id: number) => invoke('database:deleteProject', id),

  // Session operations
  createSession: (projectId: number, notes?: string) =>
    invoke('database:createSession', projectId, notes),

  endSession: (id: number, duration: number) => invoke('database:endSession', id, duration),

  getSessions: () => invoke('database:getSessions'),

  getSessionsForProject: (projectId: number) => invoke('database:getSessionsForProject', projectId),

  updateSessionNotes: (id: number, notes: string) =>
    invoke('database:updateSessionNotes', id, notes),

  updateSessionDuration: (id: number, duration: number) =>
    invoke('database:updateSessionDuration', id, duration),

  deleteSession: (id: number) => invoke('database:deleteSession', id),

  // Tag operations
  createTag: (name: string, color?: string) => invoke('database:createTag', name, color),

  getTags: () => invoke('database:getTags'),
  updateTag: (id: number, name: string, color?: string) =>
    invoke('database:updateTag', id, name, color),

  deleteTag: (id: number) => invoke('database:deleteTag', id),

  // Project–Tag relationship operations
  getTagsForProject: (projectId: number) => invoke('database:getTagsForProject', projectId),
  setProjectTags: (projectId: number, tagIds: number[]) =>
    invoke('database:setProjectTags', projectId, tagIds),

  // Settings operations
  getSetting: (key: string) => invoke('database:getSetting', key),

  setSetting: (key: string, value: string) => invoke('database:setSetting', key, value),

  // Test helper
  reset: () => invoke('database:reset'),
});
