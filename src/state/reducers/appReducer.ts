import type { AppState } from '@/types/state';
import { ActionType } from '@/types/state';
import type { SessionAction } from '@/types/session';
import type { AppAction } from '@/state/context/AppContext';
import { sessionReducer } from './sessionReducer';
import { projectReducer } from './projectReducer';
import { tagReducer } from './tagReducer';
import { settingsReducer } from './settingsReducer';
import { uiReducer } from './uiReducer';

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case ActionType.RESTORE_STATE:
      return action.payload as AppState;

    case ActionType.CREATE_SESSION:
    case ActionType.PAUSE_SESSION:
    case ActionType.RESUME_SESSION:
    case ActionType.END_SESSION:
    case ActionType.UPDATE_SESSION_NOTES:
    case ActionType.UPDATE_SESSION_DURATION:
    case ActionType.START_SESSION:
    case ActionType.UPDATE_SESSION:
    case ActionType.DELETE_SESSION:
    case ActionType.SET_SESSIONS:
      return {
        ...state,
        sessions: sessionReducer(state.sessions, action as SessionAction),
      };

    case ActionType.ADD_PROJECT:
    case ActionType.UPDATE_PROJECT:
    case ActionType.DELETE_PROJECT:
      return {
        ...state,
        projects: projectReducer(state.projects, action),
      };

    case ActionType.ADD_TAG:
    case ActionType.UPDATE_TAG:
    case ActionType.DELETE_TAG:
      return {
        ...state,
        tags: tagReducer(state.tags, action),
      };

    case ActionType.UPDATE_SETTINGS:
      return {
        ...state,
        settings: settingsReducer(state.settings, action),
      };

    case ActionType.TOGGLE_THEME:
    case ActionType.SET_CURRENT_PROJECT:
    case ActionType.SET_LOADING:
    case ActionType.SET_ERROR:
    case ActionType.CLEAR_ERROR:
      return {
        ...state,
        ui: uiReducer(state.ui, action),
      };

    default:
      return state;
  }
};
