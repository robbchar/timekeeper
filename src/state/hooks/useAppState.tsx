import { useContext } from 'react';
import { AppContext } from '@/state/context/AppContext';
import type { Project, Tag, Settings } from '@/types/state';
import type { CreateSessionParams } from '@/types/session';
import { ActionType } from '@/types/state';

export const useProjects = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useProjects must be used within an AppProvider');
  const { state, dispatch } = context;
  return {
    projects: state.projects,
    addProject: (project: Project) => {
      dispatch({ type: ActionType.ADD_PROJECT, payload: project });
    },
    updateProject: (project: Project) => {
      dispatch({ type: ActionType.UPDATE_PROJECT, payload: project });
    },
    deleteProject: (id: string) => {
      dispatch({ type: ActionType.DELETE_PROJECT, payload: id });
    },
  };
};

export const useSessions = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSessions must be used within an AppProvider');
  const { state, dispatch } = context;
  return {
    sessions: state.sessions.sessions,
    currentSession: state.sessions.currentSession,
    startSession: (params: CreateSessionParams) => {
      dispatch({ type: ActionType.CREATE_SESSION, payload: params });
    },
    stopSession: () => {
      dispatch({ type: ActionType.END_SESSION });
    },
    pauseSession: () => {
      dispatch({ type: ActionType.PAUSE_SESSION });
    },
    resumeSession: () => {
      dispatch({ type: ActionType.RESUME_SESSION });
    },
    updateSessionNotes: (notes: string) => {
      dispatch({ type: ActionType.UPDATE_SESSION_NOTES, payload: { notes } });
    },
  };
};

export const useTags = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useTags must be used within an AppProvider');
  const { state, dispatch } = context;
  return {
    tags: state.tags,
    addTag: (tag: Tag) => {
      dispatch({ type: ActionType.ADD_TAG, payload: tag });
    },
    updateTag: (tag: Tag) => {
      dispatch({ type: ActionType.UPDATE_TAG, payload: tag });
    },
    deleteTag: (id: string) => {
      dispatch({ type: ActionType.DELETE_TAG, payload: id });
    },
  };
};

export const useSettings = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useSettings must be used within an AppProvider');
  const { state, dispatch } = context;
  return {
    settings: state.settings,
    updateSettings: (settings: Partial<Settings>) => {
      dispatch({ type: ActionType.UPDATE_SETTINGS, payload: settings });
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
