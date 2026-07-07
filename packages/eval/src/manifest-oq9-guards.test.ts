/**
 * Eval harness guard expansion — manifest SHA empty-string + manifest shape
 * negative branches + malformed-JSON → AppError.
 *
 *   E2-G5 [P0] oq9.ts `manifestShaMatches` empty-string guard (line 535-537).
 *          The conjunct is `expected === actual && expected.length > 0`. Only
 *          a real mismatch (OQ-4) is tested today; the both-empty case is not.
 *          If the `.length > 0` guard were dropped, two empty manifest SHAs
 *          would "match" and satisfy the provenance conjunct — greenlighting a
 *          gate with NO corpus identity (ADR-0011 bypass).
 *
 *   E2-G6 [P1] manifest.ts `isCorpusManifest` negative branches. Only
 *          `schemaVersion` mismatch (EN-5) is tested today; bad `corpusHash`,
 *          non-array `files`, malformed file entries are not. This validator
 *          is the shared harness guard for every language instance.
 *
 *   E2-G7 [P1] manifest.ts malformed-JSON-string → `manifest:invalid_shape`
 *          AppError path (line 123-131). No test passes non-JSON today.
 *
 * @rules AC-1, SC-1, SC-7, ADR-0011
 * @adr ADR-0025, ADR-0026, ADR-0011
 */

import { describe, it, expect } from 'vitest';
import { AppError } from '@iip/contracts';
import { evaluateOQ9Grouped, OQ9_METRICS, type StratumMetricInput } from './oq9.js';
import { validateCorpusManifest } from './manifest.js';

// ───────────────────────────────────────────────────────────────────────────
// Helpers (mirrors oq9.test.ts passingStrata — a fully-passing stratum set)
// ───────────────────────────────────────────────────────────────────────────

/** A fully-passing stratum set: k=n on every metric so CP-LCB clears the floor. */
function passingStrata(strataNames: string[], n: number): StratumMetricInput[] {
  const out: StratumMetricInput[] = [];
  for (const s of strataNames) {
    for (const m of OQ9_METRICS) {
      out.push({ stratum: s, metric: m, k: n, n, noRedLineViolation: true });
    }
  }
  return out;
}

const VALID_SHA = 'sha256:' + 'a'.repeat(64);

/** A complete, valid CorpusManifest object (the shape freeze.ts produces). */
function validManifest(): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    corpusHash: VALID_SHA,
    files: [
      { path: 'corpus/doc-001.jsonl', sha256: VALID_SHA },
      { path: 'corpus/doc-002.jsonl', sha256: 'sha256:' + 'b'.repeat(64) },
    ],
  };
}

// ───────────────────────────────────────────────────────────────────────────

describe('evaluateOQ9Grouped — E2-G5 [P0] manifestShaMatches empty-string guard', () => {
  // GIVEN expected and actual manifest SHAs are BOTH empty strings
  // WHEN the gate evaluates the provenance conjunct
  // THEN it must FAIL: the `.length > 0` guard prevents two empty SHAs from
  //      "matching". Without this guard, a gate with no corpus identity
  //      (both SHAs unset) would pass the provenance check → ADR-0011 bypass.
  it('two EMPTY manifest SHAs do NOT match (the .length > 0 guard is load-bearing)', () => {
    const res = evaluateOQ9Grouped({
      stratumMetrics: passingStrata(['s'], 120),
      expectedManifestSha: '',
      actualManifestSha: '',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.pass).toBe(false);
    expect(res.manifestShaMatches).toBe(false);
    expect(res.failureReason).toMatch(/manifest SHA/i);
  });

  it('expected empty + actual non-empty does not match (asymmetric)', () => {
    const res = evaluateOQ9Grouped({
      stratumMetrics: passingStrata(['s'], 120),
      expectedManifestSha: '',
      actualManifestSha: VALID_SHA,
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.manifestShaMatches).toBe(false);
    expect(res.pass).toBe(false);
  });

  it('identical non-empty SHAs DO match (control — the guard does not over-block)', () => {
    const res = evaluateOQ9Grouped({
      stratumMetrics: passingStrata(['s'], 120),
      expectedManifestSha: VALID_SHA,
      actualManifestSha: VALID_SHA,
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.manifestShaMatches).toBe(true);
    expect(res.pass).toBe(true);
  });
});

describe('validateCorpusManifest — E2-G6 [P1] isCorpusManifest negative branches', () => {
  it('rejects a manifest with a malformed corpusHash (bad prefix)', () => {
    const m = validManifest();
    m['corpusHash'] = 'deadbeef'; // not sha256:<64-hex>
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
    try {
      validateCorpusManifest(m);
    } catch (e) {
      expect((e as AppError).code).toBe('manifest:invalid_shape');
      expect((e as AppError).message).toMatch(/corpusHash/);
    }
  });

  it('rejects a manifest with a corpusHash that is too short', () => {
    const m = validManifest();
    m['corpusHash'] = 'sha256:abc'; // right prefix, wrong length
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
  });

  it('rejects a manifest where files is not an array', () => {
    const m = validManifest();
    m['files'] = 'not-an-array';
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
    try {
      validateCorpusManifest(m);
    } catch (e) {
      expect((e as AppError).code).toBe('manifest:invalid_shape');
      expect((e as AppError).message).toMatch(/files/i);
    }
  });

  it('rejects a manifest with a malformed file entry (missing sha256)', () => {
    const m = validManifest();
    m['files'] = [{ path: 'corpus/x.jsonl' }]; // no sha256
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
    try {
      validateCorpusManifest(m);
    } catch (e) {
      expect((e as AppError).message).toMatch(/files\[0\]/);
    }
  });

  it('rejects a manifest with a malformed file entry (empty path)', () => {
    const m = validManifest();
    m['files'] = [{ path: '', sha256: VALID_SHA }]; // empty path
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
    try {
      validateCorpusManifest(m);
    } catch (e) {
      expect((e as AppError).message).toMatch(/files\[0\]\.path/);
    }
  });

  it('rejects a manifest with a malformed file entry (non-object)', () => {
    const m = validManifest();
    m['files'] = ['not-an-object'];
    expect(() => validateCorpusManifest(m)).toThrow(AppError);
    try {
      validateCorpusManifest(m);
    } catch (e) {
      expect((e as AppError).message).toMatch(/files\[0\]/);
    }
  });

  it('rejects a non-object manifest', () => {
    expect(() => validateCorpusManifest(null)).toThrow(AppError);
    expect(() => validateCorpusManifest(42)).toThrow(AppError);
    expect(() => validateCorpusManifest('string')).toThrow(AppError);
  });

  it('accepts a valid manifest and returns it typed (control)', () => {
    const m = validManifest();
    const result = validateCorpusManifest(m);
    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.corpusHash).toBe(VALID_SHA);
    expect(result.files).toHaveLength(2);
    expect(result.files[0]!.path).toBe('corpus/doc-001.jsonl');
  });
});

describe('validateCorpusManifest — E2-G7 [P1] malformed-JSON-string → AppError', () => {
  // GIVEN a raw string that is not valid JSON
  // WHEN validateCorpusManifest parses it
  // THEN it must throw AppError code `manifest:invalid_shape` (NOT re-throw a
  //      raw SyntaxError). Dropping the catch would break the typed error
  //      contract callers discriminate on.
  it('wraps a SyntaxError as AppError manifest:invalid_shape', () => {
    expect(() => validateCorpusManifest('not json')).toThrow(AppError);
    try {
      validateCorpusManifest('not json');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('manifest:invalid_shape');
      expect((e as AppError).message).toMatch(/not valid JSON/i);
    }
  });

  it('wraps a truncated JSON string as AppError', () => {
    expect(() => validateCorpusManifest('{"schemaVersion":')).toThrow(AppError);
    try {
      validateCorpusManifest('{"schemaVersion":');
    } catch (e) {
      expect((e as AppError).code).toBe('manifest:invalid_shape');
    }
  });

  it('rejects valid JSON that is the wrong shape (JSON object, not a manifest)', () => {
    // Valid JSON, valid object, but missing all manifest fields.
    expect(() => validateCorpusManifest('{"foo":"bar"}')).toThrow(AppError);
    try {
      validateCorpusManifest('{"foo":"bar"}');
    } catch (e) {
      expect((e as AppError).code).toBe('manifest:invalid_shape');
      expect((e as AppError).message).toMatch(/schemaVersion/);
    }
  });

  it('accepts a valid manifest passed as a JSON string (control)', () => {
    const json = JSON.stringify(validManifest());
    const result = validateCorpusManifest(json);
    expect(result.schemaVersion).toBe('1.0.0');
    expect(result.files).toHaveLength(2);
  });
});
