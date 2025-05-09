import type { Settings, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const settingsReducer = (state: Settings, action: Action): Settings => {
  switch (action.type) {
    case ActionType.UPDATE_SETTINGS:
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
};
