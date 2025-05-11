import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('database', {
  // Project operations
  createProject: (name: string, description?: string, color?: string) =>
    ipcRenderer.invoke('database:createProject', name, description, color),

  getProjects: () => ipcRenderer.invoke('database:getProjects'),

  updateProject: (id: number, name: string) =>
    ipcRenderer.invoke('database:updateProject', id, name),

  deleteProject: (id: number) => ipcRenderer.invoke('database:deleteProject', id),

  // Session operations
  createSession: (projectId: number, startTime: string, notes?: string) =>
    ipcRenderer.invoke('database:createSession', projectId, startTime, notes),

  endSession: (sessionId: number, endTime: string, duration: number) =>
    ipcRenderer.invoke('database:endSession', sessionId, endTime, duration),

  getSessions: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('database:getSessions', startDate, endDate),

  // Tag operations
  createTag: (name: string, color?: string) =>
    ipcRenderer.invoke('database:createTag', name, color),

  getTags: () => ipcRenderer.invoke('database:getTags'),

  // Settings operations
  getSetting: (key: string) => ipcRenderer.invoke('database:getSetting', key),

  setSetting: (key: string, value: string) => ipcRenderer.invoke('database:setSetting', key, value),

  // Test helper
  reset: () => ipcRenderer.invoke('database:reset'),
});
