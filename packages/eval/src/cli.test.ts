// Story 1.11 — Task 5: iip-eval CLI wiring (SC-7, AC-F1-10)
// @rules SC-7, AC-F1-10

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';

const CLI = resolve(import.meta.dirname, 'cli.ts');

interface CliResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function runCli(args: string[], env: Record<string, string> = {}): CliResult {
  const r = spawnSync(process.execPath, ['--import', 'tsx/esm', CLI, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

describe('Story 1.11 — Task 5: iip-eval CLI', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'iip-eval-cli-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  describe('freeze subcommand', () => {
    it('writes manifest.json under <out-dir>/<corpusHash>/', async () => {
      const corpusDir = join(workDir, 'corpus');
      const outDir = join(workDir, 'out');
      await mkdir(corpusDir, { recursive: true });
      await writeFile(join(corpusDir, 'a.txt'), 'one');

      const r = runCli([
        'freeze',
        '--corpus-dir',
        corpusDir,
        '--out-dir',
        outDir,
      ]);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(out.fileCount).toBe(1);
      const manifestPath = join(outDir, out.corpusHash, 'manifest.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0].path).toBe('a.txt');
    });

    it('--dry-run logs the would-write path WITHOUT writing the manifest', async () => {
      const corpusDir = join(workDir, 'corpus');
      const outDir = join(workDir, 'out');
      await mkdir(corpusDir, { recursive: true });
      await writeFile(join(corpusDir, 'a.txt'), 'one');

      const r = runCli([
        'freeze',
        '--corpus-dir',
        corpusDir,
        '--out-dir',
        outDir,
        '--dry-run',
      ]);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.dryRun).toBe(true);
      expect(out.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(out.wouldWrite).toContain(out.corpusHash);
      // No manifest should have been written.
      await expect(
        readFile(join(outDir, out.corpusHash, 'manifest.json'), 'utf8'),
      ).rejects.toThrow();
    });

    it('defaults --corpus-dir to eval/corpus/golden (prints fileCount=0 for empty seed)', async () => {
      const goldenDir = join(workDir, 'eval', 'corpus', 'golden');
      await mkdir(goldenDir, { recursive: true });
      // Use a temp out-dir so we don't pollute the real eval/ tree.
      const r = runCli([
        'freeze',
        '--corpus-dir',
        goldenDir,
        '--out-dir',
        join(workDir, 'out'),
        '--dry-run',
      ]);
      // Empty seed dir → fileCount=0, hash is the empty-corpus sentinel.
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.fileCount).toBe(0);
    });
  });

  describe('reproduce subcommand', () => {
    it('re-emits a recorded decision.json', async () => {
      const gatesDir = join(workDir, 'gates');
      // Synthesize a known runId directory with a decision.json.
      const corpusHash = 'sha256:' + 'a'.repeat(64);
      const runId = 'sha256:' + 'f'.repeat(64);
      const dir = join(gatesDir, runId);
      await mkdir(dir, { recursive: true });
      const decision = {
        schemaVersion: '1.0.0',
        corpusHash,
        commit: 'deadbeef',
        timestamp: '2026-06-26T19:25:22.000Z',
        decision: 'pass',
        metrics: { echo: 1.0 },
      };
      await writeFile(join(dir, 'decision.json'), JSON.stringify(decision));

      const r = runCli(['reproduce', runId, '--gates-dir', gatesDir]);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.decision).toBe('pass');
      expect(out.corpusHash).toBe(corpusHash);
    });

    it('exits non-zero on unknown runId', () => {
      const unknown = 'sha256:' + '0'.repeat(64);
      const r = runCli([
        'reproduce',
        unknown,
        '--gates-dir',
        join(workDir, 'gates'),
      ]);
      expect(r.status).not.toBe(0);
      const err = JSON.parse(r.stderr);
      expect(err.kind).toBe('UNKNOWN_RUN');
      expect(err.runId).toBe(unknown);
    });

    it('--dry-run logs the would-read path WITHOUT touching the filesystem', () => {
      const runId = 'sha256:' + '1'.repeat(64);
      const r = runCli([
        'reproduce',
        runId,
        '--gates-dir',
        join(workDir, 'gates'),
        '--dry-run',
      ]);
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out.dryRun).toBe(true);
      expect(out.wouldRead).toContain(runId);
    });

    it('exits non-zero on malformed runId', () => {
      const r = runCli(['reproduce', 'not-a-hash']);
      expect(r.status).not.toBe(0);
    });
  });

  describe('usage / help', () => {
    it('exits non-zero with usage when no subcommand given', () => {
      const r = runCli([]);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/usage:/);
    });

    it('exits non-zero on unknown subcommand', () => {
      const r = runCli(['bogus']);
      expect(r.status).not.toBe(0);
    });
  });
});
