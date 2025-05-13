import type { Session, SessionState } from '@/types/session';
import { ActionType } from '@/types/state';

export type SessionAction =
  | { type: ActionType.CREATE_SESSION; payload: { projectId: string; notes?: string } }
  | { type: ActionType.PAUSE_SESSION }
  | { type: ActionType.RESUME_SESSION }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { notes: string } }
  | { type: ActionType.SET_ERROR; payload: string }
  | { type: ActionType.CLEAR_ERROR };

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
    case ActionType.CREATE_SESSION: {
      if (state.currentSession) {
        return {
          ...state,
          error: 'Cannot start a new session while another is active',
        };
      }

      const newSession: Session = {
        id: Date.now(), // Use timestamp as temporary ID until database assigns one
        projectId: action.payload.projectId,
        startTime: new Date(),
        duration: 0,
        notes: action.payload.notes,
        status: 'active',
        totalPausedTime: 0,
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
          lastPausedAt: new Date(),
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

      const pausedTime = state.currentSession.lastPausedAt
        ? new Date().getTime() - state.currentSession.lastPausedAt.getTime()
        : 0;

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          status: 'active',
          lastPausedAt: undefined,
          totalPausedTime: state.currentSession.totalPausedTime + pausedTime,
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
      const duration =
        endTime.getTime() -
        state.currentSession.startTime.getTime() -
        state.currentSession.totalPausedTime;

      const completedSession: Session = {
        ...state.currentSession,
        endTime,
        duration,
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
      if (!state.currentSession) {
        return {
          ...state,
          error: 'No active session to update',
        };
      }

      return {
        ...state,
        currentSession: {
          ...state.currentSession,
          notes: action.payload.notes,
        },
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
