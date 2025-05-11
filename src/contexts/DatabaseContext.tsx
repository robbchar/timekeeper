import React, { createContext, useContext, ReactNode } from 'react';

// Declare the electron property on the Window interface
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    };
  }
}

// Define types for database entities
interface Project {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

interface Session {
  id: number;
  project_id: number;
  start_time: string;
  end_time?: string;
  duration?: number;
  notes?: string;
}

interface Tag {
  id: number;
  name: string;
  color?: string;
}

// Define the shape of the database context
interface DatabaseContextType {
  // Projects
  createProject: (name: string, description?: string, color?: string) => Promise<number>;
  getProject: (id: number) => Promise<Project>;
  getAllProjects: () => Promise<Project[]>;
  // Sessions
  createSession: (projectId: number, startTime: string, notes?: string) => Promise<number>;
  endSession: (sessionId: number, endTime: string, duration: number) => Promise<void>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  // Tags
  createTag: (name: string, color?: string) => Promise<number>;
  getAllTags: () => Promise<Tag[]>;
  // Settings
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<void>;
}

// Create the context with a default value
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Provider component
export const DatabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Projects
  const createProject = async (
    name: string,
    description?: string,
    color?: string
  ): Promise<number> => {
    return window.electron.ipcRenderer.invoke('db:createProject', {
      name,
      description,
      color,
    }) as Promise<number>;
  };

  const getProject = async (id: number): Promise<Project> => {
    return window.electron.ipcRenderer.invoke('db:getProject', id) as Promise<Project>;
  };

  const getAllProjects = async (): Promise<Project[]> => {
    return window.electron.ipcRenderer.invoke('db:getAllProjects') as Promise<Project[]>;
  };

  // Sessions
  const createSession = async (
    projectId: number,
    startTime: string,
    notes?: string
  ): Promise<number> => {
    return window.electron.ipcRenderer.invoke('db:createSession', {
      projectId,
      startTime,
      notes,
    }) as Promise<number>;
  };

  const endSession = async (
    sessionId: number,
    endTime: string,
    duration: number
  ): Promise<void> => {
    return window.electron.ipcRenderer.invoke('db:endSession', {
      sessionId,
      endTime,
      duration,
    }) as Promise<void>;
  };

  const getSessionsForProject = async (projectId: number): Promise<Session[]> => {
    return window.electron.ipcRenderer.invoke('db:getSessionsForProject', projectId) as Promise<
      Session[]
    >;
  };

  // Tags
  const createTag = async (name: string, color?: string): Promise<number> => {
    return window.electron.ipcRenderer.invoke('db:createTag', { name, color }) as Promise<number>;
  };

  const getAllTags = async (): Promise<Tag[]> => {
    return window.electron.ipcRenderer.invoke('db:getAllTags') as Promise<Tag[]>;
  };

  // Settings
  const getSetting = async (key: string): Promise<string | undefined> => {
    return window.electron.ipcRenderer.invoke('db:getSetting', key) as Promise<string | undefined>;
  };

  const setSetting = async (key: string, value: string): Promise<void> => {
    return window.electron.ipcRenderer.invoke('db:setSetting', { key, value }) as Promise<void>;
  };

  const value: DatabaseContextType = {
    createProject,
    getProject,
    getAllProjects,
    createSession,
    endSession,
    getSessionsForProject,
    createTag,
    getAllTags,
    getSetting,
    setSetting,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
};

// Custom hook to use the database context
export const useDatabase = (): DatabaseContextType => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
