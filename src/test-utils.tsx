import React from 'react';
import { render, renderHook } from '@testing-library/react';
import { AppProvider } from './state/context/AppContext';
import { ThemeProvider } from 'styled-components';
import { theme } from './styles/theme';
import type { AppContextType } from './state/context/AppContext';
import { useAppContext } from './state/context/AppContext';
import { DatabaseProvider } from './contexts/DatabaseContext';
import { ProjectsProvider } from './contexts/ProjectsContext';
import { vi, beforeEach } from 'vitest';
import type { DatabaseAPI } from '@/types/database';

// Mock window.database
export const mockDatabase: DatabaseAPI = {
  createProject: vi.fn().mockResolvedValue(1),
  getProjects: vi.fn().mockResolvedValue([]),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn().mockResolvedValue(1),
  endSession: vi.fn().mockResolvedValue(undefined),
  getSessions: vi.fn().mockResolvedValue([]),
  createTag: vi.fn().mockResolvedValue(1),
  getTags: vi.fn().mockResolvedValue([]),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn().mockResolvedValue(undefined),
};

// Add window.database to global
declare global {
  interface Window {
    database: DatabaseAPI;
  }
}

// Set up the mock before each test
beforeEach(() => {
  // Reset all mocks
  Object.values(mockDatabase).forEach(mock => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  // Set up window.database
  window.database = mockDatabase;
});

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AppProvider>
      <DatabaseProvider>
        <ProjectsProvider>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </ProjectsProvider>
      </DatabaseProvider>
    </AppProvider>
  );
};

const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, { wrapper: AllTheProviders, ...options });

// Helper to get the AppContext from a rendered component
const getAppContext = (): AppContextType => {
  const { result } = renderHook(() => useAppContext(), {
    wrapper: AllTheProviders,
  });
  return result.current;
};

export * from '@testing-library/react';
export { customRender as render, getAppContext };
