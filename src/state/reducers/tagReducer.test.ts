import { describe, it, expect } from 'vitest';
import { tagReducer } from './tagReducer';
import { ActionType } from '@/types/state';
import type { Tag } from '@/types/state';

describe('tagReducer', () => {
  const mockTag: Tag = {
    id: '1',
    name: 'Test Tag',
    color: '#FF0000',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  it('should add a tag', () => {
    const initialState: Tag[] = [];
    const action = {
      type: ActionType.ADD_TAG,
      payload: mockTag
    };

    const newState = tagReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0]).toEqual(mockTag);
  });

  it('should update a tag', () => {
    const initialState: Tag[] = [mockTag];
    const action = {
      type: ActionType.UPDATE_TAG,
      payload: { id: '1', name: 'Updated Tag' }
    };

    const newState = tagReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0].name).toBe('Updated Tag');
    expect(newState[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should delete a tag', () => {
    const initialState: Tag[] = [mockTag];
    const action = {
      type: ActionType.DELETE_TAG,
      payload: '1'
    };

    const newState = tagReducer(initialState, action);
    expect(newState).toHaveLength(0);
  });

  it('should return initial state for unknown action', () => {
    const initialState: Tag[] = [mockTag];
    const action = {
      type: 'UNKNOWN_ACTION',
      payload: null
    };

    const newState = tagReducer(initialState, action as any);
    expect(newState).toEqual(initialState);
  });
}); 