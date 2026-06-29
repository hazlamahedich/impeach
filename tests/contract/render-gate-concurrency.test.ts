/**
 * Story 2.1 — Render Gate concurrency (AC #4, AC #10).
 *
 * @rules AC-2, SEC-5
 * @adr ADR-0001
 *
 * 100 simultaneous gate calls against a shared resolver — no race conditions,
 * no unhandled rejections, every call returns a well-formed GateOutput, and the
 * citation-or-silence invariant holds for each.
 */

import { describe, it, expect } from 'vitest';
import { renderGateLive } from '@iip/render';
import { liveSourceDoc, liveResolver, liveGateContext, liveCitedClaim } from '../support/fixtures';

const N = 100;

describe('Story 2.1 — concurrency (100 simultaneous calls)', () => {
  it('all calls resolve with the citation-or-silence invariant intact', async () => {
    const doc = liveSourceDoc();
    const ctx = liveGateContext({ resolver: liveResolver([doc]) });
    const input = {
      query: 'q',
      answer_text: doc.text,
      spans: [
        liveCitedClaim(doc),
        { text: 'uncited', is_claim: true as const, claim_type: 'attributed' as const, citation_ref: null },
      ],
    };

    const results = await Promise.all(
      Array.from({ length: N }, () => renderGateLive(input, ctx)),
    );

    expect(results).toHaveLength(N);
    for (const out of results) {
      // Exactly one cited claim served; the uncited one always stripped.
      const served = out.spans.filter((s) => s.is_claim);
      expect(served).toHaveLength(1);
      expect(served[0]!.citation).not.toBeNull();
    }
  });

  it('a resolver shared across concurrent calls returns consistent snapshots', async () => {
    const doc = liveSourceDoc();
    const ctx = liveGateContext({ resolver: liveResolver([doc]) });
    const input = { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] };

    const results = await Promise.all(
      Array.from({ length: N }, () => renderGateLive(input, ctx)),
    );

    const first = JSON.stringify(results[0]);
    for (const out of results) {
      expect(JSON.stringify(out)).toBe(first);
    }
  });
});
