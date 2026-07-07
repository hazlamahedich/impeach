/**
 * Story 2.11 — Audit-Health Gate integration test (ADR-0029 §5, AC #1, #3, #6, #7).
 *
 * Exercises the REAL fail-closed mechanism end-to-end with the actual
 * production components wired together:
 *
 *   - `createAuditHealthClient` (@iip/config) — the circuit-breaker, against an
 *     injected fetch that simulates audit-worker death/recovery.
 *   - `createQueryRoutes` (@iip/api) — the Fastify /query plugin that gates on
 *     the fresh poll.
 *   - `renderGateLive` (@iip/render) — the render gate with an `AuditHealthProbe`
 *     adapter reading the same circuit-breaker (single source of truth).
 *   - A transition observer capturing `audit.circuit_breaker.opened` /
 *     `closed` events for the editorial log (AC-11).
 *
 * Why not `docker compose stop audit-worker`? The `api` process is still the
 * Story 1.1 stub (`console.log('alive: api')`) and `audit-worker` is likewise a
 * stub — a Compose-level test would exercise only stubs and prove nothing about
 * the mechanism. This integration test exercises the real mechanism components
 * against an injected healthcheck, which is the contract ADR-0029 §5 actually
 * requires. The Docker-Compose-level chaos verification is Story 2.9b's scope
 * (which depends on a real serving pipeline + golden corpus).
 *
 * @rules ADR-0029 §5/§7, SEC-5, AC-2, AC-11
 * @adr ADR-0029
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createAuditHealthClient } from '@iip/config';
import type { AuditHealthClient, HealthStatus, CircuitState } from '@iip/config';
import { createQueryRoutes } from '@iip/api/routes/query';
import { renderGateLive } from '@iip/render';
import type { SourceDocSnapshot, AuditHealthProbe } from '@iip/contracts';
import {
  liveSourceDoc,
  liveResolver,
  liveGateContext,
  liveCitedClaim,
} from '../support/fixtures';

/**
 * Adapter that exposes the circuit-breaker as an AuditHealthProbe for the
 * render gate (single source of truth — the gate does NOT independently poll).
 */
function probeFromClient(client: AuditHealthClient): AuditHealthProbe {
  return {
    isAuditReachable: () => client.getCircuitBreakerState() === 'Closed',
  };
}

/** Controllable fetch simulating audit-worker /healthz. */
function makeAuditFetch(opts: { getOk: () => boolean; latencyMs?: number }): typeof fetch {
  return (async (_url: unknown, _init?: RequestInit) => {
    if (opts.latencyMs) await new Promise<void>((r) => setTimeout(r, opts.latencyMs));
    const ok = opts.getOk();
    return {
      ok,
      status: ok ? 200 : 503,
      statusText: ok ? 'OK' : 'Service Unavailable',
    } as Response;
  }) as typeof fetch;
}

interface Harness {
  client: AuditHealthClient;
  setAuditOk: (ok: boolean) => void;
  transitions: Array<{ state: CircuitState; status: HealthStatus }>;
  servedClaims: unknown[];
  probe: AuditHealthProbe;
}

function buildHarness(): Harness {
  let auditOk = true;
  const transitions: Array<{ state: CircuitState; status: HealthStatus }> = [];
  const servedClaims: unknown[] = [];
  const client = createAuditHealthClient({
    baseUrl: 'http://audit-worker.test:3001',
    pollTimeoutMs: 200,
    backoffMs: [10, 20, 40], // short for test speed
    fetchImpl: makeAuditFetch({ getOk: () => auditOk }),
    onTransition: (state, status) => transitions.push({ state, status }),
  });
  return {
    client,
    setAuditOk: (ok: boolean) => {
      auditOk = ok;
    },
    transitions,
    servedClaims,
    probe: probeFromClient(client),
  };
}

/** Register the query route with a claim-serving handler that runs the render gate. */
async function buildApp(h: Harness, doc: SourceDocSnapshot) {
  const app = Fastify();
  await app.register(
    createQueryRoutes({
      auditHealth: h.client,
      // The serve-worker RAG pipeline is a stub (Epic 5); we run the render
      // gate directly so the audit-offline fail-closed is observable in the
      // served payload too. The gate reads the same circuit-breaker via the probe.
      serveClaims: async ({ query }) => {
        const out = await renderGateLive(
          { query, answer_text: doc.text, spans: [liveCitedClaim(doc)] },
          liveGateContext({ resolver: liveResolver([doc]), auditHealth: h.probe }),
        );
        const served = out.spans.filter((s) => s.is_claim).length;
        h.servedClaims.push(served);
        return {
          no_evidence: out.no_evidence,
          claims_served: served,
          violations: out.violations.map((v) => v.kind),
        };
      },
    }),
  );
  return app;
}

describe('Story 2.11 — Audit-death fail-closed integration (ADR-0029 §5)', () => {
  let doc: SourceDocSnapshot;

  beforeEach(() => {
    doc = liveSourceDoc({ text: 'The Senate acquitted the official on 2024-01-15.' });
  });

  it('AC #1/#7: audit-worker healthy → /query serves a gated claim; fresh poll ran', async () => {
    const h = buildHarness();
    const app = await buildApp(h, doc);

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'What happened?' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.claims_served).toBe(1);
    expect(body.violations).toEqual([]);
    expect(h.servedClaims).toEqual([1]);
    expect(h.client.getCircuitBreakerState()).toBe('Closed');
    // No transition emitted (started + stayed Closed).
    expect(h.transitions).toHaveLength(0);
    await app.close();
  });

  it('AC #1/#7: audit-worker down → /query returns 503 fail-closed, NO claim served', async () => {
    const h = buildHarness();
    h.setAuditOk(false); // audit-worker dies
    const app = await buildApp(h, doc);

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'What happened?' },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('degraded');
    expect(body.error.reason).toBe('audit_offline');
    // Load-bearing: the claim-serving handler NEVER ran.
    expect(h.servedClaims).toHaveLength(0);
    // The breaker opened.
    expect(h.client.getCircuitBreakerState()).toBe('Open');
    // AC-11: the transition was observed for the editorial log.
    expect(h.transitions).toContainEqual(
      expect.objectContaining({ state: 'Open' }),
    );
    await app.close();
  });

  it('AC #6: a slow audit poll (exceeding budget) fail-closes', async () => {
    let auditOk = true;
    const transitions: Array<{ state: CircuitState }> = [];
    const client = createAuditHealthClient({
      baseUrl: 'http://audit-worker.test:3001',
      pollTimeoutMs: 30, // 30ms budget — a 100ms response exceeds it
      backoffMs: [10],
      fetchImpl: (async (_url: unknown, init?: RequestInit) => {
        // Simulate a real fetch that respects the abort signal: a 100ms
        // response that rejects when aborted at 30ms.
        return new Promise<Response>((_resolve, reject) => {
          const timer = setTimeout(
            () => _resolve({ ok: auditOk, status: 200, statusText: 'OK' } as Response),
            100,
          );
          init?.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new DOMException('aborted', 'AbortError'));
            },
            { once: true },
          );
        });
      }) as typeof fetch,
      onTransition: (state) => transitions.push({ state }),
    });
    const app = await buildApp(
      {
        client,
        setAuditOk: (ok: boolean) => {
          auditOk = ok;
        },
        transitions,
        servedClaims: [],
        probe: probeFromClient(client),
      },
      doc,
    );

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });

    // Slow poll → treated as unhealthy → 503 fail-closed.
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error.reason).toBe('audit_offline');
    expect(client.getCircuitBreakerState()).toBe('Open');
    await app.close();
  });

  it('AC #7: recovery — audit-worker restarts → Half-Open → Closed → /query resumes', async () => {
    const h = buildHarness();
    const app = await buildApp(h, doc);

    // 1. audit-worker down → 503.
    h.setAuditOk(false);
    const r1 = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });
    expect(r1.statusCode).toBe(503);
    expect(h.client.getCircuitBreakerState()).toBe('Open');
    expect(h.servedClaims).toHaveLength(0);

    // 2. audit-worker recovers. Advance past backoff (10ms) then poll.
    h.setAuditOk(true);
    await new Promise<void>((r) => setTimeout(r, 15));
    const r2 = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });

    // Half-Open probe succeeded → Closed → claim served.
    expect(r2.statusCode).toBe(200);
    expect(JSON.parse(r2.body).claims_served).toBe(1);
    expect(h.client.getCircuitBreakerState()).toBe('Closed');
    // AC-11: both opened and closed transitions observed.
    const states = h.transitions.map((t) => t.state);
    expect(states).toContain('Open');
    expect(states).toContain('Closed');
    await app.close();
  });

  it('AC #2: the advisory cache is NOT used to authorize claim serving (stale healthy cache → still fail-closed)', async () => {
    const h = buildHarness();
    const app = await buildApp(h, doc);

    // 1. Establish a healthy advisory cache via a successful poll.
    h.setAuditOk(true);
    const okRes = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });
    expect(okRes.statusCode).toBe(200);
    const cached = h.client.getAdvisoryHealth();
    expect(cached?.healthy).toBe(true);

    // 2. audit-worker dies. Even though the advisory cache still says healthy,
    //    the /query path must perform a FRESH poll — and that fresh poll fails.
    h.setAuditOk(false);
    const r = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });

    // The stale healthy cache MUST NOT authorize serving — fresh poll wins.
    expect(r.statusCode).toBe(503);
    expect(JSON.parse(r.body).error.reason).toBe('audit_offline');
    expect(h.servedClaims).toEqual([1]); // only the first (healthy) request served
    await app.close();
  });

  it('AC #4: the render gate independently WITHHOLDs claims when the probe reports Open (defense-in-depth)', async () => {
    const h = buildHarness();
    // Open the breaker directly via a failing poll.
    h.setAuditOk(false);
    await h.client.pollAuditHealthForClaim();
    expect(h.client.getCircuitBreakerState()).toBe('Open');

    // Even if some caller bypassed the /query route and invoked the render
    // gate directly, the gate reads the same probe and WITHHOLDs.
    const out = await renderGateLive(
      { query: 'q', answer_text: doc.text, spans: [liveCitedClaim(doc)] },
      liveGateContext({ resolver: liveResolver([doc]), auditHealth: h.probe }),
    );
    expect(out.spans.filter((s) => s.is_claim)).toHaveLength(0);
    expect(out.violations).toContainEqual(expect.objectContaining({ kind: 'audit_offline' }));
  });

  it('AC #3: every /query request performs its own fresh poll (no cached authorization)', async () => {
    const h = buildHarness();
    const app = await buildApp(h, doc);

    // First poll happens inside the first request.
    await app.inject({ method: 'POST', url: '/query', payload: { query: 'q1' } });
    // The integration test cannot read pollCount from the public client API,
    // but we can assert the contract indirectly: flip audit to unhealthy AFTER
    // the cache is populated and confirm the next request fails immediately.
    h.setAuditOk(false);
    const r = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q2' },
    });
    expect(r.statusCode).toBe(503); // fresh poll caught the new state
    await app.close();
  });
});
