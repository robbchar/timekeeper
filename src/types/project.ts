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

// Type for database response
export interface ProjectDatabaseResponse {
  lastInsertRowid?: number;
  changes?: number;
}
