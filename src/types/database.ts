import type { Project } from './project';
import type { SessionDatabase } from './session';
import type { TagDatabase } from './tag';
import type {
  DatabaseResponse,
  ProjectDatabaseResponse,
  TagDatabaseResponse,
  SessionDatabaseResponse,
} from './database-response';

// Define the window.database interface
export interface DatabaseAPI {
  // Project operations
  createProject: (
    name: string,
    description?: string,
    color?: string
  ) => Promise<ProjectDatabaseResponse>;
  getProjects: () => Promise<Project[]>;
  deleteProject: (id: number) => Promise<DatabaseResponse>;
  updateProject: (id: number, name: string) => Promise<DatabaseResponse>;
  // Session operations
  createSession: (
    projectId: number,
    startTime: string,
    notes?: string
  ) => Promise<SessionDatabaseResponse>;
  endSession: (sessionId: number, endTime: string, duration: number) => Promise<DatabaseResponse>;
  getSessions: (startDate?: string, endDate?: string) => Promise<SessionDatabase[]>;
  // Tag operations
  createTag: (name: string, color?: string) => Promise<TagDatabaseResponse>;
  getTags: () => Promise<TagDatabase[]>;
  // Settings operations
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<DatabaseResponse>;
  // Test helper
  reset: () => Promise<void>;
}

// Extend Window interface
declare global {
  interface Window {
    database: DatabaseAPI;
  }
}
