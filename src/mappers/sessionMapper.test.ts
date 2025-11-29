import type { SessionDatabase } from '@/types/session';
import { mapDbSessionToSession, mapDbSessionsToSessions } from './sessionMapper';

describe('sessionMapper', () => {
  it('maps a SessionDatabase row to a Session and parses timestamps', () => {
    const row: SessionDatabase = {
      sessionId: 10,
      projectId: 2,
      startTime: '2025-01-01T10:00:00.000Z',
      endTime: '2025-01-01T11:00:00.000Z',
      duration: 60_000,
      notes: 'Notes',
      status: 'completed',
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-01T11:00:00.000Z',
    };

    const session = mapDbSessionToSession(row);

    expect(session.sessionId).toBe(10);
    expect(session.projectId).toBe(2);
    expect(session.startTime).toBeInstanceOf(Date);
    expect(session.endTime).toBeInstanceOf(Date);
    expect(session.duration).toBe(60_000);
    expect(session.notes).toBe('Notes');
    expect(session.status).toBe('completed');
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeInstanceOf(Date);
  });

  it('derives status when status is missing', () => {
    const activeRow: SessionDatabase = {
      sessionId: 1,
      projectId: 1,
      startTime: '2025-01-01T10:00:00.000Z',
      endTime: null,
      duration: null,
      notes: null,
    };
    expect(mapDbSessionToSession(activeRow).status).toBe('active');

    const completedRow: SessionDatabase = {
      ...activeRow,
      sessionId: 2,
      endTime: '2025-01-01T11:00:00.000Z',
    };
    expect(mapDbSessionToSession(completedRow).status).toBe('completed');
  });

  it('maps many SessionDatabase rows to Sessions', () => {
    const rows: SessionDatabase[] = [
      {
        sessionId: 1,
        projectId: 1,
        startTime: '2025-01-01T00:00:00.000Z',
        endTime: null,
        duration: 0,
        notes: null,
      },
      {
        sessionId: 2,
        projectId: 1,
        startTime: '2025-01-02T00:00:00.000Z',
        endTime: null,
        duration: 0,
        notes: null,
      },
    ];

    const sessions = mapDbSessionsToSessions(rows);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe(1);
    expect(sessions[1].sessionId).toBe(2);
  });
});
