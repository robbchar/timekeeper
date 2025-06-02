import type { DatabaseAPI } from '@/types/database';
import { ipcRenderer } from 'electron';

// Export database instance and helper functions
export const database: DatabaseAPI = {
  // Project operations
  createProject: async (name: string, description?: string, color?: string) => {
    return ipcRenderer.invoke('database:createProject', name, description, color);
  },

  getProjects: async () => {
    return ipcRenderer.invoke('database:getProjects');
  },

  deleteProject: async (id: number) => {
    return ipcRenderer.invoke('database:deleteProject', id);
  },

  updateProject: async (id: number, name: string) => {
    return ipcRenderer.invoke('database:updateProject', id, name);
  },

  // Session operations
  createSession: async (projectId: number, startTime: string, notes?: string, tags?: number[]) => {
    return ipcRenderer.invoke('database:createSession', projectId, startTime, notes, tags);
  },

  endSession: async (sessionId: number, duration: number) => {
    return ipcRenderer.invoke('database:endSession', sessionId, duration);
  },

  getSessions: async () => {
    return ipcRenderer.invoke('database:getSessions');
  },

  getSessionsForProject: async (projectId: number) => {
    return ipcRenderer.invoke('database:getSessionsForProject', projectId);
  },

  // Tag operations
  createTag: async (name: string, color?: string) => {
    return ipcRenderer.invoke('database:createTag', name, color);
  },

  getTags: async () => {
    return ipcRenderer.invoke('database:getTags');
  },

  // Settings operations
  getSetting: async (key: string) => {
    return ipcRenderer.invoke('database:getSetting', key);
  },

  setSetting: async (key: string, value: string) => {
    return ipcRenderer.invoke('database:setSetting', key, value);
  },

  // Test helper
  reset: async () => {
    return ipcRenderer.invoke('database:reset');
  },
};
