import type { Session } from '@/types/session';
import type { SessionDatabase } from '@/types/session-database';

function toDate(value: string): Date {
  // SQLite returns TEXT; we store ISO strings. `new Date(isoString)` preserves existing behavior.
  return new Date(value);
}

function toOptionalDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  return toDate(value);
}

/**
 * Convert a DB/IPC session into the domain session used by UI/state.
 *
 * This is the single source of truth for the "string-from-SQLite" -> "Date-in-UI" boundary.
 */
export function dbSessionToSession(db: SessionDatabase): Session {
  const startTime = toDate(db.startTime);
  const endTime = toOptionalDate(db.endTime);

  return {
    sessionId: db.sessionId,
    projectId: db.projectId,
    startTime,
    endTime,
    duration: db.duration ?? 0,
    notes: db.notes ?? undefined,
    // No schema changes: status is derived for domain completeness.
    status: endTime ? 'completed' : 'active',
  };
}

export function dbSessionsToSessions(rows: SessionDatabase[]): Session[] {
  return rows.map(dbSessionToSession);
}
