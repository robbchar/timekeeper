import type { Project } from './project';
import type { Session } from './session';
import type { TagDatabase } from './tag';
import type { CreateResponse, UpdateResponse } from './database-response';

// Define the window.database interface
export interface DatabaseAPI {
  // Project operations
  createProject: (name: string, description?: string, color?: string) => Promise<CreateResponse>;
  getProjects: () => Promise<Project[]>;
  deleteProject: (projectId: number) => Promise<UpdateResponse>;
  updateProject: (projectId: number, name: string) => Promise<UpdateResponse>;
  // Session operations
  createSession: (projectId: number, notes?: string) => Promise<CreateResponse>;
  endSession: (sessionId: number, duration: number) => Promise<UpdateResponse>;
  getSessions: () => Promise<Session[]>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  updateSessionNotes: (sessionId: number, notes?: string) => Promise<UpdateResponse>;
  updateSessionDuration: (sessionId: number, duration: number) => Promise<UpdateResponse>;
  // Tag operations
  createTag: (name: string, color?: string) => Promise<CreateResponse>;
  getTags: () => Promise<TagDatabase[]>;
  updateTag: (tagId: number, name: string, color?: string) => Promise<UpdateResponse>;
  deleteTag: (tagId: number) => Promise<UpdateResponse>;
  // Settings operations
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<UpdateResponse>;
  // Test helper
  reset: () => Promise<void>;
}

// Extend Window interface
declare global {
  interface Window {
    database: DatabaseAPI;
  }
}
