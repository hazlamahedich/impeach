import { defineConfig } from 'vitest/config';

/**
 * Integration test configuration.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets that do not
 * propagate cleanly across worker threads; a single fork prevents hangs under
 * concurrent container lifecycle.
 *
 * @rules AC-1, AC-2
 * @adr ADR-002
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});
