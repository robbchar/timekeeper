import React, { createContext, useContext, ReactNode } from 'react';
import type { Project } from '@/types/project';
import type { Session } from '@/types/session';
import type { Tag } from '@/types/tag';
import type { ChangesOnlyResponse } from '@/types/database-response';
import { mapDbTagToTag, mapDbTagsToTags } from '@/utils/tagMapping';

// Define the shape of the database context
export interface DatabaseContextType {
  // Projects
  createProject: (name: string, description?: string, color?: string) => Promise<Project>;
  getProject: (projectId: number) => Promise<Project>;
  getAllProjects: () => Promise<Project[]>;
  deleteProject: (projectId: number) => Promise<ChangesOnlyResponse>;
  updateProject: (
    projectId: number,
    name: string,
    description?: string,
    color?: string
  ) => Promise<Project>;
  // Sessions
  createSession: (projectId: number, notes?: string) => Promise<Session>;
  endSession: (sessionId: number, duration: number) => Promise<ChangesOnlyResponse>;
  updateSessionNotes: (sessionId: number, notes?: string) => Promise<ChangesOnlyResponse>;
  updateSessionDuration: (sessionId: number, duration: number) => Promise<ChangesOnlyResponse>;
  getSessions: () => Promise<Session[]>;
  getSessionsForProject: (projectId: number) => Promise<Session[]>;
  deleteSession: (sessionId: number) => Promise<ChangesOnlyResponse>;
  // Tags
  createTag: (name: string, color?: string) => Promise<Tag>;
  getAllTags: () => Promise<Tag[]>;
  updateTag: (tagId: number, name: string, color?: string) => Promise<Tag>;
  deleteTag: (tagId: number) => Promise<ChangesOnlyResponse>;
  // Project–Tag relationships
  getTagsForProject: (projectId: number) => Promise<Tag[]>;
  setProjectTags: (projectId: number, tagIds: number[]) => Promise<ChangesOnlyResponse>;
  // Settings
  getSetting: (key: string) => Promise<string | undefined>;
  setSetting: (key: string, value: string) => Promise<ChangesOnlyResponse>;
}

// Create the context with a default value
const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

// Provider component
export const DatabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const toChangesOnly = (result: ChangesOnlyResponse): ChangesOnlyResponse => ({
    changes: result.changes,
  });

  // Projects
  const getProject = async (projectId: number): Promise<Project> => {
    const project = await window.database.getProject(projectId);
    if (!project) {
      throw new Error(`Project with id ${projectId} not found`);
    }
    return toDomainProject(project as ProjectDatabase);
  };

  const getAllProjects = async (): Promise<Project[]> => {
    try {
      const projects = await window.database.getProjects();
      return (projects as ProjectDatabase[]).map(toDomainProject);
    } catch (error) {
      console.error('Error getting projects:', error);
      throw error;
    }
  };

  const createProject = async (
    name: string,
    description?: string,
    color?: string
  ): Promise<Project> => {
    const result = await window.database.createProject(name, description, color);
    return toDomainProject(result.record as ProjectDatabase);
  };

  const deleteProject = async (projectId: number): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.deleteProject(projectId);
      return result;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  };

  const updateProject = async (
    projectId: number,
    name: string,
    description?: string,
    color?: string
  ): Promise<Project> => {
    try {
      const result = await window.database.updateProject(projectId, name, description, color);
      return toDomainProject(result.record as ProjectDatabase);
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  // Sessions
  const getSessions = async (): Promise<Session[]> => {
    try {
      const sessions = await window.database.getSessions();
      return (sessions as SessionDatabase[]).map(toDomainSession);
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  };

  const createSession = async (projectId: number, notes?: string): Promise<Session> => {
    try {
      const result = await window.database.createSession(projectId, notes);
      return toDomainSession(result.record as SessionDatabase);
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const endSession = async (id: number, duration: number): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.endSession(id, duration);
      return toChangesOnly(result);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  };

  const getSessionsForProject = async (projectId: number): Promise<Session[]> => {
    try {
      const sessions = await window.database.getSessionsForProject(projectId);
      return (sessions as SessionDatabase[]).map(toDomainSession);
    } catch (error) {
      console.error('Error getting sessions for project:', error);
      throw error;
    }
  };

  const updateSessionNotes = async (
    sessionId: number,
    notes?: string
  ): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.updateSessionNotes(sessionId, notes || '');
      return toChangesOnly(result);
    } catch (error) {
      console.error('Error updating session notes:', error);
      throw error;
    }
  };

  const updateSessionDuration = async (
    sessionId: number,
    duration: number
  ): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.updateSessionDuration(sessionId, duration);
      return toChangesOnly(result);
    } catch (error) {
      console.error('Error updating session duration:', error);
      throw error;
    }
  };

  const deleteSession = async (sessionId: number): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.deleteSession(sessionId);
      return result;
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  };

  // Tags
  const createTag = async (name: string, color?: string): Promise<Tag> => {
    try {
      const result = await window.database.createTag(name, color);
      return mapDbTagToTag(result.record);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  };

  const getAllTags = async (): Promise<Tag[]> => {
    try {
      const tags = await window.database.getTags();
      return mapDbTagsToTags(tags);
    } catch (error) {
      console.error('Error getting all tags:', error);
      throw error;
    }
  };

  const updateTag = async (tagId: number, name: string, color?: string): Promise<Tag> => {
    try {
      const result = await window.database.updateTag(tagId, name, color);
      return mapDbTagToTag(result.record);
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  };

  const deleteTag = async (tagId: number): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.deleteTag(tagId);
      return toChangesOnly(result);
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  };

  const getTagsForProject = async (projectId: number): Promise<Tag[]> => {
    try {
      const tags = await window.database.getTagsForProject(projectId);
      return mapDbTagsToTags(tags);
    } catch (error) {
      console.error('Error getting tags for project:', error);
      throw error;
    }
  };

  const setProjectTags = async (
    projectId: number,
    tagIds: number[]
  ): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.setProjectTags(projectId, tagIds);
      return result;
    } catch (error) {
      console.error('Error setting project tags:', error);
      throw error;
    }
  };

  // Settings
  const getSetting = async (key: string): Promise<string | undefined> => {
    try {
      return await window.database.getSetting(key);
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  };

  const setSetting = async (key: string, value: string): Promise<ChangesOnlyResponse> => {
    try {
      const result = await window.database.setSetting(key, value);
      return result;
    } catch (error) {
      console.error('Error setting setting:', error);
      throw error;
    }
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
    getTagsForProject,
    setProjectTags,
    getSetting,
    setSetting,
  };

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useDatabase = (): DatabaseContextType => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
