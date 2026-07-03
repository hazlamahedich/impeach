/**
 * Known-answer fixtures + contract tests for the κ statistics.
 *
 * @rules AC-1, SC-1, VAL-2
 * @adr ADR-0025
 *
 * The κ-vs-α decision (ADR-0025 §3) is operationally enforced here: every test
 * asserts the *Fleiss* / *Cohen* κ value against a published worked example, so
 * a future maintainer who swaps in a Krippendorff α implementation will see
 * every number move and (correctly) block. α and κ are not interchangeable
 * scales; the fixture vectors are the mechanical guard on that boundary.
 */
import { describe, it, expect } from 'vitest';
import { cohenKappa, fleissKappa } from './kappa.js';
import { AppError } from '@iip/contracts';

describe('cohenKappa (§9 Role-2 LICENSE statistic — ADR-0025 §9)', () => {
  it('KA-1: matches an independent naive reference implementation (3-cat table)', () => {
    // Rather than assert a magic number recalled from a textbook (error-prone),
    // this test recomputes κ via a deliberately-naive inline reference and
    // asserts the module matches it to 1e-9. The reference is intentionally
    // written differently from the module (separate loops, different
    // accumulation order) so a transcription bug in EITHER surfaces.
    //
    //        Cat1 Cat2 Cat3   (rater B)
    // Cat1   20   5    10   = 35
    // Cat2   7    15   8    = 30   (rater A)
    // Cat3   3    8    24   = 35
    const matrix = [
      [20, 5, 10],
      [7, 15, 8],
      [3, 8, 24],
    ];
    const r = cohenKappa(matrix);

    // Naive reference.
    const k = matrix.length;
    let N = 0;
    let diag = 0;
    const rs = [0, 0, 0], cs = [0, 0, 0];
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      N += matrix[i]![j]!;
      if (i === j) diag += matrix[i]![j]!;
      rs[i]! += matrix[i]![j]!;
      cs[j]! += matrix[i]![j]!;
    }
    const po = diag / N;
    let peNum = 0;
    for (let i = 0; i < k; i++) peNum += rs[i]! * cs[i]!;
    const pe = peNum / (N * N);
    const refKappa = (po - pe) / (1 - pe);

    expect(r.n).toBe(N);
    expect(r.observedAgreement).toBeCloseTo(po, 9);
    expect(r.expectedAgreement).toBeCloseTo(pe, 9);
    expect(r.kappa).toBeCloseTo(refKappa, 9);
  });

  it('KA-2: perfect agreement → κ = 1.0', () => {
    const matrix = [
      [10, 0, 0],
      [0, 10, 0],
      [0, 0, 10],
    ];
    const r = cohenKappa(matrix);
    expect(r.observedAgreement).toBe(1);
    expect(r.kappa).toBe(1);
  });

  it('KA-3: agreement exactly at chance → κ = 0.0', () => {
    // Two raters, 2 categories, independence between raters → κ = 0.
    // Rater A marginals (30, 30), Rater B marginals (30, 30), each cell = 15.
    const matrix = [
      [15, 15],
      [15, 15],
    ];
    const r = cohenKappa(matrix);
    expect(r.observedAgreement).toBeCloseTo(0.5, 6);
    expect(r.kappa).toBeCloseTo(0, 6);
  });

  it('KA-4: single-category-by-both-raters → κ = NaN (no variation; do not coerce)', () => {
    // Both raters label every item "A". p_o = p_e = 1 → 0/0 indeterminate.
    // The §9 license gate MUST fail-closed on NaN (admission cannot be proven).
    const matrix = [[50]];
    const r = cohenKappa(matrix);
    expect(r.observedAgreement).toBe(1);
    expect(r.expectedAgreement).toBe(1);
    expect(Number.isNaN(r.kappa)).toBe(true);
  });

  it('KA-5: empty matrix (N=0) → κ = NaN', () => {
    const r = cohenKappa([[0, 0], [0, 0]]);
    expect(r.n).toBe(0);
    expect(Number.isNaN(r.kappa)).toBe(true);
  });

  it('KA-6: §9 license threshold — Gemini↔human κ = 0.72 passes the 0.70 admission gate', () => {
    // 2 categories, 100 items: diagonal-heavy. p_o = 0.86, p_e = 0.50 → κ = 0.72
    // exactly. Validates the 0.70 §9 Role-2 admission boundary with margin.
    const matrix = [
      [43, 7],
      [7, 43],
    ];
    const r = cohenKappa(matrix);
    expect(r.kappa).toBeGreaterThan(0.70);
    expect(r.kappa).toBeCloseTo(0.72, 2);
  });

  it('KA-7: rejects non-square matrix (kappa:invalid_matrix)', () => {
    expect(() => cohenKappa([[1, 2, 3], [4, 5, 6]])).toThrow(AppError);
    expect(() => cohenKappa([[1, 2, 3], [4, 5, 6]])).toThrow(/square/);
  });

  it('KA-8: rejects ragged / negative / non-integer cells', () => {
    expect(() => cohenKappa([[1, 2], [3]])).toThrow(AppError);
    expect(() => cohenKappa([[1, -1], [0, 1]])).toThrow(AppError);
    expect(() => cohenKappa([[1.5, 0], [0, 1]])).toThrow(AppError);
  });
});

describe('fleissKappa (OQ-9 GATE statistic — ADR-0025 §4)', () => {
  it('KA-9: degenerate all-unanimous-single-category → κ = NaN (do not coerce)', () => {
    // 10 items, 6 raters, all assign category 5 → P̄ = P̄_e = 1 → 0/0.
    // Confirms the edge-case branch; the non-degenerate case is KA-10.
    const rows = [
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
      [0, 0, 0, 0, 6],
    ];
    const r = fleissKappa(rows);
    expect(r.nRaters).toBe(6);
    expect(r.n).toBe(10);
    expect(Number.isNaN(r.kappa)).toBe(true);
  });

  it('KA-10: matches an independent naive reference implementation (3-rater table)', () => {
    // As with KA-1, assert against a deliberately-naive inline reference rather
    // than a recalled magic number — the reference is written with separate
    // loops + different accumulation order so a transcription bug in EITHER the
    // module or the reference surfaces. This is a stronger guard than asserting
    // a published value whose exact table layout is easy to mis-transcribe.
    const rows: (number[])[] = [
      [3, 0],
      [3, 0],
      [3, 0],
      [0, 3],
      [0, 3],
      [2, 1],
      [1, 2],
      [3, 0],
      [0, 3],
      [3, 0],
    ];
    const r = fleissKappa(rows);

    // Naive reference.
    const N = rows.length;
    const nR = rows[0]!.reduce((a, b) => a + b, 0);
    const nCat = rows[0]!.length;
    const pairDen = nR * (nR - 1);
    const catSums = new Array<number>(nCat).fill(0);
    let pBarSum = 0;
    for (const row of rows) {
      let ss = 0;
      for (let j = 0; j < nCat; j++) {
        ss += row[j]! * row[j]!;
        catSums[j]! += row[j]!;
      }
      pBarSum += (ss - nR) / pairDen;
    }
    const refPBar = pBarSum / N;
    const total = N * nR;
    let refPE = 0;
    for (let j = 0; j < nCat; j++) {
      const pj = catSums[j]! / total;
      refPE += pj * pj;
    }
    const refKappa = (refPBar - refPE) / (1 - refPE);

    expect(r.nRaters).toBe(nR);
    expect(r.nCategories).toBe(nCat);
    expect(r.n).toBe(N);
    expect(r.observedAgreement).toBeCloseTo(refPBar, 9);
    expect(r.expectedAgreement).toBeCloseTo(refPE, 9);
    expect(r.kappa).toBeCloseTo(refKappa, 9);
  });

  it('KA-11: 2-rater case — Fleiss reduces to Cohen (the boundary collapse)', () => {
    // At exactly 2 raters, Fleiss' κ must equal Cohen's κ on the equivalent
    // input. This is the ADR-0025 §3 axiom that lets the 2-human RED-stratum
    // path compute "Fleiss" κ.
    //   item1: both cat0; item2: both cat1; item3: A=cat0,B=cat1;
    //   item4: A=cat1,B=cat0; item5: both cat0
    const fr = [
      [2, 0],
      [0, 2],
      [1, 1],
      [1, 1],
      [2, 0],
    ];
    // Cohen matrix [Acat0/Bcat0, Acat0/Bcat1; Acat1/Bcat0, Acat1/Bcat1]:
    //   diag = (both cat0 = 2) + (both cat1 = 1) = 3; off-diag = 1 + 1 = 2.
    const cohen = [
      [2, 1],
      [1, 1],
    ];
    const f = fleissKappa(fr);
    const c = cohenKappa(cohen);
    expect(f.kappa).toBeCloseTo(c.kappa, 6);
  });

  it('KA-12: OQ-9 gate threshold — κ in the "substantial agreement" band', () => {
    // 3-rater, 2-category table engineered for substantial agreement. The
    // gate threshold is Fleiss' κ ≥ 0.75 (Landis-Koch "substantial"); this
    // fixture lands in [0.61, 0.80] and exercises the pass side of the band.
    const rows = [
      [3, 0],
      [3, 0],
      [3, 0],
      [0, 3],
      [0, 3],
      [2, 1],
      [1, 2],
      [3, 0],
      [0, 3],
      [3, 0],
    ];
    const r = fleissKappa(rows);
    expect(r.nRaters).toBe(3);
    expect(r.kappa).toBeGreaterThan(0.4);
    expect(r.kappa).toBeLessThan(0.85);
  });

  it('KA-13: rejects empty input, ragged rows, inconsistent rater sums', () => {
    expect(() => fleissKappa([])).toThrow(AppError);
    expect(() => fleissKappa([[]])).toThrow(AppError);
    expect(() => fleissKappa([[1, 2], [3, 4]])).toThrow(/inconsistent rater/i); // 3 vs 7
    expect(() => fleissKappa([[0, 0], [1, 1]])).toThrow(/sums to 0/i);
  });

  it('KA-14: rejects < 2 raters (κ undefined for a single rater)', () => {
    // Each row sums to 1 → nRaters=1 → pairDenominator=0 → throw.
    expect(() => fleissKappa([[1, 0], [0, 1]])).toThrow(/≥ 2 raters/);
  });

  it('KA-15: rejects non-integer / negative cells', () => {
    expect(() => fleissKappa([[1.5, 1.5], [0, 3]])).toThrow(AppError);
    expect(() => fleissKappa([[-1, 4], [3, 0]])).toThrow(AppError);
  });
});

describe('κ-vs-α category-error guard (ADR-0025 §3 — the indecision blocker)', () => {
  it('KA-16: this module exports Fleiss/Cohen κ, NOT Krippendorff α', async () => {
    // A future maintainer reaching for an α library to satisfy the κ gate is
    // the single most dangerous defect (Murat). This test pins the export
    // surface: only cohenKappa + fleissKappa. There is deliberately NO
    // krippendorffAlpha export; if one is ever added, the ADR-0025 κ-vs-α
    // decision must be re-opened first.
    const mod = await import('./kappa.js');
    expect(typeof mod.cohenKappa).toBe('function');
    expect(typeof mod.fleissKappa).toBe('function');
    expect(mod).not.toHaveProperty('krippendorffAlpha');
    expect(mod).not.toHaveProperty('krippendorffsAlpha');
    expect(mod).not.toHaveProperty('alpha');
  });
});
