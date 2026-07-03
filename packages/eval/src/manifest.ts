/**
 * On-disk corpus manifest validator (Open Item O-2 — ADR-0025 §2, ADR-0026).
 *
 * @rules AC-1, SC-1, SC-7
 * @adr ADR-0025, ADR-0026, ADR-0011
 *
 * **Why this exists (Open Item O-2, Story 2.6c):** the English v0 manifest
 * shipped in the WRONG shape (`{version, entries}` vs the `CorpusManifest`
 * that `freeze.ts` produces: `{schemaVersion, corpusHash, files}`). The defect
 * survived because **nothing asserted the manifest conforms to the schema** —
 * it was caught by eyeball during the Story 2.6 party-mode review, not by any
 * test. This validator is the shared-harness schema guard: defined once here,
 * consumed by every language instance's `*-oq9.spec.ts` + future languages, so
 * a manifest-shape drift is a test-time failure, not a silent field defect.
 *
 * **Untrusted-boundary discipline (Winston #8 / PC-4):** a manifest read from
 * disk is untrusted input — a contributor (or a bad merge) can hand-write any
 * shape. The validator takes `unknown` and either returns a typed
 * `CorpusManifest` or throws `AppError` code `manifest:invalid_shape`. It does
 * NOT use unchecked `as` to the target type (project-context bans `as` without
 * a zod `.parse()` in the same expression; this is the moral equivalent — a
 * runtime type guard, not a cast). The internal `value as Record<string,
 * unknown>` casts are applied only AFTER a `typeof === 'object'` guard and
 * widen to a probe handle for property access, never to the target type.
 *
 * **No zod dependency:** `packages/eval` does not currently depend on zod, and
 * `@iip/contracts` owns the zod schemas. The manifest shape is a narrow,
 * stable, three-field structure pinned to `MANIFEST_SCHEMA_VERSION`; a
 * hand-written guard is defamation-grade stable (no transitive dependency
 * drift can move the validation silently) and matches the closed-form pattern
 * used for κ in `kappa.ts`. If zod is later adopted in `packages/eval`, this
 * guard can be re-expressed as a zod schema without changing its contract.
 *
 * **Relation to `freeze.ts`:** `freeze.ts` PRODUCES the `CorpusManifest`;
 * this module VALIDATES one read from disk. The shape is owned by `freeze.ts`
 * (`CorpusManifest`, `CorpusFile`, `MANIFEST_SCHEMA_VERSION`); this module
 * imports those types so a change to the producer shape ripples here at
 * compile time.
 */
import { AppError } from '@iip/contracts';
import {
  MANIFEST_SCHEMA_VERSION,
  type CorpusManifest,
  type CorpusFile,
} from './freeze.js';

// ───────────────────────────────────────────────────────────────────────────
// Shape guards
// ───────────────────────────────────────────────────────────────────────────

/** `sha256:<64-hex>` — the algorithm-prefixed digest form `freeze.ts` emits. */
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

/**
 * True iff `value` is a `CorpusFile` (`{path: string, sha256: sha256:<64-hex>}`).
 *
 * Narrowest possible guard: a `path` must be a non-empty string (a file at the
 * corpus root has a non-empty relative path), and `sha256` must match the
 * algorithm-prefixed form. Extra keys are tolerated (forward-compat for
 * future provenance fields) but NOT relied upon.
 */
function isCorpusFile(value: unknown): value is CorpusFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v['path'] !== 'string' || v['path'].length === 0) return false;
  if (typeof v['sha256'] !== 'string' || !SHA256_RE.test(v['sha256'])) return false;
  return true;
}

/**
 * True iff `value` is a `CorpusManifest`:
 *  - `schemaVersion === MANIFEST_SCHEMA_VERSION` (pinned "1.0.0").
 *  - `corpusHash` matches `sha256:<64-hex>`.
 *  - `files` is an array of `CorpusFile`.
 *
 * The `schemaVersion` is an exact-equality pin (NOT a range): a manifest at a
 * different schema version is a different shape and MUST be rejected, never
 * silently coerced — the corpusHash identity (ADR-0011) is meaningless across
 * schema versions.
 */
function isCorpusManifest(value: unknown): value is CorpusManifest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v['schemaVersion'] !== MANIFEST_SCHEMA_VERSION) return false;
  if (typeof v['corpusHash'] !== 'string' || !SHA256_RE.test(v['corpusHash'])) return false;
  if (!Array.isArray(v['files'])) return false;
  for (const f of v['files']) {
    if (!isCorpusFile(f)) return false;
  }
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/** Validation outcome — the typed manifest on success, never `null`. */
export type ValidatedManifest = CorpusManifest;

/**
 * Validate a parsed manifest object (or a raw JSON string) against the
 * `CorpusManifest` shape that `freeze.ts` produces.
 *
 * Accepts `unknown` because the input is read from disk (untrusted). On
 * success, returns the manifest typed as {@link CorpusManifest} (a safe
 * downstream handle — no `as` needed at call sites). On failure, throws
 * `AppError` code `manifest:invalid_shape` with a precise reason string so
 * the failure is diagnosable, not mystical.
 *
 * @param raw A parsed manifest object, a JSON string, or any other value
 *   (which will be rejected). Passing a `string` triggers a `JSON.parse`;
 *   project-context bans `JSON.parse` for typed data outside
 *   `packages/contracts/src/parse.ts`, but a corpus manifest is an eval-harness
 *   artifact (not a domain contract), and the parse is immediately funneled
 *   through this validator — the typed-boundary pattern the ban exists to
 *   enforce. If the parse throws, the error is wrapped as
 *   `manifest:invalid_shape` (not re-thrown as a SyntaxError).
 * @throws {AppError} code `manifest:invalid_shape` if `raw` is not a valid
 *   `CorpusManifest`.
 */
export function validateCorpusManifest(raw: unknown): ValidatedManifest {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch (e) {
      throw new AppError(
        `manifest is not valid JSON: ${(e as Error).message}`,
        'manifest:invalid_shape',
      );
    }
  }

  if (!isCorpusManifest(value)) {
    // Build a precise reason so the failure points at the offending field.
    const reason = describeShapeFailure(value);
    throw new AppError(
      `manifest does not conform to CorpusManifest (schemaVersion=${MANIFEST_SCHEMA_VERSION}, corpusHash=sha256:<64-hex>, files: CorpusFile[]): ${reason}`,
      'manifest:invalid_shape',
    );
  }
  return value;
}

/**
 * Produce a human-readable reason for why `value` failed {@link isCorpusManifest}.
 *
 * Centralised so the thrown `AppError` message points at the offending field
 * rather than saying "invalid" with no detail — a defamation-grade failure
 * must be diagnosable at first read. Walks the shape top-down and returns the
 * first defect encountered.
 */
function describeShapeFailure(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return `expected an object, got ${typeof value}`;
  }
  const v = value as Record<string, unknown>;
  if (v['schemaVersion'] !== MANIFEST_SCHEMA_VERSION) {
    const got = JSON.stringify(v['schemaVersion']);
    return `schemaVersion must be "${MANIFEST_SCHEMA_VERSION}", got ${got}`;
  }
  if (typeof v['corpusHash'] !== 'string' || !SHA256_RE.test(v['corpusHash'])) {
    const got = JSON.stringify(v['corpusHash']);
    return `corpusHash must match sha256:<64-hex>, got ${got}`;
  }
  if (!Array.isArray(v['files'])) {
    // Inside this `!Array.isArray` branch, `typeof v['files']` is the observed
    // type (the array case is excluded by the guard above).
    return `files must be an array, got ${typeof v['files']}`;
  }
  for (let i = 0; i < v['files'].length; i++) {
    const f = (v['files'] as unknown[])[i];
    if (!isCorpusFile(f)) {
      if (typeof f !== 'object' || f === null) {
        return `files[${i}] must be an object, got ${typeof f}`;
      }
      const file = f as Record<string, unknown>;
      if (typeof file['path'] !== 'string' || file['path'].length === 0) {
        return `files[${i}].path must be a non-empty string`;
      }
      if (typeof file['sha256'] !== 'string' || !SHA256_RE.test(file['sha256'])) {
        return `files[${i}].sha256 must match sha256:<64-hex>, got ${JSON.stringify(file['sha256'])}`;
      }
    }
  }
  return 'unknown shape mismatch';
}
