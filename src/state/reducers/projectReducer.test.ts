import { describe, it, expect } from 'vitest';
import { projectReducer } from './projectReducer';
import { ActionType } from '@/types/state';
import type { Project, Action } from '@/types/state';

describe('projectReducer', () => {
  const mockProject: Project = {
    projectId: 1,
    name: 'Test Project',
    description: 'Test Description',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  it('should add a project with default stats', () => {
    const initialState: Project[] = [];
    const action = {
      type: ActionType.CREATE_PROJECT,
      payload: {
        projectId: 1,
        name: 'Test Project',
        description: 'Test Description',
        color: '#000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Project,
    };

    const newState = projectReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0].createdAt).toBeInstanceOf(Date);
    expect(newState[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should update a project', () => {
    const initialState: Project[] = [mockProject];
    const action = {
      type: ActionType.UPDATE_PROJECT,
      payload: {
        projectId: 1,
        name: 'Updated Project',
        description: 'Updated Description',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Project,
    };

    const newState = projectReducer(initialState, action);
    expect(newState).toHaveLength(1);
    expect(newState[0].name).toBe('Updated Project');
    expect(newState[0].description).toBe('Updated Description');
    expect(newState[0].updatedAt).toBeInstanceOf(Date);
  });

  it('should delete a project', () => {
    const initialState: Project[] = [mockProject];
    const action = {
      type: ActionType.DELETE_PROJECT,
      payload: '1',
    };

    const newState = projectReducer(initialState, action);
    expect(newState).toHaveLength(0);
  });

  it('should return initial state for unknown action', () => {
    const initialState: Project[] = [mockProject];
    const action: Action = {
      type: 'UNKNOWN_ACTION' as ActionType,
      payload: null,
    };

    const newState = projectReducer(initialState, action);
    expect(newState).toEqual(initialState);
  });
});
