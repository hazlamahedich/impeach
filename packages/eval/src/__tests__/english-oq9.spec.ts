/**
 * English OQ-9 gate — pinned decision-function unit test + harness-shape test
 * (Story 2.6c, AC #6, ADR-0026).
 *
 * @rules AC-1, SC-1, VAL-2, VAL-10
 * @adr ADR-0026, ADR-0025
 *
 * **Test count N = 9 (PINNED).** The Filipino reference spec (filipino-oq9.spec.ts)
 * pins 8; this English spec pins 9. N is stated here, not left to drift, per AC #6.
 *
 * **What this spec ASSERTS vs. FORBIDS:**
 *  - ASSERTS: the English gate machinery (the shared OQ-9 module + κ + CP-LCB,
 *    inherited from ADR-0025 Part I) is wired and correct on SYNTHETIC fixtures;
 *    the English corpus manifest exists at the pinned path in the `CorpusManifest`
 *    shape that `freeze.ts` produces AND passes the shared-harness
 *    `validateCorpusManifest()` (the regression guard for the pre-existing shape
 *    defect — Open Item O-2); the gate is INCONCLUSIVE on `n < n_min` (the
 *    acceptance anchor that carries real weight and survives the
 *    unreachable-threshold finding F1); RED on low-pass; the manifest's
 *    `files.length === 0` (the empty-corpus honesty clause).
 *  - FORBIDS: NO realistic-corpus GREEN assertion (F1-impossible at spec'd n).
 *    A GREEN-on-realistic-corpus assertion here would be a lie: the
 *    recalibrated pass rule (ADR-0025 §4) is unreachable on a small realistic
 *    corpus by construction (Mary F1). The only GREEN fixture is an ENGINEERED
 *    high-pass large-n fixture explicitly labeled "unrealistic per F1."
 *
 * **Scope (AC #6):** this is a DECISION-FUNCTION unit test + harness-shape
 * test, NOT a product-quality acceptance test. The κ ≥ 0.75 measurement on
 * real annotated English data is DEFERRED to Story 2.6c-measure (blocked on
 * PH-domiciled annotator procurement). The corpus at `v0/` is TARGET-STATE
 * (`files: []` today); this spec tests the gate LOGIC + manifest shape, not a
 * live κ number.
 *
 * **Tier wiring (AC #5):** `eval:smoke` (per-PR, non-gating) and `eval:full`
 * (main/release, deploy-blocking) both auto-discover this file via the vitest
 * config (which includes every `.spec.ts` under `src/`) and the globbed eval
 * scripts — zero per-language CI wiring (Task 5 verification).
 *
 * **INCONCLUSIVE-on-small-n is the acceptance anchor (Amelia, Story 2.6c
 * panel):** the runtime guard that operationalizes "the gate is inert on an
 * empty corpus" inside `oq9.ts` is filed as Open Item O-3 (sibling story —
 * `oq9.ts` is shipped deploy-blocking logic). The empty-corpus AC prose + the
 * INCONCLUSIVE assertion below is the interim control: this spec asserts the
 * gate REFUSES to green-light a corpus it has not measured.
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
import { validateCorpusManifest } from '../manifest.js';
import { AppError } from '@iip/contracts';
import { fileURLToPath } from 'node:url';

// ───────────────────────────────────────────────────────────────────────────
// AC #6 — the PINNED artifact path. No "or", no "e.g.".
// ───────────────────────────────────────────────────────────────────────────

/**
 * The English golden corpus manifest (default/root-anchored path — ADR-0011
 * Amendment 2). TARGET-STATE per ADR-0026 §5: the directory exists with a
 * manifest in the `CorpusManifest` shape that `packages/eval/src/freeze.ts`
 * produces (`{schemaVersion, corpusHash, files}`), with `files: []` today (the
 * annotation lands in Story 2.6c-measure, blocked on procurement). The
 * `corpusHash` for an empty file set is the SHA-256 of empty input
 * (`sha256:e3b0c44…`) — the deterministic sentinel `freezeCorpus` produces for
 * a directory with no files, NOT a magic constant.
 */
const ENGLISH_MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../eval/corpus/golden/v0/manifest.json',
);

/**
 * The PINNED test file + module locations (this file + the shared OQ-9 module).
 * AC #6: the module location is `packages/eval/src/oq9.ts` (decision made —
 * NOT bridge.ts); the test file is
 * `packages/eval/src/__tests__/english-oq9.spec.ts`. Recorded as constants so a
 * refactor that moves either surfaces here.
 */
const PINNED_TEST_FILE = 'packages/eval/src/__tests__/english-oq9.spec.ts';
const PINNED_MODULE = 'packages/eval/src/oq9.ts';

// ───────────────────────────────────────────────────────────────────────────
// English strata (ADR-0026 §2) — synthetic fixtures use these labels.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The three English strata codified in ADR-0026 §2. The Conversational/Social
 * stratum is pressure-tested by the per-stratum floor (populate-or-exile
 * decided in 2.6c-measure); the synthetic fixtures here use all three to
 * exercise the gate logic uniformly.
 */
const ENGLISH_STRATA = [
  'journalism-news',
  'legal-official',
  'conversational-social',
] as const;

describe('AC #6 — English OQ-9 test file + module + manifest PINNED (no "or" hand-wave)', () => {
  it('EN-1: this test file lives at the pinned path', () => {
    // Self-verify: the file under test is at the AC-mandated location.
    const here = fileURLToPath(import.meta.url);
    expect(here.endsWith('packages/eval/src/__tests__/english-oq9.spec.ts')).toBe(true);
  });

  it('EN-2: the module under test is packages/eval/src/oq9.ts (NOT bridge.ts)', () => {
    // AC #6: the module boundary IS the test-file boundary. The English gate
    // reuses the SAME shared OQ-9 module as Filipino (ADR-0026 §1 inheritance).
    expect(PINNED_MODULE).toBe('packages/eval/src/oq9.ts');
    expect(PINNED_TEST_FILE).toBe('packages/eval/src/__tests__/english-oq9.spec.ts');
  });

  it('EN-3: the English manifest exists at the pinned path in the CorpusManifest shape (regression guard for Open Item O-2)', () => {
    // THE LOAD-BEARING ASSERTION. The English manifest shipped in the WRONG
    // shape ({version, entries} vs CorpusManifest) since before 2.6b-code; the
    // defect survived because nothing asserted conformance (caught by eyeball,
    // not by test). This assertion — funneled through the shared-harness
    // validateCorpusManifest() — is the regression guard: a future drift back
    // to the old shape fails here, not in production.
    expect(existsSync(ENGLISH_MANIFEST_PATH)).toBe(true);
    const raw = readFileSync(ENGLISH_MANIFEST_PATH, 'utf8');
    // The validator takes the raw string (untrusted input from disk) and
    // either returns a typed CorpusManifest or throws. This is the typed-
    // boundary pattern: no `as` cast, no unvalidated JSON.parse at the call
    // site.
    const manifest = validateCorpusManifest(raw);
    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.corpusHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Array.isArray(manifest.files)).toBe(true);
  });

  it('EN-4: the English manifest is target-state EMPTY (files.length === 0) with the empty-input sentinel hash (honesty clause)', () => {
    // ADR-0026 §5: the gate is INERT (no quality claim) until 2.6c-measure
    // populates the corpus. The empty-corpus corpusHash is SHA-256("") — the
    // deterministic sentinel freezeCorpus produces for an empty directory
    // (see freeze.ts). When 2.6c-measure lands annotation, this assertion
    // flips to expect files.length > 0.
    const raw = readFileSync(ENGLISH_MANIFEST_PATH, 'utf8');
    const manifest = validateCorpusManifest(raw);
    expect(manifest.files.length).toBe(0);
    expect(manifest.corpusHash).toBe(
      'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('EN-5: validateCorpusManifest() REJECTS the pre-existing wrong shape ({version, entries}) — the defect is now caught by test, not eyeball', () => {
    // The regression guard's negative case: the OLD English manifest shape
    // MUST be rejected. If this assertion ever fails, the validator has been
    // weakened and the shape defect can silently return.
    const oldShape = { version: '0', entries: [] };
    // Pin the AppError CODE (not message prose) so a future message edit can't
    // silently mask a validator weakening. The code lives on `err.code` (the
    // AppError constructor's 2nd arg), NOT on `err.message` — so we catch and
    // assert the code property directly. toThrowError(/regex/) matches against
    // .message only, which would be fragile to prose edits.
    let caught: unknown;
    try {
      validateCorpusManifest(oldShape);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe('manifest:invalid_shape');
  });
});

describe('English OQ-9 gate machinery — synthetic fixtures (deferred measurement slice)', () => {
  // The κ ≥ 0.75 measurement is DEFERRED to 2.6c-measure (procurement-blocked).
  // These tests exercise the gate LOGIC on synthetic inputs so the inherited
  // machinery is proven correct on the English strata independent of the
  // annotation. NO realistic-corpus GREEN assertion is written (F1-impossible).

  it('EN-6: INCONCLUSIVE on n < n_min — the acceptance anchor (the gate refuses to green-light a corpus it has not measured)', () => {
    // THIS IS THE ACCEPTANCE ANCHOR (Amelia, Story 2.6c panel). The
    // recalibrated pass rule's n_min/INCONCLUSIVE contract (ADR-0025 §4) is
    // what makes "the gate is inert on an empty corpus" literally true. The
    // English v0 corpus is empty (files: []); the gate MUST NOT green-light
    // it. A small-n fixture (n=10/stratum, far below the Phase-1 tolerance-
    // schedule floor of n=36 @ 0 errors — ADR-0025 §4) MUST fail the
    // sample-size conjunct — reported as
    // meetsSampleSize=false, never a pass. This survives the unreachable-
    // threshold finding (F1) because it asserts the gate's REFUSAL to pass
    // on insufficient data, not a numerical threshold.
    const sm: StratumMetricInput[] = [];
    for (const s of ENGLISH_STRATA) {
      for (const m of OQ9_METRICS) {
        // n=10 is well below minPerStratum (default 30); even a perfect pass
        // rate cannot rescue the sample-size conjunct.
        sm.push({ stratum: s, metric: m, k: 10, n: 10, noRedLineViolation: true });
      }
    }
    const res = evaluateOQ9Grouped({
      stratumMetrics: sm,
      expectedManifestSha: 'sha256:fixture',
      actualManifestSha: 'sha256:fixture',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    // The gate MUST NOT pass on insufficient sample size.
    expect(res.pass).toBe(false);
    expect(res.meetsSampleSize).toBe(false);
    // The failure reason names the sample-size conjunct (the INCONCLUSIVE
    // escalation path — operator must annotate more, not declare victory).
    expect(res.failureReason).toMatch(/sample size/);
  });

  it('EN-7: RED on a low-pass stratum (a red-line violation → fail-closed)', () => {
    // A single doc below τ_red is an instant per-document fail; the stratum
    // average must NOT absorb it. Synthesized as a noRedLineViolation=false
    // on one metric in one stratum.
    const sm: StratumMetricInput[] = [];
    for (const s of ENGLISH_STRATA) {
      for (const m of OQ9_METRICS) {
        sm.push({
          stratum: s,
          metric: m,
          k: 120,
          n: 120,
          // Inject a red-line violation on faithfulness in the legal-official
          // stratum (the highest-defamation-salience English stratum — the
          // exact case the red-line exists to catch).
          noRedLineViolation: !(s === 'legal-official' && m === 'faithfulness'),
        });
      }
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

  it('EN-8: per-stratum floor fires independently — a failing stratum is NOT absorbed into a passing mean (defamation harm does not average across strata)', () => {
    // ADR-0026 §6 / ADR-0025 §4: the aggregate may VETO but can NEVER rescue
    // a failing stratum. Two strata pass cleanly (k=120/120); one stratum
    // (legal-official) fails the per-stratum CP-LCB floor (k=80/120 ≈ 0.667
    // pass rate → CP-LCB well below both the Phase-1 0.90 floor and the
    // legacy 0.95 the shipped code enforces).
    //
    // REVIEW NOTE (Story 2.6c review, P1): the recalibrated AND-joined
    // aggregate-head conjunct (ADR-0025 §4) is NOT yet implemented in
    // `oq9.ts` — it lands with Open Item O-3 (sibling story). The shipped
    // gate is per-stratum-AND-by-construction (the `evaluateOQ9Grouped` loop
    // pushes every failing (stratum, metric) into failureParts), so this
    // fixture fails on the per-stratum floor today. This test therefore pins
    // the per-stratum-floor veto (a failing stratum is not absorbed into a
    // passing mean) — the property the current code actually enforces. The
    // non-rescue-of-the-aggregate-head property (aggregate passes while a
    // stratum fails) is NOT testable until O-3 adds the aggregate-head
    // conjunct; note also this fixture's aggregate (320/360 ≈ 0.889) would
    // fail the aggregate head too, so even post-O-3 it would not isolate
    // non-rescue. A dedicated non-rescue fixture (aggregate-passes-while-
    // stratum-fails) belongs in the O-3 sibling.
    const sm: StratumMetricInput[] = [];
    for (const s of ENGLISH_STRATA) {
      for (const m of OQ9_METRICS) {
        // legal-official fails the floor (k=80/120 ≈ 0.667 pass rate); the
        // other two strata pass cleanly (k=120/120).
        const isFailingStratum = s === 'legal-official';
        sm.push({
          stratum: s,
          metric: m,
          k: isFailingStratum ? 80 : 120,
          n: 120,
          noRedLineViolation: true,
        });
      }
    }
    const res = evaluateOQ9Grouped({
      stratumMetrics: sm,
      expectedManifestSha: 'sha256:fixture',
      actualManifestSha: 'sha256:fixture',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    expect(res.pass).toBe(false);
    // The failure reason names the failing stratum's CP-LCB conjunct — the
    // per-stratum floor fired, NOT a sample-size or manifest conjunct.
    expect(res.failureReason).toMatch(/legal-official.*CP-LCB/);
  });

  it('EN-9: ENGINEERED high-pass large-n GREEN fixture — labeled UNREALISTIC per F1 (the only permitted GREEN; a realistic corpus cannot pass at spec\'d n)', () => {
    // *** F1 DISCLAIMER: this fixture is ENGINEERED to clear the
    // recalibrated gate and is UNREALISTIC. A real English corpus at the
    // spec'd n (Phase-1: n=36/stratum @ 0 errors per the tolerance schedule —
    // ADR-0025 §4) CAN clear
    // the Phase-1 floor (0.90 LCB), but asserting a GREEN on a "realistic"
    // fixture here would be a lie — the measurement is deferred to
    // 2.6c-measure. This fixture uses n=500/stratum with k=500 (a perfect
    // pass rate at large n) PURELY to prove the GREEN path of the inherited
    // gate logic is wired correctly. It is NOT a product-quality claim. ***
    const sm: StratumMetricInput[] = [];
    for (const s of ENGLISH_STRATA) {
      for (const m of OQ9_METRICS) {
        // n=500, k=500 → CP-LCB ≈ 0.985, clears both the Phase-1 floor (0.90)
        // and the Phase-2 target (0.95). Engineered, not realistic.
        sm.push({ stratum: s, metric: m, k: 500, n: 500, noRedLineViolation: true });
      }
    }
    const res = evaluateOQ9Grouped({
      stratumMetrics: sm,
      expectedManifestSha: 'sha256:fixture',
      actualManifestSha: 'sha256:fixture',
      humanBaselineKappa: 0.80,
      licenseKappa: 0.75,
    });
    // The GREEN path is wired (the inherited machinery passes on a
    // defamation-safe engineered fixture). This is the only GREEN assertion
    // in this file and it is explicitly unrealistic.
    expect(res.pass).toBe(true);
    expect(res.meetsSampleSize).toBe(true);
    expect(res.manifestShaMatches).toBe(true);
    // Sanity: the engineered CP-LCB at n=500, k=500 clears the Phase-2 target
    // (0.95) — pinning the math so a regression in clopperPearsonLcb95 surfaces.
    expect(clopperPearsonLcb95(500, 500)).toBeGreaterThan(TAU_STRATUM_LCB);
  });
});
