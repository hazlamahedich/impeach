// target-path: packages/render/gate-boundary.test.ts
// RED — Story 1.4 Render Gate ESLint Boundary (AC-2)
// Refs: AC-2, SC-3, STR-4, AC-F1-08, ADR-0007
// @rules AC-2, SC-3, STR-4 @adr ADR-0007

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Linter } from 'eslint';
import { RuleTester } from 'eslint';

const ROOT = join(__dirname, '..', '..');
const linter = new Linter();

describe.skip('Story 1.4 — Render Gate ESLint boundary (AC-2)', () => {
  // RED — packages/render does not exist; @iip/eslint-plugin not authored

  it('packages/render imports ONLY @iip/contracts (SC-3)', async () => {
    // RED — render package absent
    const { importResolutionBoundary } = await import('@iip/eslint-plugin');
    const violations = await importResolutionBoundary.scan('packages/render/src', {
      allowed: ['@iip/contracts'],
      banned: ['@iip/rag', '@iip/db', '@iip/graph', '@iip/llm'],
    });
    expect(violations).toEqual([]);
  });

  it('packages/rag is banned from importing @iip/render (STR-4)', async () => {
    // RED — rag package absent
    const { importResolutionBoundary } = await import('@iip/eslint-plugin');
    const violations = await importResolutionBoundary.scan('packages/rag/src', {
      banned: ['@iip/render'],
    });
    expect(violations).toEqual([]);
  });

  it('RenderInput zod schema defined in packages/contracts/src/render.ts', async () => {
    // RED — contracts package absent
    const mod = await import('@iip/contracts/render');
    expect(mod.RenderInput).toBeDefined();
    expect(typeof mod.RenderInput.parse).toBe('function');
  });

  it('render gate placeholder throws RenderViolation on uncited claim', async () => {
    // RED — gate.ts absent; this is the AC-2 mechanical primitive
    const { gate } = await import('@iip/render/gate');
    const uncited = { text: 'Senator voted against bill X', citations: [] };
    expect(() => gate(uncited)).toThrow(/RenderViolation/);
  });

  it('ESLint rule fires for cross-package violation in render→rag import', async () => {
    // RED — custom rule not authored; synthetic test using ESLint RuleTester
    const { noRestrictedPaths } = await import('@iip/eslint-plugin');
    const ruleTester = new RuleTester();
    ruleTester.run('no-restricted-paths', noRestrictedPaths, {
      valid: [
        { code: `import { RenderInput } from '@iip/contracts/render'`, filename: 'packages/render/src/gate.ts' },
      ],
      invalid: [
        {
          code: `import { ragGenerate } from '@iip/rag'`,
          filename: 'packages/render/src/gate.ts',
          errors: [{ message: /banned/i }],
        },
      ],
    });
  });

  it('CI verifies the boundary (workflow asserts rule runs)', () => {
    // RED — ci.yml absent
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(ci).toMatch(/eslint.*packages\/render/);
  });

  it('no @ts-expect-error / @ts-ignore in packages/render + packages/contracts', () => {
    // RED — Winston #5: type-assertion ban; packages absent
    for (const file of ['packages/render/src/gate.ts', 'packages/contracts/src/render.ts']) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      expect(src).not.toMatch(/@ts-expect-error|@ts-ignore/);
    }
  });
});
