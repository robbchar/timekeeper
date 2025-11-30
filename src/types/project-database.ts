/**
 * Project shape as it crosses the Electron IPC boundary / comes directly from SQLite.
 *
 * SQLite stores DATETIME values as TEXT. Keep these as strings here, and convert to real `Date`
 * objects only in the renderer/domain layer.
 */
export interface ProjectDatabase {
  projectId: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
}
