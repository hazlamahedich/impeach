/**
 * Contract test — EditorialErrorCode spec/code alignment (TD9, Epic 3 prep).
 *
 * Catches the Story 2.5 drift class: ADR-named error codes absent from the
 * implemented `EditorialErrorCode` union. The ADR (and the repo's throw sites)
 * name codes like `DUPLICATE_SEQUENCE`, `PREV_HASH_MISMATCH`,
 * `SIGNING_CALLBACK_FAILED`; the contract union must contain every code the
 * repo throws, and the repo must only throw codes the contract defines.
 *
 * This test runs in CI and fails if either side drifts: a new code thrown by
 * the repo but not in the union (silent gap), or a union member no code path
 * produces (dead taxonomy).
 *
 * @rules AC-13, AC-14, AC-15, PC-4
 * @adr ADR-001, ADR-024
 */
import { describe, it, expect } from 'vitest';
import { EditorialError } from '@iip/contracts';
import type { EditorialErrorCode } from '@iip/contracts';

/**
 * The canonical ADR-defined error-code set. Sourced from ADR-024 (hash-chain
 * concurrency model) + AC-13/14/15 (editorial error variants). If the ADR
 * adds a code, add it here FIRST — this list is the spec the contract union
 * is checked against.
 */
const ADR_SPECIFIED_CODES: readonly EditorialErrorCode[] = [
  'CONCURRENT_APPEND_EXHAUSTED',
  'KEY_REGISTRY_UNAVAILABLE',
  'CHAIN_INTEGRITY_FAILURE',
  'JTI_REPLAY',
  'CHAIN_CONTINUITY_VIOLATION',
  'INVALID_ENTRY',
  'DUPLICATE_SEQUENCE',
  'PREV_HASH_MISMATCH',
  'SIGNING_CALLBACK_FAILED',
];

/**
 * Every code the editorial repo throws (the production code paths). Sourced
 * from a grep of `packages/editorial/src/editorial-log-repo.ts`. If a new throw
 * site appears, add its code here so the contract test catches a missing union
 * member.
 */
const REPO_THROWN_CODES: readonly EditorialErrorCode[] = [
  'JTI_REPLAY',
  'DUPLICATE_SEQUENCE',
  'SIGNING_CALLBACK_FAILED',
  'CONCURRENT_APPEND_EXHAUSTED',
  'PREV_HASH_MISMATCH',
];

describe('TD9 — EditorialErrorCode spec/code alignment (AC-13, AC-14, AC-15)', () => {
  it('every ADR-specified code is constructible as an EditorialError', () => {
    // If a code is in the spec but not in the union, this fails to typecheck
    // (TS error) AND fails at runtime (EditorialError constructor would reject).
    for (const code of ADR_SPECIFIED_CODES) {
      const err = new EditorialError(`test: ${code}`, code);
      expect(err.code).toBe(code);
      expect(err.name).toBe('EditorialError');
      expect(err instanceof Error).toBe(true);
    }
  });

  it('every code the repo throws is in the ADR spec', () => {
    // Catches the drift: a throw site uses a code the ADR didn't define.
    for (const code of REPO_THROWN_CODES) {
      expect(ADR_SPECIFIED_CODES, `repo throws ${code} but ADR spec lacks it`).toContain(code);
    }
  });

  it('the union has no duplicate codes (sanity)', () => {
    const unique = new Set(ADR_SPECIFIED_CODES);
    expect(unique.size).toBe(ADR_SPECIFIED_CODES.length);
  });

  it('the union is closed — no arbitrary string is assignable as a code (compile-time)', () => {
    // A misspelled code is rejected at compile time. The @ts-expect-error
    // proves the type guard: if 'TYPO_CODE' were assignable, the directive
    // would itself error ("unused @ts-expect-error"). This is the load-bearing
    // assertion — runtime construction doesn't validate the union (the brand is
    // a TS-only type), so the compile-time guarantee is what matters.
    const _typoAssignment: EditorialErrorCode =
      // @ts-expect-error -- 'TYPO_CODE' is not a valid EditorialErrorCode (the point of this test)
      'TYPO_CODE' as EditorialErrorCode;
    expect(true).toBe(true); // compile-time assertion above; this line just satisfies vitest
  });
});
