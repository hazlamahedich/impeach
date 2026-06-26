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
import * as fc from 'fast-check';
import { renderGate } from '@iip/render';
import { RenderInput, CitationTuple } from '@iip/contracts';
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
    tuple: CitationTuple.parse({
      source_doc_id: '00000000-0000-4000-8000-000000000002',
      span_start: 0,
      span_end: 100,
      content_hash: 'a'.repeat(64),
    }),
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

  describe('PC-9 PROPERTY TEST (fast-check): no uncited claim served across 1000 random inputs', () => {
    const citationRefArb = fc.record({
      citation_id: fc.string({ minLength: 1 }).noShrink(),
      source_id: fc
        .uuid({ version: 4 })
        .noShrink(),
      trust_tier: fc.constantFrom(1, 2, 3),
      tuple: fc
        .record({
          source_doc_id: fc.uuid({ version: 4 }).noShrink(),
          span_start: fc.nat({ max: 10000 }),
          span_end: fc.nat({ max: 10000 }),
          content_hash: fc.hexaString({ minLength: 64, maxLength: 64 }).noShrink(),
        })
        .map(({ span_start, span_end, ...rest }) => ({
          ...rest,
          span_start: Math.min(span_start, span_end),
          span_end: Math.max(span_start, span_end),
        })),
    });

    const spanInputArb = fc.record({
      text: fc.string({ minLength: 1 }).noShrink(),
      is_claim: fc.boolean(),
      claim_type: fc.constantFrom('fact' as const, 'attributed' as const),
      citation_ref: fc.oneof(
        fc.constant(null),
        citationRefArb,
      ),
    });

    const renderInputArb = fc.record({
      query: fc.string({ minLength: 1 }).noShrink(),
      answer_text: fc.string({ minLength: 1 }).noShrink(),
      spans: fc.array(spanInputArb, { maxLength: 10 }),
    });

    it('every emitted claim-bearing span has non-null citation.source_id', () => {
      fc.assert(
        fc.property(renderInputArb, (rawInput) => {
          const typedInput = RenderInput.parse(rawInput);
          const output: RenderDocumentType = renderGate(typedInput);

          for (const span of output.spans) {
            if (span.is_claim) {
              if (span.citation === null) {
                throw new Error(
                  `Invariant violated: claim span emitted without citation: "${span.text}"`,
                );
              }
              if (!span.citation.source_id) {
                throw new Error(
                  `Invariant violated: claim span emitted with empty source_id: "${span.text}"`,
                );
              }
            }
          }
        }),
        { numRuns: 1000 },
      );
    });

    it('no span without citation is emitted as a claim', () => {
      fc.assert(
        fc.property(renderInputArb, (rawInput) => {
          const typedInput = RenderInput.parse(rawInput);
          const output: RenderDocumentType = renderGate(typedInput);

          const uncited = output.spans.filter(
            (s) => s.is_claim && (s.citation === null || s.citation.source_id === ''),
          );
          if (uncited.length > 0) {
            throw new Error(
              `Invariant violated: ${uncited.length} uncited claim(s) served`,
            );
          }
        }),
        { numRuns: 1000 },
      );
    });
  });
});
