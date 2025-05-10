export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

export enum ActionType {
  // Project actions
  ADD_PROJECT = 'ADD_PROJECT',
  UPDATE_PROJECT = 'UPDATE_PROJECT',
  DELETE_PROJECT = 'DELETE_PROJECT',

  // Session actions
  CREATE_SESSION = 'CREATE_SESSION',
  PAUSE_SESSION = 'PAUSE_SESSION',
  RESUME_SESSION = 'RESUME_SESSION',
  END_SESSION = 'END_SESSION',
  UPDATE_SESSION_NOTES = 'UPDATE_SESSION_NOTES',
  START_SESSION = 'START_SESSION',
  STOP_SESSION = 'STOP_SESSION',
  UPDATE_SESSION = 'UPDATE_SESSION',
  DELETE_SESSION = 'DELETE_SESSION',

  // Tag actions
  ADD_TAG = 'ADD_TAG',
  UPDATE_TAG = 'UPDATE_TAG',
  DELETE_TAG = 'DELETE_TAG',

  // Settings actions
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',

  // UI actions
  TOGGLE_THEME = 'TOGGLE_THEME',
  SET_CURRENT_PROJECT = 'SET_CURRENT_PROJECT',
  SET_LOADING = 'SET_LOADING',
  SET_ERROR = 'SET_ERROR',
  CLEAR_ERROR = 'CLEAR_ERROR',
}

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settings {
  timeFormat: '12h' | '24h';
  defaultProject: string | undefined;
}

export interface UIState {
  theme: Theme;
  error: string | undefined;
  currentProject: string | undefined;
  isTimerRunning: boolean;
  isLoading: boolean;
}

export interface AppState {
  projects: Project[];
  sessions: Session[];
  tags: Tag[];
  settings: Settings;
  ui: UIState;
}

export interface Action {
  type: ActionType;
  payload?:
    | Project
    | Session
    | Tag
    | Settings
    | UIState
    | string
    | boolean
    | null
    | Partial<Project>
    | Partial<Session>
    | Partial<Tag>
    | Partial<Settings>
    | Partial<UIState>;
}
