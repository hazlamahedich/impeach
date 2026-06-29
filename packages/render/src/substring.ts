/**
 * Substring validator — the fast-fail prefilter for the render gate (AC #5).
 *
 * Pure function: given the asserted span text, the citation tuple offsets, and
 * the source document text, returns whether the span exactly matches the source
 * substring at `(span_start, span_end)`.
 *
 * Codified semantics (Story 2.1 AC #5):
 *   - Case-sensitive exact match.
 *   - Unicode NFC-normalized comparison (both sides).
 *   - No whitespace collapse.
 *   - Full substring match (not word-boundary).
 *   - Empty excerpt with non-zero offsets → reject (`empty_span`).
 *   - Excerpt longer than source → reject (`out_of_bounds`).
 *
 * @rules AC-2, EI-1
 * @adr ADR-001, ADR-010
 */

import type { CitationTuple } from '@iip/contracts';
import type { GateViolationKind } from '@iip/contracts';

/**
 * Discriminated result — when `passed` is false, `kind` is always present, so
 * callers need no defensive fallback (no unkillable `??` mutant under Stryker).
 */
export type SubstringResult =
  | { readonly passed: true }
  | { readonly passed: false; readonly kind: GateViolationKind };

/**
 * Validate that `spanText` is the exact (NFC-normalized) substring of
 * `sourceText` at `[tuple.span_start, tuple.span_end)`.
 */
export function validateSubstring(
  spanText: string,
  tuple: CitationTuple,
  sourceText: string,
): SubstringResult {
  const start = tuple.span_start;
  const end = tuple.span_end;

  if (start > end) {
    return { passed: false, kind: 'inverted_span' };
  }

  if (end > sourceText.length) {
    return { passed: false, kind: 'out_of_bounds' };
  }

  // Reject empty span text outright — a claim with no text cannot be served.
  if (spanText.length === 0) {
    return { passed: false, kind: 'empty_span' };
  }

  const excerpt = sourceText.substring(start, end);

  // Empty excerpt (zero-length span at any offset) → reject (meaningless span).
  if (excerpt.length === 0) {
    return { passed: false, kind: 'empty_span' };
  }

  const normSpan = spanText.normalize('NFC');
  const normExcerpt = excerpt.normalize('NFC');

  if (normSpan !== normExcerpt) {
    return { passed: false, kind: 'citation_mismatch' };
  }

  return { passed: true };
}
