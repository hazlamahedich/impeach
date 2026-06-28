/**
 * Shared test factories for packages/render co-located tests.
 *
 * Package tests MUST NOT import from tests/support/ (boundary: packages
 * must not depend on tests/). Repo-level suites use tests/support/fixtures.ts.
 *
 * @rules AC-2, AC-4, SC-2
 * @adr ADR-001, ADR-010
 */

import { CitationTuple } from '@iip/contracts';
import type { CitationRefType } from '@iip/contracts';

/** A minimal valid CitationRef for render-gate tests. */
export function validCitation(overrides: Partial<CitationRefType> = {}): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: '00000000-0000-4000-8000-000000000001',
    trust_tier: 1,
    tuple: CitationTuple.parse({
      source_doc_id: '00000000-0000-4000-8000-000000000002',
      span_start: 0,
      span_end: 100,
      content_hash: 'a'.repeat(64),
    }),
    ...overrides,
  };
}
