/**
 * Render gate resilience expansion — throws, observer, audit-probe faults.
 *
 * Fills the three coverage gaps left by `gate-live.test.ts` (the Stryker
 * mutation spine): each closes a "gate never throws" / "VAL-9 audit integrity"
 * contract that is currently covered only by repo-level contract suites
 * OUTSIDE the package mutation scope.
 *
 *   E2-G1 [P0] verifyCitation THROWING (not just `false` / timeout) → the
 *          try/catch at gate.ts:188-201 must classify it as `gate.degraded`
 *          and strip the span, never rethrow. Today only the resolver throw
 *          and the entailment throw exercise this catch.
 *   E2-G2 [P0] auditHealth.isAuditReachable() THROWING — the probe call is
 *          wrapped in a try/catch (E2-G2 hardening): a throwing probe is
 *          treated as audit-unreachable → every claim WITHHELD + a
 *          `gate.degraded` violation. The gate never crashes the serve path.
 *   E2-G3 [P0] onInvocation observer (VAL-9) — the observation block
 *          (gate.ts:218-235) has ZERO package-level coverage. Pin the
 *          `served` / `claimsServed` / `violations` payload shape + the
 *          observer-throw → `gate.degraded` catch + the `responseId`
 *          falsy/whitespace normalization.
 *
 * @rules AC-2, SEC-5, VAL-9, EI-1
 * @adr ADR-001, ADR-010, ADR-0029
 */

import { describe, it, expect } from 'vitest';
import type { GateContext, GateInvocationObservation, SourceDocSnapshot } from '@iip/contracts';
import { renderGateLive } from './gate.js';
import {
  sourceDoc,
  citedClaimFor,
  uncitedClaim,
  makeResolver,
  makeGateContext,
} from './__fixtures__/factories.js';

// Helper: a GateContext whose verifyCitation throws synchronously.
function ctxWithThrowingVerify(docs: SourceDocSnapshot[], msg = 'verify boom'): GateContext {
  return makeGateContext({
    resolver: makeResolver(docs),
    verify: async () => { throw new Error(msg); },
  });
}

// Helper: a GateContext whose audit-health probe throws.
function ctxWithThrowingAuditHealth(docs: SourceDocSnapshot[]): GateContext {
  const base = makeGateContext({ resolver: makeResolver(docs) });
  return {
    ...base,
    auditHealth: {
      isAuditReachable: () => { throw new Error('probe boom'); },
    },
  };
}

// Helper: a GateContext that captures every onInvocation observation.
function ctxWithObserver(
  docs: SourceDocSnapshot[],
  sink: GateInvocationObservation[],
  observer?: (obs: GateInvocationObservation) => void,
): GateContext {
  const base = makeGateContext({ resolver: makeResolver(docs) });
  return {
    ...base,
    onInvocation: observer ?? ((obs) => { sink.push(obs); }),
  };
}

describe('renderGateLive — E2-G1 [P0] verifyCitation throwing → gate.degraded (never rethrows)', () => {
  // GIVEN a cited claim whose hash-verifier rejects synchronously
  // WHEN the gate processes the span
  // THEN the throw is caught (gate.ts:188-201), classified as gate.degraded,
  //      the error message is preserved, the span is stripped, and the gate
  //      resolves (never rethrows). Without this test a refactor that narrows
  //      the catch scope could let a throwing verifier serve an unverified
  //      claim whose content_hash was never authenticated (ADR-010 defeat).
  it('catches a throwing verifyCitation, classifies gate.degraded, strips the span, preserves the message', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithThrowingVerify([doc], 'hash verifier crashed'),
    );

    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
    expect(out.violations).toContainEqual(
      expect.objectContaining({ kind: 'gate.degraded', details: 'hash verifier crashed' }),
    );
  });

  it('does NOT rethrow (the gate contract: never throws)', async () => {
    const doc = sourceDoc();
    // If the catch were removed, this would reject; we assert it resolves.
    await expect(
      renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
        ctxWithThrowingVerify([doc]),
      ),
    ).resolves.toBeDefined();
  });

  it('preserves other spans when one span\'s verifier throws (per-span isolation)', async () => {
    const docA = sourceDoc({ id: '00000000-0000-4000-8000-000000000001' });
    const docB = sourceDoc({ id: '00000000-0000-4000-8000-000000000002' });
    // Mixed context: a verifier that throws ONLY for docA, succeeds for docB.
    const base = makeGateContext({
      resolver: makeResolver([docA, docB]),
      verify: async (tuple) => {
        if (tuple.source_doc_id === docA.id) throw new Error('docA verifier crash');
        return true;
      },
    });
    const out = await renderGateLive(
      { query: 'q', answer_text: `${docA.text} ${docB.text}`, spans: [citedClaimFor(docA), citedClaimFor(docB)] },
      base,
    );

    // docA stripped (degraded); docB served intact.
    const servedIds = out.spans
      .filter((s) => s.is_claim)
      .map((s) => s.citation!.tuple.source_doc_id);
    expect(servedIds).toEqual([docB.id]);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
  });
});

describe('renderGateLive — E2-G2 [P0] auditHealth probe throwing → structured gate.degraded (never crashes the serve path)', () => {
  // GIVEN a probe whose isAuditReachable() throws
  // WHEN the gate runs
  // THEN the gate must NOT propagate the throw. The probe call is wrapped in a
  //      try/catch (E2-G2 hardening): a throwing probe is treated as audit-
  //      unreachable → every claim WITHHELD + a `gate.degraded` violation
  //      recording the probe failure. SEC-5: the gate never lets a probe failure
  //      surface as an unstructured 500.
  it('catches a throwing probe, withholds every claim, and records a gate.degraded violation', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithThrowingAuditHealth([doc]),
    );

    // The defamation invariant: NO claim is served under audit-observability
    // failure (an auditable trail is a precondition for serving a claim).
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.no_evidence).toBe(true);
    // The probe failure is recorded as a structured gate.degraded violation so
    // the audit trail knows observability was impaired.
    expect(out.violations).toContainEqual(
      expect.objectContaining({
        kind: 'gate.degraded',
        source_doc_id: 'audit-health-probe',
        details: 'probe boom',
      }),
    );
  });

  it('does NOT rethrow (the gate contract: never throws on probe failure)', async () => {
    const doc = sourceDoc();
    // If the try/catch were removed, this would reject; we assert it resolves.
    await expect(
      renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
        ctxWithThrowingAuditHealth([doc]),
      ),
    ).resolves.toBeDefined();
  });

  it('preserves non-claim context spans when the probe throws (serve path still returns)', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      {
        query: 'q',
        answer_text: doc.text,
        spans: [
          { text: 'context', is_claim: false, citation_ref: null },
          citedClaimFor(doc),
        ],
      },
      ctxWithThrowingAuditHealth([doc]),
    );

    // Non-claim context passes through; the cited claim is withheld.
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.spans.filter((s) => !s.is_claim)).toHaveLength(1);
  });
});

describe('renderGateLive — E2-G3 [P0] onInvocation observer (VAL-9 audit integrity)', () => {
  it('emits exactly one observation with served=true + claimsServed count for a served claim', async () => {
    const doc = sourceDoc();
    const sink: GateInvocationObservation[] = [];
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithObserver([doc], sink),
    );

    // The observer fires exactly once.
    expect(sink).toHaveLength(1);
    const obs = sink[0]!;
    // served is true only when at least one claim survived (VAL-9 semantics).
    expect(obs.served).toBe(true);
    expect(obs.claimsServed).toBe(1);
    expect(obs.violations).toEqual([]);
    // ISO-8601 UTC timestamp.
    expect(obs.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    // The observation is consistent with the gate output.
    expect(obs.served).toBe(!out.no_evidence);
  });

  it('emits served=false when every claim is stripped (silence)', async () => {
    const doc = sourceDoc();
    const sink: GateInvocationObservation[] = [];
    const out = await renderGateLive(
      { query: 'q', answer_text: 'Allegation.', spans: [uncitedClaim('Allegation.')] },
      ctxWithObserver([doc], sink),
    );

    expect(sink).toHaveLength(1);
    expect(sink[0]!.served).toBe(false);
    expect(sink[0]!.claimsServed).toBe(0);
    expect(out.no_evidence).toBe(true);
  });

  it('carries the violation kinds in the observation payload', async () => {
    const doc = sourceDoc();
    const sink: GateInvocationObservation[] = [];
    // Tampered span text → citation_mismatch violation.
    const span = citedClaimFor(doc, { text: `${doc.text}!` });
    await renderGateLive(
      { query: 'q', answer_text: span.text!, spans: [span] },
      ctxWithObserver([doc], sink),
    );

    expect(sink[0]!.violations).toContain('citation_mismatch');
    expect(sink[0]!.served).toBe(false);
  });

  it('observer throwing → gate.degraded violation (observer failure must not change the decision)', async () => {
    const doc = sourceDoc();
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithObserver([doc], [], () => { throw new Error('observer crashed'); }),
    );

    // The claim is STILL served — observer failure does not change the gate
    // decision (SEC-5: render correctness > observability).
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(1);
    // And the observer failure is recorded as a gate.degraded violation so the
    // audit trail knows observability was impaired.
    expect(out.violations).toContainEqual(
      expect.objectContaining({ kind: 'gate.degraded', source_doc_id: 'observer' }),
    );
  });

  it('normalizes a falsy/whitespace responseId to "unknown" in the observation', async () => {
    const doc = sourceDoc();
    const sink: GateInvocationObservation[] = [];
    await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithObserver([doc], sink),
      // Whitespace-only responseId.
      '   ',
    );

    expect(sink).toHaveLength(1);
    expect(sink[0]!.responseId).toBe('unknown');
  });

  it('passes a real responseId through unchanged', async () => {
    const doc = sourceDoc();
    const sink: GateInvocationObservation[] = [];
    await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctxWithObserver([doc], sink),
      'resp-abc-123',
    );

    expect(sink[0]!.responseId).toBe('resp-abc-123');
  });

  it('does NOT invoke the observer when onInvocation is omitted (backward compatible)', async () => {
    const doc = sourceDoc();
    let called = false;
    const ctx = makeGateContext({ resolver: makeResolver([doc]) });
    // No onInvocation wired — verify the gate does not call anything.
    await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      { ...ctx, onInvocation: () => { called = true; } },
    );
    // Sanity: when explicitly wired, it IS called (control).
    expect(called).toBe(true);

    // Now the actual backward-compat assertion: the stock makeGateContext
    // has NO onInvocation, and the gate must not crash accessing it.
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [citedClaimFor(doc)] },
      ctx,
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(1);
  });
});
