import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Isolate DOM between tests — without this, rendered output accumulates across
// tests and queries report "found multiple elements".
afterEach(() => {
  cleanup();
});

// Reset Zustand ephemeral stores between tests (Story 1.9, UX-DR29) so state
// from one test file does not leak into another.
const storeModules = [
  './lib/state/graph-store',
  './lib/state/timeline-store',
  './lib/state/chat-store',
  './lib/state/citation-store',
] as const;

afterEach(async () => {
  await Promise.all(
    storeModules.map(async (mod) => {
      try {
        const { reset } = await import(mod);
        reset();
      } catch (err) {
        // Log unexpected import failures so test isolation issues are visible,
        // but do not fail unrelated tests because one store module is absent.
        console.warn(`Failed to reset Zustand store ${mod}:`, err);
      }
    }),
  );
});
