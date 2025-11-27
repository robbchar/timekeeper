import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import type { Tag, Settings } from '@/types/state';
import type { CreateSessionParams, Session } from '@/types/session';
import { ActionType } from '@/types/state';
import { useDatabase } from '@/contexts/DatabaseContext';
import { createDatabaseService, DatabaseError } from '../services/databaseService';

export const useProjects = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useProjects must be used within an AppProvider');

  const {
    state: { projects },
    createProject,
    updateProject,
    deleteProject,
  } = context;

  return {
    projects,
    createProject,
    updateProject,
    deleteProject,
  };
};

export const useSessions = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSessions must be used within an AppProvider');
  const { state, dispatch } = context;
  const database = useDatabase();
  const dbService = createDatabaseService(database);

  return {
    state,
    sessions: state.sessions.sessions,
    currentSession: state.sessions.currentSession,
    getSessions: async () => {
      const sessions = await dbService.persistAction({ type: ActionType.GET_SESSIONS }, state);
      return sessions;
    },
    startSession: async (params: CreateSessionParams) => {
      try {
        const session = await dbService.persistAction(
          {
            type: ActionType.CREATE_SESSION,
            payload: {
              projectId: Number(params.projectId),
              notes: params.notes,
            },
          },
          state
        );
        // add to the state once session is created in the database
        if (session?.sessionId) {
          dispatch({
            type: ActionType.CREATE_SESSION,
            payload: {
              sessionId: Number(session.sessionId),
              projectId: Number(params.projectId),
              notes: params.notes,
            },
          });
        }
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    stopSession: async (totalDuration: number = 0) => {
      if (!state.sessions.currentSession) return;

      try {
        await dbService.persistAction(
          {
            type: ActionType.END_SESSION,
            payload: {
              sessionId: Number(state.sessions.currentSession.sessionId),
              duration: totalDuration,
            },
          },
          state
        );
        dispatch({
          type: ActionType.END_SESSION,
          payload: {
            sessionId: Number(state.sessions.currentSession.sessionId),
            duration: totalDuration,
          },
        });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    pauseSession: () => {
      dispatch({ type: ActionType.PAUSE_SESSION });
    },
    resumeSession: () => {
      dispatch({ type: ActionType.RESUME_SESSION });
    },
    updateSessionNotes: async (sessionId: number, notes: string) => {
      try {
        await dbService.persistAction(
          {
            type: ActionType.UPDATE_SESSION_NOTES,
            payload: { sessionId: Number(sessionId), notes },
          },
          state
        );
        dispatch({
          type: ActionType.UPDATE_SESSION_NOTES,
          payload: { sessionId: Number(sessionId), notes },
        });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    updateSessionDuration: async (sessionId: number, duration: number) => {
      try {
        await dbService.persistAction(
          {
            type: ActionType.UPDATE_SESSION_DURATION,
            payload: { sessionId: Number(sessionId), duration },
          },
          state
        );
        dispatch({
          type: ActionType.UPDATE_SESSION_DURATION,
          payload: { sessionId: Number(sessionId), duration },
        });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    setSessions: (sessions: Session[]) => {
      dispatch({ type: ActionType.SET_SESSIONS, payload: sessions });
    },
    deleteSession: async (sessionId: number) => {
      try {
        await dbService.persistAction(
          {
            type: ActionType.DELETE_SESSION,
            payload: { sessionId: Number(sessionId) },
          },
          state
        );
        dispatch({
          type: ActionType.DELETE_SESSION,
          payload: { sessionId: Number(sessionId) },
        });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
  };
};

export const useTags = () => {
  const context = useContext(AppContext);
  const database = useDatabase();
  if (!context) throw new Error('useTags must be used within an AppProvider');
  const { state, dispatch } = context;
  const dbService = createDatabaseService(database);

  return {
    tags: state.tags,
    addTag: async (tag: Tag) => {
      try {
        const created = await dbService.persistAction(
          { type: ActionType.ADD_TAG, payload: tag },
          state
        );
        dispatch({ type: ActionType.ADD_TAG, payload: created });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    updateTag: async (tag: Tag) => {
      try {
        const updated = await dbService.persistAction(
          { type: ActionType.UPDATE_TAG, payload: tag },
          state
        );
        dispatch({ type: ActionType.UPDATE_TAG, payload: updated });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
    deleteTag: async (id: string) => {
      try {
        await dbService.persistAction({ type: ActionType.DELETE_TAG, payload: id }, state);
        dispatch({ type: ActionType.DELETE_TAG, payload: id });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
  };
};

export const useSettings = () => {
  const context = useContext(AppContext);
  const database = useDatabase();
  if (!context) throw new Error('useSettings must be used within an AppProvider');
  const { state, dispatch } = context;
  const dbService = createDatabaseService(database);

  return {
    settings: state.settings,
    updateSettings: async (settings: Partial<Settings>) => {
      try {
        await dbService.persistAction(
          { type: ActionType.UPDATE_SETTINGS, payload: settings },
          state
        );
        dispatch({ type: ActionType.UPDATE_SETTINGS, payload: settings });
      } catch (error) {
        if (error instanceof DatabaseError) {
          dispatch({ type: ActionType.SET_ERROR, payload: error.message });
          dispatch({ type: ActionType.RESTORE_STATE, payload: error.oldState });
        }
        throw error;
      }
    },
  };
};

export const useUI = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useUI must be used within an AppProvider');
  const { state, dispatch } = context;
  return {
    ui: state.ui,
    toggleTheme: () => {
      dispatch({ type: ActionType.TOGGLE_THEME });
    },
    setError: (error: string | undefined) => {
      dispatch({ type: ActionType.SET_ERROR, payload: error });
    },
  };
};
