import type { ProjectDatabase, Project } from '@/types/project';

export function mapDbProjectToProject(dbProject: ProjectDatabase): Project {
  const createdAt = new Date(dbProject.createdAt);
  const updatedAt = new Date(dbProject.updatedAt ?? dbProject.createdAt);

  return {
    projectId: dbProject.projectId,
    name: dbProject.name,
    description: dbProject.description ?? undefined,
    color: dbProject.color ?? undefined,
    createdAt,
    updatedAt,
  };
}

export function mapDbProjectsToProjects(dbProjects: readonly ProjectDatabase[]): Project[] {
  return dbProjects.map(mapDbProjectToProject);
}
