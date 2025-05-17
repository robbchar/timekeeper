import '@testing-library/jest-dom';
import { expect, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

const testDataDir = path.join(__dirname, 'test-data');

// Create test data directory if it doesn't exist
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => testDataDir),
  },
}));

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Initialize database tables
function initializeDatabase(db: sqlite3.Database) {
  return new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON', err => {
        if (err) {
          reject(err);
          return;
        }
      });

      // Projects table
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sessions table
      db.run(`
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
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT
        )
      `);

      // Session tags junction table
      db.run(`
        CREATE TABLE IF NOT EXISTS session_tags (
          session_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (session_id, tag_id),
          FOREIGN KEY (session_id) REFERENCES sessions(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        )
      `);

      // Settings table
      db.run(
        `
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `,
        err => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
}

// Helper function to safely delete a file
async function safeDeleteFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      // Wait for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
}

// Helper function to safely remove a directory
async function safeRemoveDirectory(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      // Wait for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Error removing directory ${dirPath}:`, error);
  }
}

// Set up test database
beforeAll(async () => {
  // Ensure directory exists
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  const dbPath = path.join(testDataDir, 'timekeeper.db');
  await safeDeleteFile(dbPath);

  // Create new database and initialize tables
  const db = new sqlite3.Database(dbPath);
  await initializeDatabase(db);
  db.close();
});

// Clean up after tests
afterAll(async () => {
  cleanup();
  // Remove test database
  const dbPath = path.join(testDataDir, 'timekeeper.db');

  // Wait for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));

  await safeDeleteFile(dbPath);
  await safeRemoveDirectory(testDataDir);
});
