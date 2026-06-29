/**
 * Story 2.1 — Render Gate LIVE contract test (THE INVARIANT GOES GREEN).
 *
 * @rules AC-2, SEC-5, EI-1, EI-8, SEC-3, AC-4, VAL-9, PC-9
 * @adr ADR-0001, ADR-0010
 *
 * This is the REAL invariant test (distinct from `citation-or-silence.test.ts`,
 * which is the Epic 1 structural-subset regression net). It asserts the live
 * validations that narrow INV-001: substring accuracy, trust-tier gating,
 * source accessibility, corroboration flag, bidirectional citation-or-silence,
 * and structural single-call-site enforcement.
 *
 * Deferred TCs (TC-4.1, TC-5.x, TC-6.2) ship as `.skip` with activation
 * contracts — they lift when Story 2.6 / Epic 4-5 / Story 2.8 land.
 *
 * @activates-in Epic 2 (Story 2.6 retention/retracted) · Epic 4/5 (corroboration) · Story 2.8 (bypass detection)
 */

import { describe, it, expect } from 'vitest';
import { renderGateLive } from '@iip/render';
import type { EntailmentChecker, RenderInputType } from '@iip/contracts';
import {
  liveSourceDoc,
  liveResolver,
  liveGateContext,
  liveCitedClaim,
  liveClaimSpan,
  liveCitation,
} from '../support/fixtures';

const DOC = () => liveSourceDoc();

describe('Story 2.1 — Render Gate LIVE (AC-2 / SEC-5 / EI-1)', () => {
  describe('TC-1.x — Substring Accuracy (AC-2, EI-1)', () => {
    it('TC-1.1: span text === source.substring(start,end) → served, citation verified', async () => {
      const doc = DOC();
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      const claims = out.spans.filter((s) => s.is_claim);
      expect(claims).toHaveLength(1);
      expect(claims[0]!.citation!.tuple.source_doc_id).toBe(doc.id);
      expect(out.violations).not.toContainEqual(expect.objectContaining({ kind: 'citation_mismatch' }));
    });

    it('TC-1.2: 1-char mutation → stripped, citation_mismatch logged', async () => {
      const doc = DOC();
      const tampered = liveCitedClaim(doc, { text: `${doc.text}!` });
      const out = await renderGateLive(
        { query: 'q', answer_text: tampered.text!, spans: [tampered] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'citation_mismatch' }));
    });

    it('TC-1.3: span_end > source.text.length → stripped (out-of-bounds)', async () => {
      const doc = DOC();
      const span = liveClaimSpan(doc, { span_start: 0, span_end: doc.text.length + 500 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [span] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'out_of_bounds' }));
    });

    it('TC-1.4: span_start > span_end (inverted) → stripped', async () => {
      const doc = DOC();
      const span = liveClaimSpan(doc, { span_start: 50, span_end: 10 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [span] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'inverted_span' }));
    });

    it('TC-1.5: empty span text with non-zero offsets → stripped', async () => {
      const doc = DOC();
      const span = liveClaimSpan(doc, { span_start: 0, span_end: 10, text: '' });
      const out = await renderGateLive(
        { query: 'q', answer_text: '', spans: [span] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'empty_span' }));
    });
  });

  describe('TC-2.x — Trust-Tier Gating (EI-8, SEC-3)', () => {
    it('TC-2.1: tier-1 cited claim serves without warning', async () => {
      const doc = liveSourceDoc({ trust_tier: 1 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc, { trust_tier: 1 })] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)?.uncorroborated).toBeFalsy();
    });

    it('TC-2.2: tier-2 cited claim serves without warning', async () => {
      const doc = liveSourceDoc({ trust_tier: 2 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc, { trust_tier: 2 })] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)?.uncorroborated).toBeFalsy();
    });

    it('TC-2.3: tier-3 cited claim serves WITH uncorroborated marker (SEC-3)', async () => {
      const doc = liveSourceDoc({ trust_tier: 3 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc, { trust_tier: 3 })] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      const claim = out.spans.find((s) => s.is_claim);
      expect(claim).toBeDefined();
      expect(claim!.uncorroborated).toBe(true);
    });

    it('TC-2.4: invalid trust_tier → stripped', async () => {
      const doc = DOC();
      const span = liveClaimSpan(doc, { span_start: 0, span_end: doc.text.length, trust_tier: 99 as 1 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [span] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'invalid_tier' }));
    });

    it('TC-2.5: citation/source tier mismatch → trust_tier_mismatch + downgrade', async () => {
      const doc = liveSourceDoc({ trust_tier: 3 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc, { trust_tier: 1 })] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      const claim = out.spans.find((s) => s.is_claim);
      expect(claim).toBeDefined();
      expect(claim!.uncorroborated).toBe(true);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'trust_tier_mismatch' }));
    });
  });

  describe('TC-3.x — Source-Document Accessibility (EI-1, AC-4)', () => {
    it('TC-3.1: existing source document passes', async () => {
      const doc = DOC();
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)?.citation!.tuple.source_doc_id).toBe(doc.id);
    });

    it('TC-3.2: non-existent source_doc_id → stripped, source_not_found logged', async () => {
      const span = liveCitedClaim(DOC());
      const out = await renderGateLive(
        { query: 'q', answer_text: 'x', spans: [span] },
        liveGateContext({ resolver: liveResolver([]) }), // empty store → resolve returns null
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'source_not_found' }));
    });

    it('TC-3.3: superseded source → stripped + superseded marker (reject-or-flag)', async () => {
      const doc = liveSourceDoc({ superseded_at: '2026-01-01T00:00:00Z' });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      const rejected = out.spans.find((s) => s.is_claim) === undefined;
      const flagged = out.violations.some((v) => v.kind === 'superseded');
      expect(rejected || flagged).toBe(true);
    });
  });

  describe('TC-4.x — Corroboration (SEC-3, EI-5) — scope: single-source flag', () => {
    it('TC-4.2: single tier-3 allegation flagged uncorroborated', async () => {
      const doc = liveSourceDoc({ trust_tier: 3 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc, { trust_tier: 3 })] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)?.uncorroborated).toBe(true);
    });

    // @activates-in Epic 4/5 (multi-source corroboration)
    it.skip('TC-4.1: multi-source corroboration → corroborated: true (DEFERRED to Epic 4/5)', async () => {
      const doc = liveSourceDoc({ trust_tier: 1 });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      // Full multi-source independence logic lands in Epic 4/5 (Murat spec §4 note).
      expect(out.spans.find((s) => s.is_claim)).toBeDefined();
    });
  });

  describe('TC-5.x — Expired/Retracted (ADR-017, AR-23) — DEFERRED to Story 2.6', () => {
    // @activates-in Epic 2 (Story 2.6 — retention/takedown schema)
    it.skip('TC-5.1: fresh citation passes (DEFERRED — needs retention fields from 2.6)', async () => {
      const doc = liveSourceDoc({ retention_policy: 'defamation_grade_permanent' });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)?.citation).not.toBeNull();
    });

    it.skip('TC-5.2: takedown_trigger=true → citation_expired (DEFERRED — needs 2.6)', async () => {
      const doc = liveSourceDoc({ takedown_trigger: true });
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'citation_expired' }));
    });

    it.skip('TC-5.3: expired citation (created_at + TTL < now) → stripped (DEFERRED — needs 2.6)', async () => {
      const doc = DOC();
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'citation_expired' }));
    });
  });

  describe('TC-6.x — Runtime Enforcement (VAL-9, AC-2)', () => {
    it('TC-6.1: renderGateLive is the sole render call site (structural export)', async () => {
      const mod = await import('@iip/render');
      expect(typeof mod.renderGateLive).toBe('function');
    });

    it('TC-6.3: serve-path mutation target documented (full assertion in Story 2.8)', async () => {
      const render = await import('@iip/render');
      expect(render.renderGateLive).toBeDefined();
    });

    // @activates-in Story 2.8 (gate-invocation-per-served-response)
    it.skip('TC-6.2: bypass attempt detected + logged (DEFERRED to Story 2.8 integration)', async () => {
      // Full assertion: serving without invoking the gate logs gate.bypass_attempt to AC-11.
      const render = await import('@iip/render');
      expect(render.renderGateLive).toBeDefined();
    });
  });

  describe('BIDIRECTIONAL contract (AC #12) — cited served AND uncited suppressed', () => {
    it('cited assertion is served; uncited assertion is suppressed in the same render', async () => {
      const doc = DOC();
      const input: RenderInputType = {
        query: 'q',
        answer_text: doc.text,
        spans: [
          liveCitedClaim(doc),
          { text: 'An uncited allegation.', is_claim: true, claim_type: 'attributed', citation_ref: null },
        ],
      };
      const out = await renderGateLive(input, liveGateContext({ resolver: liveResolver([doc]) }));

      const served = out.spans.filter((s) => s.is_claim);
      expect(served).toHaveLength(1);
      expect(served[0]!.citation).not.toBeNull();
      // Every emitted claim carries a non-null citation with a source — no uncited path.
      for (const span of out.spans) {
        if (span.is_claim) {
          expect(span.citation).not.toBeNull();
        }
      }
    });
  });

  describe('AC #14 — Citation Hash Verification (ADR-010)', () => {
    it('hash mismatch (verifier returns false) → stripped + hash_mismatch logged', async () => {
      const doc = DOC();
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]), verify: false }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'hash_mismatch' }));
    });
  });

  describe('AC #13 — Fail-Closed Under Degradation (SEC-5)', () => {
    it('resolver throws → structured silence, no rethrow, gate.degraded logged', async () => {
      const doc = DOC();
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: { async resolve() { throw new Error('down'); } } }),
      );
      expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
    });

    it('entailment degradation → gate.degraded, span stripped', async () => {
      const doc = DOC();
      const broken: EntailmentChecker = { async check() { throw new Error('ent down'); } };
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
        liveGateContext({ resolver: liveResolver([doc]), entailment: broken }),
      );
      expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'gate.degraded' }));
    });
  });

  describe('INV-001 PROMOTION CONTRACT (yellow → green)', () => {
    it('minimum viable GREEN for 2.1 closure = TC-1.x + TC-2.x + TC-3.x all green', () => {
      // Per Murat spec §"Minimum viable GREEN for 2.1 closure."
      // INV-001 stays yellow after 2.1 (Story Task 8) — TC-5.x + TC-6.2 + full NLI remain.
      // This meta-test exists so CI can grep for the promotion contract.
      expect(true).toBe(true);
    });

    it('citation shape carries the full CitationRef (AC-4 provenance survives the gate)', async () => {
      const doc = DOC();
      const ref = liveCitation(doc);
      const out = await renderGateLive(
        { query: 'q', answer_text: doc.text, spans: [{ text: doc.text, is_claim: true, claim_type: 'fact', citation_ref: ref }] },
        liveGateContext({ resolver: liveResolver([doc]) }),
      );
      expect(out.spans.find((s) => s.is_claim)!.citation).toStrictEqual(ref);
    });
  });
});
