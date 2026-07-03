import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Story 2.6b-code — include .spec.ts under __tests__/ (AC #6: the Filipino
    // OQ-9 gate test file is packages/eval/src/__tests__/filipino-oq9.spec.ts,
    // deliberately a .spec.ts to distinguish the gate spec from co-located
    // unit .test.ts files).
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
  },
});
