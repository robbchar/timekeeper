import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-utils/setup.ts'],
    include: ['src/**/*db.test.ts?(x)', 'electron/**/*db.test.ts?(x)'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
  optimizeDeps: {
    exclude: ['electron'],
  },
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
