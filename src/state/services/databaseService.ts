import type { Action, Tag, Settings, AppState } from '@/types/state';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Project, ProjectCreate, ProjectUpdate } from '@/types/project';
import { CreateSessionParams, Session, SessionUpdate } from '@/types/session';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public oldState: AppState
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

async function persistAction(
  action: Action,
  state: AppState,
  database: ReturnType<typeof useDatabase>
): Promise<Project | Session | { changes: number } | null | undefined> {
  const oldState = state;

  try {
    switch (action.type) {
      case ActionType.CREATE_PROJECT: {
        const { name, description, color } = action.payload as ProjectCreate;
        if (!name) {
          throw new DatabaseError('Project name is required', oldState);
        }
        const project = await database.createProject(name, description, color);
        return project;
      }

      case ActionType.UPDATE_PROJECT: {
        const { projectId, name, description, color } = action.payload as ProjectUpdate;
        if (!projectId || !name) {
          throw new DatabaseError('Project ID and name are required', oldState);
        }
        return await database.updateProject(projectId, name, description, color);
      }

      case ActionType.DELETE_PROJECT: {
        const id = Number(action.payload);
        if (isNaN(id)) {
          throw new DatabaseError('Invalid project ID', oldState);
        }
        return await database.deleteProject(id);
      }

      case ActionType.ADD_TAG: {
        const tag = action.payload as Tag;
        if (!tag?.name) {
          throw new DatabaseError('Tag name is required', oldState);
        }
        await database.createTag(tag.name, tag.color);
        break;
      }

      case ActionType.UPDATE_TAG: {
        const tag = action.payload as Tag;
        if (!tag?.id || !tag?.name) {
          throw new DatabaseError('Tag ID and name are required', oldState);
        }
        await database.updateTag(tag.id, tag.name, tag.color);
        break;
      }

      case ActionType.DELETE_TAG: {
        const id = Number(action.payload);
        if (isNaN(id)) {
          throw new DatabaseError('Invalid tag ID', oldState);
        }
        await database.deleteTag(id);
        break;
      }

      case ActionType.UPDATE_SETTINGS: {
        const settings = action.payload as Partial<Settings>;
        if (!settings) {
          throw new DatabaseError('Settings are required', oldState);
        }
        for (const [key, value] of Object.entries(settings)) {
          await database.setSetting(key, JSON.stringify(value));
        }
        break;
      }

      case ActionType.CREATE_SESSION: {
        const { projectId, notes } = action.payload as CreateSessionParams;
        if (!projectId) {
          throw new DatabaseError('Project ID is required', oldState);
        }
        return (await database.createSession(projectId, notes)) as unknown as Session;
      }

      case ActionType.END_SESSION: {
        const { sessionId, duration } = action.payload as SessionUpdate;
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        await database.endSession(sessionId, duration);
        break;
      }

      case ActionType.UPDATE_SESSION_NOTES: {
        const { sessionId, notes } = action.payload as { sessionId: number; notes: string };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        await database.updateSessionNotes(sessionId, notes);
        break;
      }

      case ActionType.UPDATE_SESSION_DURATION: {
        const { sessionId, duration } = action.payload as {
          sessionId: number;
          duration: number;
        };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        await database.updateSessionDuration(sessionId, duration);
        break;
      }

      case ActionType.DELETE_SESSION: {
        const { sessionId } = action.payload as { sessionId: number };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        await database.deleteSession(sessionId);
        break;
      }

      default:
        // For actions that don't need database persistence
        return;
    }
  } catch (error) {
    console.error('Database service error:', error);
    throw new DatabaseError(
      error instanceof Error ? error.message : 'Unknown database error',
      oldState
    );
  }
}

export const createDatabaseService = (database: ReturnType<typeof useDatabase>) => {
  return {
    persistAction: (action: Action, state: AppState) => persistAction(action, state, database),
  };
};
