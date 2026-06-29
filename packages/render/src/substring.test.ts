/**
 * Substring validator unit tests (AC #5, PC-9).
 *
 * Covers every branch + boundary so Stryker mutation on `substring.ts`
 * reaches 100% (SEC-8, INV-008).
 *
 * @rules AC-2, EI-1, PC-9
 * @adr ADR-001, ADR-010
 */

import { describe, it, expect } from 'vitest';
import { validateSubstring } from './substring.js';
import type { SubstringResult } from './substring.js';
import type { GateViolationKind } from '@iip/contracts';
import { CitationTuple } from '@iip/contracts';

function tuple(source_doc_id: string, span_start: number, span_end: number): CitationTuple {
  return CitationTuple.parse({
    source_doc_id,
    span_start,
    span_end,
    content_hash: 'a'.repeat(64),
  });
}

/** Narrows a failed result to its violation kind (and asserts it actually failed). */
function failKind(r: SubstringResult): GateViolationKind {
  if (r.passed) {
    throw new Error('expected validator to fail, but it passed');
  }
  return r.kind;
}

const DOC_ID = '00000000-0000-4000-8000-000000000002';
const SOURCE = 'The senator voted YES on the resolution.';

describe('validateSubstring — POSITIVE (valid substring passes)', () => {
  it('TC-1.1: span text === source.substring(start,end) → passed', () => {
    const spanText = SOURCE.substring(0, 11); // 'The senator'
    const r = validateSubstring(spanText, tuple(DOC_ID, 0, 11), SOURCE);
    expect(r.passed).toBe(true);
  });

  it('full-document span (end === source.length) passes — kills `>`→`>=` bounds mutant', () => {
    const r = validateSubstring(SOURCE, tuple(DOC_ID, 0, SOURCE.length), SOURCE);
    expect(r.passed).toBe(true);
  });

  it('mid-document substring passes', () => {
    const r = validateSubstring('voted YES', tuple(DOC_ID, 12, 21), SOURCE);
    expect(r.passed).toBe(true);
  });
});

describe('validateSubstring — NEGATIVE (tamper / bounds / ordering)', () => {
  it('TC-1.2: 1-char mutation → citation_mismatch', () => {
    const tampered = SOURCE.substring(0, 11) + '!';
    const r = validateSubstring(tampered, tuple(DOC_ID, 0, 11), SOURCE);
    expect(failKind(r)).toBe('citation_mismatch');
  });

  it('non-empty mismatch always yields citation_mismatch (kills empty-ternary mutant)', () => {
    const r = validateSubstring('totally different', tuple(DOC_ID, 0, 11), SOURCE);
    expect(failKind(r)).toBe('citation_mismatch');
  });

  it('TC-1.3: span_end > source.length → out_of_bounds', () => {
    const r = validateSubstring(SOURCE, tuple(DOC_ID, 0, SOURCE.length + 500), SOURCE);
    expect(failKind(r)).toBe('out_of_bounds');
  });

  it('span_end === source.length + 1 → out_of_bounds (boundary +1)', () => {
    const r = validateSubstring(SOURCE, tuple(DOC_ID, 0, SOURCE.length + 1), SOURCE);
    expect(failKind(r)).toBe('out_of_bounds');
  });

  it('TC-1.4: span_start > span_end → inverted_span', () => {
    const r = validateSubstring(SOURCE, tuple(DOC_ID, 40, 10), SOURCE);
    expect(failKind(r)).toBe('inverted_span');
  });

  it('equal non-zero start/end with empty span text → empty_span', () => {
    const r = validateSubstring('', tuple(DOC_ID, 12, 12), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });

  it('equal non-zero start/end with non-empty span text → empty_span (kills `>`→`>=` ordering mutant)', () => {
    // start === end === 12 → empty excerpt → empty_span.
    // A `>=` mutant on `start > end` would return inverted_span (different kind).
    const r = validateSubstring('claim', tuple(DOC_ID, 12, 12), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });

  it('equal zero start/end with non-empty span text → empty_span (kills `>`→`>=` ordering mutant)', () => {
    // start === end === 0, spanText non-empty → empty excerpt. A `>=` mutant
    // would return inverted_span instead of empty_span.
    const r = validateSubstring('claim', tuple(DOC_ID, 0, 0), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });

  it('TC-1.5: empty span text with non-zero offsets → empty_span', () => {
    const r = validateSubstring('', tuple(DOC_ID, 0, 10), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });

  it('empty span text at zero-offset → empty_span', () => {
    const r = validateSubstring('', tuple(DOC_ID, 0, 0), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });

  it('non-empty span text with empty excerpt at non-zero offsets → empty_span', () => {
    const r = validateSubstring('claim', tuple(DOC_ID, 12, 12), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });
});

describe('validateSubstring — zero-offset empty-span edge', () => {
  it('start=end=0, empty span text → empty_span', () => {
    const r = validateSubstring('', tuple(DOC_ID, 0, 0), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });
});

describe('validateSubstring — Unicode NFC normalization', () => {
  // Composed é = U+00E9 (1 UTF-16 unit). Decomposed = 'e' + U+0301 (2 units).

  it('span decomposed, excerpt composed → passes (kills normSpan mutant)', () => {
    // Source holds COMPOSED é at index 3.
    const source = 'caf\u00E9 bar'; // 'café bar'
    const r = validateSubstring('e\u0301', tuple(DOC_ID, 3, 4), source);
    expect(r.passed).toBe(true);
  });

  it('span composed, excerpt decomposed → passes (kills normExcerpt mutant)', () => {
    // Source holds DECOMPOSED e + combining acute at indices 3..5.
    const source = 'cafe\u0301 bar'; // 'cafe\u0301 bar'
    const r = validateSubstring('\u00E9', tuple(DOC_ID, 3, 5), source);
    expect(r.passed).toBe(true);
  });

  it('case-sensitive: different case → citation_mismatch', () => {
    const r = validateSubstring('the senator', tuple(DOC_ID, 0, 11), SOURCE);
    expect(failKind(r)).toBe('citation_mismatch');
  });
});

describe('validateSubstring — zero-offset empty-span edge', () => {
  it('start=end=0, empty span text → empty_span', () => {
    const r = validateSubstring('', tuple(DOC_ID, 0, 0), SOURCE);
    expect(failKind(r)).toBe('empty_span');
  });
});
