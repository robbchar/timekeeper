import { describe, it, expect } from 'vitest';
import { uiReducer } from './uiReducer';
import { ActionType, Theme } from '@/types/state';
import type { UIState, Action } from '@/types/state';

describe('uiReducer', () => {
  const mockUIState: UIState = {
    theme: Theme.LIGHT,
    currentProject: null,
    isTimerRunning: false,
    isLoading: false,
    error: null,
  };

  it('should toggle theme', () => {
    const initialState: UIState = mockUIState;
    const action = {
      type: ActionType.TOGGLE_THEME,
    };

    const newState = uiReducer(initialState, action);
    expect(newState.theme).toBe(Theme.DARK);

    const newState2 = uiReducer(newState, action);
    expect(newState2.theme).toBe(Theme.LIGHT);
  });

  it('should set current project', () => {
    const initialState: UIState = mockUIState;
    const action = {
      type: ActionType.SET_CURRENT_PROJECT,
      payload: '1',
    };

    const newState = uiReducer(initialState, action);
    expect(newState.currentProject).toBe('1');
  });

  it('should set loading state', () => {
    const initialState: UIState = mockUIState;
    const action = {
      type: ActionType.SET_LOADING,
      payload: true,
    };

    const newState = uiReducer(initialState, action);
    expect(newState.isLoading).toBe(true);
  });

  it('should set error state', () => {
    const initialState: UIState = mockUIState;
    const action = {
      type: ActionType.SET_ERROR,
      payload: 'Test error',
    };

    const newState = uiReducer(initialState, action);
    expect(newState.error).toBe('Test error');
  });

  it('should return initial state for unknown action', () => {
    const initialState: UIState = mockUIState;
    const action: Action = {
      type: 'UNKNOWN_ACTION' as ActionType,
      payload: null,
    };

    const newState = uiReducer(initialState, action);
    expect(newState).toEqual(initialState);
  });
});
