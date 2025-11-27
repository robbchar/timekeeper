import type { Project, ProjectDatabase } from '@/types/project';

export function toDomainProject(dbProject: ProjectDatabase): Project {
  const createdAt = new Date(dbProject.createdAt);
  const updatedAt = dbProject.updatedAt ? new Date(dbProject.updatedAt) : createdAt;

  return {
    projectId: dbProject.projectId,
    name: dbProject.name,
    description: dbProject.description,
    color: dbProject.color,
    createdAt,
    updatedAt,
  };
}
