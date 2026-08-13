import { setupTestDatabase, teardownTestDatabase } from '@/test-utils/db-test-setup';
import { seedProjects } from '@/test-utils/db-test-data-setup';

/**
 * Exercises the full renderer→IPC→SQLite path for reopening a finished
 * session, which is what continuing a previous session depends on.
 */
describe('reopenSession', () => {
  // Handlers bind to the database instance they were registered with, so the
  // database is set up once per file rather than per test. Each test creates
  // its own session, so they stay independent regardless.
  beforeAll(async () => {
    const db = await setupTestDatabase();
    await seedProjects(db, [
      {
        projectId: 1,
        name: 'Contract work',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const createFinishedSession = async (duration: number) => {
    const created = await window.database.createSession(1, 'first sitting');
    const sessionId = created.record.sessionId;
    await window.database.endSession(sessionId, duration);
    return sessionId;
  };

  it('clears the end time so the session reads as in progress again', async () => {
    const sessionId = await createFinishedSession(47);

    const before = await window.database.getSessions();
    expect(before.find(s => s.sessionId === sessionId)?.endTime).not.toBeNull();

    await window.database.reopenSession(sessionId);

    const after = await window.database.getSessions();
    expect(after.find(s => s.sessionId === sessionId)?.endTime).toBeNull();
  });

  it('preserves the duration already accumulated', async () => {
    const sessionId = await createFinishedSession(47);

    await window.database.reopenSession(sessionId);

    const sessions = await window.database.getSessions();
    expect(sessions.find(s => s.sessionId === sessionId)?.duration).toBe(47);
  });

  it('leaves the original start time alone', async () => {
    const sessionId = await createFinishedSession(47);
    const before = await window.database.getSessions();
    const originalStart = before.find(s => s.sessionId === sessionId)?.startTime;

    await window.database.reopenSession(sessionId);

    const after = await window.database.getSessions();
    expect(after.find(s => s.sessionId === sessionId)?.startTime).toBe(originalStart);
  });

  it('returns the reopened record', async () => {
    const sessionId = await createFinishedSession(47);

    const result = await window.database.reopenSession(sessionId);

    expect(result.changes).toBe(1);
    expect(result.record.sessionId).toBe(sessionId);
    expect(result.record.endTime).toBeNull();
  });

  it('lets a subsequent endSession write the combined total', async () => {
    const sessionId = await createFinishedSession(47);
    await window.database.reopenSession(sessionId);

    await window.database.endSession(sessionId, 77);

    const sessions = await window.database.getSessions();
    const session = sessions.find(s => s.sessionId === sessionId);
    expect(session?.duration).toBe(77);
    expect(session?.endTime).not.toBeNull();
  });
});
