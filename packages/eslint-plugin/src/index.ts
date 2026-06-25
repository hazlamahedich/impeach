export { noInternalImport } from './rules/no-internal-import.js';
export type { Restriction } from './rules/no-internal-import.js';

import { noInternalImport } from './rules/no-internal-import.js';

/**
 * Plugin definition (ESLint flat-config plugin object).
 *
 * @rules STR-5, PC-1
 */
export const plugin = {
  meta: { name: '@iip/eslint-plugin' },
  rules: {
    'no-internal-import': noInternalImport,
  },
};

/**
 * Flat-config preset (PC-1, STR-5).
 *
 * Seeds the load-bearing graph-writer seam: `@iip/graph/writer` is write-only
 * and may only be imported from `apps/ingest-worker/src/graph-builder/**`.
 * Reads via `@iip/graph/reader` remain public. Extend this preset's `rules`
 * with more restrictions as later stories harden additional seams.
 *
 * Spread this object into the root `eslint.config.js` flat-config array.
 */
export const importBoundaryPreset = {
  name: '@iip/eslint-plugin/import-boundary-preset',
  plugins: { '@iip': plugin },
  rules: {
    '@iip/no-internal-import': [
      'error',
      {
        restrictions: [
          {
            source: '@iip/graph/writer',
            allow: ['apps/ingest-worker/src/graph-builder/**'],
            message:
              "'@iip/graph/writer' is write-only and may only be imported from apps/ingest-worker/src/graph-builder/** (STR-5).",
          },
        ],
      },
    ],
  },
};
