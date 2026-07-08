/**
 * Rate-limit plugin unit tests (NFR-S-3, ADR-0004).
 *
 * Exercises the createRateLimitPlugin factory against an in-memory Fastify
 * instance with the query route registered. Spoofs per-IP identity via
 * `x-forwarded-for` (with `trustProxy`) so the limiter's per-IP keying is
 * observable. Verifies the load-bearing NFR-S-3 behavior: over-limit → 429 +
 * Retry-After + rate_limited envelope; per-IP isolation; window reset.
 *
 * @rules NFR-S-3, ADR-0004
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { createRateLimitPlugin } from './rate-limit.js';
import { createQueryRoutes } from './query.js';
import type { AuditHealthClient, HealthStatus } from '@iip/config';
import type { ResolvedPrincipal } from '@iip/auth';

const HEALTHY: HealthStatus = {
  healthy: true,
  latencyMs: 8,
  lastChecked: '2026-07-07T00:00:00.000Z',
};

/** Minimal healthy audit stub — the rate-limit tests don't exercise the gate. */
function healthyAudit(): AuditHealthClient {
  return {
    async pollAuditHealthForClaim() {
      return HEALTHY;
    },
    getAdvisoryHealth() {
      return HEALTHY;
    },
    getCircuitBreakerState() {
      return 'Closed' as const;
    },
    reset() {
      /* no-op */
    },
  };
}

/**
 * Build an app with rate limiting + query routes. `remoteIp` sets the
 * `x-forwarded-for` header so per-IP keying is deterministic in tests.
 */
async function buildApp(opts: { windowMs: number; max: number; trustProxy?: boolean }) {
  const app = Fastify({ trustProxy: opts.trustProxy ?? true });
  // Stub principal so the route's scope check passes (full auth is covered
  // elsewhere; rate-limit tests focus on the throttle, not the gate).
  app.addHook('onRequest', async (req) => {
    req.principal = {
      sub: 'rate-limit-test',
      iss: 'iip-issuer',
      kid: 'test-key-1',
      scope: ['read'],
      jti: 'rate-limit-jti',
      iat: Math.floor(Date.now() / 1000),
    } as unknown as ResolvedPrincipal;
  });
  await app.register(
    createRateLimitPlugin({ windowMs: opts.windowMs, max: opts.max }),
  );
  await app.register(
    createQueryRoutes({
      auditHealth: healthyAudit(),
      serveClaims: async () => ({ answer: 'served', citations: [] }),
    }),
  );
  return app;
}

/** Inject a request from a given spoofed IP. */
function fromIp(app: Awaited<ReturnType<typeof buildApp>>, ip: string) {
  return app.inject({
    method: 'POST',
    url: '/query',
    headers: { 'x-forwarded-for': ip },
    payload: { query: 'q' },
  });
}

describe('[P0] NFR-S-3 — per-IP rate limiting on /query', () => {
  it('serves requests up to the limit, then returns 429', async () => {
    const app = await buildApp({ windowMs: 60_000, max: 3 });

    // 3 requests from the same IP: all succeed.
    for (let i = 0; i < 3; i++) {
      const res = await fromIp(app, '1.2.3.4');
      expect(res.statusCode).toBe(200);
    }

    // 4th request from the SAME IP: throttled.
    const res = await fromIp(app, '1.2.3.4');
    expect(res.statusCode).toBe(429);
    // Retry-After header present (seconds).
    expect(res.headers['retry-after']).toBeDefined();
    // Body uses the project envelope with the sanctioned error code.
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('rate_limited');
    await app.close();
  });

  it('isolates per-IP — a second IP is not throttled when the first is', async () => {
    const app = await buildApp({ windowMs: 60_000, max: 2 });

    // Exhaust IP A's budget.
    await fromIp(app, '10.0.0.1');
    await fromIp(app, '10.0.0.1');
    const aThird = await fromIp(app, '10.0.0.1');
    expect(aThird.statusCode).toBe(429);

    // IP B still has its full budget.
    const bFirst = await fromIp(app, '10.0.0.2');
    expect(bFirst.statusCode).toBe(200);
    const bSecond = await fromIp(app, '10.0.0.2');
    expect(bSecond.statusCode).toBe(200);
    await app.close();
  });

  it('429 response carries the Retry-After header as a positive integer', async () => {
    const app = await buildApp({ windowMs: 60_000, max: 1 });
    await fromIp(app, '7.7.7.7');
    const res = await fromIp(app, '7.7.7.7');

    expect(res.statusCode).toBe(429);
    const retryAfter = res.headers['retry-after'];
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
    await app.close();
  });

  it('window reset — after the window elapses, requests succeed again', async () => {
    // Tiny window so the test resets quickly.
    const app = await buildApp({ windowMs: 150, max: 1 });

    const first = await fromIp(app, '9.9.9.9');
    expect(first.statusCode).toBe(200);

    const throttled = await fromIp(app, '9.9.9.9');
    expect(throttled.statusCode).toBe(429);

    // Wait for the window to roll over.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const after = await fromIp(app, '9.9.9.9');
    expect(after.statusCode).toBe(200);
    await app.close();
  });

  it('exposes x-ratelimit-* headers on successful responses', async () => {
    const app = await buildApp({ windowMs: 60_000, max: 5 });
    const res = await fromIp(app, '8.8.8.8');
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    await app.close();
  });
});
