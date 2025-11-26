import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AppContext, type AppContextType } from '@/contexts/AppContext';
import { initialState } from '@/state/initialState';
import { useProjects, useSessions, useTags, useSettings, useUI } from './useAppState';
import { ActionType, Theme } from '@/types/state';
import type { AppState, Project, Tag } from '@/types/state';
import type { CreateSessionParams, Session } from '@/types/session';

const mockPersistAction = vi.fn();

vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: vi.fn().mockReturnValue({}),
}));

vi.mock('../services/databaseService', () => ({
  createDatabaseService: () => ({
    persistAction: mockPersistAction,
  }),
  DatabaseError: class DatabaseError extends Error {
    constructor(
      message: string,
      public oldState: AppState
    ) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

const createAppContextValue = (overrides: Partial<AppContextType> = {}): AppContextType => ({
  state: initialState,
  dispatch: vi.fn(),
  getState: () => initialState,
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  ...overrides,
});

const createWrapper =
  (valueOverrides: Partial<AppContextType> = {}) =>
  ({ children }: { children: React.ReactNode }) => (
    <AppContext.Provider value={createAppContextValue(valueOverrides)}>
      {children}
    </AppContext.Provider>
  );

describe('useProjects', () => {
  it('exposes projects and project actions from context', () => {
    const projects: Project[] = [
      {
        projectId: 1,
        name: 'Test Project',
        description: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const createProject = vi.fn();
    const updateProject = vi.fn();
    const deleteProject = vi.fn();

    const wrapper = createWrapper({
      state: { ...initialState, projects },
      createProject,
      updateProject,
      deleteProject,
    });

    const { result } = renderHook(() => useProjects(), { wrapper });

    expect(result.current.projects).toEqual(projects);
    expect(result.current.createProject).toBe(createProject);
    expect(result.current.updateProject).toBe(updateProject);
    expect(result.current.deleteProject).toBe(deleteProject);
  });
});

describe('useSessions', () => {
  it('starts a session via db service and dispatches CREATE_SESSION', async () => {
    const dispatch = vi.fn();
    const state = initialState;
    const wrapper = createWrapper({ state, dispatch });

    const fakeSession: Session = {
      sessionId: 1,
      projectId: 1,
      startTime: new Date(),
      duration: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPersistAction.mockResolvedValueOnce(fakeSession);

    const { result } = renderHook(() => useSessions(), { wrapper });

    const params: CreateSessionParams = { projectId: 1, notes: 'Test session' };

    await act(async () => {
      await result.current.startSession(params);
    });

    expect(mockPersistAction).toHaveBeenCalledWith(
      {
        type: ActionType.CREATE_SESSION,
        payload: {
          projectId: 1,
          notes: 'Test session',
        },
      },
      state
    );

    expect(dispatch).toHaveBeenCalledWith({
      type: ActionType.CREATE_SESSION,
      payload: {
        sessionId: 1,
        projectId: 1,
        notes: 'Test session',
      },
    });
  });
});

describe('useTags', () => {
  it('dispatches ADD_TAG when addTag is called', async () => {
    const dispatch = vi.fn();
    const wrapper = createWrapper({ dispatch });
    const { result } = renderHook(() => useTags(), { wrapper });

    const tag: Tag = {
      id: 1,
      name: 'Test Tag',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPersistAction.mockResolvedValueOnce(tag);

    await act(async () => {
      await result.current.addTag(tag);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: ActionType.ADD_TAG,
      payload: tag,
    });
  });
});

describe('useSettings', () => {
  it('dispatches UPDATE_SETTINGS when updateSettings is called', async () => {
    const dispatch = vi.fn();
    const wrapper = createWrapper({ dispatch });
    const { result } = renderHook(() => useSettings(), { wrapper });

    await act(async () => {
      await result.current.updateSettings({ timeFormat: '12h' });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: ActionType.UPDATE_SETTINGS,
      payload: { timeFormat: '12h' },
    });
  });
});

describe('useUI', () => {
  it('toggles theme via dispatch', () => {
    const dispatch = vi.fn();
    const wrapper = createWrapper({
      state: {
        ...initialState,
        ui: {
          ...initialState.ui,
          theme: Theme.LIGHT,
        },
      },
      dispatch,
    });

    const { result } = renderHook(() => useUI(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(dispatch).toHaveBeenCalledWith({ type: ActionType.TOGGLE_THEME });
  });

  it('sets error via dispatch', () => {
    const dispatch = vi.fn();
    const wrapper = createWrapper({ dispatch });
    const { result } = renderHook(() => useUI(), { wrapper });

    act(() => {
      result.current.setError('Test error');
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: ActionType.SET_ERROR,
      payload: 'Test error',
    });
  });
});
