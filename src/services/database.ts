import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// Get the path to the user data directory
const userDataPath = app.getPath('userData')
const dbPath = path.join(userDataPath, 'timekeeper.db')

// Create data directory if it doesn't exist
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true })
}

// Initialize database
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

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
  `)

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
  `)

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    )
  `)

  // Session tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_tags (
      session_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, tag_id),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
    )
  `)

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
}

// Initialize the database
initializeDatabase()

// Define types for our database entities
interface Project {
  id: number
  name: string
  description?: string
  color?: string
  created_at: string
}

interface Session {
  id: number
  project_id: number
  start_time: string
  end_time?: string
  duration?: number
  notes?: string
}

interface Tag {
  id: number
  name: string
  color?: string
}

// Export database instance and helper functions
export const database = {
  // Project operations
  createProject: (name: string, description?: string, color?: string) => {
    const stmt = db.prepare(`
      INSERT INTO projects (name, description, color)
      VALUES (?, ?, ?)
    `)
    return stmt.run(name, description, color)
  },

  getProjects: (): Project[] => {
    const stmt = db.prepare('SELECT * FROM projects ORDER BY name')
    return stmt.all() as Project[]
  },

  // Session operations
  createSession: (projectId: number, startTime: string, notes?: string) => {
    const stmt = db.prepare(`
      INSERT INTO sessions (project_id, start_time, notes)
      VALUES (?, ?, ?)
    `)
    return stmt.run(projectId, startTime, notes)
  },

  endSession: (sessionId: number, endTime: string, duration: number) => {
    const stmt = db.prepare(`
      UPDATE sessions
      SET end_time = ?, duration = ?
      WHERE id = ?
    `)
    return stmt.run(endTime, duration, sessionId)
  },

  getSessions: (startDate?: string, endDate?: string): Session[] => {
    let query = 'SELECT * FROM sessions'
    const params: any[] = []

    if (startDate && endDate) {
      query += ' WHERE start_time BETWEEN ? AND ?'
      params.push(startDate, endDate)
    }

    query += ' ORDER BY start_time DESC'
    const stmt = db.prepare(query)
    return stmt.all(...params) as Session[]
  },

  // Tag operations
  createTag: (name: string, color?: string) => {
    const stmt = db.prepare(`
      INSERT INTO tags (name, color)
      VALUES (?, ?)
    `)
    return stmt.run(name, color)
  },

  getTags: (): Tag[] => {
    const stmt = db.prepare('SELECT * FROM tags ORDER BY name')
    return stmt.all() as Tag[]
  },

  // Settings operations
  getSetting: (key: string) => {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    const result = stmt.get(key) as { value: string } | undefined
    return result?.value
  },

  setSetting: (key: string, value: string) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `)
    return stmt.run(key, value)
  }
} 