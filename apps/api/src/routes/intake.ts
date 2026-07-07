/**
 * Intake API routes (SEC-2, DoD-8).
 *
 *   POST /intake/:documentId/review      { signature, partnerSignature? }  scope: intake:review
 *   POST /intake/:documentId/approve     { signature, partnerSignature? }  scope: intake:approve
 *   POST /intake/:documentId/reject      { reason }                        scope: intake:review
 *   POST /intake/:documentId/revise      { reason }                        scope: intake:review
 *   GET  /intake/:documentId/attestation                                   (signed attestation, AC-9)
 *
 * Principal identity is read ONLY from `request.principal` (Story 2.2
 * middleware, SEC-1) — never `request.auth`. Every state transition runs the
 * gate inside `withTx` so the transition + signature persistence is atomic
 * (DoD-8). On approval-window expiry the route reverts the document to
 * `staging` (AC-8).
 *
 * API envelope: success = resource; error = `{ error: { code, message } }`.
 *
 * @rules SEC-2, SEC-1, AC-8, DoD-8
 * @adr ADR-0001
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { Scope } from '@iip/contracts';
import type { IntakeErrorCode } from '@iip/intake';
import { IntakeError } from '@iip/intake';
import type {
  IntakeDocument,
  IntakeGate,
  ReasonInput,
  ReviewInput,
  SignedAttestation,
} from '@iip/intake';
import type { ResolvedPrincipal } from '@iip/auth';

/** Minimal principal shape the routes consume (SEC-1). */
export interface RoutePrincipal {
  readonly sub: string;
  readonly kid: string;
  readonly scope: readonly Scope[];
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers (unit-testable without a DB / Fastify)
// ─────────────────────────────────────────────────────────────────────────

/** Intake review/approve request body. */
export interface SignatureBody {
  readonly signature: string;
  readonly partnerSignature?: { readonly kid: string; readonly signature: string };
}

/** Intake reject/revise request body. */
export interface ReasonBody {
  readonly reason: string;
}

/**
 * Build a ReviewInput from the resolved principal + request body.
 *
 * @rules SEC-2, DoD-8
 */
export function buildReviewInput(
  principal: RoutePrincipal,
  body: SignatureBody,
): ReviewInput {
  return {
    principalSub: principal.sub,
    principalKid: principal.kid,
    signature: body.signature,
    ...(body.partnerSignature !== undefined
      ? { partnerSignature: { kid: body.partnerSignature.kid, signature: body.partnerSignature.signature } }
      : {}),
  };
}

/**
 * Build a ReasonInput from the resolved principal + request body.
 *
 * @rules SEC-2, DoD-8
 */
export function buildReasonInput(
  principal: RoutePrincipal,
  body: ReasonBody,
): ReasonInput {
  return {
    principalSub: principal.sub,
    principalKid: principal.kid,
    reason: body.reason,
  };
}

/**
 * Fail-closed scope check: throw if the principal lacks `required`.
 *
 * @rules SEC-1, SEC-2, DoD-8
 */
export function requireIntakeScope(
  principal: RoutePrincipal,
  required: Scope,
): void {
  if (!principal.scope.includes(required)) {
    throw new IntakeError(
      `insufficient scope: required ${required}`,
      'intake.insufficient_scope',
    );
  }
}

/** Map an IntakeError code to an HTTP status + envelope code. */
export function errorResponse(err: IntakeError): {
  status: number;
  body: { error: { code: string; message: string } };
} {
  const map: Record<IntakeErrorCode, number> = {
    'intake.invalid_signature': 403,
    'intake.key_revoked': 403,
    'intake.same_principal': 403,
    'intake.invalid_transition': 409,
    'intake.signature_failed': 403,
    'intake.tier5_partner_required': 403,
    'intake.approval_window_expired': 409,
    'intake.inter_signature_delay': 409,
    'intake.replay': 409,
    'intake.bypass_attempt': 403,
    'intake.unknown_kid': 403,
    'intake.insufficient_scope': 403,
  };
  // Compile-time exhaustiveness guard: if a new IntakeErrorCode is added
  // without an HTTP mapping, this assignment fails to type-check.
  const _exhaustive: Record<IntakeErrorCode, number> = map;
  return {
    status: map[err.code] ?? 500,
    body: { error: { code: err.code, message: err.message } },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Route plugin
// ─────────────────────────────────────────────────────────────────────────

/** Injected dependencies (kept injectable so the plugin is testable). */
export interface IntakeRouteDeps {
  readonly gate: IntakeGate;
  readonly withTx: <T>(fn: (txDeps: { loadDoc: (documentId: string) => Promise<IntakeDocument | undefined>; saveDoc: (doc: IntakeDocument) => Promise<void> }) => Promise<T>) => Promise<T>;
}

function principalOf(req: { principal?: ResolvedPrincipal }): RoutePrincipal {
  const p = req.principal;
  if (p === undefined) {
    throw new IntakeError('missing authenticated principal', 'intake.invalid_signature');
  }
  return { sub: p.sub, kid: p.kid, scope: p.scope };
}

/**
 * Create the intake Fastify route plugin. Requires the Story 2.2
 * `verifyMiddleware` to be registered upstream so `request.principal` is set.
 *
 * @rules SEC-2, DoD-8
 * @adr ADR-0001
 */
export function createIntakeRoutes(deps: IntakeRouteDeps): FastifyPluginAsync {
  return async function intakeRoutes(app: FastifyInstance): Promise<void> {
    // POST /intake/:documentId/review
    app.post('/intake/:documentId/review', async (request, reply) => {
      const principal = principalOf(request);
      const documentId = (request.params as { documentId: string }).documentId;
      const body = request.body as SignatureBody;

      try {
        requireIntakeScope(principal, 'intake:review' as Scope);
        const result = await deps.withTx(async (txDeps) => {
          const doc = await mustLoad(txDeps, documentId);
          const input = buildReviewInput(principal, body);
          const updated = await deps.gate.review(doc, input);
          await txDeps.saveDoc(updated);
          return updated;
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // POST /intake/:documentId/approve
    app.post('/intake/:documentId/approve', async (request, reply) => {
      const principal = principalOf(request);
      const documentId = (request.params as { documentId: string }).documentId;
      const body = request.body as SignatureBody;

      try {
        requireIntakeScope(principal, 'intake:approve' as Scope);
        const result = await deps.withTx(async (txDeps) => {
          const doc = await mustLoad(txDeps, documentId);
          const input = buildReviewInput(principal, body);
          try {
            const updated = await deps.gate.approve(doc, input);
            await txDeps.saveDoc(updated);
            return updated;
          } catch (err) {
            // AC-8: approval-window expiry reverts the document to staging.
            if (err instanceof IntakeError && err.code === 'intake.approval_window_expired') {
              const reverted: IntakeDocument = { ...doc, status: 'staging' as IntakeDocument['status'] } as IntakeDocument;
              await txDeps.saveDoc(reverted);
            }
            throw err;
          }
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // POST /intake/:documentId/reject
    app.post('/intake/:documentId/reject', async (request, reply) => {
      const principal = principalOf(request);
      const documentId = (request.params as { documentId: string }).documentId;
      const body = request.body as ReasonBody;

      try {
        requireIntakeScope(principal, 'intake:review' as Scope);
        const result = await deps.withTx(async (txDeps) => {
          const doc = await mustLoad(txDeps, documentId);
          const input = buildReasonInput(principal, body);
          const updated = await deps.gate.reject(doc, input);
          await txDeps.saveDoc(updated);
          return updated;
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // POST /intake/:documentId/revise
    app.post('/intake/:documentId/revise', async (request, reply) => {
      const principal = principalOf(request);
      const documentId = (request.params as { documentId: string }).documentId;
      const body = request.body as ReasonBody;

      try {
        requireIntakeScope(principal, 'intake:review' as Scope);
        const result = await deps.withTx(async (txDeps) => {
          const doc = await mustLoad(txDeps, documentId);
          const input = buildReasonInput(principal, body);
          const updated = await deps.gate.revise(doc, input);
          await txDeps.saveDoc(updated);
          return updated;
        });
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    });

    // GET /intake/:documentId/attestation (AC-9)
    app.get('/intake/:documentId/attestation', async (request, reply) => {
      principalOf(request); // authenticated principal required
      const documentId = (request.params as { documentId: string }).documentId;
      try {
        const doc = await deps.withTx(async (txDeps) => mustLoad(txDeps, documentId));
        const attestation: SignedAttestation = await deps.gate.issueAttestation(doc);
        return reply.send(attestation);
      } catch (err) {
        return sendError(reply, err);
      }
    });
  };
}

/** Load a document or 404. */
async function mustLoad(
  txDeps: { loadDoc: (documentId: string) => Promise<IntakeDocument | undefined> },
  documentId: string,
): Promise<IntakeDocument> {
  const doc = await txDeps.loadDoc(documentId);
  if (doc === undefined) {
    throw new IntakeError(`document not found: ${documentId}`, 'intake.invalid_transition');
  }
  return doc;
}

/** Send a typed error envelope. */
function sendError(
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  err: unknown,
): unknown {
  if (err instanceof IntakeError) {
    const { status, body } = errorResponse(err);
    return reply.code(status).send(body);
  }
  return reply.code(500).send({ error: { code: 'internal', message: 'intake route failed' } });
}
