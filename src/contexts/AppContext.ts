import { createContext } from 'react';
import type { AppState } from '@/types/state';
import type { AppAction } from '@/types/AppAction';
import type { Dispatch } from 'react';
import type { DatabaseProjectCreate, ProjectUpdate, Project } from '@/types/project';

export interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  getState: () => AppState;
  createProject: (p: DatabaseProjectCreate) => Promise<Project | null>;
  updateProject: (p: ProjectUpdate) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);
