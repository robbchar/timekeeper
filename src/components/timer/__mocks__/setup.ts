import { vi } from 'vitest';
import React from 'react';
import { Theme } from '@/types/state';

// Extend Window interface to include electron
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
      };
    };
  }
}

// Create mock data without hoisting
const createMockProjects = () => [
  {
    id: 1,
    name: 'Project 1',
    description: '',
    totalTime: 0,
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: 'Project 2',
    description: '',
    totalTime: 0,
    sessionCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const createMockSessions = () => [
  {
    id: 1,
    projectId: 1,
    startTime: '2024-03-10T10:00:00Z',
    endTime: '2024-03-10T11:00:00Z',
    duration: 3600,
    notes: 'Test session 1',
  },
  {
    id: 2,
    projectId: 2,
    startTime: '2024-03-10T12:00:00Z',
    endTime: '2024-03-10T13:30:00Z',
    duration: 5400,
    notes: 'Test session 2',
  },
];

// Initialize default mock data
const defaultProjects = createMockProjects();
const defaultSessions = createMockSessions();

// Keep track of current sessions for IPC mock
let currentSessions = defaultSessions;

// Mock window.electron for tests
const mockIpcRenderer = {
  invoke: vi.fn().mockImplementation((channel: string) => {
    // Handle different database channels
    switch (channel) {
      case 'db:getSessionsForProject':
        return Promise.resolve(currentSessions);
      default:
        return Promise.resolve([]);
    }
  }),
};

// Set up the mock
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: mockIpcRenderer,
  },
  writable: true,
  configurable: true,
});

const createMockContextValue = () => ({
  state: {
    projects: defaultProjects,
    sessions: {
      currentSession: null,
      sessions: [],
      isLoading: false,
      error: null,
    },
    tags: [],
    settings: {
      timeFormat: '24h',
      defaultProject: 1,
    },
    ui: {
      theme: Theme.LIGHT,
      error: undefined,
      currentProject: 1,
      isTimerRunning: false,
      isLoading: false,
    },
  },
  dispatch: vi.fn(),
});

// Create a mock function for useDatabase
const mockUseDatabase = vi.fn();

// Function to set up the mock with specific sessions
const setupMockDatabase = (sessions = defaultSessions) => {
  // Update both the database mock and IPC mock
  currentSessions = sessions;
  mockUseDatabase.mockImplementation(() => ({
    // Projects
    createProject: vi.fn().mockResolvedValue(1),
    getProject: vi
      .fn()
      .mockResolvedValue({ id: 1, name: 'Project 1', createdAt: new Date().toISOString() }),
    getAllProjects: vi.fn().mockResolvedValue(defaultProjects),
    // Sessions
    createSession: vi
      .fn()
      .mockImplementation((projectId: number, startTime: string, notes?: string) => {
        const newSession = {
          id: Date.now(),
          projectId: projectId,
          startTime: startTime,
          endTime: '',
          duration: 0,
          notes: notes || '',
        };
        currentSessions = [...currentSessions, newSession];
        return Promise.resolve({ lastInsertRowid: newSession.id, changes: 1 });
      }),
    endSession: vi.fn().mockResolvedValue(undefined),
    getSessionsForProject: vi.fn().mockResolvedValue(sessions),
    // Tags
    createTag: vi.fn().mockResolvedValue(1),
    getAllTags: vi.fn().mockResolvedValue([]),
    // Settings
    getSetting: vi.fn().mockResolvedValue(undefined),
    setSetting: vi.fn().mockResolvedValue(undefined),
  }));
};

// Mock the hooks
vi.mock('@/contexts/DatabaseContext', () => ({
  useDatabase: mockUseDatabase,
  DatabaseProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

export {
  defaultProjects,
  defaultSessions,
  createMockProjects,
  createMockSessions,
  createMockContextValue,
  mockUseDatabase,
  setupMockDatabase,
  mockIpcRenderer,
};
