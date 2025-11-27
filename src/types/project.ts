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
 * Database/IPC shape for rows from the `projects` table.
 *
 * NOTE: SQLite returns DATETIME columns as strings (typically ISO8601 / CURRENT_TIMESTAMP text).
 * This type is the explicit "string-from-SQLite" boundary surface.
 */
export interface ProjectDatabase {
  projectId: number;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  /**
   * Optional because the current schema does not include an `updatedAt` column.
   * If/when added, it should still remain a string at the DB/IPC boundary.
   */
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
