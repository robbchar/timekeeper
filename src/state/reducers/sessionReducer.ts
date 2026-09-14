import type { Session, SessionState, SessionAction } from '@/types/session';
import { ActionType } from '@/types/state';

const initialState: SessionState = {
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,
  restoredSessionId: null,
};

/** Applies edits to a session wherever it is held: as the current session, in the list, or both. */
const applySessionChanges = (
  state: SessionState,
  sessionId: number,
  changes: Pick<Partial<Session>, 'notes' | 'duration'>
): SessionState => {
  const isCurrentSession = state.currentSession?.sessionId === sessionId;
  const isListed = state.sessions.some(s => s.sessionId === sessionId);

  if (!isCurrentSession && !isListed) {
    return { ...state, error: 'Session not found' };
  }

  return {
    ...state,
    currentSession:
      state.currentSession && isCurrentSession
        ? { ...state.currentSession, ...changes }
        : state.currentSession,
    sessions: state.sessions.map(s => (s.sessionId === sessionId ? { ...s, ...changes } : s)),
    error: null,
  };
};

export const sessionReducer = (
  state: SessionState = initialState,
  action: SessionAction
): SessionState => {
  switch (action.type) {
    case ActionType.SET_SESSIONS:
      return {
        ...state,
        sessions: action.payload as Session[],
        error: null,
      };

    case ActionType.CREATE_SESSION: {
      if (state.currentSession) {
        return {
          ...state,
          error: 'Cannot start a new session while another is active',
        };
      }

      const newSession: Session = {
        sessionId: action.payload.sessionId,
        projectId: action.payload.projectId,
        startTime: new Date(),
        duration: 0,
        notes: action.payload.notes,
        status: 'active',
      };

      return {
        ...state,
        currentSession: newSession,
        restoredSessionId: null,
        error: null,
      };
    }

    case ActionType.PAUSE_SESSION: {
      if (!state.currentSession || state.currentSession.status !== 'active') {
        return {
          ...state,
          error: 'No active session to pause',
        };
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          status: 'paused',
        },
        error: null,
      };
    }

    case ActionType.RESUME_SESSION: {
      if (!state.currentSession || state.currentSession.status !== 'paused') {
        return {
          ...state,
          error: 'No paused session to resume',
        };
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          status: 'active',
        },
        error: null,
      };
    }

    case ActionType.RESTORE_SESSION: {
      // Adopting an unfinished session must not clobber one already running.
      if (state.currentSession) {
        return state;
      }

      return {
        ...state,
        currentSession: action.payload,
        restoredSessionId: action.payload.sessionId,
        error: null,
      };
    }

    case ActionType.END_SESSION: {
      if (!state.currentSession) {
        return {
          ...state,
          error: 'No active session to end',
        };
      }

      const endTime = new Date();
      const completedSession: Session = {
        ...state.currentSession,
        endTime,
        duration: action.payload.duration,
        status: 'completed',
      };

      // A continued session is already in the list, so replace it rather than
      // appending a second copy of the same row.
      const isAlreadyListed = state.sessions.some(s => s.sessionId === completedSession.sessionId);

      return {
        ...state,
        currentSession: null,
        restoredSessionId: null,
        sessions: isAlreadyListed
          ? state.sessions.map(s =>
              s.sessionId === completedSession.sessionId ? completedSession : s
            )
          : [...state.sessions, completedSession],
        error: null,
      };
    }

    case ActionType.UPDATE_SESSION_NOTES:
      return applySessionChanges(state, action.payload.sessionId, { notes: action.payload.notes });

    case ActionType.DELETE_SESSION: {
      return {
        ...state,
        sessions: state.sessions.filter(s => s.sessionId !== action.payload.sessionId),
        error: null,
      };
    }

    case ActionType.UPDATE_SESSION_DURATION:
      return applySessionChanges(state, action.payload.sessionId, {
        duration: action.payload.duration,
      });

    case ActionType.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case ActionType.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};
