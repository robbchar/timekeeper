import React, { createContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import { sessionReducer } from '@/state/reducers/sessionReducer';
import type { SessionState } from '@/types/session';
import type { Project, Tag, Settings, UIState } from '@/types/state';
import { Theme, ActionType } from '@/types/state';

interface AppState {
  projects: Project[];
  sessions: SessionState;
  tags: Tag[];
  settings: Settings;
  ui: UIState;
}

type AppAction =
  | { type: ActionType.ADD_PROJECT; payload: Project }
  | { type: ActionType.UPDATE_PROJECT; payload: Project }
  | { type: ActionType.DELETE_PROJECT; payload: string }
  | { type: ActionType.CREATE_SESSION; payload: { projectId: string; notes?: string } }
  | { type: ActionType.PAUSE_SESSION }
  | { type: ActionType.RESUME_SESSION }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { notes: string } }
  | { type: ActionType.ADD_TAG; payload: Tag }
  | { type: ActionType.UPDATE_TAG; payload: Tag }
  | { type: ActionType.DELETE_TAG; payload: string }
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  | { type: ActionType.TOGGLE_THEME }
  | { type: ActionType.SET_ERROR; payload: string | undefined };

const initialState: AppState = {
  projects: [],
  sessions: {
    currentSession: null,
    sessions: [],
    isLoading: false,
    error: null,
  },
  tags: [],
  settings: {
    timeFormat: '24h',
    defaultProject: undefined,
  },
  ui: {
    theme: Theme.LIGHT,
    error: undefined,
    currentProject: undefined,
    isTimerRunning: false,
    isLoading: false,
  },
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case ActionType.ADD_PROJECT:
      return {
        ...state,
        projects: [...state.projects, action.payload],
      };
    case ActionType.UPDATE_PROJECT:
      return {
        ...state,
        projects: state.projects.map(p => (p.id === action.payload.id ? action.payload : p)),
      };
    case ActionType.DELETE_PROJECT:
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
      };
    case ActionType.CREATE_SESSION:
    case ActionType.PAUSE_SESSION:
    case ActionType.RESUME_SESSION:
    case ActionType.END_SESSION:
    case ActionType.UPDATE_SESSION_NOTES:
      return {
        ...state,
        sessions: sessionReducer(state.sessions, action),
      };
    case ActionType.ADD_TAG:
      return {
        ...state,
        tags: [...state.tags, action.payload],
      };
    case ActionType.UPDATE_TAG:
      return {
        ...state,
        tags: state.tags.map(t => (t.id === action.payload.id ? action.payload : t)),
      };
    case ActionType.DELETE_TAG:
      return {
        ...state,
        tags: state.tags.filter(t => t.id !== action.payload),
      };
    case ActionType.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    case ActionType.TOGGLE_THEME:
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: state.ui.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT,
        },
      };
    case ActionType.SET_ERROR:
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload,
        },
      };
    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};
