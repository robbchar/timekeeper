import '@testing-library/jest-dom';
import { expect, afterEach, afterAll, beforeAll, vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockIpcMain } from './ipc-test-helper';

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
}));

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Set up the mock before each test
beforeEach(() => {});

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
