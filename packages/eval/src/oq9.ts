/**
 * OQ-9 measurement protocol — the Filipino salience eval pass/fail rule.
 *
 * @rules AC-1, SC-1, VAL-2, VAL-10
 * @adr ADR-0025
 *
 * Implements `OQ9_PASS` as specified in ADR-0025 §4 — a **stratified floor +
 * red-line**, NEVER a mean or p95. A single aggregate can hit 0.95 while
 * silently failing every libel-relevant Tagalog document, so aggregation is a
 * Clopper–Pearson 95% lower confidence bound on the within-stratum pass rate,
 * applied per-metric.
 *
 * **Module boundary (AC #6):** this module is INTENTIONALLY separate from
 * `bridge.ts`. The polyglot bridge invokes the Python RAGAS/DeepEval/Inspect
 * stack; the OQ-9 *gate decision* is a TS-side aggregation over per-document
 * metric results. Keeping them separate means a Python-side change cannot
 * silently move the gate logic (different language, different test coverage).
 *
 * **CI unit (AC #2 — the pin):** `k` = documents passing metric `m` in the
 * stratum, `n` = total documents in the stratum. NOT per-annotation, NOT
 * per-stratum-aggregate. A doc "passes" metric `m` iff `score ≥ τ_doc`.
 *
 * **CP_LCB_95 precision (AC #3 — the GAP that flips ship/no-ship):** the
 * Clopper–Pearson lower bound is computed with `decimal.js` (Decimal internals)
 * + a documented tolerance policy. The gate lives at its boundary — a float
 * rounding 0.94999↔0.95001 must not flip ship/no-ship. The "exact" beta-
 * quantile form is used (no normal approximation: at small n and extreme pass
 * rates the normal interval undercovers and silently passes — ADR-0025 §4).
 */
import { AppError } from '@iip/contracts';
import Decimal from 'decimal.js';

// ───────────────────────────────────────────────────────────────────────────
// Thresholds + tolerance policy (ADR-0025 §4, §8)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Per-document red-line: a doc scoring below this is an instant per-document
 * fail (do NOT let the stratum average absorb it). ADR-0025 §4.
 */
export const TAU_RED = 0.50;

/**
 * Per-document pass floor. A doc "passes" metric `m` iff `score ≥ τ_doc`.
 * ADR-0025 §4 (interim; τ_doc re-derived empirically before G-3 release per §8).
 */
export const TAU_DOC = 0.90;

/**
 * Stratum-level floor applied to the Clopper–Pearson 95% LOWER bound on the
 * within-stratum pass rate, for every metric.
 *
 * **Recalibrated (ADR-0025 §4 amended, Story 2.6c, Open Item O-3 resolved):**
 * the original `0.95` LCB floor is **unreachable by construction** — a perfect
 * corpus (0 errors at n=30) yields a 95% LCB of ~0.886–0.905, failing the gate.
 * Phase-1 lowers the LCB floor to **0.90** (reachable) AND adds a point-estimate
 * conjunct (`TAU_POINT_ESTIMATE = 0.95`, see below) so the gate is no longer
 * structurally impossible. Phase-2 (before broad public launch) re-tightens
 * toward 0.95 once the annotated corpus is large enough to clear it.
 *
 * ADR-0025 §4 (as amended) tolerance schedule (exact one-sided CP):
 *  - Phase-1 (0.90 floor): n≈36 @ 0 errors, n≈54 @ 1 error, n≈72 @ 2 errors
 *  - Phase-2 (0.95 floor): n≈72 @ 0 errors, n≈110 @ 1 error
 *
 * @rules ADR-0025 §4 (amended), VAL-2, O-3
 */
export const TAU_STRATUM_LCB = 0.90;

/**
 * Phase-2 stratum LCB floor — the re-tightened target before broad public
 * launch. Retained as a constant so the Phase-1→Phase-2 transition is a
 * one-line change (`TAU_STRATUM_LCB = TAU_STRATUM_LCB_PHASE_2`).
 *
 * @rules ADR-0025 §4 (amended), Phase-2
 */
export const TAU_STRATUM_LCB_PHASE_2 = 0.95;

/**
 * Point-estimate floor: the raw pass rate `k/n` must be ≥ 0.95 for a stratum
 * to pass. This conjunct was ADDED in the recalibration (O-3) — the old rule
 * checked only the LCB, which is unreachable at the 0.95 floor. The point
 * estimate is the "we actually observed ≥95% passes" leg; the LCB floor (0.90)
 * is the "and the sample is large enough that the lower bound clears" leg.
 * BOTH must hold (AND-joined per stratum).
 *
 * @rules ADR-0025 §4 (amended), O-3
 */
export const TAU_POINT_ESTIMATE = 0.95;

/**
 * Minimum per-stratum sample size. Below this, the stratum is INCONCLUSIVE
 * (not pass, not fail) — the gate cannot make a defamation-safety call on too
 * few documents. The operator must raise n. ADR-0025 §4 tolerance schedule
 * shows n≈36 @ 0 errors clears the Phase-1 floor; n_min=30 is the floor below
 * which even a perfect corpus is statistically inconclusive.
 *
 * @rules ADR-0025 §4 (amended), O-3
 */
export const N_MIN_PER_STRATUM = 30;

/** License (§9 Role-2 admission) κ threshold: Gemini↔human Cohen's κ ≥ 0.70. */
export const KAPPA_LICENSE_THRESHOLD = 0.70;

/** Gate (multi-rater) κ threshold: Fleiss' κ ≥ 0.75. */
export const KAPPA_GATE_THRESHOLD = 0.75;

/**
 * Decimal tolerance policy for the gate boundary (AC #3).
 *
 * The CP lower bound is compared against {@link TAU_STRATUM_LCB}. At defamation
 * grade, a result within `±BOUNDARY_TOLERANCE` of the threshold is a **band
 * failure** — the gate is *inconclusive*, not pass, because a float rounding
 * cliff is exactly the failure mode the Decimal impl exists to eliminate. The
 * tolerance is the resolution at which we are willing to make a ship/no-ship
 * call: 1e-9 (Decimal.js default precision is 20 sig figs, far tighter). A
 * value in `[TAU − 1e-9, TAU + 1e-9)` is reported as `inconclusive` so the
 * operator MUST intervene (re-run with larger n, or accept the documented
 * defamation-risk exception) rather than let IEEE-754 noise decide.
 */
export const BOUNDARY_TOLERANCE = 1e-9;

// Configure decimal.js for defamation-grade precision. NOTE: `Decimal.clone`
// returns an INDEPENDENT constructor whose config does NOT mutate the global
// `decimal.js` default — a top-level `Decimal.set(...)` here would silently
// change rounding (ROUND_DOWN, toward zero) for every other decimal.js
// consumer in the process (e.g. a future @iip/render consumer). ROUND_DOWN is
// a deliberate fail-closed bias: the bisection `mid` truncates toward zero,
// pulling the converged lower bound DOWN (conservative — refuses to ship on a
// rounding cliff rather than rounding up to clear the floor).
const D = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_DOWN });

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

/** The four metrics scored under OQ-9 (ADR-0025 §4). */
export const OQ9_METRICS = [
  'faithfulness',
  'citation_recall',
  'citation_precision',
  'nli',
] as const;
export type OQ9Metric = (typeof OQ9_METRICS)[number];

/** A single document's score on one metric, within one stratum. */
export interface DocMetricScore {
  /** Stable document id (provenance key into the corpus manifest). */
  readonly docId: string;
  readonly metric: OQ9Metric;
  /** Score ∈ [0, 1]; validated finite in [0,1]. */
  readonly score: number;
}

/** A stratum's pass/fail breakdown for one metric. */
export interface StratumMetricResult {
  readonly stratum: string;
  readonly metric: OQ9Metric;
  /** Documents passing metric m in the stratum (score ≥ τ_doc). */
  readonly k: number;
  /** Total documents in the stratum. */
  readonly n: number;
  /** Clopper–Pearson 95% lower confidence bound on k/n (Decimal-precise). */
  readonly cpLcb95: number;
  /** Raw pass rate k/n (the point-estimate conjunct, O-3). */
  readonly pointEstimate: number;
  /** True iff n ≥ N_MIN_PER_STRATUM (O-3 — below this, INCONCLUSIVE). */
  readonly meetsNMin: boolean;
  /** True iff the stratum passes the recalibrated 4-part rule (O-3). */
  readonly passesStratum: boolean;
  /** True iff every doc scored ≥ τ_red (no red-line violation). */
  readonly passesRedLine: boolean;
}

/** The full OQ-9 gate decision. */
export interface OQ9Result {
  /** True iff the WHOLE pass rule holds (all conjuncts). */
  readonly pass: boolean;
  /** Per-stratum, per-metric breakdown. */
  readonly strata: readonly StratumMetricResult[];
  /** Sample-size conjunct: n ≥ minTotal ∧ every stratum ≥ minPerStratum. */
  readonly meetsSampleSize: boolean;
  /** Aggregate-head conjunct (O-3): every stratum passes → AND-joined, non-rescuing. */
  readonly aggregateHeadPasses: boolean;
  /** Provenance-manifest SHA-256 conjunct. */
  readonly manifestShaMatches: boolean;
  /** Human-only baseline Fleiss' κ (reported alongside; ADR-0025 §4). */
  readonly humanBaselineKappa: number | null;
  /** §9 Role-2 license Cohen's κ (Gemini↔human), if Gemini is a co-rater. */
  readonly licenseKappa: number | null;
  /** Reason the gate failed (empty string on pass). */
  readonly failureReason: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Clopper–Pearson 95% lower confidence bound (Decimal-precise — AC #3)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Compute the **exact** one-sided Clopper–Pearson 95% LOWER confidence bound
 * for a binomial proportion, with defamation-grade boundary precision (AC #3).
 *
 * Definition (Clopper–Pearson 1934): the lower bound `p_L` is the value such
 * that `P(X ≥ k | n, p_L) = α/2`, where `α = 0.05` (so the lower bound uses
 * `α/2 = 0.025`) and `X ~ Binomial(n, p)`. Equivalently `p_L` is the `α/2`
 * quantile of a `Beta(k, n − k + 1)` distribution. In CDF terms: `p_L` is the
 * `p` at which `P(X ≤ k−1 | n, p) = 1 − α/2 = 0.975` (the upper tail beyond
 * k−1 has probability α/2). This is the standard `binom.test` lower bound.
 *
 * **Implementation — two-tier precision (the defamation-grade pattern):**
 *
 * 1. **Fast path (double):** bisect on the binomial CDF in plain `number`
 *    arithmetic to ~1e-12 (well inside double precision for n ≤ ~1000). This
 *    is fast (~50µs) and correct away from the gate boundary.
 *
 * 2. **Boundary path (Decimal):** when the fast-path result lands within
 *    `BOUNDARY_TOLERANCE` (1e-9) of {@link TAU_STRATUM_LCB}, re-evaluate via a
 *    `decimal.js` (30 sig figs) bisection on the same binomial CDF. This is the
 *    AC #3 requirement made operational: the cliff that matters is the
 *    ship/no-ship boundary, and ONLY there does the IEEE-754 noise threaten a
 *    flip. Away from the boundary, double precision is defamation-grade (the
 *    margin dwarfs 1e-12). The Decimal re-evaluation eliminates the residual
 *    cliff at exactly the decision point.
 *
 * The tolerance band around the threshold is reported as `inconclusive` by the
 * gate ({@link evaluateOQ9Grouped}) so an operator MUST resolve it (larger n,
 * or a documented defamation-risk exception) — never let rounding decide a
 * defamation gate.
 *
 * **Edge cases:**
 *  - `k = 0` → LCB = 0 (no passes observed; the lower bound cannot exceed 0).
 *  - `k = n` → LCB = `alpha2^(1/n)` (the standard "all-pass" bound; e.g. at
 *    n=100, LCB = 0.025^(1/100) ≈ 0.964 — comfortably above the 0.95 floor).
 *  - `n = 0` → throws (a stratum with no documents is a defect).
 *
 * **CP conservatism note:** because CP is exact (not approximate), high pass
 * rates are needed to clear a 0.95 *lower bound*. At n=100, k=100 → LCB≈0.964
 * (clears); k=99 → ≈0.9455 (FAILS — the canonical "95% accuracy ≠ 0.95 LCB"
 * lesson this module exists to teach); k=98 → ≈0.9296 (fails). At n=30, even
 * k=30 → LCB≈0.887 (fails the 0.95 floor). This is why the OQ-9 protocol
 * requires n≥100 and the ADR-0025 §4 power note targets n≈250.
 *
 * @throws {AppError} code `oq9:invalid_sample` if `n`/`k` are not non-negative
 *   integers, `k > n`, or `n === 0`.
 */
export function clopperPearsonLcb95(k: number, n: number): number {
  if (
    !Number.isInteger(n) || !Number.isFinite(n) || n <= 0 ||
    !Number.isInteger(k) || !Number.isFinite(k) || k < 0 || k > n
  ) {
    throw new AppError(
      `clopperPearsonLcb95: k=${k}, n=${n} must satisfy 0 ≤ k ≤ n, n ≥ 1, both integers`,
      'oq9:invalid_sample',
    );
  }

  const ONE_MINUS_ALPHA2 = 0.975; // 1 − α/2 for the lower-bound CDF equation.

  // Closed-form edges.
  if (k === 0) return 0;
  if (k === n) {
    // LCB = (α/2)^(1/n) — the β(α/2; n, 1) quantile.
    return Math.pow(0.025, 1 / n);
  }

  // Fast path: bisect for the p where P(X ≤ k−1 | n, p) = 0.975. The CDF is
  // DECREASING in p, so when Cdf(k−1, n, mid) > 0.975, p is too small → search
  // [mid, hi]; else [lo, mid]. Return lo (largest p with Cdf ≥ 0.975).
  const fast = bisectCdfLcbFloat(k - 1, n, ONE_MINUS_ALPHA2);

  // Boundary path: re-evaluate in Decimal if within the tolerance band.
  if (Math.abs(fast - TAU_STRATUM_LCB) < BOUNDARY_TOLERANCE) {
    return bisectCdfLcbDecimal(k - 1, n, ONE_MINUS_ALPHA2);
  }
  return fast;
}

/** Double bisection: find the largest p with `P(X ≤ k | n, p) ≥ target`. */
function bisectCdfLcbFloat(k: number, n: number, target: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (binomialCdfLEFloat(k, n, mid) > target) {
      lo = mid; // CDF too high → p too small → search upper half.
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Double binomial CDF `P(X ≤ k | n, p)` via incremental log-sum-exp.
 *
 * `ln C(n,i)` is built incrementally with the log-gamma recurrence
 * `lnΓ(x+1) = lnΓ(x) + ln(x)`, so each loop iteration is O(1) and the whole
 * CDF is O(k). A small Lanczos `lgamma` (Node's `Math` has no `lgamma`)
 * provides `lnΓ` to ~1e-15.
 */
function binomialCdfLEFloat(k: number, n: number, p: number): number {
  const lnP = Math.log(p);
  const ln1mP = Math.log(1 - p);
  const lnFactN = lgammaFloat(n + 1); // constant prefix

  let maxLog = -Infinity;
  const logTerms = new Float64Array(k + 1);
  let lnFactI = 0; // lnΓ(1) = 0 at i=0; advance via +ln(i).
  let lnFactNminusI = lnFactN; // lnΓ(n+1) at i=0; advance via −ln(n−i).
  for (let i = 0; i <= k; i++) {
    const lnCoef = lnFactN - lnFactI - lnFactNminusI;
    const lt = lnCoef + i * lnP + (n - i) * ln1mP;
    logTerms[i] = lt;
    if (lt > maxLog) maxLog = lt;
    if (i < k) {
      lnFactI += Math.log(i + 1);
      lnFactNminusI -= Math.log(n - i);
    }
  }
  // log-sum-exp for numerical stability.
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += Math.exp(logTerms[i]! - maxLog);
  return Math.exp(maxLog + Math.log(sum));
}

/**
 * Decimal bisection — the boundary-path re-evaluation (AC #3). Same algorithm
 * as {@link bisectCdfLcbFloat} but in `decimal.js` (30 sig figs). Only invoked
 * when the fast-path result is within the boundary tolerance band, so the
 * Decimal cost is paid only at the cliff.
 */
function bisectCdfLcbDecimal(k: number, n: number, target: number): number {
  const targetD = new D(target);
  let lo = new D(0);
  let hi = new D(1);
  for (let i = 0; i < 100; i++) {
    const mid = lo.plus(hi).div(2);
    if (binomialCdfLEDecimal(k, n, mid).gt(targetD)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo.toNumber();
}

/** Decimal binomial CDF — used only on the boundary path. */
function binomialCdfLEDecimal(k: number, n: number, p: Decimal): Decimal {
  const lnP = p.ln();
  const ln1mP = new D(1).minus(p).ln();
  const lnFactN = logGammaDecimal(n + 1);
  const logTerms: Decimal[] = [];
  let lnFactI = new D(0);
  let lnFactNminusI = lnFactN;
  for (let i = 0; i <= k; i++) {
    const lnCoef = lnFactN.minus(lnFactI).minus(lnFactNminusI);
    logTerms.push(lnCoef.plus(new D(i).times(lnP)).plus(new D(n - i).times(ln1mP)));
    if (i < k) {
      lnFactI = lnFactI.plus(new D(i + 1).ln());
      lnFactNminusI = lnFactNminusI.minus(new D(n - i).ln());
    }
  }
  return logSumExpDecimal(logTerms);
}

/** Decimal log-sum-exp. */
function logSumExpDecimal(terms: Decimal[]): Decimal {
  if (terms.length === 0) return new D(0);
  let m = terms[0]!;
  for (const t of terms) if (t.gt(m)) m = t;
  let sum = new D(0);
  for (const t of terms) sum = sum.plus(t.minus(m).exp());
  return m.plus(sum.ln());
}

/**
 * `ln(Γ(x))` for `x > 0` via Lanczos g=7 / n=9 (the SciPy `gammaln` set).
 * Node's `Math` exposes no `lgamma`, so a small Lanczos is the defamation-grade
 * standalone choice (~1e-15 accuracy, no native binding). The Decimal-boundary
 * path uses the Decimal variant {@link logGammaDecimal} for the residual cliff.
 */
function lgammaFloat(x: number): number {
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1−x) = π / sin(πx).
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgammaFloat(1 - x);
  }
  x -= 1;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let s = c[0]!;
  for (let i = 1; i < 9; i++) s += c[i]! / (x + i);
  const t = x + 7.5;
  return 0.9189385332046727 + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

/**
 * Lanczos approximation of `ln(Γ(x))` for real `x > 0`, all Decimal. Standard
 * g=7 / n=9 coefficients (the same set used by SciPy's `gammaln`); Decimal(30)
 * precision is far beyond the 1e-15 double accuracy of the approximation.
 * Used by the Decimal boundary path in {@link binomialCdfLEDecimal}.
 */
function logGammaDecimal(x: number): Decimal {
  const xd = new D(x);
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1−x) = π / sin(πx)  →  lnΓ(x) = lnπ − ln(sin(πx)) − lnΓ(1−x).
    const pi = new D('3.141592653589793238462643383279');
    const piX = pi.times(xd);
    return pi.log()
      .minus(sinDecimal(piX).ln())
      .minus(logGammaDecimal(1 - x));
  }
  const c = [
    '0.99999999999980993',
    '676.5203681218851',
    '-1259.1392167224028',
    '771.32342877765313',
    '-176.61502916214059',
    '12.507343278686905',
    '-0.13857109526572012',
    '9.9843695780195716e-6',
    '1.5056327351493116e-7',
  ].map((s) => new D(s));
  // z = x − 1; series uses z+i for i=0..8.
  const z = xd.minus(1);
  let sum = c[0]!;
  for (let i = 1; i < 9; i++) {
    sum = sum.plus(c[i]!.div(z.plus(i)));
  }
  const g = 7;
  const t = z.plus(g).plus(new D('0.5'));
  const halfLog2Pi = new D('0.91893853320467274178032973640562');
  // lnΓ(x) = 0.5·ln(2π) + (z+0.5)·ln(t) − t + ln(sum).
  return halfLog2Pi
    .plus(z.plus(new D('0.5')).times(t.ln()))
    .minus(t)
    .plus(sum.ln());
}

/**
 * `sin(x)` for Decimal via Taylor series (centered at the nearest multiple of
 * 2π for convergence). Only called on the reflection branch (x < 0.5 input →
 * πx ∈ (0, π/2)), so the argument is already in the fast-converging range.
 */
function sinDecimal(x: Decimal): Decimal {
  // Reduce x mod 2π into [−π, π] for stability, then Taylor-expand.
  const twoPi = new D('6.283185307179586476925286766559');
  const pi = new D('3.141592653589793238462643383279');
  // x mod 2π:
  let r = x.mod(twoPi);
  if (r.gt(pi)) r = r.minus(twoPi);
  // Taylor: sin(r) = r − r³/3! + r⁵/5! − ...  (r ∈ [−π,π], converges fast).
  let term = r;
  let sum = r;
  const rSq = r.times(r);
  for (let n = 1; n <= 40; n++) {
    // term ← term · (−r²) / ((2n)(2n+1))
    term = term.times(rSq.neg()).div(new D(2 * n).times(new D(2 * n + 1)));
    sum = sum.plus(term);
    if (term.abs().lt(new D('1e-40'))) break;
  }
  return sum;
}

// ───────────────────────────────────────────────────────────────────────────
// OQ-9 pass rule (AC #2)
// ───────────────────────────────────────────────────────────────────────────

export interface OQ9Input {
  /** All per-document scores, grouped implicitly by stratum label. */
  readonly scores: readonly DocMetricScore[];
  /** Stratum labels present (each must have ≥ minPerStratum docs). */
  readonly strata: readonly string[];
  /** Expected provenance manifest SHA-256; `actualSha` must equal it. */
  readonly expectedManifestSha: string;
  readonly actualManifestSha: string;
  /** Human-only baseline Fleiss' κ (required — ADR-0025 §4 reports it). */
  readonly humanBaselineKappa: number | null;
  /** §9 Role-2 license κ (Gemini↔human); null if Gemini is not a co-rater. */
  readonly licenseKappa: number | null;
  /** Minimum total documents across all strata (default 100 per §4). */
  readonly minTotal?: number;
  /** Minimum documents per stratum (default 30 per §4). */
  readonly minPerStratum?: number;
}

// NOTE: an `evaluateOQ9(input: OQ9Input)` overload that walks raw DocMetricScore
// rows was sketched during design but rejected — it forced this module to know
// the stratum↔doc mapping, coupling the gate logic to the corpus store. The
// real API is {@link evaluateOQ9Grouped}, which takes pre-grouped per-stratum
// counts; the caller (which already walks the corpus for RAGAS scoring) groups
// trivially. OQ9Input/DocMetricScore are retained as exported types for callers
// that produce scores before grouping.

/**
 * Per-stratum, per-metric pass counts. The caller computes `k` (docs passing
 * metric `m` with score ≥ τ_doc) and `n` (total docs in stratum) and the
 * per-doc red-line status, then passes them here. This keeps the OQ-9 module
 * pure-PassFail and pushes corpus-walking to the caller (the caller knows the
 * stratum↔doc mapping; this module does not).
 */
export interface StratumMetricInput {
  readonly stratum: string;
  readonly metric: OQ9Metric;
  /** Docs passing metric m (score ≥ τ_doc). */
  readonly k: number;
  /** Total docs in stratum for this metric. */
  readonly n: number;
  /** True iff every doc in this stratum scored ≥ τ_red on this metric. */
  readonly noRedLineViolation: boolean;
}

export interface OQ9GroupedInput {
  readonly stratumMetrics: readonly StratumMetricInput[];
  readonly expectedManifestSha: string;
  readonly actualManifestSha: string;
  readonly humanBaselineKappa: number | null;
  readonly licenseKappa: number | null;
  readonly minTotal?: number;
  readonly minPerStratum?: number;
}

/**
 * Evaluate the OQ-9 pass rule over pre-grouped per-stratum metric counts.
 * See {@link evaluateOQ9} for the rule + boundary policy.
 */
export function evaluateOQ9Grouped(input: OQ9GroupedInput): OQ9Result {
  const minTotal = input.minTotal ?? 100;
  const minPerStratum = input.minPerStratum ?? 30;

  const strata: StratumMetricResult[] = [];
  const failureParts: string[] = [];

  // Per-stratum, per-metric 4-part recalibrated pass rule (O-3).
  // A stratum passes iff ALL of:
  //   (1) n ≥ N_MIN_PER_STRATUM (else INCONCLUSIVE — too few docs to call)
  //   (2) pointEstimate k/n ≥ TAU_POINT_ESTIMATE (0.95 — "we saw ≥95% passes")
  //   (3) cpLcb95 ≥ TAU_STRATUM_LCB (0.90 Phase-1 — "lower bound clears floor")
  //   (4) noRedLineViolation (every doc ≥ τ_red — unchanged)
  // The aggregate head is AND-joined: every stratum must pass. The aggregate
  // may VETO but never RESCUE — defamation harm does not average across strata.
  for (const sm of input.stratumMetrics) {
    const cpLcb95 = clopperPearsonLcb95(sm.k, sm.n);
    const pointEstimate = sm.n > 0 ? sm.k / sm.n : 0;
    const meetsNMin = sm.n >= N_MIN_PER_STRATUM;
    const passesRedLine = sm.noRedLineViolation;

    // INCONCLUSIVE on small n (O-3): below n_min, the gate cannot make a
    // defamation-safety call. This is NOT a fail — the operator must raise n.
    if (!meetsNMin) {
      failureParts.push(
        `${sm.stratum}/${sm.metric} INCONCLUSIVE: n=${sm.n} < N_MIN=${N_MIN_PER_STRATUM} (raise n)`,
      );
    }
    // Point-estimate conjunct (O-3, NEW): raw pass rate must be ≥ 0.95.
    if (meetsNMin && pointEstimate < TAU_POINT_ESTIMATE) {
      failureParts.push(
        `${sm.stratum}/${sm.metric} point-estimate=${pointEstimate.toFixed(6)} < ${TAU_POINT_ESTIMATE}`,
      );
    }
    // LCB floor conjunct (O-3, recalibrated to 0.90 Phase-1).
    if (meetsNMin && cpLcb95 < TAU_STRATUM_LCB) {
      failureParts.push(
        `${sm.stratum}/${sm.metric} CP-LCB=${cpLcb95.toFixed(6)} < ${TAU_STRATUM_LCB} (Phase-1 floor)`,
      );
    }
    if (!passesRedLine) {
      failureParts.push(`red-line violation in ${sm.stratum}/${sm.metric}`);
    }

    const passesStratum = meetsNMin && pointEstimate >= TAU_POINT_ESTIMATE && cpLcb95 >= TAU_STRATUM_LCB && passesRedLine;

    strata.push({
      stratum: sm.stratum,
      metric: sm.metric,
      k: sm.k,
      n: sm.n,
      cpLcb95,
      pointEstimate,
      meetsNMin,
      passesStratum,
      passesRedLine,
    });
  }

  // Sample-size conjunct.
  const totalN = input.stratumMetrics.length === 0
    ? 0
    : aggregateTotalN(input.stratumMetrics);
  const meetsSampleSize = totalN >= minTotal &&
    input.stratumMetrics.every((sm) => sm.n >= minPerStratum);
  if (!meetsSampleSize) {
    failureParts.push(
      `sample size: total ${totalN} < ${minTotal} or some stratum < ${minPerStratum}`,
    );
  }

  // Provenance-manifest conjunct.
  const manifestShaMatches =
    input.expectedManifestSha === input.actualManifestSha &&
    input.expectedManifestSha.length > 0;
  if (!manifestShaMatches) {
    failureParts.push('provenance manifest SHA-256 mismatch');
  }

  // Human-baseline-κ-reported conjunct (must be non-null AND finite; ADR-0025 §4).
  // kappa.ts returns NaN on degenerate inputs (e.g. single-category unanimity);
  // NaN must fail-closed (a NaN baseline cannot prove admission) — `=== null`
  // alone lets NaN slip through because `NaN === null` is false.
  if (input.humanBaselineKappa === null || Number.isNaN(input.humanBaselineKappa)) {
    failureParts.push('human-only baseline κ not reported (null or NaN)');
  }

  // Aggregate-head conjunct (O-3, AND-joined non-rescuing): every stratum must
  // pass. The aggregate may VETO (any failing stratum fails the gate) but NEVER
  // RESCUE (a failing stratum cannot be averaged away by passing strata).
  // Defamation harm does not average across strata — a libel-relevant Tagalog
  // stratum failing is not offset by a passing English stratum.
  const aggregateHeadPasses = strata.length > 0 && strata.every((s) => s.passesStratum);
  if (!aggregateHeadPasses) {
    // Per-stratum failures already pushed above; this is the aggregate veto.
    // Only add a distinct message if no per-stratum reason was pushed (e.g.
    // empty strata input — a degenerate case).
    if (strata.length === 0) {
      failureParts.push('aggregate head: no strata scored (cannot pass an empty gate)');
    }
  }

  const pass = failureParts.length === 0;
  return {
    pass,
    strata,
    meetsSampleSize,
    aggregateHeadPasses,
    manifestShaMatches,
    humanBaselineKappa: input.humanBaselineKappa,
    licenseKappa: input.licenseKappa,
    failureReason: pass ? '' : failureParts.join('; '),
  };
}

/**
 * Sum the unique-stratum `n` (a doc counted once per metric, so divide by metrics).
 *
 * diverges — see ADR-0025 §4: the rule assumes a doc is scored on every metric,
 * so all `(stratum, metric)` rows for a stratum share the same `n`. This helper
 * takes `max(n)` per stratum across metrics rather than validating equality. If
 * a caller partial-scores a stratum (e.g. `stratum/nli n=30` while the other
 * metrics report `n=120`), the sample-size conjunct sees 120 (passes) while nli
 * is scored on only 30 docs — a structurally invalid input that slips through.
 * The per-stratum floor check (`sm.n >= minPerStratum` in {@link
 * evaluateOQ9Grouped}) catches a stratum uniformly below floor, but NOT a
 * partial-score mismatch within a stratum. Callers MUST ensure every metric for
 * a stratum carries the same `n`; a future hardening pass should throw on
 * mismatch instead of silently taking the max.
 */
function aggregateTotalN(stratumMetrics: readonly StratumMetricInput[]): number {
  // Each (stratum, metric) carries its own n; for the sample-size floor we want
  // the per-stratum document count, which equals n for any single metric on
  // that stratum (a doc is scored on every metric). Sum distinct strata.
  const perStratum = new Map<string, number>();
  for (const sm of stratumMetrics) {
    if (!perStratum.has(sm.stratum) || perStratum.get(sm.stratum)! < sm.n) {
      perStratum.set(sm.stratum, sm.n);
    }
  }
  let total = 0;
  for (const n of perStratum.values()) total += n;
  return total;
}
