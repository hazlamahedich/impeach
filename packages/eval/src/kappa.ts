/**
 * Inter-annotator agreement statistics — Cohen's κ (pairwise) and
 * Fleiss' κ (multi-rater).
 *
 * @rules AC-1, SC-1, VAL-2
 * @adr ADR-0025
 *
 * **κ-vs-α decision (AC #1, ADR-0025):** Fleiss' κ is the chosen *gate*
 * statistic (multi-rater agreement over *nominal* defamation labels — the
 * classic case for which Fleiss' κ is the standard). Krippendorff's α is
 * *not* used: the `project-context.md` note *"krippendorff vs simpledorff:
 * pick ONE and pin"* names **two α libraries** (both compute α, not κ) and is
 * reconciled here. Reaching for either α library to satisfy a κ requirement
 * would silently redefine the gate on a non-interchangeable scale (Landis-Koch
 * κ 0.75 = "substantial"; Krippendorff α 0.75 = "tentative, not yet
 * conclusive") — see ADR-0025 §3 for the full benchmark-table justification.
 *
 * **License vs gate statistic separation (AC #4):** two DISTINCT functions
 * are exposed — {@link cohenKappa} (pairwise *license* statistic: Gemini↔human
 * Cohen's κ ≥ 0.70 for §9 Role-2 admission) and {@link fleissKappa} (multi-rater
 * *gate* statistic: Fleiss' κ ≥ 0.75). They MUST NOT be substituted: a dev
 * computing "κ" once and applying it to both is the failure mode. At exactly 2
 * raters Fleiss' κ reduces to Cohen's κ (the boundary where the multi-rater
 * formula collapses to the pairwise one); this code exploits that only inside
 * {@link fleissKappa}, never as a license to call {@link cohenKappa} for the gate.
 *
 * **Implementation choice (AC #1):** CLOSED-FORM, no external library. No κ
 * implementation exists on the npm registry (verified 2026-07-03:
 * `krippendorffs-alpha`/`simpledorff` → 404; both are α libraries anyway).
 * A closed-form implementation is defamation-grade *stable* (no transitive
 * dependency drift can move the κ number silently) and is explicitly permitted
 * by AC #1 ("a pinned library OR a closed form implementation"). Correctness is
 * anchored by the known-answer fixture vectors in `kappa.test.ts` — the classic
 * Fleiss 6-rater worked example and a Cohen 2-rater table — so a regression in
 * the math is caught at unit-test time, not at gate-decision time.
 *
 * **Numerical precision:** both functions use plain `number` arithmetic. The κ
 * statistic itself is a ratio of integer-derived marginal sums; double
 * precision is ample for κ ∈ [−1, 1] at annotator headcounts ≤ ~30 and category
 * counts ≤ ~10. (The Decimal-precision requirement in AC #3 applies to the
 * *Clopper–Pearson* lower bound in `oq9.ts`, where the gate lives at a
 * 0.94999↔0.95001 rounding cliff — κ has no equivalent cliff.) Inputs are
 * validated to be non-negative integers; non-finite outputs (from pathological
 * zero-variance inputs) are reported as `NaN` per the κ literature, not coerced.
 */
import { AppError } from '@iip/contracts';

// ───────────────────────────────────────────────────────────────────────────
// Cohen's κ (pairwise) — the §9 Role-2 LICENSE statistic
// ───────────────────────────────────────────────────────────────────────────

/**
 * A pairwise confusion matrix for two raters over the same N items, indexed by
 * category label. Each cell `[i][j]` is the count of items rater A labelled `i`
 * and rater B labelled `j`. The matrix MUST be square and symmetric in its
 * category set (both raters use the same label alphabet).
 */
export type CohenMatrix = readonly (readonly number[])[];

export interface CohenKappaResult {
  /** Cohen's κ ∈ [−1, 1], or `NaN` for zero observed *and* expected agreement. */
  readonly kappa: number;
  /** Observed agreement proportion `p_o` = trace / N. */
  readonly observedAgreement: number;
  /** Expected-by-chance agreement proportion `p_e`. */
  readonly expectedAgreement: number;
  /** Total number of items judged (`N`). */
  readonly n: number;
}

/**
 * Compute **Cohen's κ** for two raters from a square confusion matrix.
 *
 * Formula (Cohen 1960): `κ = (p_o − p_e) / (1 − p_e)`, where
 * `p_o = (Σᵢ m[i][i]) / N` is the observed agreement and
 * `p_e = Σᵢ (rowSumᵢ / N) · (colSumᵢ / N)` is the agreement expected by chance
 * from the marginal distributions.
 *
 * **Edge cases (return `kappa: NaN`, matching the κ literature):**
 *  - `N = 0` (empty matrix): undefined.
 *  - Both raters assign the same single category to every item (`p_o = p_e = 1`):
 *    `0/0` — κ is undefined when there is no variation to agree on. Callers
 *    MUST treat `NaN` as "κ not computable for this input" and surface it
 *    (e.g. the §9 license gate fails-closed on `NaN`, since admission cannot be
 *    proven). This is a deliberate non-coercion: returning 0 or 1 here would
 *    silently pass or fail the gate on a degenerate input.
 *
 * @throws {AppError} code `kappa:invalid_matrix` if the matrix is empty,
 *   non-square, ragged, or contains negative / non-integer / non-finite cells.
 */
export function cohenKappa(matrix: CohenMatrix): CohenKappaResult {
  validateMatrix(matrix, /* minDim = */ 1);
  const k = matrix.length; // number of categories
  // Total items N = sum of EVERY cell (the full confusion matrix), NOT just
  // row 0. A confusion matrix is not row-normalised; summing one row
  // undercounts N and silently inflates p_o/p_e. Found by the KA-11 fixture.
  const n = matrix.reduce(
    (rowSum, row) => rowSum + row.reduce((s, v) => s + v, 0),
    0,
  );

  if (n === 0) {
    // No items → κ undefined.
    return { kappa: NaN, observedAgreement: NaN, expectedAgreement: NaN, n: 0 };
  }

  // Observed agreement: sum of diagonal / N.
  let diagonal = 0;
  const rowSums = new Array<number>(k).fill(0);
  const colSums = new Array<number>(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const cell = matrix[i]![j]!;
      diagonal += i === j ? cell : 0;
      rowSums[i]! += cell;
      colSums[j]! += cell;
    }
  }
  const pObserved = diagonal / n;

  // Expected-by-chance agreement: Σ (rowSumᵢ · colSumᵢ) / N².
  let expectedNumerator = 0;
  for (let i = 0; i < k; i++) {
    expectedNumerator += rowSums[i]! * colSums[i]!;
  }
  const pExpected = expectedNumerator / (n * n);

  const denominator = 1 - pExpected;
  if (denominator === 0) {
    // No marginal variation (both raters put every item in one category) → κ
    // is the 0/0 indeterminate form. Report NaN; do NOT coerce.
    return { kappa: NaN, observedAgreement: pObserved, expectedAgreement: pExpected, n };
  }
  const kappa = (pObserved - pExpected) / denominator;
  return { kappa, observedAgreement: pObserved, expectedAgreement: pExpected, n };
}

// ───────────────────────────────────────────────────────────────────────────
// Fleiss' κ (multi-rater) — the OQ-9 GATE statistic
// ───────────────────────────────────────────────────────────────────────────

/**
 * Per-item category-count row for Fleiss' κ: `counts[j]` = number of raters
 * who assigned category `j` to this item. Each row MUST sum to the same value
 * (the number of raters `n_raters`). A row of all-zeros is rejected (an item
 * that no rater judged is not part of the agreement computation — Fleiss 1971).
 */
export type FleissRow = readonly number[];

export interface FleissKappaResult {
  /** Fleiss' κ ∈ [−1, 1], or `NaN` for zero observed *and* expected agreement. */
  readonly kappa: number;
  /** Mean observed agreement `P̄` across items. */
  readonly observedAgreement: number;
  /** Expected-by-chance agreement `P̄_e` from the category marginals. */
  readonly expectedAgreement: number;
  /** Number of items (`N`). */
  readonly n: number;
  /** Number of raters (per-item sum, validated constant across rows). */
  readonly nRaters: number;
  /** Number of categories (`k`). */
  readonly nCategories: number;
}

/**
 * Compute **Fleiss' κ** for multiple raters from a per-item count matrix.
 *
 * Each row of `rows` is one item; `rows[i][j]` is how many raters labelled item
 * `i` as category `j`. Every row MUST sum to the same `nRaters`. The number of
 * raters is *inferred* from the first row's sum (callers do not pass it
 * separately — a mismatch between declared and actual rater counts is a
 * defect, and inferring forces the check).
 *
 * Formula (Fleiss 1971):
 *   - For item *i*: `Pᵢ = (Σⱼ nᵢⱼ² − n_raters) / (n_raters · (n_raters − 1))`.
 *   - `P̄ = (1/N) · Σᵢ Pᵢ` (mean observed agreement).
 *   - Category marginal `pⱼ = (1/(N · n_raters)) · Σᵢ nᵢⱼ`.
 *   - `P̄_e = Σⱼ pⱼ²` (expected agreement by chance).
 *   - `κ = (P̄ − P̄_e) / (1 − P̄_e)`.
 *
 * **At exactly 2 raters** Fleiss' κ collapses to Cohen's κ (the multi-rater
 * formula reduces to the pairwise one); `fleissKappa` therefore remains valid
 * on the 2-human RED-severity stratum permitted by ADR-0025 §3.
 *
 * **Edge cases (return `kappa: NaN`):**
 *  - `N = 0` (no items): undefined.
 *  - All raters use a single category for every item (`P̄ = P̄_e = 1`): `0/0`.
 *    As with {@link cohenKappa}, `NaN` is reported and callers MUST fail-closed
 *    rather than coerce to 0/1.
 *
 * @throws {AppError} code `kappa:invalid_fleiss_input` if `rows` is empty, any
 *   row is empty, a row sums to zero, or rows have inconsistent rater sums.
 *   Cells must be non-negative integers.
 */
export function fleissKappa(rows: readonly FleissRow[]): FleissKappaResult {
  if (rows.length === 0) {
    throw new AppError(
      'fleissKappa requires at least one item row',
      'kappa:invalid_fleiss_input',
    );
  }

  const nItems = rows.length;
  const nCategories = rows[0]!.length;
  if (nCategories === 0) {
    throw new AppError(
      'fleissKappa requires at least one category',
      'kappa:invalid_fleiss_input',
    );
  }

  // Validate every cell + infer + verify the constant rater-sum.
  for (let i = 0; i < nItems; i++) {
    const row = rows[i]!;
    if (row.length !== nCategories) {
      throw new AppError(
        `fleissKappa row ${i} has ${row.length} categories, expected ${nCategories}`,
        'kappa:invalid_fleiss_input',
      );
    }
    for (let j = 0; j < nCategories; j++) {
      const cell = row[j]!;
      if (!Number.isInteger(cell) || cell < 0 || !Number.isFinite(cell)) {
        throw new AppError(
          `fleissKappa cell [${i}][${j}] must be a non-negative integer (got ${cell})`,
          'kappa:invalid_fleiss_input',
        );
      }
    }
  }

  const nRaters = rows[0]!.reduce((s, v) => s + v, 0);
  if (nRaters === 0) {
    throw new AppError(
      'fleissKappa row 0 sums to 0 (no raters judged item 0)',
      'kappa:invalid_fleiss_input',
    );
  }
  for (let i = 1; i < nItems; i++) {
    const sum = rows[i]!.reduce((s, v) => s + v, 0);
    if (sum !== nRaters) {
      throw new AppError(
        `fleissKappa row ${i} sums to ${sum}, expected ${nRaters} (inconsistent rater count)`,
        'kappa:invalid_fleiss_input',
      );
    }
  }

  // nRaters·(nRaters−1): if nRaters === 1, Pᵢ is undefined (no pairwise agreement
  // possible with one rater). Fleiss' κ requires ≥ 2 raters.
  const pairDenominator = nRaters * (nRaters - 1);
  if (pairDenominator === 0) {
    throw new AppError(
      `fleissKappa requires ≥ 2 raters (got ${nRaters})`,
      'kappa:invalid_fleiss_input',
    );
  }

  // Per-item observed agreement Pᵢ + category marginals.
  const categorySums = new Array<number>(nCategories).fill(0);
  let pBarSum = 0;
  for (let i = 0; i < nItems; i++) {
    const row = rows[i]!;
    let sumSquares = 0;
    for (let j = 0; j < nCategories; j++) {
      const c = row[j]!;
      sumSquares += c * c;
      categorySums[j]! += c;
    }
    pBarSum += (sumSquares - nRaters) / pairDenominator;
  }
  const pBar = pBarSum / nItems;

  const total = nItems * nRaters;
  let pE = 0;
  for (let j = 0; j < nCategories; j++) {
    const pj = categorySums[j]! / total;
    pE += pj * pj;
  }

  const denominator = 1 - pE;
  if (denominator === 0) {
    // Single-category-used-everywhere → indeterminate. Report NaN; do not coerce.
    return {
      kappa: NaN,
      observedAgreement: pBar,
      expectedAgreement: pE,
      n: nItems,
      nRaters,
      nCategories,
    };
  }
  const kappa = (pBar - pE) / denominator;
  return {
    kappa,
    observedAgreement: pBar,
    expectedAgreement: pE,
    n: nItems,
    nRaters,
    nCategories,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Shared validation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Validate a square, non-empty, non-ragged, non-negative-integer confusion
 * matrix for {@link cohenKappa}. Centralised so the error code + messages are
 * consistent and the main function reads as pure math.
 */
function validateMatrix(matrix: CohenMatrix, minDim: number): void {
  if (matrix.length < minDim) {
    throw new AppError(
      `cohenKappa matrix must have ≥ ${minDim} category row(s) (got ${matrix.length})`,
      'kappa:invalid_matrix',
    );
  }
  const k = matrix.length;
  for (let i = 0; i < k; i++) {
    const row = matrix[i]!;
    if (row.length !== k) {
      throw new AppError(
        `cohenKappa matrix must be square (row ${i} has ${row.length} cols, expected ${k})`,
        'kappa:invalid_matrix',
      );
    }
    for (let j = 0; j < k; j++) {
      const cell = row[j]!;
      if (!Number.isInteger(cell) || cell < 0 || !Number.isFinite(cell)) {
        throw new AppError(
          `cohenKappa cell [${i}][${j}] must be a non-negative integer (got ${cell})`,
          'kappa:invalid_matrix',
        );
      }
    }
  }
}
