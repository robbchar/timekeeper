export enum Theme {
  LIGHT = 'light',
  DARK = 'dark'
}

export enum ActionType {
  // Project actions
  ADD_PROJECT = 'ADD_PROJECT',
  UPDATE_PROJECT = 'UPDATE_PROJECT',
  DELETE_PROJECT = 'DELETE_PROJECT',
  
  // Session actions
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
  SET_ERROR = 'SET_ERROR'
}

export interface Project {
  id: string;
  name: string;
  description?: string;
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
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settings {
  defaultProject?: string;
  timeFormat: '12h' | '24h';
  timerRounding: number; // in minutes
  autoStartBreaks: boolean;
  breakDuration: number; // in minutes
}

export interface UIState {
  theme: Theme;
  currentProject: string | null;
  isTimerRunning: boolean;
  isLoading: boolean;
  error: string | null;
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
  payload?: any;
} 