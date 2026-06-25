// LINT FIXTURE (AC #7) — intentionally illegal. Do not import or build.
//
// Represents a file at packages/render/src/illegal.ts that imports @iip/rag,
// which violates SC-3: packages/render may import ONLY @iip/contracts at the
// rag→render seam.
//
// This file is excluded from lint (eslint `ignores`), build, and typecheck.
// It is consumed only by tests/lint/import-boundaries.test.ts, which feeds its
// source to ESLint via lintText() with a virtual filePath under packages/render/.
import { packageName } from '@iip/rag';

export const illegal = packageName;
