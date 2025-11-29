import type { Session, SessionDatabase, SessionStatus } from '@/types/session';

const deriveStatus = (db: Pick<SessionDatabase, 'status' | 'endTime'>): SessionStatus => {
  if (db.status && db.status !== null) return db.status;
  return db.endTime ? 'completed' : 'active';
};

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

export function mapDbSessionsToSessions(dbSessions: readonly SessionDatabase[]): Session[] {
  return dbSessions.map(mapDbSessionToSession);
}
