import { describe, it, expect } from 'vitest';
import { renderGate } from './gate.js';
import { CitationTuple } from '@iip/contracts';
import type { RenderInputType, CitationRefType } from '@iip/contracts';

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

describe('renderGate (Story 1.4 stub)', () => {
  describe('POSITIVE: cited claims are preserved', () => {
    it('preserves a claim-bearing span with valid citation', () => {
      const input: RenderInputType = {
        query: 'What did the senator vote on?',
        answer_text: 'The senator voted YES.',
        spans: [
          {
            text: 'The senator voted YES.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
        ],
      };

      const output = renderGate(input);

      expect(output.spans).toHaveLength(1);
      expect(output.spans[0]!.is_claim).toBe(true);
      expect(output.spans[0]!.citation).not.toBeNull();
      expect(output.spans[0]!.citation!.citation_id).toBe('cit-001');
      expect(output.no_evidence).toBe(false);
    });

    it('does not throw when answer_text is empty', () => {
    const input: RenderInputType = {
      query: 'Test',
      answer_text: '',
      spans: [{ text: 'Context.', is_claim: false, citation_ref: null }],
    };

    expect(() => renderGate(input)).not.toThrow();
    const output = renderGate(input);
    expect(output.no_evidence).toBe(true);
    expect(output.essence_sentence).toBe('');
  });

  it('passes through non-claim spans unchanged', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'Some context. A claim.',
        spans: [
          { text: 'Some context.', is_claim: false, citation_ref: null },
          {
            text: 'A claim.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
        ],
      };

      const output = renderGate(input);

      expect(output.spans).toHaveLength(2);
      expect(output.spans[0]!.is_claim).toBe(false);
      expect(output.spans[1]!.is_claim).toBe(true);
      expect(output.spans[1]!.citation).not.toBeNull();
    });
  });

  describe('NEGATIVE: uncited claims are stripped (fail-closed)', () => {
    it('strips a claim-bearing span with null citation_ref', () => {
      const input: RenderInputType = {
        query: 'What happened?',
        answer_text: 'An uncited allegation.',
        spans: [
          {
            text: 'An uncited allegation.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output = renderGate(input);

      expect(output.spans).toHaveLength(0);
      expect(output.no_evidence).toBe(true);
    });

    it('strips uncited claims but preserves cited ones in mixed input', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'Cited fact. Uncited allegation.',
        spans: [
          {
            text: 'Cited fact.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
          {
            text: 'Uncited allegation.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output = renderGate(input);

      const claimSpans = output.spans.filter((s) => s.is_claim);
      expect(claimSpans).toHaveLength(1);
      expect(claimSpans[0]!.text).toBe('Cited fact.');
      expect(output.no_evidence).toBe(false);
    });
  });

  describe('SILENCE: no_evidence state', () => {
    it('sets no_evidence=true when all claims are stripped', () => {
      const input: RenderInputType = {
        query: 'What happened?',
        answer_text: 'Allegation one. Allegation two.',
        spans: [
          {
            text: 'Allegation one.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
          {
            text: 'Allegation two.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: null,
          },
        ],
      };

      const output = renderGate(input);

      expect(output.no_evidence).toBe(true);
      expect(output.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(output.essence_sentence).toBeTruthy();
    });

    it('sets no_evidence=false when at least one claim is cited', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'A cited claim.',
        spans: [
          {
            text: 'A cited claim.',
            is_claim: true,
            claim_type: 'fact',
            citation_ref: validCitation(),
          },
        ],
      };

      const output = renderGate(input);

      expect(output.no_evidence).toBe(false);
    });
  });

  describe('claim_type preservation', () => {
    it('preserves claim_type on cited spans', () => {
      const input: RenderInputType = {
        query: 'Test',
        answer_text: 'An attributed claim.',
        spans: [
          {
            text: 'An attributed claim.',
            is_claim: true,
            claim_type: 'attributed',
            citation_ref: validCitation(),
          },
        ],
      };

      const output = renderGate(input);

      expect(output.spans[0]!.claim_type).toBe('attributed');
    });
  });
});
