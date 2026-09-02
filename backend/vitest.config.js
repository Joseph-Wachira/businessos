import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/setup/globalSetup.js',
    setupFiles: ['./tests/setup/testDb.js'],
    fileParallelism: false,
    hookTimeout: 30000,
  },
});
