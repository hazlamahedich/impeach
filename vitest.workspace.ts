import { defineWorkspace } from 'vitest/config';

// Enumerates all 12 package workspaces (each carries its own vitest.config.ts
// so `turbo run test` stays isolated per package) plus the root smoke suite.
export default defineWorkspace([
  'packages/*',
  {
    test: {
      name: 'smoke',
      environment: 'node',
      include: ['tests/smoke/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  },
]);
