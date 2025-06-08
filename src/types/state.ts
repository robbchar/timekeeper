import type { SessionState, Session } from './session';
import type { Project } from './project';
import type { Tag } from './tag';

export type { Project } from './project';
export type { Tag } from './tag';

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
  UPDATE_SESSION_DURATION = 'UPDATE_SESSION_DURATION',
  START_SESSION = 'START_SESSION',
  UPDATE_SESSION = 'UPDATE_SESSION',
  DELETE_SESSION = 'DELETE_SESSION',
  SET_SESSIONS = 'SET_SESSIONS',
  GET_SESSIONS = 'GET_SESSIONS',
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

  // State management
  RESTORE_STATE = 'RESTORE_STATE',
}

export interface Settings {
  timeFormat: '12h' | '24h';
  defaultProject: number | undefined;
}

export interface UIState {
  theme: Theme;
  error: string | undefined;
  currentProject: number | undefined;
  isTimerRunning: boolean;
  isLoading: boolean;
}

export interface AppState {
  projects: Project[];
  sessions: SessionState;
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
    | Partial<UIState>
    | AppState;
}
