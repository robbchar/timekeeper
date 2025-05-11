import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import type { DatabaseAPI } from '@/types/database';

// Get the path to the user data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'timekeeper.db');

// Create data directory if it doesn't exist
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
function initializeDatabase() {
  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      duration INTEGER,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    )
  `);

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    )
  `);

  // Session tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_tags (
      session_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

// Initialize the database
initializeDatabase();

// Export database instance and helper functions
export const database: DatabaseAPI = {
  // Project operations
  createProject: async (name: string, description?: string, color?: string) => {
    return window.database.createProject(name, description, color);
  },

  getProjects: async () => {
    return window.database.getProjects();
  },

  deleteProject: async (id: number) => {
    return window.database.deleteProject(id);
  },

  updateProject: async (id: number, name: string) => {
    return window.database.updateProject(id, name);
  },

  // Session operations
  createSession: async (projectId: number, startTime: string, notes?: string) => {
    return window.database.createSession(projectId, startTime, notes);
  },

  endSession: async (sessionId: number, endTime: string, duration: number) => {
    return window.database.endSession(sessionId, endTime, duration);
  },

  getSessions: async (startDate?: string, endDate?: string) => {
    return window.database.getSessions(startDate, endDate);
  },

  // Tag operations
  createTag: async (name: string, color?: string) => {
    return window.database.createTag(name, color);
  },

  getTags: async () => {
    return window.database.getTags();
  },

  // Settings operations
  getSetting: async (key: string) => {
    return window.database.getSetting(key);
  },

  setSetting: async (key: string, value: string) => {
    return window.database.setSetting(key, value);
  },

  // Test helper
  reset: async () => {
    return window.database.reset();
  },
};
