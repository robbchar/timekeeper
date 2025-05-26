import '@testing-library/jest-dom';
import { expect, afterEach, afterAll, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { initializeDatabase } from '../../electron/database';

// Extend Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => ':memory:'),
  },
}));

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Set up test database
beforeAll(async () => {
  await initializeDatabase();
});

// Clean up after tests
afterAll(async () => {
  cleanup();

  // Wait for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
});
