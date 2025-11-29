import type { Action, Tag, Settings, AppState } from '@/types/state';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { DatabaseProjectCreate, Project, ProjectUpdate } from '@/types/project';
import { CreateSessionParams, Session, SessionUpdate } from '@/types/session';
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

/**
 * Persisted actions are the subset of `ActionType`s that have a database side-effect.
 *
 * NOTE: `Action` (in `src/types/state.ts`) is intentionally broad, so we define a
 * narrower discriminated union here to give `persistAction` a precise contract
 * without touching reducers.
 */
export type PersistedAction =
  // Projects
  | { type: ActionType.CREATE_PROJECT; payload: DatabaseProjectCreate }
  | { type: ActionType.UPDATE_PROJECT; payload: ProjectUpdate }
  | { type: ActionType.DELETE_PROJECT; payload: number }
  // Tags
  | { type: ActionType.ADD_TAG; payload: Pick<Tag, 'name' | 'color'> }
  | { type: ActionType.UPDATE_TAG; payload: Pick<Tag, 'id' | 'name' | 'color'> }
  | { type: ActionType.DELETE_TAG; payload: string }
  // Settings
  | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
  // Sessions
  | { type: ActionType.CREATE_SESSION; payload: CreateSessionParams }
  | { type: ActionType.GET_SESSIONS }
  | { type: ActionType.END_SESSION; payload: SessionUpdate }
  | { type: ActionType.UPDATE_SESSION_NOTES; payload: { sessionId: number; notes: string } }
  | { type: ActionType.UPDATE_SESSION_DURATION; payload: { sessionId: number; duration: number } }
  | { type: ActionType.DELETE_SESSION; payload: { sessionId: number } };

export interface PersistResultByAction {
  // Projects
  [ActionType.CREATE_PROJECT]: Project;
  [ActionType.UPDATE_PROJECT]: Project;
  [ActionType.DELETE_PROJECT]: ChangesOnlyResponse;
  // Tags
  [ActionType.ADD_TAG]: Tag;
  [ActionType.UPDATE_TAG]: Tag;
  [ActionType.DELETE_TAG]: ChangesOnlyResponse;
  // Settings
  [ActionType.UPDATE_SETTINGS]: ChangesOnlyResponse;
  // Sessions
  [ActionType.CREATE_SESSION]: Session;
  [ActionType.GET_SESSIONS]: Session[];
  [ActionType.END_SESSION]: ChangesOnlyResponse;
  [ActionType.UPDATE_SESSION_NOTES]: ChangesOnlyResponse;
  [ActionType.UPDATE_SESSION_DURATION]: ChangesOnlyResponse;
  [ActionType.DELETE_SESSION]: ChangesOnlyResponse;
}

type PersistedActionType = keyof PersistResultByAction;
type PersistActionFor<T extends PersistedActionType> = Extract<PersistedAction, { type: T }>;
export type PersistResult<T extends PersistedActionType> = PersistResultByAction[T];

const requirePayload = <T>(payload: unknown, message: string, oldState: AppState): T => {
  if (payload === undefined || payload === null) {
    throw new DatabaseError(message, oldState);
  }
  return payload as T;
};

async function persistAction(
  action: Action,
  state: AppState,
  database: ReturnType<typeof useDatabase>
): Promise<PersistResult<PersistedActionType> | undefined> {
  const oldState = state;

  try {
    switch (action.type) {
      case ActionType.CREATE_PROJECT: {
        const payload = requirePayload<DatabaseProjectCreate>(
          action.payload,
          'Project details are required',
          oldState
        );
        const { name, description, color } = payload;
        if (!name) {
          throw new DatabaseError('Project name is required', oldState);
        }
        const project = await database.createProject(name, description, color);
        return project;
      }

      case ActionType.UPDATE_PROJECT: {
        const payload = requirePayload<ProjectUpdate>(
          action.payload,
          'Project update details are required',
          oldState
        );
        const { projectId, name, description, color } = payload;
        if (!projectId || !name) {
          throw new DatabaseError('Project ID and name are required', oldState);
        }
        return await database.updateProject(projectId, name, description, color);
      }

      case ActionType.DELETE_PROJECT: {
        const payload = requirePayload<number>(action.payload, 'Project ID is required', oldState);
        const id = Number(payload);
        if (isNaN(id)) {
          throw new DatabaseError('Invalid project ID', oldState);
        }
        return await database.deleteProject(id);
      }

      case ActionType.ADD_TAG: {
        const tag = requirePayload<Pick<Tag, 'name' | 'color'>>(
          action.payload,
          'Tag details are required',
          oldState
        );
        if (!tag?.name) {
          throw new DatabaseError('Tag name is required', oldState);
        }
        const createdTag = await database.createTag(tag.name, tag.color);
        return createdTag;
      }

      case ActionType.UPDATE_TAG: {
        const tag = requirePayload<Pick<Tag, 'id' | 'name' | 'color'>>(
          action.payload,
          'Tag details are required',
          oldState
        );
        if (!tag?.id || !tag?.name) {
          throw new DatabaseError('Tag ID and name are required', oldState);
        }
        const updatedTag = await database.updateTag(tag.id, tag.name, tag.color);
        return updatedTag;
      }

      case ActionType.DELETE_TAG: {
        const payload = requirePayload<string>(action.payload, 'Tag ID is required', oldState);
        const id = Number(payload);
        if (isNaN(id)) {
          throw new DatabaseError('Invalid tag ID', oldState);
        }
        return await database.deleteTag(id);
      }

      case ActionType.UPDATE_SETTINGS: {
        const settings = requirePayload<Partial<Settings>>(
          action.payload,
          'Settings are required',
          oldState
        );
        if (!settings) {
          throw new DatabaseError('Settings are required', oldState);
        }
        let totalChanges = 0;
        for (const [key, value] of Object.entries(settings)) {
          const result = await database.setSetting(key, JSON.stringify(value));
          totalChanges += result.changes;
        }
        return { changes: totalChanges };
      }

      case ActionType.CREATE_SESSION: {
        const payload = requirePayload<CreateSessionParams>(
          action.payload,
          'Session details are required',
          oldState
        );
        const { projectId, notes } = payload;
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
        const payload = requirePayload<SessionUpdate>(
          action.payload,
          'Session details are required',
          oldState
        );
        const { sessionId, duration } = payload;
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.endSession(sessionId, duration);
      }

      case ActionType.UPDATE_SESSION_NOTES: {
        const payload = requirePayload<{ sessionId: number; notes: string }>(
          action.payload,
          'Session details are required',
          oldState
        );
        const { sessionId, notes } = payload;
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.updateSessionNotes(sessionId, notes);
      }

      case ActionType.UPDATE_SESSION_DURATION: {
        const payload = requirePayload<{ sessionId: number; duration: number }>(
          action.payload,
          'Session details are required',
          oldState
        );
        const { sessionId, duration } = payload;
        if (!sessionId) {
          throw new DatabaseError('Session ID is required', oldState);
        }
        return await database.updateSessionDuration(sessionId, duration);
      }

      case ActionType.DELETE_SESSION: {
        const payload = requirePayload<{ sessionId: number }>(
          action.payload,
          'Session details are required',
          oldState
        );
        const { sessionId } = payload;
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
  function persistActionBound<T extends PersistedActionType>(
    action: PersistActionFor<T>,
    state: AppState
  ): Promise<PersistResult<T>>;
  function persistActionBound(
    action: Action,
    state: AppState
  ): Promise<PersistResult<PersistedActionType> | undefined>;
  function persistActionBound(action: Action, state: AppState) {
    return persistAction(action, state, database);
  }

  return {
    persistAction: persistActionBound,
  };
};
