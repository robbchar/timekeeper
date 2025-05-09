import type { AppState, Action } from '@/types/state';
import { ActionType, Theme } from '@/types/state';
import { projectReducer } from '@/state/reducers/projectReducer';
import { sessionReducer } from '@/state/reducers/sessionReducer';
import { tagReducer } from '@/state/reducers/tagReducer';
import { settingsReducer } from '@/state/reducers/settingsReducer';
import { uiReducer } from '@/state/reducers/uiReducer';

export const initialState: AppState = {
  projects: [],
  sessions: [],
  tags: [],
  settings: {
    timeFormat: '24h',
    timerRounding: 5,
    autoStartBreaks: false,
    breakDuration: 5
  },
  ui: {
    theme: Theme.LIGHT,
    currentProject: null,
    isTimerRunning: false,
    isLoading: false,
    error: null
  }
};

export const rootReducer = (state: AppState = initialState, action: Action): AppState => {
  switch (action.type) {
    // Project actions
    case ActionType.ADD_PROJECT:
    case ActionType.UPDATE_PROJECT:
    case ActionType.DELETE_PROJECT:
      return {
        ...state,
        projects: projectReducer(state.projects, action)
      };

    // Session actions
    case ActionType.START_SESSION:
    case ActionType.STOP_SESSION:
    case ActionType.UPDATE_SESSION:
    case ActionType.DELETE_SESSION:
      return {
        ...state,
        sessions: sessionReducer(state.sessions, action)
      };

    // Tag actions
    case ActionType.ADD_TAG:
    case ActionType.UPDATE_TAG:
    case ActionType.DELETE_TAG:
      return {
        ...state,
        tags: tagReducer(state.tags, action)
      };

    // Settings actions
    case ActionType.UPDATE_SETTINGS:
      return {
        ...state,
        settings: settingsReducer(state.settings, action)
      };

    // UI actions
    case ActionType.TOGGLE_THEME:
    case ActionType.SET_CURRENT_PROJECT:
    case ActionType.SET_LOADING:
    case ActionType.SET_ERROR:
      return {
        ...state,
        ui: uiReducer(state.ui, action)
      };

    default:
      return state;
  }
}; 