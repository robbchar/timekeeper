import { Mocked, vi } from 'vitest';
import React from 'react';
import { Theme } from '@/types/state';
import type { DatabaseContextType } from '@/contexts/DatabaseContext';

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
    projectId: 1,
    name: 'Project 1',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    projectId: 2,
    name: 'Project 2',
    description: '',
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
const currentSessions = defaultSessions;

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

function setupMockDatabase(): Mocked<DatabaseContextType> {
  return {
    // Projects
    createProject: vi.fn(),
    getProject: vi.fn(),
    getAllProjects: vi.fn(),
    deleteProject: vi.fn(),
    updateProject: vi.fn(),

    // Sessions
    createSession: vi.fn(),
    endSession: vi.fn(),
    updateSessionNotes: vi.fn(),
    updateSessionDuration: vi.fn(),
    getSessions: vi.fn(),
    getSessionsForProject: vi.fn(),
    deleteSession: vi.fn(),

    // Tags
    createTag: vi.fn(),
    getAllTags: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),

    // Project–Tag relationships
    getTagsForProject: vi.fn(),
    setProjectTags: vi.fn(),

    // Settings
    getSetting: vi.fn(),
    setSetting: vi.fn(),
  };
}

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
