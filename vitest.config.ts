import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@job-hunter/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
});
