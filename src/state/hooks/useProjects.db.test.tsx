import React, { PropsWithChildren } from 'react';
import { renderHook } from '@testing-library/react';
import { TestProviders } from '@/test-utils/test-db-context';
import { useProjects } from './useAppState';
import { DatabaseProjectCreate } from '@/types/project';
import { setupTestDatabase, teardownTestDatabase } from '@/test-utils/db-test-setup';
import { actAsync } from '@/test-utils/helpers';

const wrapper: React.FC<PropsWithChildren> = ({ children }) => (
  <TestProviders>{children}</TestProviders>
);

describe('useProjects with real DB', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('adds a project and updates state', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    const newProject = {
      name: 'Test Project',
      color: '#FF0000',
      description: 'test',
    };

    await actAsync(() => result.current.createProject(newProject));

    const projects = result.current.projects;
    expect(projects.length).toBe(1);
    expect(projects[0].name).toBe('Test Project');
  });

  it('updates a project and updates state', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    const newProject: DatabaseProjectCreate = {
      name: 'Test Project',
      color: '#FF0000',
      description: 'test',
    };

    const createdProject = await actAsync(() => result.current.createProject(newProject));
    expect(createdProject).toBeDefined();

    await actAsync(() =>
      result.current.updateProject({
        ...createdProject!,
        name: 'Updated Project',
        color: '#00FF00',
        description: 'test2',
      })
    );

    expect(result.current.projects[0].projectId).toEqual(createdProject!.projectId);
    expect(result.current.projects[0].name).toEqual('Updated Project');
    expect(result.current.projects[0].color).toEqual('#00FF00');
    expect(result.current.projects[0].description).toEqual('test2');
  });

  it('deletes a project and updates state', async () => {
    const { result } = renderHook(() => useProjects(), { wrapper });

    const newProject: DatabaseProjectCreate = {
      name: 'Test Project',
      color: '#FF0000',
      description: 'test',
    };

    await actAsync(() => result.current.createProject(newProject));
    await actAsync(() => result.current.deleteProject(1));

    expect(result.current.projects.find(p => p.projectId === 1)).toBeUndefined();
  });
});
