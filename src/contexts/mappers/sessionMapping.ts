import type { Session, SessionDatabase, SessionStatus } from '@/types/session';

function deriveStatus(dbSession: SessionDatabase): SessionStatus {
  // The DB does not persist paused/active semantics; we infer a minimal status.
  return dbSession.endTime ? 'completed' : 'active';
}

export function toDomainSession(dbSession: SessionDatabase): Session {
  return {
    sessionId: dbSession.sessionId,
    projectId: dbSession.projectId,
    startTime: new Date(dbSession.startTime),
    endTime: dbSession.endTime ? new Date(dbSession.endTime) : undefined,
    duration: dbSession.duration ?? 0,
    notes: dbSession.notes ?? undefined,
    status: deriveStatus(dbSession),
  };
}
