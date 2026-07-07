/**
 * Live render gate unit tests (Story 2.1 — AC #1, #2, #5, #6, #7, #8, #13, #14).
 *
 * Comprehensive branch + boundary coverage so Stryker mutation on `gate.ts`
 * reaches 100% (SEC-8, INV-008). The repo-level contract/property/error/
 * concurrency/integration suites assert the invariant end-to-end; this file is
 * the mutation-killing spine.
 *
 * @rules AC-2, SEC-5, EI-1, EI-8, SEC-3
 * @adr ADR-001, ADR-010
 */

import { describe, it, expect } from 'vitest';
import type { EntailmentChecker, GateContext, SourceDocSnapshot, SourceResolver, CitationTuple } from '@iip/contracts';
import { renderGateLive } from './gate.js';
import {
  sourceDoc,
  citedClaimFor,
  claimWithSpan,
  uncitedClaim,
  contextFor,
  makeResolver,
  makeGateContext,
  citationFor,
} from './__fixtures__/factories.js';

interface CtxOpts {
  resolver?: SourceResolver;
  verify?: boolean | ((t: CitationTuple, s: { content: string }) => Promise<boolean>);
  entailment?: GateContext['entailment'];
  auditHealth?: GateContext['auditHealth'];
}

function ctxFor(docs: SourceDocSnapshot[], opts: CtxOpts = {}): GateContext {
  const args: CtxOpts & { resolver: SourceResolver } = {
    resolver: opts.resolver ?? makeResolver(docs),
  };
  if (opts.verify !== undefined) {
    args.verify = opts.verify;
  }
  if (opts.entailment !== undefined) {
    args.entailment = opts.entailment;
  }
  if (opts.auditHealth !== undefined) {
    args.auditHealth = opts.auditHealth;
  }
  return makeGateContext(args);
}

describe('renderGateLive — POSITIVE: cited claims served through the full chain', () => {
  it('serves a tier-1 cited claim with matching substring + hash', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );

    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(claim!.citation).not.toBeNull();
    expect(claim!.citation!.tuple.source_doc_id).toBe(doc.id);
    expect(claim!.uncorroborated).toBeFalsy();
    expect(out.no_evidence).toBe(false);
    expect((out as { essence_sentence?: string }).essence_sentence).toBeUndefined();
    expect(out.violations).toEqual([]);
  });

  it('serves a tier-2 cited claim without the uncorroborated marker', async () => {
    const doc = sourceDoc({ trust_tier: 2 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    expect(out.spans.find((s) => s.is_claim)!.uncorroborated).toBeFalsy();
  });

  it('serves a tier-3 cited claim WITH uncorroborated marker (SEC-3)', async () => {
    const doc = sourceDoc({ trust_tier: 3 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(claim!.uncorroborated).toBe(true);
  });

  it('passes non-claim context spans through unchanged', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q', answer_text: doc.text,
        spans: [contextFor('Background.'), citedClaimFor(doc)],
      },
      ctxFor([doc]),
    );
    expect(out.spans).toHaveLength(2);
    expect(out.spans[0]!.is_claim).toBe(false);
    expect(out.spans[0]!.citation).toBeNull();
  });

  it('preserves a cited claim alongside a stripped uncited claim (mixed)', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q', answer_text: doc.text,
        spans: [citedClaimFor(doc), uncitedClaim('An uncited allegation.')],
      },
      ctxFor([doc]),
    );
    const claims = out.spans.filter((s) => s.is_claim);
    expect(claims).toHaveLength(1);
    expect(out.no_evidence).toBe(false);
  });

  it('passes the real source text to the injected verifier (kills ObjectLiteral mutant)', async () => {
    const doc = sourceDoc();
    // A verifier that actually reads source.content — the `{ content: source.text }`
    // object literal must carry the real text, or this returns false (hash_mismatch).
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { verify: async (_t, s) => s.content === doc.text }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(1);
    expect(out.violations).toEqual([]);
  });
});

describe('renderGateLive — NEGATIVE: uncited / unverifiable stripped (fail-closed)', () => {
  it('strips a claim with null citation_ref', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: 'x', spans: [uncitedClaim('Allegation.')] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
  });

  it('TC-3.2: non-existent source → source_not_found violation + strip', async () => {
    const doc = sourceDoc();
    const other = sourceDoc({ id: '00000000-0000-4000-8000-000000000099' });
    const span = citedClaimFor(doc); // cites `doc.id`, but resolver only has `other`
    const out = await renderGateLive(
      { query: 'q', answer_text: 'x', spans: [span] },
      ctxFor([other]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'source_not_found' }));
  });

  it('TC-3.3: superseded source → superseded violation + strip', async () => {
    const doc = sourceDoc({ superseded_at: '2026-01-01T00:00:00Z' });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('TC-1.2: tampered span text → citation_mismatch + strip', async () => {
    const doc = sourceDoc();
    const span = citedClaimFor(doc, { text: `${doc.text}!` }); // 1-char mutation
    const out = await renderGateLive(
      { query: 'q', answer_text: span.text!, spans: [span] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'citation_mismatch' }));
  });

  it('TC-1.3: out-of-bounds span_end → out_of_bounds + strip', async () => {
    const doc = sourceDoc();
    const span = claimWithSpan(doc, { span_start: 0, span_end: doc.text.length + 50 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'out_of_bounds' }));
  });

  it('TC-1.4: inverted offsets → inverted_span + strip', async () => {
    const doc = sourceDoc();
    const span = claimWithSpan(doc, { span_start: 50, span_end: 5 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'inverted_span' }));
  });

  it('TC-1.5: empty span text → empty_span + strip', async () => {
    const doc = sourceDoc();
    const span = claimWithSpan(doc, { span_start: 0, span_end: 10, text: '' });
    const out = await renderGateLive(
      { query: 'q', answer_text: '', spans: [span] },
      ctxFor([doc]),
    );
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'empty_span' }));
  });

  it('AC #14: hash mismatch → hash_mismatch + strip', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { verify: false }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'hash_mismatch' }));
  });

  it('entailment failure → entailment_failed + strip', async () => {
    const doc = sourceDoc();
    const failing: EntailmentChecker = { async check() { return { entailed: false }; } };
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { entailment: failing }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'entailment_failed' }));
  });

  it('TC-2.4: invalid trust tier → invalid_tier + strip', async () => {
    const doc = sourceDoc();
    const span = claimWithSpan(doc, { span_start: 0, span_end: doc.text.length, trust_tier: 99 as 1 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'invalid_tier' }));
  });

  it('TC-2.5: citation/source tier mismatch → trust_tier_mismatch + downgrade to lower tier', async () => {
    const doc = sourceDoc({ trust_tier: 3 });
    // citation claims tier-1, but source is tier-3 → effective tier 3, served with uncorroborated.
    const span = citedClaimFor(doc, { trust_tier: 1 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(claim!.uncorroborated).toBe(true);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'trust_tier_mismatch' }));
  });

  it('tier-3 citation over tier-1 source is downgraded and flagged', async () => {
    const doc = sourceDoc({ trust_tier: 1 });
    const span = citedClaimFor(doc, { trust_tier: 3 });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(claim!.uncorroborated).toBe(true);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'trust_tier_mismatch' }));
  });
});

describe('renderGateLive — SEC-5 fail-closed under degradation', () => {
  it('resolver throws → gate.degraded, no rethrow, span stripped, error context preserved', async () => {
    const doc = sourceDoc();
    const throwing = {
      resolver: { async resolve() { throw new Error('boom'); } },
    };
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      makeGateContext({ resolver: throwing.resolver as never }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: 'boom' }));
  });

  it('malformed top-level input (non-string answer_text) does not throw', async () => {
    const doc = sourceDoc();
    const input = { query: 'q', answer_text: 123 as unknown as string, spans: [uncitedClaim('x')] };
    const out = await renderGateLive(input, ctxFor([doc]));
    expect(out.no_evidence).toBe(true);
    expect(out.essence_sentence).toBe('');
  });

  it('undefined citation_ref is treated as uncited and stripped', async () => {
    const doc = sourceDoc();
    const span = { text: 'x', is_claim: true as const, claim_type: 'attributed' as const, citation_ref: undefined as unknown as null };
    const out = await renderGateLive(
      { query: 'q', answer_text: 'x', spans: [span] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
    expect(out.violations).toEqual([]);
  });

  it('non-ISO superseded_at is not treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: 'not-a-date' as unknown as string | null });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('empty-string superseded_at is not treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: '' as unknown as string | null });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('non-string superseded_at is not treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: 123 as unknown as string | null });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('ISO superseded_at without Z is NOT treated as superseded (UTC requires Z)', async () => {
    const doc = sourceDoc({ superseded_at: '2026-01-01T00:00:00' });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('ISO superseded_at with Z is treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: '2026-01-01T00:00:00Z' });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('prefixed junk before ISO date is not treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: 'x2026-01-01T00:00:00Z' as unknown as string | null });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('trailing junk after ISO date is not treated as superseded', async () => {
    const doc = sourceDoc({ superseded_at: '2026-01-01T00:00:00Zextra' as unknown as string | null });
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'superseded' }));
  });

  it('resolver timeout → gate.degraded, span stripped, label preserved', async () => {
    const doc = sourceDoc();
    const hanging: SourceResolver = {
      async resolve() {
        return new Promise(() => { /* never resolves */ });
      },
    };
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      makeGateContext({ resolver: hanging }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: expect.stringMatching(/resolver.*timed out/i) }));
  });

  it('verifyCitation timeout → gate.degraded, span stripped, label preserved', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { verify: async () => new Promise(() => { /* never resolves */ }) }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: expect.stringMatching(/verifyCitation.*timed out/i) }));
  });

  it('entailment timeout → gate.degraded, span stripped, label preserved', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { entailment: { async check() { return new Promise(() => { /* never resolves */ }); } } }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: expect.stringMatching(/entailment.*timed out/i) }));
  });

  it('entailment throws → gate.degraded, span stripped, error context preserved', async () => {
    const doc = sourceDoc();
    const throwing: EntailmentChecker = { async check() { throw new Error('ent boom'); } };
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { entailment: throwing }),
    );
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded', details: 'ent boom' }));
  });
});

describe('renderGateLive — silence state + essence_sentence (PD-1)', () => {
  it('sets no_evidence=true + essence_sentence when every claim is stripped', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: 'An uncited allegation.', spans: [uncitedClaim('An uncited allegation.')] },
      ctxFor([doc]),
    );
    expect(out.no_evidence).toBe(true);
    expect(out.essence_sentence).toBe('An uncited allegation.');
  });

  it('truncates essence_sentence at 200 chars (boundary)', async () => {
    const answer = 'b'.repeat(201);
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: answer, spans: [uncitedClaim(answer)] },
      ctxFor([doc]),
    );
    expect(out.essence_sentence).toHaveLength(200);
    expect(out.essence_sentence).toBe(answer.slice(0, 200));
  });

  it('falls back to empty essence when answer_text is null at runtime', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q',
        answer_text: null as unknown as string,
        spans: [uncitedClaim('x')],
      },
      ctxFor([doc]),
    );
    expect(out.essence_sentence).toBe('');
  });

  it('preserves context spans alongside no_evidence=true', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q', answer_text: 'Background. Allegation.',
        spans: [contextFor('Background.'), uncitedClaim('Allegation.')],
      },
      ctxFor([doc]),
    );
    expect(out.no_evidence).toBe(true);
    expect(out.spans.filter((s) => !s.is_claim)).toHaveLength(1);
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
  });
});

describe('renderGateLive — citation shape carried through', () => {
  it('served claim preserves the full CitationRef on the output span', async () => {
    const doc = sourceDoc();
    const ref = citationFor(doc);
    const span = { text: doc.text, is_claim: true as const, claim_type: 'fact' as const, citation_ref: ref };
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [span] },
      ctxFor([doc]),
    );
    const claim = out.spans.find((s) => s.is_claim);
    expect(claim!.citation).toStrictEqual(ref);
    expect(claim!.claim_type).toBe('fact');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Story 2.11 — ADR-0029 §5 audit-health fail-closed in the render gate.
//
// When the injected AuditHealthProbe reports audit-worker unreachable, every
// claim is WITHHELD with an `audit_offline` violation — the citation-or-silence
// invariant cannot be upheld without an intact audit trail. The gate reads the
// circuit-breaker state from the probe (single source of truth); it does NOT
// independently poll. Optional + backward-compatible: when omitted, the gate
// runs without the check (Story 2.1–2.10 behavior preserved).
// @rules ADR-0029 §5, SEC-5, AC-2
// @adr ADR-0029
// ───────────────────────────────────────────────────────────────────────────

describe('renderGateLive — Story 2.11 audit-health fail-closed (ADR-0029 §5)', () => {
  it('WITHHOLDs every claim when auditHealth reports audit unreachable', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { auditHealth: { isAuditReachable: () => false } }),
    );

    // No claim served — fail-closed.
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
    // audit_offline violation recorded against the withheld span.
    expect(out.violations).toContainEqual(
      expect.objectContaining({
        kind: 'audit_offline',
        source_doc_id: doc.id,
      }),
    );
  });

  it('serves claims normally when auditHealth reports audit reachable', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc], { auditHealth: { isAuditReachable: () => true } }),
    );

    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).toEqual([]);
    expect(out.no_evidence).toBe(false);
  });

  it('WITHHOLDs claims but passes non-claim context spans through (audit offline)', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q',
        answer_text: `Context. ${doc.text}`,
        spans: [
          { text: 'Context.', is_claim: false, citation_ref: null },
          citedClaimFor(doc),
        ],
      },
      ctxFor([doc], { auditHealth: { isAuditReachable: () => false } }),
    );

    // Non-claim context survives; the claim is stripped.
    const context = out.spans.find((s) => !s.is_claim);
    expect(context).toBeDefined();
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'audit_offline' }));
  });

  it('omitting auditHealth preserves Story 2.1–2.10 behavior (backward compatible)', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxFor([doc]), // no auditHealth
    );

    const claim = out.spans.find((s) => s.is_claim);
    expect(claim).toBeDefined();
    expect(out.violations).toEqual([]);
  });

  it('multiple cited claims under audit-offline all become audit_offline violations', async () => {
    const doc1 = sourceDoc({ id: '00000000-0000-4000-8000-000000000001' });
    const doc2 = sourceDoc({ id: '00000000-0000-4000-8000-000000000002' });
    const out = await renderGateLive(
      {
        query: 'q',
        answer_text: `${doc1.text} ${doc2.text}`,
        spans: [citedClaimFor(doc1), citedClaimFor(doc2)],
      },
      ctxFor([doc1, doc2], { auditHealth: { isAuditReachable: () => false } }),
    );

    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    const offline = out.violations.filter((v) => v.kind === 'audit_offline');
    expect(offline).toHaveLength(2);
  });
});
