import type { Session, SessionDatabase, SessionStatus } from '@/types/session';

function deriveStatus(dbSession: SessionDatabase): SessionStatus {
  if (dbSession.status) return dbSession.status;
  // Fallback for older schema versions / rows without `status`.
  return dbSession.endTime ? 'completed' : 'active';
}

export function mapDbSessionToSession(dbSession: SessionDatabase): Session {
  return {
    sessionId: dbSession.sessionId,
    projectId: dbSession.projectId,
    startTime: new Date(dbSession.startTime),
    endTime: dbSession.endTime ? new Date(dbSession.endTime) : undefined,
    duration: dbSession.duration ?? 0,
    notes: dbSession.notes ?? undefined,
    status: deriveStatus(dbSession),
    createdAt: dbSession.createdAt ? new Date(dbSession.createdAt) : undefined,
    updatedAt: dbSession.updatedAt ? new Date(dbSession.updatedAt) : undefined,
  };
}

export function mapDbSessionsToSessions(dbSessions: SessionDatabase[]): Session[] {
  return dbSessions.map(mapDbSessionToSession);
}
