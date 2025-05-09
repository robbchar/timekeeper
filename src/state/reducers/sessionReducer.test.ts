import { describe, it, expect } from 'vitest';
import { sessionReducer } from './sessionReducer';
import { ActionType } from '@/types/state';
import type { Session, Action } from '@/types/state';

describe('sessionReducer', () => {
  const mockSession: Session = {
    id: '1',
    projectId: '1',
    startTime: new Date('2024-01-01T10:00:00'),
    notes: 'Test session',
    tags: ['test'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  it('should start a session', () => {
    const initialState: Session[] = [];
    const action = {
      type: ActionType.START_SESSION,
      payload: mockSession,
    };

    const newState = sessionReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0]).toEqual(mockSession);
  });

  it('should stop a session', () => {
    const initialState: Session[] = [mockSession];
    const action = {
      type: ActionType.STOP_SESSION,
      payload: { id: '1' },
    };

    const newState = sessionReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0].endTime).toBeInstanceOf(Date);
    expect(newState[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should update a session', () => {
    const initialState: Session[] = [mockSession];
    const action = {
      type: ActionType.UPDATE_SESSION,
      payload: { id: '1', notes: 'Updated notes' },
    };

    const newState = sessionReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0].notes).toBe('Updated notes');
    expect(newState[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should delete a session', () => {
    const initialState: Session[] = [mockSession];
    const action = {
      type: ActionType.DELETE_SESSION,
      payload: '1',
    };

    const newState = sessionReducer(initialState, action);
    expect(newState).toHaveLength(0);
  });

  it('should return initial state for unknown action', () => {
    const initialState: Session[] = [mockSession];
    const action: Action = {
      type: 'UNKNOWN_ACTION' as ActionType,
      payload: null,
    };

    const newState = sessionReducer(initialState, action);
    expect(newState).toEqual(initialState);
  });
});
