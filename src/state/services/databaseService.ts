import type { Action, Tag, Settings, AppState } from '@/types/state';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Project, DatabaseProjectCreate, ProjectUpdate } from '@/types/project';
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

export const createDatabaseService = (database: ReturnType<typeof useDatabase>) => {
  type PersistableAction =
    | { type: ActionType.CREATE_PROJECT; payload: DatabaseProjectCreate }
    | { type: ActionType.UPDATE_PROJECT; payload: ProjectUpdate }
    | { type: ActionType.DELETE_PROJECT; payload: number | string }
    | { type: ActionType.ADD_TAG; payload: Tag }
    | { type: ActionType.UPDATE_TAG; payload: Tag }
    | { type: ActionType.DELETE_TAG; payload: number | string }
    | { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> }
    | { type: ActionType.CREATE_SESSION; payload: CreateSessionParams }
    | { type: ActionType.GET_SESSIONS }
    | { type: ActionType.END_SESSION; payload: SessionUpdate }
    | { type: ActionType.UPDATE_SESSION_NOTES; payload: { sessionId: number; notes: string } }
    | {
        type: ActionType.UPDATE_SESSION_DURATION;
        payload: { sessionId: number; duration: number };
      }
    | { type: ActionType.DELETE_SESSION; payload: { sessionId: number } };

  type PersistedResult = Project | Session | Session[] | Tag | ChangesOnlyResponse | undefined;

  function persistAction(
    action: { type: ActionType.CREATE_PROJECT; payload: DatabaseProjectCreate },
    state: AppState
  ): Promise<Project>;
  function persistAction(
    action: { type: ActionType.UPDATE_PROJECT; payload: ProjectUpdate },
    state: AppState
  ): Promise<Project>;
  function persistAction(
    action: { type: ActionType.DELETE_PROJECT; payload: number | string },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: { type: ActionType.ADD_TAG; payload: Tag },
    state: AppState
  ): Promise<Tag>;
  function persistAction(
    action: { type: ActionType.UPDATE_TAG; payload: Tag },
    state: AppState
  ): Promise<Tag>;
  function persistAction(
    action: { type: ActionType.DELETE_TAG; payload: number | string },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: { type: ActionType.UPDATE_SETTINGS; payload: Partial<Settings> },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: { type: ActionType.CREATE_SESSION; payload: CreateSessionParams },
    state: AppState
  ): Promise<Session>;
  function persistAction(
    action: { type: ActionType.GET_SESSIONS },
    state: AppState
  ): Promise<Session[]>;
  function persistAction(
    action: { type: ActionType.END_SESSION; payload: SessionUpdate },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: {
      type: ActionType.UPDATE_SESSION_NOTES;
      payload: { sessionId: number; notes: string };
    },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: {
      type: ActionType.UPDATE_SESSION_DURATION;
      payload: { sessionId: number; duration: number };
    },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  function persistAction(
    action: { type: ActionType.DELETE_SESSION; payload: { sessionId: number } },
    state: AppState
  ): Promise<ChangesOnlyResponse>;
  // Compatibility: allow non-persisted actions to be passed through (existing runtime behavior: return undefined)
  function persistAction(action: Action, state: AppState): Promise<undefined>;

  async function persistAction(
    action: PersistableAction | Action,
    state: AppState
  ): Promise<PersistedResult> {
    const oldState = state;

    try {
      switch (action.type) {
        case ActionType.CREATE_PROJECT: {
          const { name, description, color } = (
            action as Extract<PersistableAction, { type: ActionType.CREATE_PROJECT }>
          ).payload;
          if (!name) {
            throw new DatabaseError('Project name is required', oldState);
          }
          return await database.createProject(name, description, color);
        }

        case ActionType.UPDATE_PROJECT: {
          const { projectId, name, description, color } = (
            action as Extract<PersistableAction, { type: ActionType.UPDATE_PROJECT }>
          ).payload;
          if (!projectId || !name) {
            throw new DatabaseError('Project ID and name are required', oldState);
          }
          return await database.updateProject(projectId, name, description, color);
        }

        case ActionType.DELETE_PROJECT: {
          const id = Number(
            (action as Extract<PersistableAction, { type: ActionType.DELETE_PROJECT }>).payload
          );
          if (Number.isNaN(id)) {
            throw new DatabaseError('Invalid project ID', oldState);
          }
          return await database.deleteProject(id);
        }

        case ActionType.ADD_TAG: {
          const tag = (action as Extract<PersistableAction, { type: ActionType.ADD_TAG }>).payload;
          if (!tag?.name) {
            throw new DatabaseError('Tag name is required', oldState);
          }
          return await database.createTag(tag.name, tag.color);
        }

        case ActionType.UPDATE_TAG: {
          const tag = (action as Extract<PersistableAction, { type: ActionType.UPDATE_TAG }>)
            .payload;
          if (!tag?.id || !tag?.name) {
            throw new DatabaseError('Tag ID and name are required', oldState);
          }
          return await database.updateTag(tag.id, tag.name, tag.color);
        }

        case ActionType.DELETE_TAG: {
          const id = Number(
            (action as Extract<PersistableAction, { type: ActionType.DELETE_TAG }>).payload
          );
          if (Number.isNaN(id)) {
            throw new DatabaseError('Invalid tag ID', oldState);
          }
          return await database.deleteTag(id);
        }

        case ActionType.UPDATE_SETTINGS: {
          const settings = (
            action as Extract<PersistableAction, { type: ActionType.UPDATE_SETTINGS }>
          ).payload;
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
          const { projectId, notes } = (
            action as Extract<PersistableAction, { type: ActionType.CREATE_SESSION }>
          ).payload;
          if (!projectId) {
            throw new DatabaseError('Project ID is required', oldState);
          }
          return await database.createSession(projectId, notes);
        }

        case ActionType.GET_SESSIONS: {
          return await database.getSessions();
        }

        case ActionType.END_SESSION: {
          const { sessionId, duration } = (
            action as Extract<PersistableAction, { type: ActionType.END_SESSION }>
          ).payload;
          if (!sessionId) {
            throw new DatabaseError('Session ID is required', oldState);
          }
          return await database.endSession(sessionId, duration);
        }

        case ActionType.UPDATE_SESSION_NOTES: {
          const { sessionId, notes } = (
            action as Extract<PersistableAction, { type: ActionType.UPDATE_SESSION_NOTES }>
          ).payload;
          if (!sessionId) {
            throw new DatabaseError('Session ID is required', oldState);
          }
          return await database.updateSessionNotes(sessionId, notes);
        }

        case ActionType.UPDATE_SESSION_DURATION: {
          const { sessionId, duration } = (
            action as Extract<PersistableAction, { type: ActionType.UPDATE_SESSION_DURATION }>
          ).payload;
          if (!sessionId) {
            throw new DatabaseError('Session ID is required', oldState);
          }
          return await database.updateSessionDuration(sessionId, duration);
        }

        case ActionType.DELETE_SESSION: {
          const { sessionId } = (
            action as Extract<PersistableAction, { type: ActionType.DELETE_SESSION }>
          ).payload;
          if (!sessionId) {
            throw new DatabaseError('Session ID is required', oldState);
          }
          return await database.deleteSession(sessionId);
        }

        default:
          // For actions that don't need database persistence
          return undefined;
      }
    } catch (error) {
      console.error('Database service error:', error);
      throw new DatabaseError(
        error instanceof Error ? error.message : 'Unknown database error',
        oldState
      );
    }
  }

  return {
    persistAction,
  };
};
