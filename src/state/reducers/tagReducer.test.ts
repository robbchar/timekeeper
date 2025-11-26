import { tagReducer } from './tagReducer';
import { ActionType } from '@/types/state';

describe('tagReducer', () => {
  it('should add a tag', () => {
    const tag = {
      id: 1,
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const action = {
      type: ActionType.ADD_TAG,
      payload: tag,
    };

    const state = tagReducer([], action);
    expect(state).toHaveLength(1);
    expect(state[0]).toEqual(tag);
  });

  it('should update a tag', () => {
    const tag = {
      id: 1,
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedTag = {
      id: tag.id,
      name: 'Updated Tag',
    };

    const action = {
      type: ActionType.UPDATE_TAG,
      payload: updatedTag,
    };

    const state = tagReducer([tag], action);
    expect(state).toHaveLength(1);
    expect(state[0].name).toBe('Updated Tag');
    expect(state[0].id).toBe(tag.id);
  });

  it('should delete a tag', () => {
    const tag = {
      id: 1,
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const action = {
      type: ActionType.DELETE_TAG,
      payload: String(tag.id),
    };

    const state = tagReducer([tag], action);
    expect(state).toHaveLength(0);
  });

  it('should return initial state for unknown action', () => {
    const state = tagReducer([], { type: 'UNKNOWN' as ActionType });
    expect(state).toEqual([]);
  });
});
