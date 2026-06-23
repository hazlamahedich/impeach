/**
 * Citation-or-Silence Contract Test (RED)
 *
 * @rules AC-2, EI-1, SEC-5, PC-9
 * @adr ADR-001
 *
 * This test documents and enforces the citation-or-silence invariant.
 * It is RED by design — the render gate is not implemented until Epic 2.
 *
 * Once the gate is wired (Story 2.1), this test must go GREEN and stay GREEN.
 * Any PR touching packages/render/ or packages/ingest/extract/ must re-run
 * this contract as a merge gate (regression net).
 *
 * From the Foundation Action Plan P1:
 *   GIVEN any rendered assertion
 *   WHEN citation is present and valid
 *   THEN the assertion is served (POSITIVE — EI-1)
 *
 *   GIVEN any rendered assertion
 *   WHEN citation is absent or invalid
 *   THEN render output is suppressed — fail-closed (NEGATIVE — AC-2, EI-1)
 */

import { describe, it, expect } from 'vitest';
import { renderGate } from '@iip/render';
import type {
  RenderInputType,
  RenderDocumentType,
  CitationRefType,
} from '@iip/contracts';

/** Minimal valid citation ref factory. */
function validCitation(overrides: Partial<CitationRefType> = {}): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: '00000000-0000-4000-8000-000000000001',
    trust_tier: 1,
    tuple: {
      source_doc_id: '00000000-0000-4000-8000-000000000002',
      span_start: 0,
      span_end: 100,
      content_hash: 'sha256:abc123',
    },
    ...overrides,
  };
}

describe('Citation-or-Silence Contract (EI-1, AC-2, SEC-5)', () => {
  describe('POSITIVE: cited assertions are served', () => {
    it('serves a claim-bearing span when citation is present and valid', () => {
      const input: RenderInputType = {
        query: 'What did the senator vote on?',
        answer_text: 'The senator voted YES on the resolution.',
        spans: [
          {
            text: 'The senator voted YES on the resolution.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);

      const claimSpans = output.spans.filter((s) => s.is_claim);
      expect(claimSpans).toHaveLength(1);
      expect(claimSpans[0]!.citation).not.toBeNull();
    });
  });

  describe('NEGATIVE: uncited assertions are suppressed (fail-closed)', () => {
    it('strips a claim-bearing span when citation is null', () => {
      const input: RenderInputType = {
        query: 'What did the senator do?',
        answer_text: 'The senator accepted a bribe.',
        spans: [
          {
            text: 'The senator accepted a bribe.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);

      const claimSpans = output.spans.filter((s) => s.is_claim);
      expect(claimSpans).toHaveLength(0);
    });

    it('renders no_evidence state when ALL claims lack citation', () => {
      const input: RenderInputType = {
        query: 'What happened?',
        answer_text: 'Something happened allegedly.',
        spans: [
          {
            text: 'Something happened allegedly.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);

      expect(output.no_evidence).toBe(true);
      expect(output.spans.filter((s) => s.is_claim)).toHaveLength(0);
    });
  });

  describe('INVARIANT: no uncited path exists (PC-9 property)', () => {
    it('every emitted claim-bearing span has non-null citation.source_id', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'Claim with citation. Claim without.',
        spans: [
          {
            text: 'Claim with citation.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
          {
            text: 'Claim without.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);

      for (const span of output.spans) {
        if (span.is_claim) {
          expect(span.citation).not.toBeNull();
          expect(span.citation!.source_id).toBeTruthy();
        }
      }
    });

    it('no span without citation.source_id is emitted as a claim', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'Uncited claim.',
        spans: [
          {
            text: 'Uncited claim.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);

      const uncitedClaims = output.spans.filter(
        (s) => s.is_claim && (s.citation === null || s.citation.source_id === ''),
      );
      expect(uncitedClaims).toHaveLength(0);
    });
  });

  describe('TRUST TIER: EI-8 enforcement', () => {
    it('serves tier-1 cited claim without corroboration marker', () => {
      const input: RenderInputType = {
        query: 'What was the verdict?',
        answer_text: 'The Senate acquitted the official.',
        spans: [
          {
            text: 'The Senate acquitted the official.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation({ trust_tier: 1 }),
          },
        ],
      };

      const output: RenderDocumentType = renderGate(input);
      const claim = output.spans.find((s) => s.is_claim);
      expect(claim).toBeDefined();
      expect(claim!.citation!.trust_tier).toBe(1);
    });
  });
});
