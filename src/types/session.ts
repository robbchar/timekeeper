import { ActionType } from '@/types/state';

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface Session {
  sessionId: number;
  projectId: number;
  startTime: Date;
  endTime?: Date;
  duration: number; // in milliseconds
  notes?: string;
  status: SessionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
}

export interface CreateSessionParams {
  projectId: number;
  notes?: string;
}

export interface UpdateSessionParams {
  notes?: string;
}

// Session action types
export interface CreateSessionAction {
  type: ActionType.CREATE_SESSION;
  payload: { sessionId: number; projectId: number; notes?: string };
}

export interface EndSessionAction {
  type: ActionType.END_SESSION;
  payload: { sessionId: number; duration: number };
}

export interface UpdateSessionNotesAction {
  type: ActionType.UPDATE_SESSION_NOTES;
  payload: { sessionId: number; notes: string };
}

export interface UpdateSessionDurationAction {
  type: ActionType.UPDATE_SESSION_DURATION;
  payload: { sessionId: number; duration: number };
}

export interface DeleteSessionAction {
  type: ActionType.DELETE_SESSION;
  payload: { sessionId: number };
}

export interface PauseSessionAction {
  type: ActionType.PAUSE_SESSION;
}

export interface ResumeSessionAction {
  type: ActionType.RESUME_SESSION;
}

export interface SetErrorAction {
  type: ActionType.SET_ERROR;
  payload: string;
}

export interface ClearErrorAction {
  type: ActionType.CLEAR_ERROR;
}

export interface SetSessionsAction {
  type: ActionType.SET_SESSIONS;
  payload: Session[];
}

export interface StartSessionAction {
  type: ActionType.START_SESSION;
  payload: { sessionId: number; projectId: number; notes?: string };
}

export interface EndSessionAction {
  type: ActionType.END_SESSION;
  payload: { sessionId: number; duration: number };
}

export interface UpdateSessionAction {
  type: ActionType.UPDATE_SESSION;
  payload: { sessionId: number; notes?: string; duration: number };
}

export interface DeleteSessionAction {
  type: ActionType.DELETE_SESSION;
  payload: { sessionId: number };
}

export type SessionAction =
  | CreateSessionAction
  | EndSessionAction
  | UpdateSessionNotesAction
  | UpdateSessionDurationAction
  | PauseSessionAction
  | ResumeSessionAction
  | SetErrorAction
  | ClearErrorAction
  | SetSessionsAction
  | StartSessionAction
  | UpdateSessionAction
  | DeleteSessionAction;
