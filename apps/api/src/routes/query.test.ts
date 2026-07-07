/**
 * Story 2.11 — Query route fail-closed unit tests (ADR-0029 §5, AC #1).
 *
 * Exercises the fresh-poll gate without a real Fastify server: the route
 * plugin is registered against an in-memory Fastify instance with an injected
 * audit-health stub + claim-serving stub. Verifies the load-bearing behavior:
 * audit-worker down → 503 fail-closed, no claim served; audit-worker up →
 * claim served; budget exceed → fail-closed.
 *
 * @rules ADR-0029 §5/§7, SEC-5, AC-2, AC-11
 * @adr ADR-0029
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { createQueryRoutes } from './query.js';
import type { AuditHealthClient, HealthStatus } from '@iip/config';

/** Build a controllable audit-health stub. */
function fakeAuditHealth(initial: HealthStatus): AuditHealthClient & {
  setStatus(s: HealthStatus): void;
  pollCount(): number;
} {
  let status = initial;
  let polls = 0;
  return {
    async pollAuditHealthForClaim(): Promise<HealthStatus> {
      polls += 1;
      return status;
    },
    getAdvisoryHealth(): HealthStatus | null {
      return status;
    },
    getCircuitBreakerState(): 'Closed' | 'Open' | 'HalfOpen' {
      return status.healthy ? 'Closed' : 'Open';
    },
    reset(): void {
      status = { healthy: true, latencyMs: 5, lastChecked: '2026-07-07T00:00:00.000Z' };
    },
    setStatus(s: HealthStatus): void {
      status = s;
    },
    pollCount(): number {
      return polls;
    },
  };
}

const HEALTHY: HealthStatus = {
  healthy: true,
  latencyMs: 8,
  lastChecked: '2026-07-07T00:00:00.000Z',
};
const UNHEALTHY: HealthStatus = {
  healthy: false,
  latencyMs: 50,
  lastChecked: '2026-07-07T00:00:00.000Z',
  error: 'audit-worker /healthz returned 503 Service Unavailable',
};

async function buildApp(
  auditHealth: AuditHealthClient,
  serveClaims: (input: { query: string; principalSub: string | undefined }) => Promise<unknown>,
) {
  const app = Fastify();
  await app.register(createQueryRoutes({ auditHealth, serveClaims }));
  return app;
}

describe('Story 2.11 — POST /query audit-health fail-closed (ADR-0029 §5)', () => {
  let served: unknown[];

  beforeEach(() => {
    served = [];
  });

  it('AC #1: audit-worker healthy → claim served; fresh poll ran once', async () => {
    const audit = fakeAuditHealth(HEALTHY);
    const app = await buildApp(audit, async (input) => {
      served.push(input);
      return { answer: 'served', citations: [] };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'What happened?' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ answer: 'served', citations: [] });
    expect(served).toHaveLength(1);
    // AC #1: a FRESH poll ran for this claim-serving request.
    expect(audit.pollCount()).toBe(1);
    await app.close();
  });

  it('AC #1: audit-worker unhealthy → 503 fail-closed, NO claim served', async () => {
    const audit = fakeAuditHealth(UNHEALTHY);
    const app = await buildApp(audit, async (input) => {
      served.push(input);
      return { answer: 'should-not-reach' };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'What happened?' },
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('degraded');
    expect(body.error.reason).toBe('audit_offline');
    expect(body.error.message).toMatch(/audit services/);
    expect(body.error.poll_latency_ms).toBe(50);
    // Load-bearing: the claim-serving handler NEVER ran.
    expect(served).toHaveLength(0);
    await app.close();
  });

  it('AC #1: empty query → 400 WITHOUT burning the audit-health poll budget', async () => {
    const audit = fakeAuditHealth(HEALTHY);
    const app = await buildApp(audit, async () => ({ answer: 'x' }));

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: '   ' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('bad_request');
    // Invalid requests are not claim-serving, so no fresh poll should run.
    expect(audit.pollCount()).toBe(0);
    await app.close();
  });

  it('AC #1: claim-serving handler throws → 503 fail-closed (operational failure)', async () => {
    const audit = fakeAuditHealth(HEALTHY);
    const app = await buildApp(audit, async () => {
      throw new Error('render pipeline exploded');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error.code).toBe('internal');
    // Valid request → fresh poll ran.
    expect(audit.pollCount()).toBe(1);
    await app.close();
  });

  it('AC #1: recovery — unhealthy then healthy resumes claim serving', async () => {
    const audit = fakeAuditHealth(UNHEALTHY);
    const app = await buildApp(audit, async () => {
      served.push(true);
      return { answer: 'served' };
    });

    // First request: audit down → 503. Valid request → poll ran.
    const r1 = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });
    expect(r1.statusCode).toBe(503);
    expect(served).toHaveLength(0);
    expect(audit.pollCount()).toBe(1);

    // Audit recovers.
    audit.setStatus(HEALTHY);

    // Second request: audit up → claim served.
    const r2 = await app.inject({
      method: 'POST',
      url: '/query',
      payload: { query: 'q' },
    });
    expect(r2.statusCode).toBe(200);
    expect(served).toHaveLength(1);
    expect(audit.pollCount()).toBe(2);
    await app.close();
  });

  it('AC #1: every /query request performs its own fresh poll (no cached authorization)', async () => {
    const audit = fakeAuditHealth(HEALTHY);
    const app = await buildApp(audit, async () => ({ ok: true }));

    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/query',
        payload: { query: `q${i}` },
      });
    }
    // 5 requests → 5 fresh polls. The advisory cache MUST NOT authorize claims.
    expect(audit.pollCount()).toBe(5);
    await app.close();
  });
});
