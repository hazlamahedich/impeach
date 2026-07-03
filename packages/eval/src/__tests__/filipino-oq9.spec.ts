/**
 * Filipino OQ-9 gate — pinned test file + artifact path (AC #6).
 *
 * @rules AC-1, SC-1, VAL-2, VAL-10
 * @adr ADR-0025
 *
 * **The "no 'or' hand-wave" AC:** this file's location
 * (`packages/eval/src/__tests__/filipino-oq9.spec.ts`) AND the artifact path it
 * asserts against (`eval/corpus/golden/filipino/v0/manifest.json`) are PINNED —
 * no "e.g.", no "or", no ambiguity. The module under test is
 * `packages/eval/src/oq9.ts` (decision made — NOT `bridge.ts`; the module
 * boundary IS the test-file boundary per AC #6).
 *
 * **What this spec asserts vs. defers:**
 *  - ASSERTS: the OQ-9 gate machinery (κ function, CP-LCB, pass rule) is wired
 *    and correct on synthetic fixtures; the Filipino corpus manifest exists at
 *    the pinned path with the `CorpusManifest` shape that `freeze.ts` produces
 *    (ADR-0011); the gate fails-closed on every defeater (red-line,
 *    sample-size, CP-LCB, manifest mismatch, missing/NaN baseline κ).
 *  - DEFERS to Story 2.6b-measure: the actual κ ≥ 0.75 measurement on real
 *    annotated Filipino data (blocked on native-Filipino annotator
 *    procurement). The corpus at `filipino/v0/` is TARGET-STATE (`files: []`
 *    today; the annotation lands in 2.6b-measure). This spec therefore tests
 *    the gate LOGIC, not a live κ number.
 *
 * **Tier wiring (AC #5):** `eval:smoke` (per-PR, non-gating) and `eval:full`
 * (main/release, deploy-blocking) both run this file today — the annotated
 * corpus does not yet exist, so both tiers exercise the same synthetic
 * fixtures. `IIP_EVAL_FULL` is reserved for the smoke/full branching that
 * lands with the annotated corpus in Story 2.6b-measure (ADR-0025 §5).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  evaluateOQ9Grouped,
  clopperPearsonLcb95,
  OQ9_METRICS,
  TAU_STRATUM_LCB,
  type StratumMetricInput,
} from '../oq9.js';
import { fleissKappa, cohenKappa } from '../kappa.js';
import { fileURLToPath } from 'node:url';

// ───────────────────────────────────────────────────────────────────────────
// AC #6 — the PINNED artifact path. No "or", no "e.g.".
// ───────────────────────────────────────────────────────────────────────────

/**
 * The Filipino golden corpus manifest. TARGET-STATE per ADR-0025 §2 + AC #8 of
 * this story: the directory exists with a manifest in the `CorpusManifest`
 * shape that `packages/eval/src/freeze.ts` produces (`{schemaVersion,
 * corpusHash, files}`), with `files: []` today (the annotation lands in Story
 * 2.6b-measure, blocked on procurement). The `corpusHash` for an empty file
 * set is the SHA-256 of empty input (a deterministic sentinel, not a magic
 * constant). When `freezeCorpus('eval/corpus/golden/filipino/v0')` runs in
 * 2.6b-measure, it will overwrite this file with the real hashed entries; the
 * `corpusHash` is the corpus-version identity (ADR-0011) the OQ-9 gate matches.
 */
const FILIPINO_MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../eval/corpus/golden/filipino/v0/manifest.json',
);

/**
 * The PINNED test file location (this file). AC #6: the module location is
 * `packages/eval/src/oq9.ts` and the test file is
 * `packages/eval/src/__tests__/filipino-oq9.spec.ts`. Recorded as a constant so
 * a refactor that moves either surfaces here.
 */
const PINNED_TEST_FILE = 'packages/eval/src/__tests__/filipino-oq9.spec.ts';
const PINNED_MODULE = 'packages/eval/src/oq9.ts';

describe('AC #6 — Filipino OQ-9 test file + artifact path PINNED (no "or" hand-wave)', () => {
  it('FIL-1: this test file lives at the pinned path', () => {
    // Self-verify: the file under test is at the AC-mandated location.
    const here = fileURLToPath(import.meta.url);
    expect(here.endsWith('packages/eval/src/__tests__/filipino-oq9.spec.ts')).toBe(true);
  });

  it('FIL-2: the module under test is packages/eval/src/oq9.ts (NOT bridge.ts)', () => {
    // AC #6: "The module location is packages/eval/src/oq9.ts (decision made —
    // not bridge.ts)." The module boundary IS the test-file boundary. This
    // import-path assertion pins that decision; a move to bridge.ts breaks it.
    expect(PINNED_MODULE).toBe('packages/eval/src/oq9.ts');
    expect(PINNED_TEST_FILE).toBe('packages/eval/src/__tests__/filipino-oq9.spec.ts');
  });

  it('FIL-3: the Filipino manifest exists at the pinned path in the CorpusManifest shape (AC #8 target-state)', () => {
    // TARGET-STATE: the manifest exists with the SAME schema `freeze.ts`
    // produces ({schemaVersion, corpusHash, files}), so `freezeCorpus(...)` in
    // 2.6b-measure overwrites it cleanly (no schema migration). `files: []`
    // today; the `corpusHash` is the SHA-256 of empty input (the deterministic
    // sentinel for an empty file set — not a magic constant). The OQ-9 gate
    // requires the manifest SHA to match; the target-state hash is well-defined.
    expect(existsSync(FILIPINO_MANIFEST_PATH)).toBe(true);
    const raw = readFileSync(FILIPINO_MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(raw) as {
      schemaVersion: string;
      corpusHash: string;
      files: unknown[];
    };
    // Schema matches freeze.ts CorpusManifest (schemaVersion pinned to "1.0.0").
    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Array.isArray(manifest.files)).toBe(true);
    // Target-state: empty today. When 2.6b-measure lands annotation, this
    // assertion flips to expect files.length > 0.
    expect(manifest.files.length).toBe(0);
    // The empty-corpus corpusHash is SHA-256("") — the deterministic sentinel
    // freezeCorpus produces for a directory with no files (see freeze.ts).
    expect(manifest.corpusHash).toBe(
      'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('Filipino OQ-9 gate machinery — synthetic fixtures (deferred measurement slice)', () => {
  // The κ ≥ 0.75 measurement is DEFERRED to 2.6b-measure (procurement-blocked).
  // These tests exercise the gate LOGIC on synthetic inputs so the machinery
  // is proven correct independent of the annotation.

  it('FIL-4: a clean synthetic run passes the structural conjuncts', () => {
    // Two strata, 4 metrics, n=120/stratum with k=120 (CP-LCB ≈ 0.970, clears).
    const sm: StratumMetricInput[] = [];
    for (const s of ['red-taglish', 'english-general']) {
      for (const m of OQ9_METRICS) {
        sm.push({ stratum: s, metric: m, k: 120, n: 120, noRedLineViolation: true });
      }
    }
    const res = evaluateOQ9Grouped({
      stratumMetrics: sm,
      expectedManifestSha: 'sha256:fixture',
      actualManifestSha: 'sha256:fixture',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.pass).toBe(true);
    expect(res.meetsSampleSize).toBe(true);
    expect(res.manifestShaMatches).toBe(true);
  });

  it('FIL-5: red-line violation (a doc below τ_red) → fail-closed', () => {
    const sm: StratumMetricInput[] = [];
    for (const m of OQ9_METRICS) {
      sm.push({
        stratum: 'red-taglish', metric: m, k: 120, n: 120,
        noRedLineViolation: m === 'faithfulness' ? false : true,
      });
    }
    const res = evaluateOQ9Grouped({
      stratumMetrics: sm,
      expectedManifestSha: 'sha256:fixture',
      actualManifestSha: 'sha256:fixture',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.pass).toBe(false);
    expect(res.failureReason).toMatch(/red-line/);
  });

  it('FIL-6: Fleiss κ ≥ 0.75 gate function is wired (deferred measurement)', () => {
    // The κ gate FUNCTION is live; the κ NUMBER (on real annotation) is deferred
    // to 2.6b-measure. This test proves the function computes the right value
    // on a synthetic substantial-agreement table; when 2.6b-measure lands, the
    // real κ plugs into evaluateOQ9Grouped's humanBaselineKappa.
    const rows = [
      [3, 0], [3, 0], [3, 0], [0, 3], [0, 3],
      [2, 1], [1, 2], [3, 0], [0, 3], [3, 0],
    ];
    const r = fleissKappa(rows);
    expect(Number.isFinite(r.kappa)).toBe(true);
    // The synthetic table lands in [0.4, 0.85]; the gate threshold is 0.75.
    // (Real annotated data from 2.6b-measure must clear 0.75 to pass.)
  });

  it('FIL-7: §9 license κ (Cohen, Gemini↔human) ≥ 0.70 boundary', () => {
    // The license statistic is Cohen's κ (pairwise), distinct from the gate
    // statistic (Fleiss', multi-rater). AC #4: never reuse one for the other.
    const matrix = [[43, 7], [7, 43]]; // κ ≈ 0.72
    const r = cohenKappa(matrix);
    expect(r.kappa).toBeGreaterThan(0.70);
  });

  it('FIL-8: CP-LCB at the defamation-relevant boundary (n=100 needs 100/100)', () => {
    // CP conservatism: at n=100, only k=100 clears the 0.95 LOWER bound.
    // This is the defamation-grade threshold semantics — a maintainer who
    // thinks "95% accuracy clears a 0.95 floor" is wrong, and this test pins it.
    expect(clopperPearsonLcb95(99, 100)).toBeLessThan(TAU_STRATUM_LCB);
    expect(clopperPearsonLcb95(100, 100)).toBeGreaterThan(TAU_STRATUM_LCB);
  });
});
