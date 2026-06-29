/**
 * Story 2.1 — Render Gate integration (AC #1, #4, #10, #13).
 *
 * @rules AC-2, SEC-5, EI-1, EI-8
 * @adr ADR-0001, ADR-0010
 *
 * Full-chain exercise with a realistic canned source resolver: multiple
 * documents, mixed cited / uncited / superseded / tier-3 claims, and the
 * fail-closed degradation path. This is the closest unit-level stand-in for the
 * serve-worker render pipeline (which lands in Epic 5).
 */

import { describe, it, expect } from 'vitest';
import { renderGateLive } from '@iip/render';
import type { SourceDocSnapshot } from '@iip/contracts';
import {
  liveSourceDoc,
  liveResolver,
  liveGateContext,
  liveCitedClaim,
  liveClaimSpan,
} from '../support/fixtures';

describe('Story 2.1 — integration: full chain with a canned resolver', () => {
  it('serves cited claims, strips uncited/superseded, flags tier-3, in one render', async () => {
    const doc1 = liveSourceDoc({
      id: '00000000-0000-4000-8000-000000000001',
      text: 'The Senate acquitted the official on 2024-01-15.',
      trust_tier: 1,
    });
    const doc3 = liveSourceDoc({
      id: '00000000-0000-4000-8000-000000000003',
      text: 'A single unverified manual source alleges misconduct.',
      trust_tier: 3,
    });
    const superseded = liveSourceDoc({
      id: '00000000-0000-4000-8000-000000000004',
      text: 'An older report now corrected.',
      superseded_at: '2026-02-01T00:00:00Z',
    });

    const input = {
      query: 'What happened?',
      answer_text: [doc1.text, doc3.text, superseded.text, 'An uncited rumour.'].join(' '),
      spans: [
        { text: 'Context.', is_claim: false as const, citation_ref: null },
        liveCitedClaim(doc1),
        liveCitedClaim(doc3, { trust_tier: 3, text: doc3.text }),
        liveCitedClaim(superseded, { text: superseded.text }),
        { text: 'An uncited rumour.', is_claim: true as const, claim_type: 'attributed' as const, citation_ref: null },
      ],
    };

    const out = await renderGateLive(input, liveGateContext({ resolver: liveResolver([doc1, doc3, superseded]) }));

    const served = out.spans.filter((s) => s.is_claim);
    // doc1 (tier-1) + doc3 (tier-3) served; superseded rejected; uncited stripped.
    expect(served).toHaveLength(2);
    const tier3 = served.find((s) => s.citation!.tuple.source_doc_id === doc3.id);
    expect(tier3?.uncorroborated).toBe(true);
    const tier1 = served.find((s) => s.citation!.tuple.source_doc_id === doc1.id);
    expect(tier1?.uncorroborated).toBeFalsy();

    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'superseded' }));
    expect(out.no_evidence).toBe(false);
  });

  it('partial-span citation over a sub-range of the source serves correctly', async () => {
    const doc = liveSourceDoc({ text: 'The senator voted YES on the resolution.' });
    const span = liveClaimSpan(doc, { span_start: 12, span_end: 21 }); // 'voted YES'
    const out = await renderGateLive(
      { query: 'q', answer_text: 'voted YES', spans: [span] },
      liveGateContext({ resolver: liveResolver([doc]) }),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(claim!.text).toBe('voted YES');
  });

  it('degradation: killing the resolver (it throws) yields structured silence, no throw', async () => {
    const doc: SourceDocSnapshot = liveSourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
      liveGateContext({ resolver: { async resolve() { throw new Error('killed'); } } }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });

  it('performance baseline: a single gate invocation completes well under budget (excludes resolver I/O)', async () => {
    const doc = liveSourceDoc();
    const ctx = liveGateContext({ resolver: liveResolver([doc]) });
    const input = { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] };

    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      await renderGateLive(input, ctx);
    }
    const elapsedMs = performance.now() - start;
    const perCallMs = elapsedMs / 500;
    // Budget is p95 < 500ms / p99 < 1s (Task 7). Average must be far under that.
    expect(perCallMs).toBeLessThan(100);
  });
});
