import React, { createContext, useContext, ReactNode } from 'react';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import type { Tag } from '@/types/tag';

// Define the shape of the database context
interface DatabaseContextType {
  // Projects
  createProject: (name: string, description?: string, color?: string) => Promise<number>;
  getProject: (id: number) => Promise<Project>;
  getAllProjects: () => Promise<Project[]>;
  deleteProject: (id: number) => Promise<{ changes: number }>;
  updateProject: (id: number, name: string) => Promise<{ changes: number }>;
  // Sessions
  createSession: (
    projectId: number,
    startTime: string,
    notes?: string,
    tags?: number[]
  ) => Promise<number>;
  endSession: (sessionId: number, duration: number) => Promise<{ changes: number }>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  // Tags
  createTag: (name: string, color?: string) => Promise<number>;
  getAllTags: () => Promise<Tag[]>;
  // Settings
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<{ changes: number }>;
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
    console.log('Creating project:', { name, description, color });
    const result = await window.database.createProject(name, description, color);
    console.log('Create project result:', result);
    return result.itemId;
  };

  const getProject = async (id: number): Promise<Project> => {
    console.log('Getting project:', id);
    const projects = await window.database.getProjects();
    console.log('All projects:', projects);
    const project = projects.find(p => p.id === id);
    if (!project) {
      throw new Error(`Project with id ${id} not found`);
    }
    return project;
  };

  const getAllProjects = async (): Promise<Project[]> => {
    console.log('Getting all projects...');
    try {
      const projects = await window.database.getProjects();
      console.log('Retrieved projects:', projects);
      return projects;
    } catch (error) {
      console.error('Error getting projects:', error);
      throw error;
    }
  };

  const deleteProject = async (id: number): Promise<{ changes: number }> => {
    console.log('Deleting project:', id);
    try {
      const result = await window.database.deleteProject(id);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const updateProject = async (id: number, name: string): Promise<{ changes: number }> => {
    console.log('Updating project:', { id, name });
    try {
      const result = await window.database.updateProject(id, name);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  // Sessions
  const createSession = async (
    projectId: number,
    startTime: string,
    notes?: string,
    tags?: number[]
  ): Promise<number> => {
    console.log('Creating session:', { projectId, startTime, notes, tags });
    const result = await window.database.createSession(projectId, startTime, notes, tags);
    console.log('Create session result:', result);
    return result.itemId;
  };

  const endSession = async (sessionId: number, duration: number): Promise<{ changes: number }> => {
    console.log('Ending session:', { sessionId, duration });
    const result = await window.database.endSession(sessionId, duration);
    return { changes: result.changes };
  };

  const getSessionsForProject = async (projectId: number): Promise<Session[]> => {
    console.log('Getting sessions for project:', projectId);
    const sessions = await window.database.getSessions();
    console.log('All sessions:', sessions);
    return sessions.filter(s => s.projectId === projectId);
  };

  // Tags
  const createTag = async (name: string, color?: string): Promise<number> => {
    console.log('Creating tag:', { name, color });
    const result = await window.database.createTag(name, color);
    console.log('Create tag result:', result);
    return result.itemId;
  };

  const getAllTags = async (): Promise<Tag[]> => {
    console.log('Getting all tags...');
    const tags = await window.database.getTags();
    console.log('Retrieved tags:', tags);
    return tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  };

  // Settings
  const getSetting = async (key: string): Promise<string | undefined> => {
    console.log('Getting setting:', key);
    return window.database.getSetting(key);
  };

  const setSetting = async (key: string, value: string): Promise<{ changes: number }> => {
    console.log('Setting:', { key, value });
    const result = await window.database.setSetting(key, value);
    return { changes: result.changes };
  };

  const value: DatabaseContextType = {
    createProject,
    getProject,
    getAllProjects,
    deleteProject,
    updateProject,
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
