import type { Project } from '@/types/project';
import type { ProjectDatabase } from '@/types/project-database';

function toDate(value: string): Date {
  // SQLite returns TEXT. In our schema this is either CURRENT_TIMESTAMP or an ISO string.
  return new Date(value);
}

/**
 * Convert a DB/IPC project into the domain project used by UI/state.
 *
 * This is the single source of truth for the "string-from-SQLite" -> "Date-in-UI" boundary.
 */
export function dbProjectToProject(db: ProjectDatabase): Project {
  const createdAt = toDate(db.createdAt);

  return {
    projectId: db.projectId,
    name: db.name,
    description: db.description ?? undefined,
    color: db.color ?? undefined,
    createdAt,
    // No schema changes: we currently treat updatedAt as createdAt.
    updatedAt: createdAt,
  };
}

export function dbProjectsToProjects(rows: ProjectDatabase[]): Project[] {
  return rows.map(dbProjectToProject);
}
