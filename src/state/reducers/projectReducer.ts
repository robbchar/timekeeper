import type { Project, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const projectReducer = (state: Project[], action: Action): Project[] => {
  switch (action.type) {
    case ActionType.ADD_PROJECT:
      return [...state, action.payload];

    case ActionType.UPDATE_PROJECT:
      return state.map(project =>
        project.id === action.payload.id
          ? { ...project, ...action.payload, updatedAt: new Date() }
          : project
      );

    case ActionType.DELETE_PROJECT:
      return state.filter(project => project.id !== action.payload);

    default:
      return state;
  }
}; 