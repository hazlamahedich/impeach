import { defineWorkspace } from 'vitest/config';

// Enumerates all 12 package workspaces (each carries its own vitest.config.ts
// so `turbo run test` stays isolated per package) plus the root suites.
//
// The citation-or-silence contract test (P1) is RED by design until Epic 2
// Story 2.1 implements renderGate. It lives in a separate `contract-red`
// project so the main `contract` project stays GREEN in CI.
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
  {
    test: {
      name: 'contract',
      environment: 'node',
      include: ['tests/contract/**/*.test.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/._*',
        '**/citation-or-silence*',
      ],
    },
  },
  {
    test: {
      name: 'contract-red',
      environment: 'node',
      include: ['tests/contract/citation-or-silence.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  },
  {
    test: {
      name: 'integration',
      environment: 'node',
      include: ['tests/integration/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
      pool: 'forks',
      poolOptions: {
        forks: { singleFork: true },
      },
    },
  },
  {
    test: {
      name: 'lint',
      environment: 'node',
      include: ['tests/lint/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  },
  {
    test: {
      name: 'perf',
      environment: 'node',
      include: ['tests/perf/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  },
  {
    test: {
      name: 'chaos',
      environment: 'node',
      include: ['tests/chaos/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/._*'],
    },
  },
]);
