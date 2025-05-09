import '@testing-library/jest-dom'
import { expect, afterEach, beforeEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers)

const testDataDir = path.join(__dirname, 'test-data')

// Create test data directory if it doesn't exist
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true })
}

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return testDataDir
      }
      return ''
    },
  },
}))

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})

// Clean up test data before each test
beforeEach(() => {
  // Ensure test data directory exists
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true })
  }

  // Clean up database tables
  const dbPath = path.join(testDataDir, 'timekeeper.db')
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath)
    db.exec(`
      DELETE FROM session_tags;
      DELETE FROM sessions;
      DELETE FROM tags;
      DELETE FROM projects;
      DELETE FROM settings;
    `)
    db.close()
  }
})

// Clean up test data after all tests
afterAll(() => {
  // Close any open database connections
  const dbPath = path.join(testDataDir, 'timekeeper.db')
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath)
      db.close()
    } catch (error) {
      // Ignore errors if database is already closed
    }
  }

  // Wait a bit to ensure all file handles are released
  setTimeout(() => {
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true })
      }
    } catch (error) {
      console.error('Error cleaning up test data directory:', error)
    }
  }, 100)
}) 