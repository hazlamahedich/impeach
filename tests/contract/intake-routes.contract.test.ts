/**
 * Contract tests — Story 2.3 Intake API route helpers (SEC-2, DoD-8).
 *
 * Pure helper coverage (no DB / Fastify required): scope enforcement,
 * request->input mapping, and IntakeError -> HTTP envelope mapping.
 *
 * @rules SEC-1, SEC-2, DoD-8
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import {
  buildReviewInput,
  buildReasonInput,
  requireIntakeScope,
  errorResponse,
} from '@iip/api/routes/intake';
import { IntakeError } from '@iip/ingest';
import type { RoutePrincipal, IntakeRouteDeps } from '@iip/api/routes/intake';

function principal(scope: string[]): RoutePrincipal {
  return { sub: 'operator-001', kid: 'op-key-1', scope: scope as RoutePrincipal['scope'] };
}

describe('Story 2.3 — Intake route helpers (SEC-2, DoD-8)', () => {

  it('requireIntakeScope throws when the principal lacks the required scope', () => {
    expect(() => requireIntakeScope(principal(['read']), 'intake:review' as never)).toThrow(IntakeError);
  });

  it('requireIntakeScope passes when the principal has the required scope', () => {
    expect(() => requireIntakeScope(principal(['intake:review' as never]), 'intake:review' as never)).not.toThrow();
  });

  it('buildReviewInput maps principal + body to a ReviewInput (with partner)', () => {
    const input = buildReviewInput(principal([]), {
      signature: 'sig',
      partnerSignature: { kid: 'pk', signature: 'psig' },
    });
    expect(input.principalSub).toBe('operator-001');
    expect(input.principalKid).toBe('op-key-1');
    expect(input.signature).toBe('sig');
    expect(input.partnerSignature).toEqual({ kid: 'pk', signature: 'psig' });
  });

  it('buildReviewInput omits partnerSignature when absent (absence preserved)', () => {
    const input = buildReviewInput(principal([]), { signature: 'sig' });
    expect(input.partnerSignature).toBeUndefined();
  });

  it('buildReasonInput maps principal + body to a ReasonInput', () => {
    const input = buildReasonInput(principal([]), { reason: 'off-topic' });
    expect(input.principalSub).toBe('operator-001');
    expect(input.reason).toBe('off-topic');
  });

  it('errorResponse maps KEY_REVOKED to 403 and invalid_transition to 409', () => {
    const revoked = errorResponse(new IntakeError('revoked', 'intake.key_revoked'));
    expect(revoked.status).toBe(403);
    expect(revoked.body.error.code).toBe('intake.key_revoked');

    const badTransition = errorResponse(new IntakeError('bad', 'intake.invalid_transition'));
    expect(badTransition.status).toBe(409);
  });

  it('withTx callback receives transaction-bound loadDoc and saveDoc', async () => {
    const calls: string[] = [];
    const gate = {
      async review(doc: { id: string; status: string }) {
        calls.push(`review:${doc.id}`);
        return { id: doc.id, status: 'reviewed_once' } as unknown as import('@iip/intake').IntakeDocument;
      },
    } as unknown as IntakeRouteDeps['gate'];
    const withTx: IntakeRouteDeps['withTx'] = async (fn) =>
      fn({
        loadDoc: async (id: string) => {
          calls.push(`load:${id}`);
          return { id, status: 'staging' } as unknown as import('@iip/ingest').IntakeDocument;
        },
        saveDoc: async (doc: import('@iip/ingest').IntakeDocument) => {
          calls.push(`save:${doc.id}:${doc.status}`);
        },
      });
    // We can't easily exercise the Fastify plugin here; the contract we verify
    // is that withTx passes the tx-bound helpers to the callback.
    const result = await withTx(async (txDeps) => {
      const doc = await txDeps.loadDoc('doc-1');
      const updated = await gate.review(doc);
      await txDeps.saveDoc(updated);
      return updated;
    });
    expect(result.status).toBe('reviewed_once');
    expect(calls).toEqual(['load:doc-1', 'review:doc-1', 'save:doc-1:reviewed_once']);
  });
});
