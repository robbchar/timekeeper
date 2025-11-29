import React from 'react';
import { renderHook } from '@testing-library/react';
import { DatabaseProvider, useDatabase } from './DatabaseContext';
import type { ProjectDatabase } from '@/types/project';
import type { SessionDatabase } from '@/types/session';
import type { TagDatabase } from '@/types/tag';

const createWrapper =
  () =>
  ({ children }: { children: React.ReactNode }) => <DatabaseProvider>{children}</DatabaseProvider>;

describe('DatabaseContext mappings', () => {
  beforeEach(() => {
    const projectRow: ProjectDatabase = {
      projectId: 1,
      name: 'Project 1',
      description: 'Test project',
      color: '#ffffff',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    };

    const sessionRow: SessionDatabase = {
      sessionId: 1,
      projectId: 1,
      startTime: '2025-01-03T10:00:00.000Z',
      endTime: null,
      duration: 0,
      notes: 'Test session',
      status: 'active',
    };

    (window as unknown as { database: unknown }).database = {
      createProject: vi.fn().mockResolvedValue({
        itemId: 1,
        changes: 1,
        record: projectRow,
      }),
      getProjects: vi.fn().mockResolvedValue([projectRow]),
      getProject: vi.fn().mockResolvedValue(projectRow),
      createSession: vi.fn().mockResolvedValue({
        itemId: 1,
        changes: 1,
        record: sessionRow,
      }),
      getSessionsForProject: vi.fn().mockResolvedValue([sessionRow]),
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
      endSession: vi.fn().mockResolvedValue({ changes: 1, record: sessionRow }),
      updateSessionNotes: vi.fn().mockResolvedValue({ changes: 1, record: sessionRow }),
      updateSessionDuration: vi.fn().mockResolvedValue({ changes: 1, record: sessionRow }),
      deleteSession: vi.fn().mockResolvedValue({ changes: 1 }),
      deleteProject: vi.fn().mockResolvedValue({ changes: 1 }),
      updateProject: vi.fn().mockResolvedValue({
        changes: 1,
        record: {
          ...projectRow,
          name: 'Updated Project',
          description: 'Updated',
          color: '#000000',
        } satisfies ProjectDatabase,
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
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
  });

  it('uses getProject to fetch a single project', async () => {
    const { result } = renderHook(() => useDatabase(), { wrapper: createWrapper() });

    const project = await result.current.getProject(1);

    expect(window.database.getProject).toHaveBeenCalledWith(1);
    expect(window.database.getProjects).not.toHaveBeenCalled();
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
