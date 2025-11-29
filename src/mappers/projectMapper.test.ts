import type { ProjectDatabase } from '@/types/project';
import { mapDbProjectToProject, mapDbProjectsToProjects } from './projectMapper';

describe('projectMapper', () => {
  it('maps a ProjectDatabase row to a Project and parses timestamps', () => {
    const row: ProjectDatabase = {
      projectId: 1,
      name: 'Alpha',
      description: null,
      color: '#ffffff',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    };

    const project = mapDbProjectToProject(row);

    expect(project.projectId).toBe(1);
    expect(project.name).toBe('Alpha');
    expect(project.description).toBeUndefined();
    expect(project.color).toBe('#ffffff');
    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
    expect(project.createdAt.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(project.updatedAt.toISOString()).toBe('2025-01-02T00:00:00.000Z');
  });

  it('defaults updatedAt to createdAt when updatedAt is missing', () => {
    const row: ProjectDatabase = {
      projectId: 2,
      name: 'Beta',
      createdAt: '2025-01-03T00:00:00.000Z',
    };

    const project = mapDbProjectToProject(row);
    expect(project.updatedAt.toISOString()).toBe('2025-01-03T00:00:00.000Z');
  });

  it('maps many ProjectDatabase rows to Projects', () => {
    const rows: ProjectDatabase[] = [
      { projectId: 1, name: 'A', createdAt: '2025-01-01T00:00:00.000Z' },
      { projectId: 2, name: 'B', createdAt: '2025-01-01T00:00:01.000Z' },
    ];

    const projects = mapDbProjectsToProjects(rows);

    expect(projects).toHaveLength(2);
    expect(projects[0].projectId).toBe(1);
    expect(projects[1].projectId).toBe(2);
  });
});
