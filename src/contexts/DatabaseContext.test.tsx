import React from 'react';
import { renderHook } from '@testing-library/react';
import { DatabaseProvider, useDatabase } from './DatabaseContext';
import type { Project } from '@/types/project';
import type { SessionDatabase } from '@/types/session-database';
import type { TagDatabase } from '@/types/tag';

const createWrapper =
  () =>
  ({ children }: { children: React.ReactNode }) => <DatabaseProvider>{children}</DatabaseProvider>;

describe('DatabaseContext mappings', () => {
  beforeEach(() => {
    (window as unknown as { database: unknown }).database = {
      createProject: vi.fn().mockResolvedValue({
        itemId: 1,
        changes: 1,
        record: {
          projectId: 1,
          name: 'Project 1',
          description: 'Test project',
          color: '#ffffff',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Project,
      }),
      getProject: vi.fn().mockResolvedValue({
        projectId: 1,
        name: 'Project 1',
        description: 'Test project',
        color: '#ffffff',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Project),
      getProjects: vi.fn().mockResolvedValue([
        {
          projectId: 1,
          name: 'Project 1',
          description: 'Test project',
          color: '#ffffff',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Project,
      ]),
      createSession: vi.fn().mockResolvedValue({
        itemId: 1,
        changes: 1,
        record: {
          sessionId: 1,
          projectId: 1,
          startTime: new Date().toISOString(),
          endTime: null,
          duration: 0,
          notes: 'Test session',
        } as SessionDatabase,
      }),
      getSessionsForProject: vi.fn().mockResolvedValue([
        {
          sessionId: 1,
          projectId: 1,
          startTime: new Date().toISOString(),
          endTime: null,
          duration: 0,
          notes: 'Test session',
        } as SessionDatabase,
      ]),
      createTag: vi.fn().mockResolvedValue({
        itemId: 1,
        changes: 1,
        record: {
          tagId: 1,
          name: 'Tag 1',
          color: '#ff0000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as TagDatabase,
      }),
      getTags: vi.fn().mockResolvedValue([
        {
          tagId: 1,
          name: 'Tag 1',
          color: '#ff0000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as TagDatabase,
      ]),
      endSession: vi.fn().mockResolvedValue({ changes: 1 }),
      updateSessionNotes: vi.fn().mockResolvedValue({ changes: 1 }),
      updateSessionDuration: vi.fn().mockResolvedValue({ changes: 1 }),
      deleteSession: vi.fn().mockResolvedValue({ changes: 1 }),
      deleteProject: vi.fn().mockResolvedValue({ changes: 1 }),
      updateProject: vi.fn().mockResolvedValue({
        changes: 1,
        record: {
          projectId: 1,
          name: 'Updated Project',
          description: 'Updated',
          color: '#000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Project,
      }),
      updateTag: vi.fn().mockResolvedValue({
        changes: 1,
        record: {
          tagId: 1,
          name: 'Updated Tag',
          color: '#00ff00',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as TagDatabase,
      }),
      deleteTag: vi.fn().mockResolvedValue({ changes: 1 }),
      getSessions: vi.fn().mockResolvedValue([]),
      getSetting: vi.fn().mockResolvedValue('value'),
      setSetting: vi.fn().mockResolvedValue({ changes: 1 }),
    };
  });

  it('maps createProject result to a Project with correct fields', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper: createWrapper() });

    const project = await result.current.createProject('Project 1', 'Test project', '#ffffff');

    expect(project.projectId).toBe(1);
    expect(project.name).toBe('Project 1');
    expect(project.description).toBe('Test project');
    expect(project.color).toBe('#ffffff');
  });

  it('uses getProject to fetch a single project', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper: createWrapper() });

    const project = await result.current.getProject(1);

    expect(window.database.getProject).toHaveBeenCalledWith(1);
    expect(project.projectId).toBe(1);
  });

  it('uses getSessionsForProject to fetch sessions for a project', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper: createWrapper() });

    const sessions = await result.current.getSessionsForProject(1);

    expect(window.database.getSessionsForProject).toHaveBeenCalledWith(1);
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions[0].projectId).toBe(1);
    expect(sessions[0].startTime).toBeInstanceOf(Date);
  });

  it('maps TagDatabase rows to Tag domain objects', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper: createWrapper() });

    const tags = await result.current.getAllTags();

    expect(Array.isArray(tags)).toBe(true);
    expect(tags[0].id).toBe(1);
    expect(tags[0].name).toBe('Tag 1');
    expect(tags[0].createdAt).toBeInstanceOf(Date);
    expect(tags[0].updatedAt).toBeInstanceOf(Date);
  });
});
