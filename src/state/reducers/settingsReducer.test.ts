import { describe, it, expect } from 'vitest';
import { settingsReducer } from './settingsReducer';
import { ActionType } from '@/types/state';
import type { Settings, Action } from '@/types/state';

describe('settingsReducer', () => {
  const mockSettings: Settings = {
    timeFormat: '24h',
    timerRounding: 5,
    autoStartBreaks: false,
    breakDuration: 5,
  };

  it('should update settings', () => {
    const initialState: Settings = mockSettings;
    const action = {
      type: ActionType.UPDATE_SETTINGS,
      payload: { timeFormat: '12h', timerRounding: 10 },
    };

    const newState = settingsReducer(initialState, action);
    expect(newState).toEqual({
      ...mockSettings,
      timeFormat: '12h',
      timerRounding: 10,
    });
  });

  it('should return initial state for unknown action', () => {
    const initialState: Settings = mockSettings;
    const action: Action = {
      type: 'UNKNOWN_ACTION' as ActionType,
      payload: null,
    };

    const newState = settingsReducer(initialState, action);
    expect(newState).toEqual(initialState);
  });
});
