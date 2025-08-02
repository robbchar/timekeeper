import { AppState, Theme } from '@/types/state';

export const initialState: AppState = {
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
