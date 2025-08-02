import { describe, it, expect } from 'vitest';
import { settingsReducer } from './settingsReducer';
import { ActionType } from '@/types/state';
import type { Settings, Action } from '@/types/state';

describe('settingsReducer', () => {
  const mockSettings: Settings = {
    timeFormat: '24h',
    defaultProject: undefined,
  };

  it('should update settings', () => {
    const initialState: Settings = mockSettings;
    const action = {
      type: ActionType.UPDATE_SETTINGS,
      payload: { timeFormat: '12h' as const },
    };

    const newState = settingsReducer(initialState, action);
    expect(newState).toEqual({
      ...mockSettings,
      timeFormat: '12h',
    });
  });

  it('should return initial state for unknown action', () => {
    const initialState: Settings = mockSettings;
    const action: Action = {
      // @ts-expect-error - This is a test
      type: ActionType.ADD_PROJECT,
      payload: null,
    };

    const newState = settingsReducer(initialState, action);
    expect(newState).toEqual(initialState);
  });
});
