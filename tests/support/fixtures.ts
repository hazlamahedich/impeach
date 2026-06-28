/**
 * Shared test fixtures for cross-suite defamation-spine tests.
 *
 * Consumed by tests/contract and tests/integration suites to avoid
 * duplicating `validCitation()` / `makeRenderInput()` across files.
 * Package-co-located tests keep their own helpers (packages must not
 * depend on tests/); this module serves the repo-level test suites.
 *
 * @rules AC-2, AC-4, SC-2
 * @adr ADR-001, ADR-010
 *
 * Usage:
 *   import { makeCitationRef, makeRenderInput } from '../support/fixtures';
 */

import { CitationTuple } from '@iip/contracts';
import type { CitationRefType, RenderInputType } from '@iip/contracts';

const SOURCE_DOC = '00000000-0000-4000-8000-000000000002';
const SOURCE = '00000000-0000-4000-8000-000000000001';

/** A minimal valid CitationRef for render-gate / contract tests. */
export function makeCitationRef(overrides: Partial<CitationRefType> = {}): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: SOURCE,
    trust_tier: 1,
    tuple: CitationTuple.parse({
      source_doc_id: SOURCE_DOC,
      span_start: 0,
      span_end: 100,
      content_hash: 'a'.repeat(64),
    }),
    ...overrides,
  };
}

/** A claim span carrying a valid citation. */
export function citedSpan(text: string, claimType: 'fact' | 'attributed' = 'fact') {
  return { text, is_claim: true as const, claim_type: claimType, citation_ref: makeCitationRef() };
}

/** A claim span with NO citation (must be stripped fail-closed). */
export function uncitedSpan(text: string, claimType: 'fact' | 'attributed' = 'attributed') {
  return { text, is_claim: true as const, claim_type: claimType, citation_ref: null };
}

/** A non-claim context span (always passed through). */
export function contextSpan(text: string) {
  return { text, is_claim: false as const, citation_ref: null };
}

/** Build a RenderInput from spans + answer text. */
export function makeRenderInput(
  answer_text: string,
  spans: RenderInputType['spans'],
  query = 'test query',
): RenderInputType {
  return { query, answer_text, spans };
}
