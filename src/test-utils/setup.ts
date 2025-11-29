import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockIpcMain } from './ipc-test-helper';

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Set up the mock before each test
beforeEach(() => {
  // Provide a safe default for tests that render providers without stubbing IPC/database.
  // Individual test files can override this by assigning `window.database` themselves.
  if (!('database' in window) || !window.database) {
    (window as unknown as { database: unknown }).database = {
      // Projects
      createProject: vi.fn().mockResolvedValue({ itemId: 1, changes: 1, record: {} }),
      getProject: vi.fn().mockResolvedValue(undefined),
      getProjects: vi.fn().mockResolvedValue([]),
      deleteProject: vi.fn().mockResolvedValue({ changes: 0 }),
      updateProject: vi.fn().mockResolvedValue({ changes: 0, record: {} }),
      // Sessions
      createSession: vi.fn().mockResolvedValue({ itemId: 1, changes: 1, record: {} }),
      endSession: vi.fn().mockResolvedValue({ changes: 0, record: {} }),
      getSessions: vi.fn().mockResolvedValue([]),
      getSessionsForProject: vi.fn().mockResolvedValue([]),
      updateSessionNotes: vi.fn().mockResolvedValue({ changes: 0, record: {} }),
      updateSessionDuration: vi.fn().mockResolvedValue({ changes: 0, record: {} }),
      deleteSession: vi.fn().mockResolvedValue({ changes: 0 }),
      // Tags
      createTag: vi.fn().mockResolvedValue({ itemId: 1, changes: 1, record: {} }),
      getTags: vi.fn().mockResolvedValue([]),
      updateTag: vi.fn().mockResolvedValue({ changes: 0, record: {} }),
      deleteTag: vi.fn().mockResolvedValue({ changes: 0, deleted: {} }),
      // Project–Tag relationships
      getTagsForProject: vi.fn().mockResolvedValue([]),
      setProjectTags: vi.fn().mockResolvedValue({ changes: 0 }),
      // Settings
      getSetting: vi.fn().mockResolvedValue(undefined),
      setSetting: vi.fn().mockResolvedValue({ changes: 0 }),
      // Test helper
      reset: vi.fn().mockResolvedValue({ changes: 0 }),
    };
  }
});

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Set up test database
beforeAll(async () => {
  // await initializeDatabase();
});

// Clean up after tests
afterAll(async () => {
  cleanup();

  // Wait for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
});
