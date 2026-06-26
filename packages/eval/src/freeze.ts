/**
 * Corpus Freeze Primitive (SC-7, AC-F1-10).
 *
 * ``freezeCorpus(corpusDir)`` walks a golden corpus directory, computes the
 * SHA-256 of each file (Web Crypto ``crypto.subtle.digest`` — NOT
 * ``node:crypto``), and derives a deterministic aggregate corpus hash.
 *
 * Output contract — ``manifest.json``:
 * ```json
 * {
 *   "schemaVersion": "1.0.0",
 *   "corpusHash": "sha256:<64-hex>",
 *   "files": [{ "path": "relative/path.txt", "sha256": "sha256:<64-hex>" }]
 * }
 * ```
 *
 * The aggregate ``corpusHash`` is computed over the sorted (by relative
 * path) concatenation of ``${path}\0${sha256}\n`` entries — canonicalised
 * so enumeration order does not move the hash (determinism is a hard gate
 * for content-addressed reproduction, SC-7).
 *
 * @rules SC-7, AC-F1-10
 */
import { AppError } from '@iip/contracts';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** Pinned manifest protocol version (mirrors EvalResult's pinning discipline). */
export const MANIFEST_SCHEMA_VERSION = '1.0.0' as const;

/** Default golden corpus directory (configurable via ``--corpus-dir``). */
export const DEFAULT_CORPUS_DIR = 'eval/corpus/golden';

/** Default output directory for the per-corpus-hash manifest tree. */
export const DEFAULT_OUT_DIR = 'eval/corpus';

/** SHA-256 hex digest prefixed with the algorithm name for forward-compat. */
type Sha256 = `sha256:${string}`;

/** A single file entry inside a frozen corpus manifest. */
export interface CorpusFile {
  /** POSIX-style relative path from the corpus root (forward slashes). */
  readonly path: string;
  /** ``sha256:<64-hex>`` of the file's bytes. */
  readonly sha256: Sha256;
}

/** The full manifest written to ``<outDir>/<corpusHash>/manifest.json``. */
export interface CorpusManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  readonly corpusHash: Sha256;
  readonly files: readonly CorpusFile[];
}

/** Return shape of {@link freezeCorpus}. */
export interface CorpusFreezeResult {
  readonly corpusHash: Sha256;
  readonly manifest: CorpusManifest;
  /** Absolute path the manifest was written to (only when ``writeManifest``). */
  readonly manifestPath?: string;
}

/**
 * Compute the SHA-256 of a string/``Uint8Array`` using Web Crypto
 * (``crypto.subtle.digest`` — Node 18+, Bun, edge-compatible).
 */
async function sha256(data: Uint8Array): Promise<Sha256> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

/** Convert a platform-native relative path to POSIX forward-slash form. */
function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/**
 * Recursively walk ``dir`` and return every regular file's absolute path.
 * Directory entries are descended into; symlinks are reported as-is (the
 * eventual ``stat`` filters non-regular entries).
 */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    // Skip macOS AppleDouble resource forks on external drives.
    if (e.name.startsWith('._')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Freeze a corpus directory: hash every file, derive the aggregate corpus
 * hash, and (optionally) write ``manifest.json`` to
 * ``<outDir>/<corpusHash>/manifest.json``.
 *
 * @param corpusDir Directory containing the golden corpus files.
 * @param opts.outDir Override the manifest output root (default: ``eval/corpus``).
 * @param opts.writeManifest When true, write the manifest to disk.
 *
 * @rules SC-7, AC-F1-10
 */
export async function freezeCorpus(
  corpusDir: string,
  opts: { outDir?: string; writeManifest?: boolean } = {},
): Promise<CorpusFreezeResult> {
  if (typeof corpusDir !== 'string' || corpusDir.trim().length === 0) {
    throw new AppError(
      'corpusDir must be a non-empty path',
      'freeze:invalid_corpus_dir',
    );
  }

  const files = await walk(corpusDir);

  // Hash every file and capture (relative-posix-path, sha256) pairs.
  const entries: CorpusFile[] = [];
  for (const abs of files) {
    const rel = toPosix(relative(corpusDir, abs));
    const bytes = await readFileBytes(abs);
    const hash = await sha256(bytes);
    entries.push({ path: rel, sha256: hash });
  }

  // Canonicalise: sort by relative path so enumeration order cannot move the
  // aggregate hash. SC-7 demands determinism across runs/machines.
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Aggregate corpus hash = SHA-256 of "${path}\0${sha256}\n" for every file,
  // concatenated in sorted order. Empty corpus → SHA-256 of empty input
  // (deterministic sentinel, not a magic constant).
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const e of entries) {
    chunks.push(encoder.encode(`${e.path}\0${e.sha256}\n`));
  }
  const totalLen = chunks.reduce((n, c) => n + c.byteLength, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  const corpusHash = await sha256(merged);

  const manifest: CorpusManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    corpusHash,
    files: entries,
  };

  let manifestPath: string | undefined;
  if (opts.writeManifest) {
    const outRoot = opts.outDir ?? DEFAULT_OUT_DIR;
    const dir = join(outRoot, corpusHash);
    await mkdir(dir, { recursive: true });
    manifestPath = join(dir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  return manifestPath === undefined
    ? { corpusHash, manifest }
    : { corpusHash, manifest, manifestPath };
}

/** Read a file's bytes as a ``Uint8Array`` (zero-copy view on the buffer). */
async function readFileBytes(path: string): Promise<Uint8Array> {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(path);
  // ``Buffer`` IS a ``Uint8Array``; the cast keeps the type narrow without
  // copying. ``buffer.subarray`` would also work but adds nothing here.
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
