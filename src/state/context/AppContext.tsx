import React, { createContext, useReducer, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ProjectAction } from '@/types/project';
import type { TagAction } from '@/types/tag';
import type { Settings, AppState } from '@/types/state';
import { Theme, ActionType } from '@/types/state';
import type { SessionAction } from '@/types/session';
import { appReducer } from '@/state/reducers/appReducer';

export type AppAction =
  | ProjectAction
  | SessionAction
  | TagAction
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  | { type: ActionType.TOGGLE_THEME }
  | { type: ActionType.SET_ERROR; payload: string | undefined }
  | { type: ActionType.SET_CURRENT_PROJECT; payload: string }
  | { type: ActionType.SET_LOADING; payload: boolean }
  | { type: ActionType.SET_ERROR; payload: string | undefined }
  | { type: ActionType.CLEAR_ERROR }
  | { type: ActionType.RESTORE_STATE; payload: AppState };

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
