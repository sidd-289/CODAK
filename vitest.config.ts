import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
