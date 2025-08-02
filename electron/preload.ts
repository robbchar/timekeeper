import { makeDbShape } from './helpers';
import type { DatabaseAPI } from '@/types/database';
import { contextBridge, ipcRenderer } from 'electron';
console.log('preload loaded');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('database', makeDbShape(ipcRenderer.invoke));

declare global {
  interface Window {
    database: DatabaseAPI;
  }
}
