import { describe, it, expect, beforeEach } from 'vitest';
import { database } from './database';

describe('Database Service', () => {
  beforeEach(() => {
    // Reset database before each test
    database.reset();
  });

  it('should create and retrieve a project', async () => {
    const result = await database.createProject('Test Project', 'Test Description', '#FF0000');
    expect(result.lastInsertRowid).toBeDefined();

    const projects = await database.getProjects();
    expect(projects.length).toBe(1);
    expect(projects[0]).toHaveProperty('name', 'Test Project');
    expect(projects[0]).toHaveProperty('description', 'Test Description');
    expect(projects[0]).toHaveProperty('color', '#FF0000');
  });

  it('should create and end a session', async () => {
    const projectResult = await database.createProject('Test Project');
    const projectId = projectResult.lastInsertRowid as number;
    const startTime = new Date().toISOString();

    const sessionResult = await database.createSession(projectId, startTime, 'Test session');
    expect(sessionResult.lastInsertRowid).toBeDefined();
    const sessionId = sessionResult.lastInsertRowid as number;

    const endTime = new Date().toISOString();
    const duration = 3600; // 1 hour in seconds

    const endResult = await database.endSession(sessionId, endTime, duration);
    expect(endResult.changes).toBe(1);

    const sessions = await database.getSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0]).toHaveProperty('project_id', projectId);
    expect(sessions[0]).toHaveProperty('start_time', startTime);
    expect(sessions[0]).toHaveProperty('end_time', endTime);
    expect(sessions[0]).toHaveProperty('duration', duration);
  });

  it('should create and retrieve tags', async () => {
    const tag1Result = await database.createTag('Test Tag', '#FF0000');
    expect(tag1Result.lastInsertRowid).toBeDefined();

    const tag2Result = await database.createTag('Another Tag', '#00FF00');
    expect(tag2Result.lastInsertRowid).toBeDefined();

    const tags = await database.getTags();
    expect(tags.length).toBe(2);

    // Test tag properties
    const tagNames = tags.map(tag => tag.name);
    expect(tagNames).toContain('Test Tag');
    expect(tagNames).toContain('Another Tag');

    // Test finding specific tags
    const testTag = tags.find(tag => tag.name === 'Test Tag');
    expect(testTag).toBeDefined();
    expect(testTag?.color).toBe('#FF0000');

    const anotherTag = tags.find(tag => tag.name === 'Another Tag');
    expect(anotherTag).toBeDefined();
    expect(anotherTag?.color).toBe('#00FF00');
  });

  it('should get and set settings', async () => {
    const setResult = await database.setSetting('testKey', 'testValue');
    expect(setResult.changes).toBe(1);

    const value = await database.getSetting('testKey');
    expect(value).toBe('testValue');
  });
});
