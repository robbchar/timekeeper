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

/**
 * Database/IPC shape for `sessions` rows.
 *
 * Boundary rule:
 * - DB/IPC layer uses `string` timestamps (ISO 8601)
 * - UI/domain layer uses `Date` timestamps
 */
export interface SessionDatabase {
  sessionId: number;
  projectId: number;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  notes: string | null;
  // These may exist depending on migrations / schema version.
  status?: SessionStatus;
  createdAt?: string;
  updatedAt?: string;
}

// Type for database operations
export type SessionCreate = Session;
export type SessionUpdate = Pick<Session, 'sessionId' | 'notes' | 'duration'>;

export interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
}

export interface CreateSessionParams {
  sessionId?: number;
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

export interface GetSessionsAction {
  type: ActionType.GET_SESSIONS;
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
  | GetSessionsAction
  | StartSessionAction
  | UpdateSessionAction
  | DeleteSessionAction;
