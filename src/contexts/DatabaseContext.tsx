import React, { createContext, useContext, ReactNode } from 'react';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import type { Tag } from '@/types/tag';

// Define the shape of the database context
interface DatabaseContextType {
  // Projects
  createProject: (name: string, description?: string, color?: string) => Promise<number>;
  getProject: (projectId: number) => Promise<Project>;
  getAllProjects: () => Promise<Project[]>;
  deleteProject: (projectId: number) => Promise<{ changes: number }>;
  updateProject: (projectId: number, name: string) => Promise<{ changes: number }>;
  // Sessions
  createSession: (sessionId: number, notes?: string) => Promise<number>;
  endSession: (sessionId: number, duration: number) => Promise<{ changes: number }>;
  updateSessionNotes: (sessionId: number, notes?: string) => Promise<{ changes: number }>;
  updateSessionDuration: (sessionId: number, duration: number) => Promise<{ changes: number }>;
  getSessions: () => Promise<Session[]>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  deleteSession: (sessionId: number) => Promise<{ changes: number }>;
  // Tags
  createTag: (name: string, color?: string) => Promise<number>;
  getAllTags: () => Promise<Tag[]>;
  updateTag: (tagId: number, name: string, color?: string) => Promise<{ changes: number }>;
  deleteTag: (tagId: number) => Promise<{ changes: number }>;
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

  const getProject = async (projectId: number): Promise<Project> => {
    console.log('Getting project:', projectId);
    const projects = await window.database.getProjects();
    console.log('All projects:', projects);
    const project = projects.find(p => p.projectId === projectId);
    if (!project) {
      throw new Error(`Project with id ${projectId} not found`);
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

  const deleteProject = async (projectId: number): Promise<{ changes: number }> => {
    console.log('Deleting project:', projectId);
    try {
      const result = await window.database.deleteProject(projectId);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const updateProject = async (projectId: number, name: string): Promise<{ changes: number }> => {
    console.log('Updating project:', { projectId, name });
    try {
      const result = await window.database.updateProject(projectId, name);
      return { changes: result.changes };
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  // Sessions
  const getSessions = async (): Promise<Session[]> => {
    console.log('Getting all sessions...');
    const sessions = await window.database.getSessions();
    return sessions;
  };

  const createSession = async (projectId: number, notes?: string): Promise<number> => {
    console.log('Creating session:', { projectId, notes });
    const result = await window.database.createSession(projectId, notes);
    console.log('Create session result:', result);
    return result.itemId;
  };

  const endSession = async (id: number, duration: number): Promise<{ changes: number }> => {
    console.log('Ending session:', { id, duration });
    const result = await window.database.endSession(id, duration);
    return { changes: result.changes };
  };

  const getSessionsForProject = async (projectId: number): Promise<Session[]> => {
    console.log('Getting sessions for project:', projectId);
    const sessions = await window.database.getSessions();
    console.log('All sessions:', sessions);
    return sessions.filter(s => s.projectId === projectId);
  };

  const updateSessionNotes = async (
    sessionId: number,
    notes?: string
  ): Promise<{ changes: number }> => {
    console.log('Updating session notes:', { sessionId, notes });
    const result = await window.database.updateSessionNotes(sessionId, notes);
    return { changes: result.changes };
  };

  const updateSessionDuration = async (
    sessionId: number,
    duration: number
  ): Promise<{ changes: number }> => {
    console.log('Updating session duration:', { sessionId, duration });
    const result = await window.database.updateSessionDuration(sessionId, duration);
    return { changes: result.changes };
  };

  const deleteSession = async (sessionId: number): Promise<{ changes: number }> => {
    console.log('Deleting session:', sessionId);
    const result = await window.database.deleteSession(sessionId);
    return { changes: result.changes };
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

  const updateTag = async (
    tagId: number,
    name: string,
    color?: string
  ): Promise<{ changes: number }> => {
    console.log('Updating tag:', { tagId, name, color });
    const result = await window.database.updateTag(tagId, name, color);
    return { changes: result.changes };
  };

  const deleteTag = async (tagId: number): Promise<{ changes: number }> => {
    console.log('Deleting tag:', tagId);
    const result = await window.database.deleteTag(tagId);
    return { changes: result.changes };
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
    updateSessionNotes,
    updateSessionDuration,
    getSessionsForProject,
    getSessions,
    deleteSession,
    createTag,
    getAllTags,
    updateTag,
    deleteTag,
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
