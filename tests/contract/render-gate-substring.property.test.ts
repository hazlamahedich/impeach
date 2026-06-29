/**
 * Story 2.1 — Render Gate substring + invariant property tests (PC-9).
 *
 * @rules AC-2, EI-1, PC-9, SEC-8
 * @adr ADR-0001, ADR-0010
 *
 * Seven fast-check properties, ≥1000 runs each:
 *   1. POSITIVE — valid substring always preserved
 *   2. NEGATIVE — 1-char mutation always rejected
 *   3. OUT-OF-BOUNDS — span_end past source length always rejected
 *   4. DETERMINISM — same input ⇒ structurally equal output
 *   5. TIER-MONOTONICITY — a valid claim serves at every tier {1,2,3};
 *      uncorroborated marker is tier-monotone (tier-3 ⇒ true, tier-1/2 ⇒ absent)
 *   6. SILENCE-CONTRACT — all-uncited input ⇒ no_evidence + no claim spans,
 *      always the same silence shape
 *   7. CITATION-OR-SILENCE — every emitted claim carries a non-null citation
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { renderGateLive } from '@iip/render';
import type { SourceDocSnapshot } from '@iip/contracts';
import {
  liveSourceDoc,
  liveResolver,
  liveGateContext,
  liveCitedClaim,
} from '../support/fixtures';

const NUM_RUNS = 1000;

const sourceDocArb = fc.record({
  id: fc.uuid({ version: 4 }).noShrink(),
  text: fc.string({ minLength: 10, maxLength: 200 }).noShrink(),
  tier: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
});

function docFrom({ id, text, tier }: { id: string; text: string; tier: 1 | 2 | 3 }): SourceDocSnapshot {
  return liveSourceDoc({ id, text, trust_tier: tier });
}

describe('Story 2.1 — Render Gate property tests (PC-9)', () => {
  it('PROPERTY 1 (positive): valid full-text substring always preserved', async () => {
    await fc.assert(
      fc.asyncProperty(sourceDocArb, async ({ id, text, tier }) => {
        const doc = docFrom({ id, text, tier });
        const out = await renderGateLive(
          { query: 'q', answer_text: text, spans: [liveCitedClaim(doc, { trust_tier: tier })] },
          liveGateContext({ resolver: liveResolver([doc]) }),
        );
        const claims = out.spans.filter((s) => s.is_claim);
        if (claims.length !== 1) {
          throw new Error(`expected 1 preserved claim, got ${claims.length}`);
        }
        expect(claims[0]!.citation).not.toBeNull();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 2 (negative): 1-char mutation always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(sourceDocArb, async ({ id, text, tier }) => {
        const doc = docFrom({ id, text, tier });
        const mutated = text.slice(0, -1) + (text.endsWith('a') ? 'b' : 'a');
        const out = await renderGateLive(
          {
            query: 'q', answer_text: mutated,
            spans: [liveCitedClaim(doc, { text: mutated, trust_tier: tier })],
          },
          liveGateContext({ resolver: liveResolver([doc]) }),
        );
        if (out.spans.some((s) => s.is_claim)) {
          throw new Error('mutated substring was served (citation-or-silence violated)');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 3 (bounds): span_end past source length always rejected', async () => {
    await fc.assert(
      fc.asyncProperty(sourceDocArb, fc.integer({ min: 1, max: 500 }), async ({ id, text, tier }, overshoot) => {
        const doc = docFrom({ id, text, tier });
        const span = {
          text,
          is_claim: true as const,
          claim_type: 'fact' as const,
          citation_ref: {
            citation_id: 'cit-001',
            source_id: '00000000-0000-4000-8000-000000000001',
            trust_tier: tier,
            tuple: {
              source_doc_id: id,
              span_start: 0,
              span_end: text.length + overshoot,
              content_hash: 'a'.repeat(64),
            },
          },
        };
        const out = await renderGateLive(
          { query: 'q', answer_text: text, spans: [span] },
          liveGateContext({ resolver: liveResolver([doc]) }),
        );
        expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 4 (determinism): same input ⇒ structurally equal output', async () => {
    await fc.assert(
      fc.asyncProperty(sourceDocArb, async ({ id, text, tier }) => {
        const doc = docFrom({ id, text, tier });
        const input = {
          query: 'q', answer_text: text,
          spans: [liveCitedClaim(doc, { trust_tier: tier })],
        };
        const ctx = liveGateContext({ resolver: liveResolver([doc]) });
        const a = await renderGateLive(input, ctx);
        const b = await renderGateLive(input, ctx);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 5 (tier-monotonicity): valid claim serves at every tier; marker is tier-monotone', async () => {
    await fc.assert(
      fc.asyncProperty(sourceDocArb, async ({ id, text }) => {
        const docs = [1, 2, 3].map((t) => docFrom({ id, text, tier: t as 1 | 2 | 3 }));
        const ctx = (d: SourceDocSnapshot) => liveGateContext({ resolver: liveResolver([d]) });
        const outs = await Promise.all(
          docs.map(async (d, i) =>
            renderGateLive(
              { query: 'q', answer_text: text, spans: [liveCitedClaim(d, { trust_tier: (i + 1) as 1 | 2 | 3 })] },
              ctx(d),
            ),
          ),
        );
        // Serving is monotone: every valid tier serves exactly one claim.
        for (const out of outs) {
          expect(out.spans.filter((s) => s.is_claim)).toHaveLength(1);
        }
        // Marker is tier-monotone: tier-3 flagged, tier-1/2 not.
        expect(outs[0]!.spans[0]!.uncorroborated).toBeFalsy();
        expect(outs[1]!.spans[0]!.uncorroborated).toBeFalsy();
        expect(outs[2]!.spans[0]!.uncorroborated).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 6 (silence-contract): all-uncited input ⇒ no_evidence + no claims + essence', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.string({ minLength: 1 }).noShrink(), { minLength: 1, maxLength: 8 }), async (texts) => {
        const doc = liveSourceDoc();
        const input = {
          query: 'q', answer_text: texts.join(' '),
          spans: texts.map((t) => ({ text: t, is_claim: true as const, claim_type: 'attributed' as const, citation_ref: null })),
        };
        const out = await renderGateLive(input, liveGateContext({ resolver: liveResolver([doc]) }));
        expect(out.no_evidence).toBe(true);
        expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
        expect(typeof out.essence_sentence).toBe('string');
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('PROPERTY 7 (citation-or-silence): every emitted claim carries a non-null citation', async () => {
    // kind: 0 → cited claim (valid full-text), 1 → uncited claim, 2 → non-claim context.
    const spanKindsArb = fc.array(fc.nat({ max: 2 }), { minLength: 1, maxLength: 8 });

    await fc.assert(
      fc.asyncProperty(sourceDocArb, spanKindsArb, async ({ id, text, tier }, kinds) => {
        const doc = docFrom({ id, text, tier });
        const spans = kinds.map((kind) => {
          if (kind === 0) return liveCitedClaim(doc, { trust_tier: tier });
          if (kind === 1) {
            return { text: 'An uncited allegation.', is_claim: true as const, claim_type: 'attributed' as const, citation_ref: null };
          }
          return { text: 'Context.', is_claim: false as const, citation_ref: null };
        });
        const out = await renderGateLive(
          { query: 'q', answer_text: text, spans },
          liveGateContext({ resolver: liveResolver([doc]) }),
        );
        for (const span of out.spans) {
          if (span.is_claim) {
            expect(span.citation).not.toBeNull();
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
