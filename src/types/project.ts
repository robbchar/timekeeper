import { ActionType } from '@/types/state';

export interface Project {
  projectId: number;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database/IPC shape for `projects` rows.
 *
 * Boundary rule:
 * - DB/IPC layer uses `string` timestamps (ISO 8601)
 * - UI/domain layer uses `Date` timestamps
 */
export interface ProjectDatabase {
  projectId: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  // Some schema versions may not have this column.
  updatedAt?: string;
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
