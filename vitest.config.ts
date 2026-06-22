import { defineConfig } from 'vitest/config';

// B3 — root vitest config scoping the ATDD smoke suite (AC-F1-05).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/smoke/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
});
