import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Isolate DOM between tests — without this, rendered output accumulates across
// tests and queries report "found multiple elements".
afterEach(() => {
  cleanup();
});
