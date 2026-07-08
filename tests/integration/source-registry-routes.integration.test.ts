/**
 * Story 3.1 — Source Registry API routes (ATDD RED phase).
 *
 * Exercises the HTTP path for registering/listing/configuring sources with
 * confirmed trust tiers. The routes DO NOT EXIST YET — this suite is RED by
 * design (describe.skip) until Story 3.1 lands the `createSourceRoutes`
 * handler + registers it in the Fastify bootstrap.
 *
 * Mirrors the established integration-test pattern (Story 2.3): real Ed25519
 * JWTs via `@iip/test-utils`, Fastify `app.inject()`, injected deps (no real
 * DB writer — the repo stub is in-memory). SEC-1 scope enforcement follows the
 * same `req.principal` middleware as the intake routes.
 *
 * @rules FR-1.1, SEC-1, SEC-3, EI-8
 * @adr ADR-001
 *
 * GIVEN the operator accesses the source registry
 * WHEN a new source is registered
 * THEN source_type + crawl_strategy are set and trust_tier is assigned + confirmed
 *   AND upstream feed provenance (wire_service, original_publisher) is tracked
 *   AND trust tier is persisted as a structural property feeding EI-8 (SEC-3)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createVerifyMiddleware, InMemoryReplayDetector, NoopAuthEventLogger } from '@iip/auth';
import type { KeyRegistry, RevocationChecker } from '@iip/auth';
import { createKeyPair, asConfigKey } from '@iip/test-utils';
import { SourceSourceType, CrawlStrategy } from '@iip/contracts';
import { makeValidSourceId } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.1 has not shipped `createSourceRoutes` yet. We dynamically import it
// so the suite can be COLLECTED without failing. Once the route module lands,
// remove `describe.skip` and the dynamic-import wrapper.
async function loadSourceRoutes() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.1 route module not shipped yet). The
  // catch keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/api/routes/sources';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.1 — Source Registry API routes (ATDD RED)', () => {
  // Shared test fixtures (minted once in beforeAll).
  let testKey: { kid: string; privateKey: Uint8Array; publicKey: Uint8Array } | undefined;
  let keyRegistry: KeyRegistry | undefined;

  beforeAll(async () => {
    const pair = await createKeyPair('Ed25519');
    testKey = {
      kid: 'test-key-3-1',
      privateKey: pair.privateKey,
      publicKey: pair.publicKey,
    };
    keyRegistry = new Map([['test-key-3-1', testKey]]) as unknown as KeyRegistry;
  });

  // Helper: build a Fastify app with the source routes + SEC-1 middleware.
  async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify();
    const verifyJwt = async () => ({
      key: testKey!.publicKey,
      algorithms: ['EdDSA'],
    });
    const noopRevocation: RevocationChecker = async () => ({ revoked: false });
    const verifyMiddleware = createVerifyMiddleware({
      verifyJwt,
      keyRegistry: keyRegistry!,
      replayDetector: new InMemoryReplayDetector(),
      authEventLogger: new NoopAuthEventLogger(),
      revocationChecker: noopRevocation,
    });
    await verifyMiddleware(app);
    const sourceRoutes = await loadSourceRoutes();
    if (sourceRoutes?.createSourceRoutes) {
      app.register(sourceRoutes.createSourceRoutes({}));
    }
    return app;
  }

  // A canonical valid registration payload.
  const validRegistration = {
    name: 'Senate Press Releases',
    url: 'https://www.senate.gov/press',
    source_type: 'press_release',
    crawl_strategy: 'rss',
    trust_tier: 1,
    confirmed: true,
    wire_service: null,
    original_publisher: 'Senate Press Office',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE: source registration (FR-1.1, SEC-3)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] SC-1: POST /sources with sources:write scope → 201 + persisted source with confirmed trust tier', async () => {
    // Given: an operator with sources:write scope.
    // When: they POST a valid source registration.
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['sources:write']);
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: validRegistration,
      });
      // Then: 201 Created, the body echoes the registered source.
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body).toMatchObject({
        name: validRegistration.name,
        url: validRegistration.url,
        source_type: 'press_release',
        crawl_strategy: 'rss',
        trust_tier: 1,
        confirmed: true,
        original_publisher: 'Senate Press Office',
      });
      // And: the source_type is one of the closed enum values.
      expect(Object.values(SourceSourceType)).toContain(body.source_type);
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE: SEC-1 scope enforcement
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] SC-2: POST /sources without sources:write scope → 403 (SEC-1 principal boundary)', async () => {
    // Given: a principal with only intake:review scope.
    // When: they attempt to register a source.
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'reviewer-001', ['intake:review']);
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: validRegistration,
      });
      // Then: 403 Forbidden — scope insufficient.
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('forbidden');
    } finally {
      await app.close();
    }
  });

  it('[P1] SC-3: POST /sources with no Authorization → 401', async () => {
    // Given: no credentials.
    // When: POSTing a source registration.
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        payload: validRegistration,
      });
      // Then: 401 Unauthorized.
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE: trust tier confirmation + enum validation (SEC-3, FR-1.1)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] SC-4: POST /sources with trust_tier outside {1,2,3} → 400 (SEC-3 structural tier)', async () => {
    // Given: a payload with trust_tier = 4 (invalid).
    // When: the operator registers it.
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['sources:write']);
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validRegistration, trust_tier: 4 },
      });
      // Then: 400 — trust_tier must be 1|2|3.
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('bad_request');
    } finally {
      await app.close();
    }
  });

  it('[P1] SC-5: GET /sources/:id returns the source with confirmed trust tier + provenance (EI-8)', async () => {
    // Given: a source was registered (trust_tier=2, wire_service set).
    // When: the operator fetches it by id.
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['sources:read']);
      const sourceId = makeValidSourceId();
      const res = await app.inject({
        method: 'GET',
        url: `/sources/${sourceId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      // Then: 200 + the source carries confirmed trust tier + provenance fields.
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('trust_tier');
      expect(body).toHaveProperty('confirmed');
      expect(body).toHaveProperty('wire_service');
      expect(body).toHaveProperty('original_publisher');
      // And: trust_tier is within the valid set (SEC-3).
      expect([1, 2, 3]).toContain(body.trust_tier);
    } finally {
      await app.close();
    }
  });
});

// ─── Helpers (mirror the Story 2.3 integration-test pattern) ───────────────

async function signTestToken(
  key: { kid: string; privateKey: Uint8Array },
  sub: string,
  scope: string[],
): Promise<string> {
  // Minimal Ed25519 JWT minting — the real helper lives in @iip/test-utils;
  // inlined here so the RED scaffold compiles without the full helper surface.
  const { SignJWT } = await import('jose');
  return new SignJWT({ sub, iss: 'test-iss', scope })
    .setProtectedHeader({ alg: 'EdDSA', kid: key.kid })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key.privateKey as unknown as CryptoKey);
}

// Suppress the unused-var lint for the config-key helper (referenced for
// future green-phase wiring to @iip/config).
void asConfigKey;
