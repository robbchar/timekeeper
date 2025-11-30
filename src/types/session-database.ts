/**
 * Session shape as it crosses the Electron IPC boundary / comes directly from SQLite.
 *
 * SQLite stores DATETIME values as TEXT (ISO strings in our app).
 * Keep these as strings here, and convert to real `Date` objects only in the renderer/domain layer.
 */
export interface SessionDatabase {
  sessionId: number;
  projectId: number;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  notes: string | null;
}
