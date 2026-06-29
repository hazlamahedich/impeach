/**
 * Story 2.1 — Render Gate error propagation (AC #13, SEC-5).
 *
 * @rules AC-2, SEC-5
 * @adr ADR-0001
 *
 * Backing-service failure modes: resolver throws, resolver "times out"
 * (delayed rejection), resolver returns malformed data, resolver signals a
 * 429 rate-limit. In every case the gate MUST fail closed into structured
 * silence — never throw, never serve an unverifiable claim.
 */

import { describe, it, expect } from 'vitest';
import { renderGateLive } from '@iip/render';
import type { SourceDocSnapshot, SourceResolver } from '@iip/contracts';
import { liveSourceDoc, liveCitedClaim, liveGateContext } from '../support/fixtures';

const DOC = liveSourceDoc();
const CLAIM = liveCitedClaim(DOC);

function ctxWith(resolver: SourceResolver) {
  return liveGateContext({ resolver });
}

describe('Story 2.1 — error propagation (SEC-5 fail-closed under degradation)', () => {
  it('resolver throws → gate.degraded, span stripped, no rethrow, error context preserved', async () => {
    const out = await renderGateLive(
      { query: 'q', answer_text: DOC.text, spans: [CLAIM] },
      ctxWith({ async resolve() { throw new Error('connection refused'); } }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: 'connection refused' }));
  });

  it('resolver "times out" (delayed rejection) → gate.degraded', async () => {
    const out = await renderGateLive(
      { query: 'q', answer_text: DOC.text, spans: [CLAIM] },
      ctxWith({
        async resolve() {
          return new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error('timeout')), 5);
          });
        },
      }),
    );
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });

  it('resolver returns malformed data (missing text) → gate.degraded', async () => {
    // Resolver violates its contract; the gate trusts the snapshot but defends
    // itself by degrading rather than crashing on a malformed object.
    // (`superseded_at: null` so the chain advances past supersession to the
    // substring step, where the missing `text` throws → gate.degraded.)
    const malformed = { id: DOC.id, superseded_at: null } as unknown as SourceDocSnapshot;
    const out = await renderGateLive(
      { query: 'q', answer_text: DOC.text, spans: [CLAIM] },
      ctxWith({ async resolve() { return malformed; } }),
    );
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });

  it('resolver signals 429 rate-limit (throws) → gate.degraded', async () => {
    const out = await renderGateLive(
      { query: 'q', answer_text: DOC.text, spans: [CLAIM] },
      ctxWith({ async resolve() { throw new Error('429 Too Many Requests'); } }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });

  it('malformed snapshot (invalid superseded_at) does NOT cause false superseded rejection', async () => {
    const bad = { ...DOC, superseded_at: 'not-a-date' as unknown as string | null };
    const out = await renderGateLive(
      { query: 'q', answer_text: DOC.text, spans: [CLAIM] },
      ctxWith({ async resolve(id) { return id === DOC.id ? bad : null; } }),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('one degraded span does NOT suppress an independently-valid span', async () => {
    const goodDoc = liveSourceDoc({ id: '00000000-0000-4000-8000-0000000000aa' });
    const goodClaim = liveCitedClaim(goodDoc);
    const resolver: SourceResolver = {
      async resolve(id) {
        if (id === goodDoc.id) return goodDoc;
        throw new Error('down for the bad doc');
      },
    };
    const out = await renderGateLive(
      { query: 'q', answer_text: goodDoc.text, spans: [CLAIM, goodClaim] },
      ctxWith(resolver),
    );
    const served = out.spans.filter((s) => s.is_claim);
    expect(served).toHaveLength(1);
    expect(served[0]!.citation!.tuple.source_doc_id).toBe(goodDoc.id);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });
});
