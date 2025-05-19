import { ActionType } from '@/types/state';

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface Session {
  id: number;
  projectId: number;
  startTime: Date;
  endTime?: Date;
  duration: number; // in milliseconds
  notes?: string;
  status: SessionStatus;
  lastPausedAt?: Date;
  totalPausedTime: number; // in milliseconds
  tags: number[];
  createdAt: Date;
  updatedAt: Date;
}

// Database-specific types
export interface SessionDatabase {
  id: number;
  project_id: number;
  start_time: string;
  end_time?: string;
  duration?: number;
  notes?: string;
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
}

export interface UpdateSessionNotesAction {
  type: ActionType.UPDATE_SESSION_NOTES;
  payload: { notes: string };
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

export type SessionAction =
  | CreateSessionAction
  | EndSessionAction
  | UpdateSessionNotesAction
  | PauseSessionAction
  | ResumeSessionAction
  | SetErrorAction
  | ClearErrorAction;
