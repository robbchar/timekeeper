import { ActionType } from '@/types/state';

export interface Project {
  projectId: number;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type for database operations
export type ProjectCreate = Project;
export type ProjectUpdate = Pick<
  Project,
  'projectId' | 'name' | 'description' | 'color' | 'createdAt'
>;
export type DatabaseProjectCreate = Pick<Project, 'name' | 'description' | 'color'>;

// Project action types
export interface CreateProjectAction {
  type: ActionType.CREATE_PROJECT;
  payload: ProjectCreate;
}

export interface DeleteProjectAction {
  type: ActionType.DELETE_PROJECT;
  payload: number;
}

export interface UpdateProjectAction {
  type: ActionType.UPDATE_PROJECT;
  payload: ProjectUpdate;
}

export type ProjectAction = CreateProjectAction | DeleteProjectAction | UpdateProjectAction;
