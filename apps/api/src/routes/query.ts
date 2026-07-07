/**
 * Query API route — the claim-serving ingress gated by audit-worker health
 * (Story 2.11, ADR-0029 §5, OQ-29.6).
 *
 *   POST /query  { query: string }  → claim-bearing answer (citations enforced
 *                                     by the render gate in serve-worker) OR
 *                                     503 fail-closed when audit-worker is down.
 *
 * **The single load-bearing requirement of the 6-process blast-radius matrix
 * (ADR-0029 §5):** before serving any claim, the `/query` path performs a
 * FRESH health poll against `audit-worker /healthz` — never an advisory cache.
 * If the fresh poll fails or exceeds the 100ms budget (ADR-0029 §7), `/query`
 * fails-closed: `503 Service Unavailable` with a structured
 * "degraded — audit offline" body. No claim is served while audit-worker is
 * unreachable.
 *
 * Non-claim routes (`/search`, `/healthz`, document listing) are wired in their
 * own plugins and skip this fresh poll — they MAY use the advisory cache
 * (AC #2). This route is the only one that serves claims, so it is the only
 * one that must pay the fresh-poll cost.
 *
 * Principal identity is read ONLY from `request.principal` (Story 2.2
 * middleware, SEC-1) — never `request.auth`. The claim-serving handler is
 * injected (`ClaimServingHandler`) so this route is unit-testable without the
 * Epic 5 RAG pipeline; production wires the serve-worker render path.
 *
 * API envelope: success = resource; error = `{ error: { code, message, details? } }`.
 *
 * @rules ADR-0029 §5/§7, SEC-5, AC-2, AC-11, OQ-29.6
 * @adr ADR-0029, ADR-0001
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { AuditHealthClient, HealthStatus } from '@iip/config';

/** Request body for POST /query. */
export interface QueryBody {
  readonly query: string;
}

/** Structured 503 fail-closed body (AC #1, AC #5). */
export interface AuditOfflineBody {
  readonly error: {
    readonly code: 'degraded';
    readonly reason: 'audit_offline';
    readonly message: string;
    readonly poll_latency_ms: number;
  };
}

/**
 * Injected claim-serving handler. In production this is the serve-worker RAG →
 * render-gate pipeline; in tests it is a stub. The handler receives the
 * validated query string and the request principal identity and returns the
 * serve-eligible answer (already gated by the render gate downstream).
 */
export type ClaimServingHandler = (input: {
  readonly query: string;
  readonly principalSub: string | undefined;
}) => Promise<unknown>;

/** Dependencies injected into the query route plugin. */
export interface QueryRouteDeps {
  /** Audit-health client (the circuit-breaker, from @iip/config). */
  readonly auditHealth: AuditHealthClient;
  /** Claim-serving handler (serve-worker RAG pipeline in production). */
  readonly serveClaims: ClaimServingHandler;
}

/** Read the principal sub from the verified request (SEC-1). */
function principalSubOf(request: FastifyRequest): string | undefined {
  const principal = (request as unknown as { principal?: { sub?: string } }).principal;
  return principal?.sub;
}

/** Structured 503 fail-closed response (AC #1). */
function sendAuditOffline(reply: FastifyReply, status: HealthStatus): FastifyReply {
  const body: AuditOfflineBody = {
    error: {
      code: 'degraded',
      reason: 'audit_offline',
      message:
        'IIP cannot reach its audit services right now. No claims are being served — this is a safety measure, not an error.',
      poll_latency_ms: status.latencyMs,
    },
  };
  return reply.code(503).send(body);
}

/**
 * Create the query Fastify route plugin. Requires the Story 2.2
 * `verifyMiddleware` to be registered upstream so `request.principal` is set.
 *
 * The fresh audit-health poll runs as the FIRST thing inside the handler (the
 * load-bearing fail-closed gate, ADR-0029 §5). Only if the poll is healthy
 * does the handler delegate to `serveClaims`.
 */
export function createQueryRoutes(deps: QueryRouteDeps): FastifyPluginAsync {
  return async function queryRoutes(app: FastifyInstance): Promise<void> {
    app.post('/query', async (request, reply) => {
      // ── ADR-0029 §5: the fresh health poll is per claim-serving /query. ──
      // Validate the body FIRST so invalid (non-claim-serving) requests fail
      // fast without burning the audit-worker poll budget (AC #1). The render
      // gate still provides defense-in-depth if a request somehow reaches it.
      const body = (request.body ?? {}) as Partial<QueryBody>;
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length === 0) {
        return reply.code(400).send({
          error: { code: 'bad_request', message: 'query must be a non-empty string' },
        });
      }

      // Fresh health poll: only claim-serving requests pay this cost. The
      // advisory cache is intentionally NOT consulted here — only a fresh poll
      // may authorize claim serving. A slow/failed poll fails-closed.
      const health = await deps.auditHealth.pollAuditHealthForClaim();
      if (!health.healthy) {
        return sendAuditOffline(reply, health);
      }

      try {
        const answer = await deps.serveClaims({
          query,
          principalSub: principalSubOf(request),
        });
        return reply.send(answer);
      } catch {
        // The render gate inside serveClaims withholds claims rather than
        // throwing; reaching here is an operational failure, fail-closed.
        return reply.code(503).send({
          error: {
            code: 'internal',
            message: 'claim-serving pipeline unavailable',
          },
        });
      }
    });
  };
}
