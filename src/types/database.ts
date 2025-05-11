// Define types for database entities
export interface Project {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface Session {
  id: number;
  project_id: number;
  start_time: string;
  end_time?: string;
  duration?: number;
  notes?: string;
}

export interface Tag {
  id: number;
  name: string;
  color?: string;
}

export interface DatabaseResponse {
  lastInsertRowid?: number;
  changes?: number;
}

// Define the window.database interface
export interface DatabaseAPI {
  // Project operations
  createProject: (
    name: string,
    description?: string,
    color?: string
  ) => Promise<{ lastInsertRowid: number; changes: number }>;
  getProjects: () => Promise<Project[]>;
  deleteProject: (id: number) => Promise<{ changes: number }>;
  updateProject: (id: number, name: string) => Promise<{ changes: number }>;
  // Session operations
  createSession: (
    projectId: number,
    startTime: string,
    notes?: string
  ) => Promise<{ lastInsertRowid: number; changes: number }>;
  endSession: (
    sessionId: number,
    endTime: string,
    duration: number
  ) => Promise<{ changes: number }>;
  getSessions: (startDate?: string, endDate?: string) => Promise<Session[]>;
  // Tag operations
  createTag: (
    name: string,
    color?: string
  ) => Promise<{ lastInsertRowid: number; changes: number }>;
  getTags: () => Promise<Tag[]>;
  // Settings operations
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<{ changes: number }>;
  // Test helper
  reset: () => Promise<void>;
}

// Extend Window interface
declare global {
  interface Window {
    database: DatabaseAPI;
  }
}
