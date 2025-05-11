import { UIState, Action, ActionType, Theme } from '@/types/state';

const initialState: UIState = {
  theme: Theme.LIGHT,
  error: undefined,
  currentProject: undefined,
  isTimerRunning: false,
  isLoading: false,
};

export const uiReducer = (state: UIState = initialState, action: Action): UIState => {
  switch (action.type) {
    case ActionType.TOGGLE_THEME:
      return {
        ...state,
        theme: state.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT,
      };

    case ActionType.SET_CURRENT_PROJECT:
      if (typeof action.payload !== 'string' && action.payload !== undefined) {
        return state;
      }
      return {
        ...state,
        currentProject: action.payload,
      };

    case ActionType.SET_LOADING:
      if (typeof action.payload !== 'boolean') {
        return state;
      }
      return {
        ...state,
        isLoading: action.payload,
      };

    case ActionType.SET_ERROR:
      if (typeof action.payload !== 'string' && action.payload !== undefined) {
        return state;
      }
      return {
        ...state,
        error: action.payload,
      };

    case ActionType.CLEAR_ERROR:
      return {
        ...state,
        error: undefined,
      };

    default:
      return state;
  }
};
