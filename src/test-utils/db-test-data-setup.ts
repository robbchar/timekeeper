import type sqlite3 from 'sqlite3';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';

export async function seedProjects(db: sqlite3.Database, projects: Project[]) {
  await Promise.all(
    projects.map(
      project =>
        new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO projects (projectId, name, description, createdAt)
           VALUES (?, ?, ?, ?)`,
            [
              project.projectId,
              project.name,
              project.description ?? '',
              project.createdAt.toISOString(),
            ],
            err => (err ? reject(err) : resolve())
          );
        })
    )
  );
}

export async function seedSessions(db: sqlite3.Database, sessions: Session[]) {
  await Promise.all(
    sessions.map(
      session =>
        new Promise<void>((resolve, reject) => {
          db.run(
            `INSERT INTO sessions (sessionId, projectId, startTime, duration, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              session.sessionId,
              session.projectId,
              session.startTime.toISOString(),
              session.duration,
              session.status,
              session.createdAt?.toISOString() ?? new Date().toISOString(),
              session.updatedAt?.toISOString() ?? new Date().toISOString(),
            ],
            err => (err ? reject(err) : resolve())
          );
        })
    )
  );
}
