import React, { useReducer, useMemo, useCallback } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { appReducer } from '@/state/reducers/appReducer';
import { initialState } from '@/state/initialState';
import { useDatabase } from '@/contexts/DatabaseContext';
import { createDatabaseService } from '@/state/services/databaseService';
import type { DatabaseProjectCreate, ProjectUpdate, Project } from '@/types/project';
import { ActionType } from '@/types/state';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const database = useDatabase();
  const dbService = createDatabaseService(database);

  // Always fresh state getter
  const getState = useCallback(() => state, [state]);

  const createProject = useCallback(
    async (project: DatabaseProjectCreate): Promise<Project | null> => {
      const createdProject = (await dbService.persistAction(
        { type: ActionType.CREATE_PROJECT, payload: project },
        getState()
      )) as Project;
      dispatch({ type: ActionType.CREATE_PROJECT, payload: createdProject });
      return createdProject;
    },
    [dbService, getState, dispatch]
  );

  const updateProject = useCallback(
    async (project: ProjectUpdate): Promise<void> => {
      const updated = (await dbService.persistAction(
        { type: ActionType.UPDATE_PROJECT, payload: project },
        getState()
      )) as ProjectUpdate;
      if (updated) {
        dispatch({ type: ActionType.UPDATE_PROJECT, payload: updated });
      }
    },
    [dbService, getState, dispatch]
  );

  const deleteProject = useCallback(
    async (projectId: number): Promise<void> => {
      await dbService.persistAction(
        { type: ActionType.DELETE_PROJECT, payload: projectId },
        getState()
      );
      dispatch({ type: ActionType.DELETE_PROJECT, payload: projectId });
    },
    [dbService, getState, dispatch]
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      getState,
      createProject,
      updateProject,
      deleteProject,
    }),
    [state, dispatch, getState, createProject, updateProject, deleteProject]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
