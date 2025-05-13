import React, { createContext, useReducer, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SessionState } from '@/types/session';
import type { Project, Tag, Settings, UIState } from '@/types/state';
import { Theme, ActionType } from '@/types/state';
import { appReducer } from '@/state/reducers/appReducer';

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
  | { type: ActionType.CREATE_SESSION; payload: { projectId: number; notes?: string } }
  | { type: ActionType.PAUSE_SESSION }
  | { type: ActionType.RESUME_SESSION }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { notes: string } }
  | { type: ActionType.ADD_TAG; payload: Tag }
  | { type: ActionType.UPDATE_TAG; payload: Tag }
  | { type: ActionType.DELETE_TAG; payload: string }
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  | { type: ActionType.TOGGLE_THEME }
  | { type: ActionType.SET_ERROR; payload: string | undefined }
  | { type: ActionType.SET_CURRENT_PROJECT; payload: string };

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

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <div data-testid="app-context">
      <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
    </div>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
