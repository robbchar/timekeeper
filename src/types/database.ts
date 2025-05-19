import type { Project } from './project';
import type { SessionDatabase } from './session';
import type { TagDatabase } from './tag';
import type { CreateResponse, UpdateResponse } from './database-response';

// Define the window.database interface
export interface DatabaseAPI {
  // Project operations
  createProject: (name: string, description?: string, color?: string) => Promise<CreateResponse>;
  getProjects: () => Promise<Project[]>;
  deleteProject: (id: number) => Promise<UpdateResponse>;
  updateProject: (id: number, name: string) => Promise<UpdateResponse>;
  // Session operations
  createSession: (projectId: number, startTime: string, notes?: string) => Promise<CreateResponse>;
  endSession: (sessionId: number, endTime: string, duration: number) => Promise<UpdateResponse>;
  getSessions: (startDate?: string, endDate?: string) => Promise<SessionDatabase[]>;
  // Tag operations
  createTag: (name: string, color?: string) => Promise<CreateResponse>;
  getTags: () => Promise<TagDatabase[]>;
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
