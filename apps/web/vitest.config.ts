import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(here),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'app/**/*.test.ts',
      'app/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'components/**/*.test.ts',
      'components/**/*.test.tsx',
      'lib/**/*.test.ts',
      'lib/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/._*'],
  },
});
