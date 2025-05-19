import { ActionType } from '@/types/state';

export interface Project {
  id: number;
  name: string;
  description: string;
  color?: string;
  totalTime: number; // in milliseconds
  sessionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Type for database operations
export type ProjectCreate = Pick<Project, 'name' | 'description' | 'color'>;
export type ProjectUpdate = Partial<ProjectCreate>;

// Project action types
export interface CreateProjectAction {
  type: ActionType.ADD_PROJECT;
  payload: Project;
}

export interface DeletePorojectAction {
  type: ActionType.DELETE_PROJECT;
  payload: string;
}

export interface UpdateProjectAction {
  type: ActionType.UPDATE_PROJECT;
  payload: Project;
}

// Type for database response
export interface ProjectDatabaseResponse {
  lastInsertRowid?: number;
  changes?: number;
}

export type ProjectAction = CreateProjectAction | DeletePorojectAction | UpdateProjectAction;
