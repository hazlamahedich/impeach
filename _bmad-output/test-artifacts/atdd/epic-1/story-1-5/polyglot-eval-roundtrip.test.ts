// target-path: packages/eval/polyglot-eval-roundtrip.test.ts
// RED — Story 1.5 Polyglot Eval Seam (SC-1)
// Refs: AC-F1-05 (KEYSTONE), SC-1, ADR-014
// @rules SC-1, AC-1 @adr ADR-014

import { describe, it, expect } from 'vitest';
import { execaSync } from 'execa';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

describe.skip('Story 1.5 — Polyglot eval seam (SC-1, ADR-014)', () => {
  // RED — packages/eval + tools/eval absent

  it('tools/eval has pyproject.toml, uv config, Dockerfile (containerized)', () => {
    // RED — tools/eval not scaffolded
    expect(readFileSync(join(ROOT, 'tools/eval/pyproject.toml'), 'utf8')).toMatch(/\[project\]/);
    expect(readFileSync(join(ROOT, 'tools/eval/Dockerfile'), 'utf8')).toMatch(/FROM python:3.12/);
  });

  it('tools/eval/package.json is a shim (no JS, scripts shell to uv run)', () => {
    // RED — STR-12: tools/ is NOT a pnpm workspace member
    const pkg = JSON.parse(readFileSync(join(ROOT, 'tools/eval/package.json'), 'utf8'));
    expect(pkg.scripts?.test).toMatch(/uv run pytest/);
    expect(pkg.scripts?.lint).toMatch(/uv run ruff/);
    expect(pkg.main).toBeUndefined();
    // Inline comment documenting intentional non-standard layout
    expect(readFileSync(join(ROOT, 'tools/eval/package.json'), 'utf8')).toMatch(/shim.*intentional/i);
  });

  it('turbo.json declares py:* tasks (py:lint, py:test dependsOn py:lint)', () => {
    // RED — turbo v2 tasks schema; py:* task absent
    const turbo = JSON.parse(readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
    expect(turbo.tasks['py#lint']).toBeDefined();
    expect(turbo.tasks['py#test']?.dependsOn).toContain('py#lint');
  });

  it('invocation is subprocess/CLI, NOT HTTP (ADR-014)', () => {
    // RED — eval bridge absent
    const bridge = readFileSync(join(ROOT, 'packages/eval/src/bridge.ts'), 'utf8');
    expect(bridge).toMatch(/execa|child_process|spawn/);
    expect(bridge).not.toMatch(/fetch\(|axios|http\.request/); // NO HTTP — ADR-014
  });

  it('Python eval workspace returns EvalResult that passes TS-side zod parse (AC-F1-05 KEYSTONE)', async () => {
    // RED — bridge + EvalResult contract absent
    const { runPythonEval } = await import('@iip/eval/bridge');
    const { EvalResult } = await import('@iip/contracts/eval');
    const raw = await runPythonEval({ suite: 'smoke', fixtures: [] });
    const parsed = EvalResult.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('packages/contracts/scripts/gen-pydantic.ts generates pydantic from zod → JSON Schema in CI', async () => {
    // RED — codegen script absent; SC-1: NO hand-written pydantic mirroring zod
    const { generatePydantic } = await import('@iip/contracts/scripts/gen-pydantic');
    const out = await generatePydantic();
    expect(out).toMatch(/class.*BaseModel/);
    expect(out).toMatch(/field_constraints|Field\(/); // PC-9 silently absent otherwise
    expect(out).toMatch(/use_union_operator/); // PEP 604 X | Y
  });

  it('subprocess contract has a schema version (zod ↔ pydantic generated from one source)', () => {
    // RED — schema-version field absent; Python minor lift would silently break the gate
    const contract = readFileSync(join(ROOT, 'packages/contracts/src/eval.ts'), 'utf8');
    expect(contract).toMatch(/schemaVersion/);
  });
});
