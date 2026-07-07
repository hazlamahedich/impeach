/**
 * Integration tests — Story 2.11 + SEC-1 scope enforcement on POST /query.
 *
 * Exercises the FULL HTTP path with the real `verifyMiddleware` (Story 2.2)
 * attached: JWT in `Authorization` header → principal resolved → route handler
 * enforces `read` scope → audit-health poll → claim-serving. The existing
 * `apps/api/src/routes/query.test.ts` is unit-level and BYPASSES auth entirely
 * (no middleware registered); this test closes that HTTP-level gap.
 *
 * No real DB or serve-worker pipeline is required: the `serveClaims` handler
 * and `auditHealth` client are injected stubs (the established pattern from
 * `audit-health-gate.integration.test.ts`). Real Ed25519 keys are minted via
 * `jose` so the middleware's signature + claim verification runs in full.
 *
 * @rules ADR-0029 §5/§7, SEC-1, SEC-5, AC-2, AC-11, OQ-29.6
 * @adr ADR-0001, ADR-0029
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, createVerifyMiddleware, InMemoryReplayDetector, NoopAuthEventLogger } from '@iip/auth';
import type { KeyRegistry, ResolvedPrincipal, RevocationChecker } from '@iip/auth';
import { createQueryRoutes } from '@iip/api/routes/query';
import { createAuditHealthClient } from '@iip/config';
import type { AuditHealthClient } from '@iip/config';

// ─────────────────────────────────────────────────────────────────────────
// Test fixtures (mirror jwt-auth.integration.test.ts)
// ─────────────────────────────────────────────────────────────────────────

interface TestKey {
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

let testKey: TestKey;

beforeAll(async () => {
  const pair = await generateKeyPair('Ed25519', { extractable: true });
  testKey = { kid: 'test-key-1', privateKey: pair.privateKey, publicKey: pair.publicKey };
});

function makeKeyRegistry(keys: TestKey[]): KeyRegistry {
  const map = new Map<string, CryptoKey>();
  for (const k of keys) {
    map.set(k.kid, k.publicKey);
  }
  return {
    get(kid: string) {
      const publicKey = map.get(kid);
      return publicKey === undefined ? undefined : { kid, publicKey };
    },
  };
}

const noopRevocationChecker: RevocationChecker = { isRevoked: () => false };

function makeVerifyJwt(): (token: string) => Promise<ResolvedPrincipal> {
  return createVerifyJwt({
    keyRegistry: makeKeyRegistry([testKey]),
    replayDetector: new InMemoryReplayDetector(),
    eventLogger: NoopAuthEventLogger,
    revocationChecker: noopRevocationChecker,
  });
}

async function signTestToken(opts: { scope?: string[]; expOffsetSec?: number }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const iat = now;
  const exp = iat + (opts.expOffsetSec ?? 3600);
  return new SignJWT({
    sub: 'operator-001',
    iss: 'iip-issuer',
    scope: opts.scope ?? ['read'],
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: testKey.kid })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setJti(crypto.randomUUID())
    .sign(testKey.privateKey);
}

/** Controllable fetch simulating audit-worker /healthz. */
function makeAuditFetch(opts: { getOk: () => boolean }): typeof fetch {
  return (async (_url: unknown, _init?: RequestInit) => {
    const ok = opts.getOk();
    return { ok, status: ok ? 200 : 503, statusText: ok ? 'OK' : 'Service Unavailable' } as Response;
  }) as typeof fetch;
}

interface Harness {
  client: AuditHealthClient;
  setAuditOk: (ok: boolean) => void;
  servedClaims: unknown[];
}

function buildHarness(): Harness {
  let auditOk = true;
  const servedClaims: unknown[] = [];
  const client = createAuditHealthClient({
    baseUrl: 'http://audit-worker.test:3001',
    pollTimeoutMs: 200,
    backoffMs: [10, 20, 40],
    fetchImpl: makeAuditFetch({ getOk: () => auditOk }),
  });
  return {
    client,
    setAuditOk: (ok: boolean) => {
      auditOk = ok;
    },
    servedClaims,
  };
}

async function buildApp(h: Harness): Promise<FastifyInstance> {
  const app = Fastify();
  // Call the middleware plugin function DIRECTLY on `app` (not via app.register)
  // so the onRequest hook is added at the root instance level and applies to
  // routes registered in child plugin contexts. This matches the established
  // pattern in packages/auth/src/middleware.test.ts. (createVerifyMiddleware is
  // not wrapped with fastify-plugin, so app.register() would encapsulate the
  // hook in a sibling context that does not reach createQueryRoutes.)
  await createVerifyMiddleware({ verifyJwt: makeVerifyJwt() })(app);
  await app.register(
    createQueryRoutes({
      auditHealth: h.client,
      serveClaims: async ({ query }) => {
        const answer = { query, claims_served: 1, no_evidence: false };
        h.servedClaims.push(answer);
        return answer;
      },
    }),
  );
  return app;
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('POST /query — HTTP-level integration with auth + scope enforcement (SEC-1, ADR-0029 §5)', () => {
  it('TC-1: valid JWT with read scope → 200 and serves claims', async () => {
    const h = buildHarness();
    const app = await buildApp(h);
    try {
      const token = await signTestToken({ scope: ['read'] });
      const res = await app.inject({
        method: 'POST',
        url: '/query',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'What happened?' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { claims_served: number };
      expect(body.claims_served).toBe(1);
      expect(h.servedClaims).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it('TC-2: missing Authorization header → 401', async () => {
    const h = buildHarness();
    const app = await buildApp(h);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/query',
        payload: { query: 'What happened?' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('unauthorized');
      expect(h.servedClaims).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('TC-3: malformed/expired token → 401 (middleware rejects before route handler)', async () => {
    const h = buildHarness();
    const app = await buildApp(h);
    try {
      // Expired token (exp offset -60s exceeds the 30s clock-skew tolerance)
      const token = await signTestToken({ scope: ['read'], expOffsetSec: -60 });
      const res = await app.inject({
        method: 'POST',
        url: '/query',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'What happened?' },
      });
      expect(res.statusCode).toBe(401);
      expect(h.servedClaims).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('TC-4: valid JWT WITHOUT read scope → 403 auth.insufficient_scope (scope-denied)', async () => {
    const h = buildHarness();
    const app = await buildApp(h);
    try {
      // Valid token but the principal's scope lacks `read`
      const token = await signTestToken({ scope: ['intake:review'] });
      const res = await app.inject({
        method: 'POST',
        url: '/query',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'What happened?' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('auth.insufficient_scope');
      // SEC-1: an unauthorized caller must NOT spend the audit-poll budget
      expect(h.servedClaims).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('TC-5: audit-worker degraded → 503 fail-closed (ADR-0029 §5)', async () => {
    const h = buildHarness();
    const app = await buildApp(h);
    try {
      h.setAuditOk(false);
      const token = await signTestToken({ scope: ['read'] });
      const res = await app.inject({
        method: 'POST',
        url: '/query',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'What happened?' },
      });
      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body) as { error: { code: string; reason: string } };
      expect(body.error.code).toBe('degraded');
      expect(body.error.reason).toBe('audit_offline');
      expect(h.servedClaims).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
