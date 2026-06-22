// AC-F1-05 — ATDD smoke suite for Story 1.1 (activated: GREEN).
// Refs: AC-F1-01, AC-F1-02, AC-F1-03, AC-F1-04, AC-F1-06
// Activates: post-scaffold (this story IS the scaffold; tests assert its output).
// NOTE: subprocess helper uses node:child_process (zero-dep) instead of execa;
// the assertions are identical to the ATDD contract.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..'); // tests/smoke -> repo root
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');
const exists = (p: string): boolean => existsSync(join(ROOT, p));
const parse = (p: string): Record<string, unknown> =>
  JSON.parse(read(p)) as Record<string, unknown>;

const PACKAGES = [
  'contracts', 'db', 'graph', 'llm', 'ingest', 'rag',
  'citation', 'render', 'eval', 'editorial', 'config', 'auth',
];
const APPS = ['api', 'ingest-worker', 'serve-worker', 'audit-worker', 'enqueuer'];

describe('Story 1.1 — Turborepo scaffold', () => {
  it('AC-F1-01: pnpm build exits 0 with zero TS errors', () => {
    const result = spawnSync('pnpm', ['build'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stderr ?? '').not.toMatch(/error TS\d+/);
  });

  it('AC-F1-02: pnpm typecheck passes across all workspaces', () => {
    const result = spawnSync('pnpm', ['typecheck'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('AC-F1-03: >=1 vitest placeholder passes in every TS package', () => {
    for (const pkg of PACKAGES) {
      const result = spawnSync(
        'pnpm',
        ['--filter', `@iip/${pkg}`, 'run', 'test'],
        { cwd: ROOT, encoding: 'utf8' },
      );
      expect(result.status).toBe(0);
    }
  });

  it('AC-F1-04: all 12 packages exist under packages/ by name', () => {
    for (const pkg of PACKAGES) {
      expect(exists(`packages/${pkg}/package.json`)).toBe(true);
      const manifest = parse(`packages/${pkg}/package.json`);
      expect(manifest['name']).toBe(`@iip/${pkg}`);
    }
  });

  it('AC-F1-04: all 5 app stubs exist under apps/', () => {
    for (const app of APPS) {
      expect(exists(`apps/${app}/package.json`)).toBe(true);
    }
  });

  it('AC-F1-06: workspace config files exist with required contents', () => {
    expect(exists('turbo.json')).toBe(true);
    expect(exists('pnpm-workspace.yaml')).toBe(true);
    expect(exists('tsconfig.base.json')).toBe(true);
    expect(exists('.npmrc')).toBe(true);
    expect(exists('.nvmrc')).toBe(true);

    // STR-12: pnpm-workspace lists apps/* + packages/* ONLY (tools/ excluded)
    const ws = read('pnpm-workspace.yaml');
    expect(ws).toMatch(/packages:\s*\n\s*-\s+apps\/\*/);
    expect(ws).toMatch(/-\s+packages\/\*/);
    expect(ws).not.toMatch(/-\s+tools\/\*/);

    // node-linker=hoisted (required for native AGE bindings)
    expect(read('.npmrc')).toMatch(/node-linker\s*=\s*hoisted/);
    expect(read('.npmrc')).toMatch(/engine-strict\s*=\s*true/);

    // Node 22 pin
    expect(read('.nvmrc').trim()).toMatch(/^22\./);

    // turbo v2 uses "tasks", not "pipeline"
    const turbo = parse('turbo.json');
    expect(turbo['tasks']).toBeDefined();
    expect(turbo['pipeline']).toBeUndefined();
  });
});
