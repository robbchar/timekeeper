import { useAppContext } from '@/state/context/AppContext';
import type { Project, Session, Tag, Settings } from '@/types/state';
import { ActionType } from '@/types/state';

export const useProjects = () => {
  const { state, dispatch } = useAppContext();

  return {
    projects: state.projects,
    addProject: (project: Project) => dispatch({ type: ActionType.ADD_PROJECT, payload: project }),
    updateProject: (project: Partial<Project> & { id: string }) =>
      dispatch({ type: ActionType.UPDATE_PROJECT, payload: project }),
    deleteProject: (id: string) => dispatch({ type: ActionType.DELETE_PROJECT, payload: id }),
  };
};

export const useSessions = () => {
  const { state, dispatch } = useAppContext();

  return {
    sessions: state.sessions,
    startSession: (session: Session) =>
      dispatch({ type: ActionType.START_SESSION, payload: session }),
    stopSession: (id: string) => dispatch({ type: ActionType.STOP_SESSION, payload: { id } }),
    updateSession: (session: Partial<Session> & { id: string }) =>
      dispatch({ type: ActionType.UPDATE_SESSION, payload: session }),
    deleteSession: (id: string) => dispatch({ type: ActionType.DELETE_SESSION, payload: id }),
  };
};

export const useTags = () => {
  const { state, dispatch } = useAppContext();

  return {
    tags: state.tags,
    addTag: (tag: Tag) => dispatch({ type: ActionType.ADD_TAG, payload: tag }),
    updateTag: (tag: Partial<Tag> & { id: string }) =>
      dispatch({ type: ActionType.UPDATE_TAG, payload: tag }),
    deleteTag: (id: string) => dispatch({ type: ActionType.DELETE_TAG, payload: id }),
  };
};

export const useSettings = () => {
  const { state, dispatch } = useAppContext();

  return {
    settings: state.settings,
    updateSettings: (settings: Partial<Settings>) =>
      dispatch({ type: ActionType.UPDATE_SETTINGS, payload: settings }),
  };
};

export const useUI = () => {
  const { state, dispatch } = useAppContext();

  return {
    ui: state.ui,
    toggleTheme: () => dispatch({ type: ActionType.TOGGLE_THEME }),
    setCurrentProject: (projectId: string | null) =>
      dispatch({ type: ActionType.SET_CURRENT_PROJECT, payload: projectId }),
    setLoading: (isLoading: boolean) =>
      dispatch({ type: ActionType.SET_LOADING, payload: isLoading }),
    setError: (error: string | null) => dispatch({ type: ActionType.SET_ERROR, payload: error }),
  };
};
