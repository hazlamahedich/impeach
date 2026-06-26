// Story 1.11 — Task 3: Corpus Freeze Primitive (SC-7, AC-F1-10)
// @rules SC-7, AC-F1-10

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freezeCorpus, MANIFEST_SCHEMA_VERSION, type CorpusManifest } from './freeze.js';

describe('Story 1.11 — Task 3: freezeCorpus() (SC-7, AC-F1-10)', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'iip-freeze-'));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('deterministic: same corpus → same hash', async () => {
    const a = join(workDir, 'a');
    const b = join(workDir, 'b');
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(join(a, 'x.txt'), 'hello');
    await writeFile(join(a, 'y.txt'), 'world');

    // Identical content in both dirs.
    await writeFile(join(b, 'x.txt'), 'hello');
    await writeFile(join(b, 'y.txt'), 'world');

    const fa = await freezeCorpus(a, { writeManifest: false });
    const fb = await freezeCorpus(b, { writeManifest: false });
    expect(fa.corpusHash).toBe(fb.corpusHash);
    expect(fa.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('different corpus → different hash', async () => {
    const a = join(workDir, 'a');
    const b = join(workDir, 'b');
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(join(a, 'x.txt'), 'hello');
    await writeFile(join(b, 'x.txt'), 'goodbye');

    const fa = await freezeCorpus(a, { writeManifest: false });
    const fb = await freezeCorpus(b, { writeManifest: false });
    expect(fa.corpusHash).not.toBe(fb.corpusHash);
  });

  it('single file added → hash changes, manifest reflects new file', async () => {
    const dir = join(workDir, 'corpus');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.txt'), 'one');

    const before = await freezeCorpus(dir, { writeManifest: false });
    expect(before.manifest.files).toHaveLength(1);

    await writeFile(join(dir, 'b.txt'), 'two');
    const after = await freezeCorpus(dir, { writeManifest: false });
    expect(after.manifest.files).toHaveLength(2);
    expect(after.corpusHash).not.toBe(before.corpusHash);
    expect(after.manifest.files.map((f) => f.path)).toContain('b.txt');
  });

  it('empty corpus → valid manifest with empty files array', async () => {
    const dir = join(workDir, 'empty');
    await mkdir(dir, { recursive: true });
    const result = await freezeCorpus(dir, { writeManifest: false });
    expect(result.manifest.files).toEqual([]);
    expect(result.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Empty-corpus hash is the SHA-256 of empty input (deterministic).
    expect(result.manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
  });

  it('rejects empty corpusDir', async () => {
    await expect(freezeCorpus('', { writeManifest: false })).rejects.toThrow(
      'corpusDir must be a non-empty path',
    );
  });

  it('walks nested directories and records relative paths', async () => {
    const dir = join(workDir, 'nested');
    await mkdir(join(dir, 'sub', 'deep'), { recursive: true });
    await writeFile(join(dir, 'top.txt'), 'top');
    await writeFile(join(dir, 'sub', 'mid.txt'), 'mid');
    await writeFile(join(dir, 'sub', 'deep', 'bot.txt'), 'bot');

    const result = await freezeCorpus(dir, { writeManifest: false });
    const paths = result.manifest.files.map((f) => f.path).sort();
    expect(paths).toEqual(
      ['sub/deep/bot.txt', 'sub/mid.txt', 'top.txt'].sort(),
    );
    // All paths are relative (no leading slash, no absolute prefix).
    for (const p of result.manifest.files) {
      expect(p.path).not.toMatch(/^\//);
      expect(p.path).not.toMatch(/^[A-Za-z]:/);
    }
  });

  it('each file sha256 matches an independent computation', async () => {
    const dir = join(workDir, 'hash');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.txt'), 'content-a');

    const result = await freezeCorpus(dir, { writeManifest: false });
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      enc.encode('content-a'),
    );
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(result.manifest.files[0]?.sha256).toBe(`sha256:${hex}`);
  });

  it('writes manifest to <corpus-parent>/<hash>/manifest.json when writeManifest=true', async () => {
    const dir = join(workDir, 'corpus');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'a.txt'), 'one');

    const outDir = join(workDir, 'out');
    const result = await freezeCorpus(dir, { outDir, writeManifest: true });
    const manifestPath = join(outDir, result.corpusHash, 'manifest.json');
    const raw = await readFile(manifestPath, 'utf8');
    const parsed: CorpusManifest = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(parsed.corpusHash).toBe(result.corpusHash);
    expect(parsed.files).toEqual(result.manifest.files);
  });

  it('corpusHash is independent of file enumeration order (sorted by path)', async () => {
    // Same files added in different orders must hash identically because the
    // manifest is canonicalised by sorting files on relative path.
    const a = join(workDir, 'a');
    const b = join(workDir, 'b');
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(join(a, 'z.txt'), 'z');
    await writeFile(join(a, 'a.txt'), 'a');
    await writeFile(join(b, 'a.txt'), 'a');
    await writeFile(join(b, 'z.txt'), 'z');

    const fa = await freezeCorpus(a, { writeManifest: false });
    const fb = await freezeCorpus(b, { writeManifest: false });
    expect(fa.corpusHash).toBe(fb.corpusHash);
  });
});
