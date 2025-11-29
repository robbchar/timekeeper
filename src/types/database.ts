import type { Project } from './project';
import type { Session } from './session';
import type { TagDatabase } from './tag';
import type {
  CreateResponse,
  DeleteResponse,
  UpdateResponse,
  ChangesOnlyResponse,
} from './database-response';

// Define the window.database interface
export interface DatabaseAPI {
  // Project operations
  createProject: (
    name: string,
    description?: string,
    color?: string
  ) => Promise<CreateResponse<Project>>;
  getProject: (projectId: number) => Promise<Project | undefined>;
  getProjects: () => Promise<Project[]>;
  deleteProject: (projectId: number) => Promise<ChangesOnlyResponse>;
  updateProject: (
    projectId: number,
    name: string,
    description?: string,
    color?: string
  ) => Promise<UpdateResponse<Project>>;
  // Session operations
  createSession: (projectId: number, notes?: string) => Promise<CreateResponse<Session>>;
  endSession: (sessionId: number, duration: number) => Promise<UpdateResponse<Session>>;
  getSessions: () => Promise<Session[]>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  updateSessionNotes: (sessionId: number, notes: string) => Promise<UpdateResponse<Session>>;
  updateSessionDuration: (sessionId: number, duration: number) => Promise<UpdateResponse<Session>>;
  deleteSession: (sessionId: number) => Promise<ChangesOnlyResponse>;
  // Tag operations
  createTag: (name: string, color?: string) => Promise<CreateResponse<TagDatabase>>;
  getTags: () => Promise<TagDatabase[]>;
  updateTag: (tagId: number, name: string, color?: string) => Promise<UpdateResponse<TagDatabase>>;
  deleteTag: (tagId: number) => Promise<DeleteResponse<TagDatabase>>;
  // Project–Tag relationship operations
  getTagsForProject: (projectId: number) => Promise<TagDatabase[]>;
  setProjectTags: (projectId: number, tagIds: number[]) => Promise<ChangesOnlyResponse>;
  // Settings operations
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<ChangesOnlyResponse>;
  // Test helper
  reset: () => Promise<ChangesOnlyResponse>;
}

// Extend Window interface
declare global {
  interface Window {
    database: DatabaseAPI;
  }
}
