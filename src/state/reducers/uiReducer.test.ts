import { uiReducer } from './uiReducer';
import { ActionType, Theme } from '@/types/state';

describe('uiReducer', () => {
  const initialState = {
    theme: Theme.LIGHT,
    error: undefined,
    currentProject: undefined,
    isTimerRunning: false,
    isLoading: false,
  };

  it('should toggle theme', () => {
    const action = {
      type: ActionType.TOGGLE_THEME,
    };

    const state = uiReducer(initialState, action);
    expect(state.theme).toBe(Theme.DARK);
  });

  it('should set current project', () => {
    const action = {
      type: ActionType.SET_CURRENT_PROJECT,
      payload: '1',
    };

    const state = uiReducer(initialState, action);
    expect(state.currentProject).toBe(1);
  });

  it('should set loading state', () => {
    const action = {
      type: ActionType.SET_LOADING,
      payload: true,
    };

    const state = uiReducer(initialState, action);
    expect(state.isLoading).toBe(true);
  });

  it('should set error state', () => {
    const action = {
      type: ActionType.SET_ERROR,
      payload: 'Test error',
    };

    const state = uiReducer(initialState, action);
    expect(state.error).toBe('Test error');
  });

  it('should clear error state', () => {
    const stateWithError = {
      ...initialState,
      error: 'Test error',
    };

    const action = {
      type: ActionType.CLEAR_ERROR,
    };

    const state = uiReducer(stateWithError, action);
    expect(state.error).toBeUndefined();
  });

  it('should return initial state for unknown action', () => {
    const state = uiReducer(initialState, { type: 'UNKNOWN' as ActionType });
    expect(state).toEqual(initialState);
  });
});
