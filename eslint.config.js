import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import { importBoundaryPreset } from '@iip/eslint-plugin';

/**
 * Globs covering both the workspace path and the `node_modules/@iip/*` symlink
 * path for a package, so resolution-based rules match regardless of whether
 * the resolver returns a realpath or the symlink location (pnpm hoisted mode).
 */
const pkg = (name) => [`packages/${name}/**`, `**/node_modules/@iip/${name}/**`];

/**
 * Root flat ESLint config (AC-F1-08).
 *
 * Story 1.4 promotes the foundational ruleset to defamation-grade import
 * boundaries:
 *   - SC-3: `packages/render` imports ONLY `@iip/contracts`.
 *   - STR-4: `@iip/render` is banned in `packages/rag/**` and the serve-worker
 *            RAG processor (cross-process handoff via the render-queue).
 *   - STR-5: `@iip/graph/writer` is write-only (see @iip/eslint-plugin preset).
 *
 * Layered enforcement:
 *   1. `import/no-restricted-paths`  — structural zone bans (path resolution).
 *   2. `no-restricted-imports`       — deterministic string-based module bans
 *                                      (belt-and-suspenders; survives resolver gaps).
 *   3. `import/no-relative-packages` — block `../../render/src/gate.ts` bypasses.
 *   4. `@iip/no-internal-import`      — exports-map / internal-subtree reach (STR-5).
 *
 * Plugin choice: `eslint-plugin-import-x@4.17.0` — the ESM-first fork with
 * first-class flat-config + TypeScript support (preferred over the CJS-bound
 * `eslint-plugin-import@2.32.0`). Exact version pinned.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.next/**',
      '**/next-env.d.ts', // Next.js auto-generated — triple-slash references required by framework
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
      // Story 1.4: lint fixtures are intentionally illegal — excluded from lint.
      'tests/lint-fixtures/**',
      '**/.stryker-tmp/**',
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
  // Global: block cross-package relative-import bypasses (STR-4/SC-3).
  // The TypeScript resolver lets import-x resolve workspace packages whose
  // `exports` point at `.ts` source, so the resolution-based rules
  // (no-restricted-paths / no-relative-packages) can match package zones.
  {
    name: 'iip/import-x-plugin',
    plugins: { import: importX },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: ['tsconfig.json', 'packages/*/tsconfig.json', 'apps/*/tsconfig.json'],
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      'import/no-relative-packages': 'error',
    },
  },
  // SC-3 / STR-4: RAG must not import @iip/render — emit RenderInput, push to queue.
  {
    name: 'iip/rag-bans-render',
    files: [
      'packages/rag/**/*.ts',
      'apps/serve-worker/src/processors/rag/**/*.ts',
    ],
    plugins: { import: importX },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@iip/render',
              message:
                'RAG must not import @iip/render — emit RenderInput and push to the render-queue (STR-4, SC-3).',
            },
          ],
          patterns: [
            {
              group: ['@iip/render/**'],
              message:
                'RAG must not reach into @iip/render/** — emit RenderInput and push to the render-queue (STR-4, SC-3).',
            },
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: '.',
          zones: [
            {
              target: 'packages/rag/**',
              from: pkg('render'),
              message:
                'RAG must not import from packages/render (STR-4, SC-3).',
            },
            {
              target: 'apps/serve-worker/src/processors/rag/**',
              from: pkg('render'),
              message:
                'serve-worker RAG processor must not import from packages/render (STR-4).',
            },
          ],
        },
      ],
    },
  },
  // SC-3: packages/render imports ONLY @iip/contracts.
  {
    name: 'iip/render-imports-only-contracts',
    files: ['packages/render/**/*.ts'],
    plugins: { import: importX },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@iip/db',
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
            {
              name: '@iip/rag',
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
            {
              name: '@iip/llm',
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
            {
              name: '@iip/ingest',
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
            {
              name: '@iip/graph',
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
          ],
          patterns: [
            {
              group: ['@iip/{db,rag,llm,ingest,graph}/**'],
              message: 'packages/render may only import @iip/contracts (SC-3).',
            },
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: '.',
          zones: [
            {
              target: 'packages/render/**',
              from: [
                ...pkg('rag'),
                ...pkg('llm'),
                ...pkg('ingest'),
                ...pkg('db'),
                ...pkg('graph'),
                'apps/**',
              ],
              message:
                'packages/render may only import @iip/contracts at the rag→render seam (SC-3).',
            },
          ],
        },
      ],
    },
  },
  // STR-5: @iip/graph/writer write-only restriction + internal-path reach.
  importBoundaryPreset,

  // ─────────────────────────────────────────────────────────────────────────
  // Story 2.2 — SEC-1: ban req.auth access in API handlers.
  // Handlers read ONLY req.principal (populated by auth middleware), never
  // req.auth (DoD-1). Enforced via no-restricted-syntax in apps/api/**.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'iip/api-req-auth-ban',
    files: ['apps/api/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='req'][property.name='auth']",
          message:
            'req.auth is banned in API handlers — read req.principal only (SEC-1, DoD-1). The auth middleware populates req.principal from the verified JWT.',
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Story 2.2 — SEC-1/PC-9: process.env reads only in @iip/config.
  // Auth keys must be resolved via @iip/config (sops/age at rest), never
  // read directly from process.env in packages/auth or other packages.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'iip/process-env-restriction',
    files: ['packages/**/*.ts'],
    ignores: [
      'packages/config/**',
      'packages/db/drizzle.config.ts',
      'packages/*/src/**/*.test.ts',
      'packages/eval/src/cli.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            'process.env access is restricted to @iip/config only (PC-9, DoD-4). Resolve configuration via @iip/config.',
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Story 2.2 — SEC-1: packages/auth must not import from apps/*.
  // Auth is a library package; it cannot depend on application code.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'iip/auth-bans-apps',
    files: ['packages/auth/**/*.ts'],
    plugins: { import: importX },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          basePath: '.',
          zones: [
            {
              target: 'packages/auth/**',
              from: 'apps/**',
              message:
                'packages/auth must not import from apps/* — auth is a library package (SEC-1).',
            },
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Story 1.9 — UX-DR31: ban raw fetch() in the web client.
  // The API server, workers, and scripts use fetch legitimately, so this is
  // scoped to apps/web/** only. All client HTTP calls go through apiFetch()
  // (lib/api.ts) which adds AbortController + retry logic.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'iip/web-fetch-ban',
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    ignores: ['apps/web/lib/api.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            'Raw fetch() is banned in the web client. Use apiFetch() from lib/api.ts instead (UX-DR31).',
        },
      ],
    },
  },
);
