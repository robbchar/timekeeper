import type { AppState, Action, Project, Tag, Settings } from '@/types/state';
import { ActionType, Theme } from '@/types/state';
import { sessionReducer } from './sessionReducer';
import type { SessionState, SessionAction } from '@/types/session';

export const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case ActionType.CREATE_SESSION:
    case ActionType.PAUSE_SESSION:
    case ActionType.RESUME_SESSION:
    case ActionType.UPDATE_SESSION_NOTES:
      return {
        ...state,
        sessions: sessionReducer(
          state.sessions as unknown as SessionState,
          action as unknown as SessionAction
        ),
      };

    case ActionType.END_SESSION: {
      const newSessions = sessionReducer(
        state.sessions as unknown as SessionState,
        action as unknown as SessionAction
      );

      // Update project stats if a session was completed
      if (newSessions.sessions.length > state.sessions.sessions.length) {
        const completedSession = newSessions.sessions[newSessions.sessions.length - 1];
        const updatedProjects = state.projects.map(project => {
          if (project.id === Number(completedSession.projectId)) {
            return {
              ...project,
              totalTime: project.totalTime + completedSession.duration,
              sessionCount: project.sessionCount + 1,
              updatedAt: new Date(),
            };
          }
          return project;
        });

        return {
          ...state,
          projects: updatedProjects,
          sessions: newSessions,
        };
      }

      return {
        ...state,
        sessions: newSessions,
      };
    }

    case ActionType.ADD_PROJECT:
      return {
        ...state,
        projects: [...state.projects, action.payload as Project],
      };

    case ActionType.UPDATE_PROJECT:
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === (action.payload as Project).id ? (action.payload as Project) : project
        ),
      };

    case ActionType.DELETE_PROJECT:
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
      };

    case ActionType.ADD_TAG:
      return {
        ...state,
        tags: [...state.tags, action.payload as Tag],
      };

    case ActionType.UPDATE_TAG:
      return {
        ...state,
        tags: state.tags.map(tag =>
          tag.id === (action.payload as Tag).id ? (action.payload as Tag) : tag
        ),
      };

    case ActionType.DELETE_TAG:
      return {
        ...state,
        tags: state.tags.filter(tag => tag.id !== action.payload),
      };

    case ActionType.UPDATE_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...(action.payload as Partial<Settings>) },
      };

    case ActionType.TOGGLE_THEME:
      return {
        ...state,
        ui: {
          ...state.ui,
          theme: state.ui.theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT,
        },
      };

    case ActionType.SET_CURRENT_PROJECT:
      return {
        ...state,
        ui: {
          ...state.ui,
          currentProject: Number(action.payload as string),
        },
      };

    case ActionType.SET_LOADING:
      return {
        ...state,
        ui: {
          ...state.ui,
          isLoading: action.payload as boolean,
        },
      };

    case ActionType.SET_ERROR:
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload as string,
        },
      };

    case ActionType.CLEAR_ERROR:
      return {
        ...state,
        ui: {
          ...state.ui,
          error: undefined,
        },
      };

    default:
      return state;
  }
};
