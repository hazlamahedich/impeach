// target-path: tests/smoke/scaffold-smoke.test.ts
// RED — Story 1.1 Turborepo Scaffold & Process Stubs
// Refs: AC-F1-01, AC-F1-02, AC-F1-03
// Activates: post-1.1 (this story IS the scaffold; tests assert its own output)

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execaSync } from 'execa';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p: string) => existsSync(join(ROOT, p));
const parse = (p: string): Record<string, unknown> => JSON.parse(read(p));

const PACKAGES = [
  'contracts', 'db', 'graph', 'llm', 'ingest', 'rag',
  'citation', 'render', 'eval', 'editorial', 'config', 'auth',
];
const APPS = ['api', 'ingest-worker', 'serve-worker', 'audit-worker', 'enqueuer'];

describe.skip('Story 1.1 — Turborepo scaffold', () => {
  // RED — workspace not yet created; scaffold lives outside repo at ATDD time

  it('AC-F1-01: pnpm install && pnpm build exits 0 with zero TS errors', () => {
    // RED — no package.json; pnpm not installable
    const result = execaSync('pnpm', ['build'], { cwd: ROOT, reject: false });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toMatch(/error TS\d+/);
  });

  it('AC-F1-02: pnpm typecheck passes across all workspaces', () => {
    // RED — turbo.json 'typecheck' task missing
    const result = execaSync('pnpm', ['typecheck'], { cwd: ROOT, reject: false });
    expect(result.exitCode).toBe(0);
  });

  it('AC-F1-03: >=1 vitest placeholder passes in every TS package', () => {
    // RED — packages not created yet
    for (const pkg of PACKAGES) {
      const result = execaSync('pnpm', ['vitest', 'run', '--filter', `@iip/${pkg}`], {
        cwd: ROOT, reject: false,
      });
      expect(result.exitCode).toBe(0);
    }
  });

  it('all 12 packages exist under packages/', () => {
    for (const pkg of PACKAGES) {
      expect(exists(`packages/${pkg}/package.json`)).toBe(true);
      const manifest = parse(`packages/${pkg}/package.json`);
      expect(manifest['name']).toBe(`@iip/${pkg}`);
    }
  });

  it('all 5 app stubs exist under apps/', () => {
    for (const app of APPS) {
      expect(exists(`apps/${app}/package.json`)).toBe(true);
    }
  });

  it('workspace config files exist with required contents', () => {
    expect(exists('turbo.json')).toBe(true);
    expect(exists('pnpm-workspace.yaml')).toBe(true);
    expect(exists('tsconfig.base.json')).toBe(true);
    expect(exists('.npmrc')).toBe(true);
    expect(exists('.nvmrc')).toBe(true);

    // STR-12: pnpm-workspace lists apps/* + packages/* ONLY (tools/ excluded)
    const ws = read('pnpm-workspace.yaml');
    expect(ws).toMatch(/packages:\s*\n\s*-\s+apps\/\*/);
    expect(ws).toMatch(/-\s+packages\/\*/);
    expect(ws).not.toMatch(/-\s+tools\/\*/); // tools/ NOT a workspace member

    // node-linker=hoisted (required for native AGE bindings)
    expect(read('.npmrc')).toMatch(/node-linker\s*=\s*hoisted/);

    // Node 22 pin
    expect(read('.nvmrc').trim()).toMatch(/^22\./);

    // turbo v2 uses "tasks", not "pipeline"
    const turbo = parse('turbo.json');
    expect(turbo['tasks']).toBeDefined();
    expect(turbo['pipeline']).toBeUndefined();
  });
});
