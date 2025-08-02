import { ProjectCreate, ProjectUpdate } from '@/types/project';
import type { Project } from '@/types/state';
import type { Action } from '@/types/state';
import { ActionType } from '@/types/state';

export const projectReducer = (projectsState: Project[], action: Action): Project[] => {
  switch (action.type) {
    case ActionType.CREATE_PROJECT: {
      const { projectId, name, description, color, createdAt, updatedAt } =
        action.payload as ProjectCreate;

      return [
        ...projectsState,
        {
          projectId,
          name,
          description,
          color,
          createdAt,
          updatedAt,
        },
      ];
    }

    case ActionType.UPDATE_PROJECT:
      return projectsState.map(project =>
        project.projectId === (action.payload as ProjectUpdate).projectId
          ? {
              ...project,
              ...(action.payload as Partial<Project>),
              updatedAt: new Date(),
            }
          : project
      );

    case ActionType.DELETE_PROJECT:
      return projectsState.filter(project => project.projectId !== Number(action.payload));

    default:
      return projectsState;
  }
};
