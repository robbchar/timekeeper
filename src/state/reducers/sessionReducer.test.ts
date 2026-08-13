import { sessionReducer } from './sessionReducer';
import type { SessionState, SessionStatus, SessionAction } from '@/types/session';
import { ActionType } from '@/types/state';

describe('sessionReducer', () => {
  const initialState: SessionState = {
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,
    restoredSessionId: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a new session', () => {
    const action: SessionAction = {
      type: ActionType.CREATE_SESSION,
      payload: {
        sessionId: 1,
        projectId: 1,
        notes: 'Test session',
      },
    };

    const newState = sessionReducer(initialState, action);

    expect(newState.currentSession).toBeDefined();
    expect(newState.currentSession?.projectId).toBe(1);
    expect(newState.currentSession?.notes).toBe('Test session');
    expect(newState.currentSession?.status).toBe('active');
    expect(newState.error).toBeNull();
  });

  it('should not create a new session if one is active', () => {
    const stateWithActiveSession: SessionState = {
      ...initialState,
      currentSession: {
        sessionId: 1,
        projectId: 1,
        startTime: new Date(),
        duration: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const action: SessionAction = {
      type: ActionType.CREATE_SESSION,
      payload: {
        sessionId: 2,
        projectId: 2,
      },
    };

    const newState = sessionReducer(stateWithActiveSession, action);

    expect(newState.currentSession).toBe(stateWithActiveSession.currentSession);
    expect(newState.error).toBe('Cannot start a new session while another is active');
  });

  it('should pause an active session', () => {
    const stateWithActiveSession: SessionState = {
      ...initialState,
      currentSession: {
        sessionId: 1,
        projectId: 1,
        startTime: new Date(),
        duration: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const action: SessionAction = { type: ActionType.PAUSE_SESSION };

    const newState = sessionReducer(stateWithActiveSession, action);

    expect(newState.currentSession?.status).toBe('paused');
    expect(newState.error).toBeNull();
  });

  it('should resume a paused session', () => {
    const startTime = new Date('2024-01-01T10:00:00');
    const resumeTime = new Date('2024-01-01T11:00:00');

    // Set initial time
    vi.setSystemTime(startTime);

    const stateWithPausedSession: SessionState = {
      ...initialState,
      currentSession: {
        sessionId: 1,
        projectId: 1,
        startTime,
        duration: 0,
        status: 'paused',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    // Advance to resume time
    vi.setSystemTime(resumeTime);

    const action: SessionAction = { type: ActionType.RESUME_SESSION };

    const newState = sessionReducer(stateWithPausedSession, action);

    expect(newState.currentSession?.status).toBe('active');
    expect(newState.error).toBeNull();
  });

  it('should end a session', () => {
    const startTime = new Date('2024-01-01T10:00:00');
    vi.setSystemTime(startTime);

    const stateWithActiveSession: SessionState = {
      ...initialState,
      currentSession: {
        sessionId: 1,
        projectId: 1,
        startTime,
        duration: 0,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const action: SessionAction = {
      type: ActionType.END_SESSION,
      payload: { sessionId: 1, duration: 3600000 },
    };

    const newState = sessionReducer(stateWithActiveSession, action);

    expect(newState.currentSession).toBeNull();
    expect(newState.sessions).toHaveLength(1);
    expect(newState.sessions[0].status).toBe('completed');
    expect(newState.sessions[0].endTime).toBeDefined();
    expect(newState.sessions[0].duration).toBe(3600000); // 1 hour in milliseconds
    expect(newState.error).toBeNull();
  });

  it('should update session notes', () => {
    const testSession = {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active' as SessionStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const stateWithActiveSession: SessionState = {
      ...initialState,
      sessions: [testSession],
    };

    const action: SessionAction = {
      type: ActionType.UPDATE_SESSION_NOTES,
      payload: {
        sessionId: 1,
        notes: 'Updated notes',
      },
    };

    const newState = sessionReducer(stateWithActiveSession, action);
    expect(newState.sessions[0].notes).toBe('Updated notes');
    expect(newState.error).toBeNull();
  });

  describe('RESTORE_SESSION', () => {
    const unfinishedSession = {
      sessionId: 9,
      projectId: 1,
      startTime: new Date(),
      duration: 240,
      status: 'active' as SessionStatus,
    };

    const restoreAction: SessionAction = {
      type: ActionType.RESTORE_SESSION,
      payload: unfinishedSession,
    };

    it('adopts the session as the current one', () => {
      const newState = sessionReducer(initialState, restoreAction);

      expect(newState.currentSession).toEqual(unfinishedSession);
    });

    it('flags it so the timer knows to resume counting', () => {
      const newState = sessionReducer(initialState, restoreAction);

      expect(newState.restoredSessionId).toBe(unfinishedSession.sessionId);
    });

    it('leaves a session that is already running untouched', () => {
      const running = { ...unfinishedSession, sessionId: 1, duration: 0 };
      const stateWithRunningSession: SessionState = {
        ...initialState,
        currentSession: running,
      };

      const newState = sessionReducer(stateWithRunningSession, restoreAction);

      expect(newState.currentSession).toEqual(running);
      expect(newState.restoredSessionId).toBeNull();
    });

    it('replaces a continued session in the list rather than duplicating it', () => {
      // A continued session is already in `sessions`, unlike a brand new one.
      const listed = { ...unfinishedSession, duration: 240 };
      const restored = sessionReducer(
        { ...initialState, sessions: [listed] },
        { type: ActionType.RESTORE_SESSION, payload: listed }
      );

      const ended = sessionReducer(restored, {
        type: ActionType.END_SESSION,
        payload: { sessionId: listed.sessionId, duration: 300 },
      });

      expect(ended.sessions).toHaveLength(1);
      expect(ended.sessions[0].duration).toBe(300);
    });

    it('still appends a session that was not already listed', () => {
      const restored = sessionReducer(initialState, restoreAction);

      const ended = sessionReducer(restored, {
        type: ActionType.END_SESSION,
        payload: { sessionId: unfinishedSession.sessionId, duration: 300 },
      });

      expect(ended.sessions).toHaveLength(1);
    });

    it('clears the flag once the session ends', () => {
      const restored = sessionReducer(initialState, restoreAction);

      const ended = sessionReducer(restored, {
        type: ActionType.END_SESSION,
        payload: { sessionId: unfinishedSession.sessionId, duration: 300 },
      });

      expect(ended.restoredSessionId).toBeNull();
      expect(ended.currentSession).toBeNull();
    });
  });
});
