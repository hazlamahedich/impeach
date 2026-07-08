/**
 * Story 3.1 — Source Registry API routes HTTP-level integration tests
 * (TC-1.1 … TC-1.10).
 *
 * Exercises the FULL HTTP path: real Ed25519 JWT → `verifyMiddleware` (SEC-1)
 * → `createSourceRoutes` handler → injected `SourceRegistryRepo`. Mirrors the
 * established integration-test pattern from `api-routes-query.integration.test.ts`
 * (real auth middleware, injected stub deps, `app.inject()`).
 *
 * The repository is an in-memory stub so the suite runs in CI without Docker.
 * The real DB-level behavior (unique constraint, CHECK constraints) is covered
 * by `ingest-schema.integration.test.ts` (live Postgres via Testcontainers).
 * This suite covers the HTTP + auth + validation + error-mapping layer.
 *
 * @rules FR-1.1, SEC-1, SEC-3, AC-1..AC-8, DoD-3, DoD-6
 * @adr ADR-0001, ADR-0010
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, createVerifyMiddleware, InMemoryReplayDetector, NoopAuthEventLogger } from '@iip/auth';
import type { KeyRegistry, ResolvedPrincipal, RevocationChecker } from '@iip/auth';
import type { SourceResponse } from '@iip/contracts';

// Route module imported from @iip/api once Task 4 ships it.
import { createSourceRoutes } from '@iip/api/routes/sources';
import type { SourceRegistryRepo } from '@iip/api/routes/sources';

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures (mirror api-routes-query.integration.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

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
  for (const k of keys) map.set(k.kid, k.publicKey);
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

async function signTestToken(opts: {
  scope?: string[];
  sub?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: opts.sub ?? 'operator-001',
    iss: 'iip-issuer',
    scope: opts.scope ?? ['sources:write'],
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: testKey.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setJti(crypto.randomUUID())
    .sign(testKey.privateKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory SourceRegistryRepo stub
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the real repository interface so the route handler logic (validation,
// error mapping, scope checks) is exercised end-to-end. Duplicate-URL detection
// (TC-1.2) throws a Postgres-shaped 23505 error so the route's error mapper is
// exercised identically to production.

function makeRepo(): SourceRegistryRepo & { store: Map<string, SourceResponse> } {
  const store = new Map<string, SourceResponse>();
  const urlIndex = new Map<string, string>(); // normalized url → id

  const repo: SourceRegistryRepo = {
    async create(input) {
      const normalized = normalizeUrl(input.url);
      const existingId = urlIndex.get(normalized);
      if (existingId !== undefined) {
        // Throw a Postgres-shaped unique_violation so the route maps it to 409.
        const err = Object.assign(new Error('duplicate key'), { code: '23505' });
        (err as { constraint?: string }).constraint = 'sources_url_uq';
        throw err;
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const row: SourceResponse = {
        id,
        name: input.name,
        url: input.url,
        source_type: input.source_type,
        crawl_strategy: input.crawl_strategy,
        trust_tier: input.trust_tier,
        confirmed: false,
        confirmation_status: 'tentative',
        is_wire_service: input.is_wire_service,
        original_publisher_id: input.original_publisher_id ?? null,
        confirmed_by: null,
        confirmed_at: null,
        confirmation_rationale: null,
        created_at: now,
        updated_at: now,
      };
      store.set(id, row);
      urlIndex.set(normalized, id);
      return row;
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByUrl(url) {
      const id = urlIndex.get(normalizeUrl(url));
      return id === undefined ? null : (store.get(id) ?? null);
    },
    async update(id, patch) {
      const existing = store.get(id);
      if (existing === undefined) return null;
      if (patch.url !== undefined && patch.url !== existing.url) {
        const newNorm = normalizeUrl(patch.url);
        const clash = urlIndex.get(newNorm);
        if (clash !== undefined && clash !== id) {
          throw Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'sources_url_uq' });
        }
        urlIndex.delete(normalizeUrl(existing.url));
        urlIndex.set(newNorm, id);
      }
      const updated: SourceResponse = {
        ...existing,
        ...patch,
        updated_at: new Date().toISOString(),
        // confirmed fields are NEVER mutated by update.
        confirmed: existing.confirmed,
        confirmed_by: existing.confirmed_by,
        confirmed_at: existing.confirmed_at,
        confirmation_rationale: existing.confirmation_rationale,
      };
      store.set(id, updated);
      return updated;
    },
    async list(filters) {
      const all = [...store.values()];
      return all.filter((s) => {
        if (filters.source_type !== undefined && s.source_type !== filters.source_type) return false;
        if (filters.trust_tier !== undefined && s.trust_tier !== filters.trust_tier) return false;
        if (filters.confirmed !== undefined && s.confirmed !== filters.confirmed) return false;
        return true;
      });
    },
  };
  return Object.assign(repo, { store });
}

/** Mirrors the route's URL normalization (case-insensitive, trailing-slash). */
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────────

async function buildApp(repo: SourceRegistryRepo): Promise<FastifyInstance> {
  const app = Fastify();
  // DIRECT call (not app.register) — createVerifyMiddleware is not fp-wrapped;
  // the onRequest hook must reach sibling route plugin contexts.
  await createVerifyMiddleware({ verifyJwt: makeVerifyJwt() })(app);
  await app.register(createSourceRoutes({ repo }));
  return app;
}

const validRegistration = {
  name: 'Senate Press Releases',
  url: 'https://www.senate.gov/press',
  source_type: 'press_release',
  crawl_strategy: 'rss',
  trust_tier: 1,
  is_wire_service: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.1 — Source Registry API routes (TC-1.1 … TC-1.10)', () => {
  // ── TC-1.1: Register new source with valid data succeeds (201) ──────────
  it('TC-1.1: POST /sources with sources:write → 201 + persisted source (AC-1, AC-2, AC-3)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const token = await signTestToken({ scope: ['sources:write'] });
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: validRegistration,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body) as SourceResponse;
      expect(body.id).toBeDefined();
      expect(body.confirmed).toBe(false);
      expect(body.confirmation_status).toBe('tentative');
      expect(body.name).toBe(validRegistration.name);
      expect(body.source_type).toBe('press_release');
      expect(body.trust_tier).toBe(1);
    } finally {
      await app.close();
    }
  });

  // ── TC-1.2: Register duplicate URL returns 409 ──────────────────────────
  it('TC-1.2: POST /sources with duplicate URL → 409 conflict (AC-4)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      // First registration succeeds.
      await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: validRegistration,
      });
      // Duplicate (trailing-slash variant — normalized comparison).
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, url: 'https://www.senate.gov/press/' },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body) as {
        error: { code: string; details?: { existing_source_id?: string } };
      };
      expect(body.error.code).toBe('conflict');
      expect(body.error.details?.existing_source_id).toBeDefined();
    } finally {
      await app.close();
    }
  });

  // ── TC-1.3: Invalid enum values return 400 ──────────────────────────────
  it('TC-1.3: POST /sources with invalid enums → 400 (AC-1, DoD-3)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const token = await signTestToken({ scope: ['sources:write'] });
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...validRegistration,
          source_type: 'blog',
          crawl_strategy: 'scrape',
          trust_tier: 5,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body) as { error: { code: string; details?: unknown } };
      expect(body.error.code).toBe('bad_request');
    } finally {
      await app.close();
    }
  });

  // ── TC-1.4: Registration rejects client-supplied confirmed ──────────────
  it('TC-1.4: POST /sources with confirmed:true → 400; omitting → 201 with confirmed=false (AC-2, DoD-3)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      // Attempting self-attestation → 400.
      const bad = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, confirmed: true },
      });
      expect(bad.statusCode).toBe(400);
      // Omitting confirmed → 201 with confirmed=false.
      const good = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, url: 'https://ok.example.com' },
      });
      expect(good.statusCode).toBe(201);
      expect((JSON.parse(good.body) as SourceResponse).confirmed).toBe(false);
    } finally {
      await app.close();
    }
  });

  // ── TC-1.5: Registration requires sources:write scope (403) ─────────────
  it('TC-1.5: POST /sources with sources:read only → 403 (SEC-1, DoD-8)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const token = await signTestToken({ scope: ['sources:read'] });
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${token}` },
        payload: validRegistration,
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('auth.insufficient_scope');
    } finally {
      await app.close();
    }
  });

  // ── TC-1.6: Registration without authentication returns 401 ─────────────
  it('TC-1.6: POST /sources with no Authorization → 401 (SEC-1)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/sources',
        payload: validRegistration,
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  // ── TC-1.7: Get source by ID succeeds (200) ─────────────────────────────
  it('TC-1.7: GET /sources/:id → 200 with confirmation_status + AC-7 fields null (AC-5, AC-7)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: validRegistration,
      });
      const id = (JSON.parse(created.body) as SourceResponse).id;
      const res = await app.inject({
        method: 'GET',
        url: `/sources/${id}`,
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:read'] })}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as SourceResponse;
      expect(body.confirmation_status).toBe('tentative');
      expect(body.confirmed_by).toBeNull();
      expect(body.confirmed_at).toBeNull();
      expect(body.confirmation_rationale).toBeNull();
    } finally {
      await app.close();
    }
  });

  // ── TC-1.8: Get source by ID not found returns 404 ──────────────────────
  it('TC-1.8: GET /sources/:nonexistent → 404 (AC-5)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const token = await signTestToken({ scope: ['sources:read'] });
      const res = await app.inject({
        method: 'GET',
        url: '/sources/00000000-0000-4000-8000-000000000099',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('not_found');
    } finally {
      await app.close();
    }
  });

  // ── TC-1.9: List sources with filters ───────────────────────────────────
  it('TC-1.9: GET /sources?trust_tier=1&confirmed=false → filtered list (AC-5)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      // Seed two sources with different tiers.
      await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, url: 'https://t1.example.com', trust_tier: 1 },
      });
      await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, url: 'https://t2.example.com', trust_tier: 2 },
      });
      const res = await app.inject({
        method: 'GET',
        url: '/sources?trust_tier=1&confirmed=false',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:read'] })}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as SourceResponse[];
      expect(body.every((s) => s.trust_tier === 1 && s.confirmed === false)).toBe(true);
      expect(body.length).toBe(1);
    } finally {
      await app.close();
    }
  });

  // ── TC-1.10: Update source fields (trust_tier change does not affect confirmed) ─
  it('TC-1.10: PATCH /sources/:id { trust_tier } → 200, confirmed stays false (AC-6)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/sources',
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { ...validRegistration, trust_tier: 2 },
      });
      const id = (JSON.parse(created.body) as SourceResponse).id;
      const res = await app.inject({
        method: 'PATCH',
        url: `/sources/${id}`,
        headers: { authorization: `Bearer ${await signTestToken({ scope: ['sources:write'] })}` },
        payload: { trust_tier: 1 },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as SourceResponse;
      expect(body.trust_tier).toBe(1);
      expect(body.confirmed).toBe(false);
      expect(body.confirmation_status).toBe('tentative');
    } finally {
      await app.close();
    }
  });
});
