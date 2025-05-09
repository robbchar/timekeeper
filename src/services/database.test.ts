import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { database } from './database'
import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

describe('Database Operations', () => {
  beforeAll(() => {
    // Ensure test data directory exists
    const testDataDir = path.join(__dirname, '../../test/test-data')
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true })
    }
  })

  beforeEach(() => {
    // Clean up all tables before each test
    const db = new Database(path.join(app.getPath('userData'), 'timekeeper.db'))
    db.exec(`
      DELETE FROM session_tags;
      DELETE FROM sessions;
      DELETE FROM tags;
      DELETE FROM projects;
      DELETE FROM settings;
    `)
    db.close()
  })

  // Project tests
  describe('Project Operations', () => {
    it('should create and retrieve projects', () => {
      // Create a project
      const result = database.createProject('Test Project', 'Test Description', '#FF0000')
      expect(result.changes).toBe(1)
      expect(result.lastInsertRowid).toBeDefined()

      // Retrieve projects
      const projects = database.getProjects()
      expect(Array.isArray(projects)).toBe(true)
      expect(projects.length).toBe(1)
      expect(projects[0]).toHaveProperty('name', 'Test Project')
      expect(projects[0]).toHaveProperty('description', 'Test Description')
      expect(projects[0]).toHaveProperty('color', '#FF0000')
    })
  })

  // Session tests
  describe('Session Operations', () => {
    it('should create, end, and retrieve sessions', () => {
      // Create a project first
      const projectResult = database.createProject('Session Test Project')
      const projectId = projectResult.lastInsertRowid as number

      // Create a session
      const startTime = new Date().toISOString()
      const sessionResult = database.createSession(projectId, startTime, 'Test Session')
      expect(sessionResult.changes).toBe(1)
      expect(sessionResult.lastInsertRowid).toBeDefined()
      const sessionId = sessionResult.lastInsertRowid as number

      // End the session
      const endTime = new Date().toISOString()
      const duration = 3600 // 1 hour in seconds
      const endResult = database.endSession(sessionId, endTime, duration)
      expect(endResult.changes).toBe(1)

      // Retrieve sessions
      const sessions = database.getSessions()
      expect(Array.isArray(sessions)).toBe(true)
      expect(sessions.length).toBe(1)
      expect(sessions[0]).toHaveProperty('project_id', projectId)
      expect(sessions[0]).toHaveProperty('start_time', startTime)
      expect(sessions[0]).toHaveProperty('end_time', endTime)
      expect(sessions[0]).toHaveProperty('duration', duration)
    })
  })

  // Tag tests
  describe('Tag Operations', () => {
    it('should create and retrieve tags', () => {
      // Create multiple tags
      const tag1Result = database.createTag('Test Tag', '#00FF00')
      expect(tag1Result.changes).toBe(1)
      
      const tag2Result = database.createTag('Another Tag', '#FF0000')
      expect(tag2Result.changes).toBe(1)
      
      // Retrieve tags
      const tags = database.getTags()
      expect(Array.isArray(tags)).toBe(true)
      expect(tags.length).toBe(2)
      
      // Verify both tags exist
      const tagNames = tags.map(tag => tag.name)
      expect(tagNames).toContain('Test Tag')
      expect(tagNames).toContain('Another Tag')
      
      // Verify tag properties
      const testTag = tags.find(tag => tag.name === 'Test Tag')
      expect(testTag).toHaveProperty('color', '#00FF00')
      
      const anotherTag = tags.find(tag => tag.name === 'Another Tag')
      expect(anotherTag).toHaveProperty('color', '#FF0000')
    })
  })

  // Settings tests
  describe('Settings Operations', () => {
    it('should set and get settings', () => {
      const key = 'test_setting'
      const value = 'test_value'
      
      // Set the setting
      const setResult = database.setSetting(key, value)
      expect(setResult.changes).toBe(1)

      // Get the setting
      const retrievedValue = database.getSetting(key)
      expect(retrievedValue).toBe(value)

      // Test non-existent setting
      const nonExistentValue = database.getSetting('non_existent_setting')
      expect(nonExistentValue).toBeUndefined()
    })
  })
}) 