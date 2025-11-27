import type { Action, Tag, Settings, AppState } from '@/types/state';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Project, DatabaseProjectCreate, ProjectUpdate } from '@/types/project';
import type { CreateSessionParams, Session } from '@/types/session';
import type { ChangesOnlyResponse } from '@/types/database-response';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public oldState: AppState
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export type DatabasePersistAction =
  // Project actions
  | { type: ActionType.CREATE_PROJECT; payload: DatabaseProjectCreate }
  | { type: ActionType.UPDATE_PROJECT; payload: ProjectUpdate }
  | { type: ActionType.DELETE_PROJECT; payload: number | string }
  // Tag actions
  | { type: ActionType.ADD_TAG; payload: Tag }
  | { type: ActionType.UPDATE_TAG; payload: Tag }
  | { type: ActionType.DELETE_TAG; payload: number | string }
  // Settings actions
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  // Session actions
  | { type: ActionType.CREATE_SESSION; payload: CreateSessionParams }
  | { type: ActionType.GET_SESSIONS }
  | { type: ActionType.END_SESSION; payload: { sessionId: number; duration: number } }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { sessionId: number; notes: string } }
  | { type: ActionType.UPDATE_SESSION_DURATION; payload: { sessionId: number; duration: number } }
  | { type: ActionType.DELETE_SESSION; payload: { sessionId: number } };

export type DatabasePersistResultMap = {
  [ActionType.CREATE_PROJECT]: Project;
  [ActionType.UPDATE_PROJECT]: Project;
  [ActionType.DELETE_PROJECT]: ChangesOnlyResponse;

  [ActionType.ADD_TAG]: Tag;
  [ActionType.UPDATE_TAG]: Tag;
  [ActionType.DELETE_TAG]: ChangesOnlyResponse;

  [ActionType.UPDATE_SETTINGS]: ChangesOnlyResponse;

  [ActionType.CREATE_SESSION]: Session;
  [ActionType.GET_SESSIONS]: Session[];
  [ActionType.END_SESSION]: ChangesOnlyResponse;
  [ActionType.UPDATE_SESSION_NOTES]: ChangesOnlyResponse;
  [ActionType.UPDATE_SESSION_DURATION]: ChangesOnlyResponse;
  [ActionType.DELETE_SESSION]: ChangesOnlyResponse;
};

type PersistActionReturn =
  | Project
  | Session
  | Session[]
  | Tag
  | ChangesOnlyResponse
  | null
  | undefined;

async function persistAction<T extends DatabasePersistAction>(
  action: T,
  state: AppState,
  database: ReturnType<typeof useDatabase>
): Promise<DatabasePersistResultMap[T['type']]>;
async function persistAction(
  action: Action,
  state: AppState,
  database: ReturnType<typeof useDatabase>
): Promise<PersistActionReturn>;
async function persistAction(
  action: Action,
  state: AppState,
  database: ReturnType<typeof useDatabase>
): Promise<PersistActionReturn> {
  const oldState = state;

  try {
    switch (action.type) {
      case ActionType.CREATE_PROJECT: {
        const { name, description, color } = action.payload as DatabaseProjectCreate;
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
        const createdTag = await database.createTag(tag.name, tag.color);
        return createdTag;
      }

      case ActionType.UPDATE_TAG: {
        const tag = action.payload as Tag;
        if (!tag?.id || !tag?.name) {
          throw new DatabaseError('Tag ID and name are required', oldState);
        }
        const updatedTag = await database.updateTag(tag.id, tag.name, tag.color);
        return updatedTag;
      }

      case ActionType.DELETE_TAG: {
        const id = Number(action.payload);
        if (isNaN(id)) {
          throw new DatabaseError('Invalid tag ID', oldState);
        }
        return await database.deleteTag(id);
      }

      case ActionType.UPDATE_SETTINGS: {
        const settings = action.payload as Partial<Settings>;
        if (!settings) {
          throw new DatabaseError('Settings are required', oldState);
        }
        let totalChanges = 0;
        for (const [key, value] of Object.entries(settings)) {
          const result = await database.setSetting(key, JSON.stringify(value));
          totalChanges += result.changes;
        }
        return { changes: totalChanges } satisfies ChangesOnlyResponse;
      }

      case ActionType.CREATE_SESSION: {
        const { projectId, notes } = action.payload as CreateSessionParams;
        if (!projectId) {
          throw new DatabaseError('Project ID is required', oldState);
        }
        return await database.createSession(projectId, notes);
      }

      case ActionType.GET_SESSIONS: {
        const sessions = await database.getSessions();
        return sessions;
      }

      case ActionType.END_SESSION: {
        const { sessionId, duration } = action.payload as SessionUpdate;
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.endSession(sessionId, duration);
      }

      case ActionType.UPDATE_SESSION_NOTES: {
        const { sessionId, notes } = action.payload as { sessionId: number; notes: string };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.updateSessionNotes(sessionId, notes);
      }

      case ActionType.UPDATE_SESSION_DURATION: {
        const { sessionId, duration } = action.payload as {
          sessionId: number;
          duration: number;
        };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.updateSessionDuration(sessionId, duration);
      }

      case ActionType.DELETE_SESSION: {
        const { sessionId } = action.payload as { sessionId: number };
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.deleteSession(sessionId);
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
