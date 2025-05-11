import { Settings, Action, ActionType } from '@/types/state';

const initialState: Settings = {
  timeFormat: '24h',
  defaultProject: undefined,
};

export const settingsReducer = (state: Settings = initialState, action: Action): Settings => {
  switch (action.type) {
    case ActionType.UPDATE_SETTINGS: {
      if (
        !action.payload ||
        typeof action.payload === 'string' ||
        typeof action.payload === 'boolean'
      ) {
        return state;
      }
      const updatedSettings = action.payload as Partial<Settings>;
      return {
        ...state,
        ...updatedSettings,
      };
    }

    default:
      return state;
  }
};
