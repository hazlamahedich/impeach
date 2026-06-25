// LINT FIXTURE (AC #7) — intentionally illegal. Do not import or build.
//
// Represents a file at packages/rag/src/illegal.ts that imports @iip/render,
// which violates STR-4 / SC-3: RAG must emit RenderInput and push it to the
// render-queue; it must never call the render gate directly.
//
// This file is excluded from lint (eslint `ignores`), build, and typecheck.
// It is consumed only by tests/lint/import-boundaries.test.ts, which feeds its
// source to ESLint via lintText() with a virtual filePath under packages/rag/.
import { renderGate } from '@iip/render';

export const illegal = renderGate;
