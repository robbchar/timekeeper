import type { Project, Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const projectReducer = (state: Project[], action: Action): Project[] => {
  switch (action.type) {
    case ActionType.ADD_PROJECT: {
      const project = action.payload as Project;
      return [
        ...state,
        {
          ...project,
          totalTime: 0,
          sessionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    case ActionType.UPDATE_PROJECT: {
      const project = action.payload as Project;
      return state.map(p =>
        p.id === project.id ? { ...p, ...project, updatedAt: new Date() } : p
      );
    }

    case ActionType.DELETE_PROJECT:
      return state.filter(project => project.id !== action.payload);

    default:
      return state;
  }
};
