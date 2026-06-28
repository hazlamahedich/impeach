/**
 * Render Gate — silence-with-context + essence_sentence truncation (EXPANSION).
 *
 * Expands Story 1.4 / 1.12 coverage: the defamation "silence + preserved
 * context" case and the PD-1 essence_sentence truncation boundary.
 *
 * @rules AC-2, SEC-5, EI-1, PD-1
 * @adr ADR-001
 */

import { describe, it, expect } from 'vitest';
import { renderGate } from './gate.js';
import type { RenderInputType } from '@iip/contracts';
import { validCitation } from './__fixtures__/factories.js';

describe('renderGate — silence-with-context (AC-2, EI-1)', () => {
  it('[P0] preserves non-claim context spans alongside no_evidence=true when all claims are uncited', () => {
    // GIVEN one non-claim context span and one uncited claim span
    const input: RenderInputType = {
      query: 'What happened?',
      answer_text: 'Background context. An uncited allegation.',
      spans: [
        { text: 'Background context.', is_claim: false, citation_ref: null },
        {
          text: 'An uncited allegation.',
          is_claim: true,
          claim_type: 'attributed',
          citation_ref: null,
        },
      ],
    };

    // WHEN the gate runs (fail-closed strips the uncited claim)
    const output = renderGate(input);

    // THEN silence is declared AND the non-claim context survives
    expect(output.no_evidence).toBe(true);
    const contextSpans = output.spans.filter((s) => !s.is_claim);
    expect(contextSpans).toHaveLength(1);
    expect(contextSpans[0]!.text).toBe('Background context.');
    expect(output.spans.filter((s) => s.is_claim)).toHaveLength(0);
  });

  it('[P0] sets no_evidence=true and drops every claim when only claim spans exist and all are uncited', () => {
    // GIVEN only claim spans, every one uncited
    const input: RenderInputType = {
      query: 'Q',
      answer_text: 'Claim A. Claim B.',
      spans: [
        { text: 'Claim A.', is_claim: true, claim_type: 'attributed', citation_ref: null },
        { text: 'Claim B.', is_claim: true, claim_type: 'attributed', citation_ref: null },
      ],
    };

    // WHEN the gate runs
    const output = renderGate(input);

    // THEN total silence — no spans survive, no_evidence true
    expect(output.spans).toHaveLength(0);
    expect(output.no_evidence).toBe(true);
  });
});

describe('renderGate — essence_sentence truncation boundary (PD-1)', () => {
  it('[P0] truncates essence_sentence at exactly 200 chars (boundary at 200)', () => {
    // GIVEN an answer_text of exactly 200 chars, all claims uncited
    const answer = 'a'.repeat(200);
    const input: RenderInputType = {
      query: 'Q',
      answer_text: answer,
      spans: [
        { text: 'uncited', is_claim: true, claim_type: 'attributed', citation_ref: null },
      ],
    };

    // WHEN the gate enters the silence branch
    const output = renderGate(input);

    // THEN essence_sentence preserves the full 200 chars (no truncation at the boundary)
    expect(output.no_evidence).toBe(true);
    expect(output.essence_sentence).toHaveLength(200);
    expect(output.essence_sentence).toBe(answer);
  });

  it('[P0] truncates essence_sentence to 200 when answer_text is 201 chars (boundary +1)', () => {
    // GIVEN an answer_text of 201 chars
    const answer = 'b'.repeat(201);
    const input: RenderInputType = {
      query: 'Q',
      answer_text: answer,
      spans: [
        { text: 'uncited', is_claim: true, claim_type: 'attributed', citation_ref: null },
      ],
    };

    // WHEN the gate truncates via slice(0, 200)
    const output = renderGate(input);

    // THEN essence_sentence is exactly 200 chars (the 201st is dropped)
    expect(output.essence_sentence).toHaveLength(200);
    expect(output.essence_sentence).toBe(answer.slice(0, 200));
  });

  it('[P1] essence_sentence equals the first 200 chars of a long, recognizable answer', () => {
    // GIVEN a 250-char answer with identifiable content
    const answer = 'The Senate convened to vote on the articles of impeachment. '.repeat(5) + 'tail';
    const input: RenderInputType = {
      query: 'Q',
      answer_text: answer,
      spans: [
        { text: 'uncited', is_claim: true, claim_type: 'attributed', citation_ref: null },
      ],
    };

    // WHEN the gate truncates
    const output = renderGate(input);

    // THEN the essence is the leading 200 chars verbatim (PD-1 framing integrity)
    expect(output.essence_sentence).toBe(answer.slice(0, 200));
    expect(output.essence_sentence).toContain('Senate convened');
  });
});

describe('renderGate — essence_sentence null-safety (defensive ?? fallback)', () => {
  it('[P1] falls back to empty string when answer_text is null at runtime (bypasses zod)', () => {
    const input = {
      query: 'Q',
      answer_text: null as unknown as string,
      spans: [{ text: 'uncited', is_claim: true, claim_type: 'attributed' as const, citation_ref: null }],
    };
    const output = renderGate(input);
    expect(output.essence_sentence).toBe('');
  });
});

describe('renderGate — essence_sentence only on silence (not on cited answers)', () => {
  it('[P1] does not set essence_sentence when at least one claim is cited', () => {
    // GIVEN a cited claim (no silence)
    const input: RenderInputType = {
      query: 'Q',
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

    // WHEN the gate runs
    const output = renderGate(input);

    // THEN no_evidence is false and essence_sentence is absent (only emitted in silence branch)
    expect(output.no_evidence).toBe(false);
    expect((output as { essence_sentence?: string }).essence_sentence).toBeUndefined();
  });
});
