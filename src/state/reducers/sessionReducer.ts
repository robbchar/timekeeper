import type { Session, SessionState, SessionAction } from '@/types/session';
import { ActionType } from '@/types/state';

const initialState: SessionState = {
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,
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

      return {
        ...state,
        currentSession: null,
        sessions: [...state.sessions, completedSession],
        error: null,
      };
    }

    case ActionType.UPDATE_SESSION_NOTES: {
      const session = state.sessions.find(s => s.sessionId === action.payload.sessionId);
      if (!session) {
        return {
          ...state,
          error: 'Session not found',
        };
      }

      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.sessionId === action.payload.sessionId ? { ...s, notes: action.payload.notes } : s
        ),
        error: null,
      };
    }

    case ActionType.DELETE_SESSION: {
      return {
        ...state,
        sessions: state.sessions.filter(s => s.sessionId !== action.payload.sessionId),
        error: null,
      };
    }

    case ActionType.UPDATE_SESSION_DURATION: {
      const session = state.sessions.find(s => s.sessionId === action.payload.sessionId);
      if (!session) {
        return {
          ...state,
          error: 'Session not found',
        };
      }
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.sessionId === action.payload.sessionId ? { ...s, duration: action.payload.duration } : s
        ),
        error: null,
      };
    }

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
