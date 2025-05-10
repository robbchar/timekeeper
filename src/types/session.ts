export type SessionStatus = 'active' | 'paused' | 'completed';

export interface Session {
  id: string;
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
