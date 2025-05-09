import type { UIState, Action } from '@/types/state';
import { ActionType, Theme } from '@/types/state';

export const uiReducer = (state: UIState, action: Action): UIState => {
  switch (action.type) {
    case ActionType.TOGGLE_THEME:
      return {
        ...state,
        theme: state.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT,
      };

    case ActionType.SET_CURRENT_PROJECT:
      return {
        ...state,
        currentProject: action.payload,
      };

    case ActionType.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    case ActionType.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
};
