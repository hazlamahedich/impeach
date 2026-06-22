import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// AC-F1-08 — flat ESLint config at repo root. Foundational ruleset for the
// scaffold; defamation-grade boundary/rule promotion lands in Story 1.4.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/._*', // macOS AppleDouble resource forks (external drive)
      '_bmad/**',
      '_bmad-output/**',
      'docs/**',
      'design-artifacts/**',
      'graphify-out/**',
      'tools/**',
      // Pre-existing tooling dirs (not part of this scaffold):
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.opencode/**',
      '.git/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
);
