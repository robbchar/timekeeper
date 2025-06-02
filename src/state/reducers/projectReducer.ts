import type { Project } from '@/types/state';
import type { Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const projectReducer = (state: Project[], action: Action): Project[] => {
  switch (action.type) {
    case ActionType.ADD_PROJECT:
      return [...state, action.payload as Project];

    case ActionType.UPDATE_PROJECT:
      return state.map(project =>
        project.id === (action.payload as Project).id ? (action.payload as Project) : project
      );

    case ActionType.DELETE_PROJECT:
      return state.filter(project => project.id !== action.payload);

    default:
      return state;
  }
};
