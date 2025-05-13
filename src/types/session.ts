import { ActionType } from './state';

export type SessionStatus = 'active' | 'paused' | 'completed';

export interface Session {
  id: number;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in milliseconds
  notes?: string;
  status: SessionStatus;
  lastPausedAt?: Date;
  totalPausedTime: number; // in milliseconds
}

export interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
}

export interface CreateSessionParams {
  projectId: string;
  notes?: string;
}

export interface UpdateSessionParams {
  notes?: string;
}

export type SessionAction =
  | { type: ActionType.CREATE_SESSION; payload: { projectId: string; notes?: string } }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { notes: string } }
  | { type: ActionType.SET_ERROR; payload: string }
  | { type: ActionType.CLEAR_ERROR };
