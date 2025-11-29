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
 * Database-specific shape (SQLite row / IPC payload).
 *
 * Timestamps are serialized strings at the DB boundary; the UI/domain `Project`
 * uses `Date`.
 */
export interface ProjectDatabase {
  projectId: number;
  name: string;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  /**
   * Optional for backwards-compatibility with older schemas that don't include
   * an `updatedAt` column.
   */
  updatedAt?: string | null;
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
