import { ActionType } from './state';

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

export type SessionAction =
  | { type: ActionType.CREATE_SESSION; payload: { projectId: number; notes?: string } }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { notes: string } }
  | { type: ActionType.SET_ERROR; payload: string }
  | { type: ActionType.CLEAR_ERROR };
