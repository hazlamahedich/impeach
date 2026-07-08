/**
 * Story 3.1 — Source registry route unit tests (DoD-4 Stryker coverage).
 *
 * Co-located unit tests exercising `createSourceRoutes` against an in-memory
 * Fastify instance with an injected `SourceRegistryRepo` stub. The principal is
 * stubbed via an onRequest hook (bypassing real JWT verification) so the suite
 * focuses on route logic: validation, scope enforcement, error mapping, the
 * confirmed-rejection gate, duplicate-URL 409, and the confirmed-immutable
 * update discipline.
 *
 * These tests are the Stryker mutation target (DoD-4: 100% on sources.ts).
 * Full HTTP-level auth + real Ed25519 JWT coverage lives in
 * tests/integration/sources-registry.integration.test.ts.
 *
 * @rules FR-1.1, SEC-1, SEC-3, AC-1..AC-8, DoD-3, DoD-4, DoD-6
 * @adr ADR-0001
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { createSourceRoutes } from './sources.js';
import type { SourceRegistryRepo } from '@iip/db';
import type { SourceResponse } from '@iip/contracts';
import type { ResolvedPrincipal } from '@iip/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Stubs
// ─────────────────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/** In-memory repo stub with controllable behavior. */
function makeRepo(overrides: Partial<{
  createImpl: SourceRegistryRepo['create'];
  findByIdImpl: SourceRegistryRepo['findById'];
  findByUrlImpl: SourceRegistryRepo['findByUrl'];
  updateImpl: SourceRegistryRepo['update'];
  listImpl: SourceRegistryRepo['list'];
}> = {}): SourceRegistryRepo & { store: Map<string, SourceResponse> } {
  const store = new Map<string, SourceResponse>();
  const urlIndex = new Map<string, string>();
  return {
    store,
    async create(input) {
      if (overrides.createImpl) return overrides.createImpl(input);
      const normalized = normalizeUrl(input.url);
      if (urlIndex.has(normalized)) {
        throw Object.assign(new Error('dup'), { code: '23505', constraint: 'sources_url_uq' });
      }
      const id = crypto.randomUUID() as SourceResponse['id'];
      const now = new Date().toISOString();
      const row: SourceResponse = {
        id, name: input.name, url: input.url, source_type: input.source_type,
        crawl_strategy: input.crawl_strategy, trust_tier: input.trust_tier ?? 1,
        confirmed: false, confirmation_status: 'tentative', is_wire_service: input.is_wire_service,
        original_publisher_id: input.original_publisher_id ?? null, confirmed_by: null,
        confirmed_at: null, confirmation_rationale: null, created_at: now, updated_at: now,
      };
      store.set(id, row);
      urlIndex.set(normalized, id);
      return row;
    },
    async findById(id) {
      if (overrides.findByIdImpl) return overrides.findByIdImpl(id);
      return store.get(id) ?? null;
    },
    async findByUrl(url) {
      if (overrides.findByUrlImpl) return overrides.findByUrlImpl(url);
      const id = urlIndex.get(normalizeUrl(url));
      return id === undefined ? null : (store.get(id) ?? null);
    },
    async update(id, patch) {
      if (overrides.updateImpl) return overrides.updateImpl(id, patch);
      const existing = store.get(id);
      if (existing === undefined) return null;
      if (patch.url !== undefined) {
        const newNorm = normalizeUrl(patch.url);
        const clash = urlIndex.get(newNorm);
        if (clash !== undefined && clash !== id) {
          throw Object.assign(new Error('dup'), { code: '23505', constraint: 'sources_url_uq' });
        }
        urlIndex.delete(normalizeUrl(existing.url));
        urlIndex.set(newNorm, id);
      }
      const updated: SourceResponse = {
        id: existing.id,
        name: patch.name ?? existing.name,
        url: patch.url ?? existing.url,
        source_type: patch.source_type ?? existing.source_type,
        crawl_strategy: patch.crawl_strategy ?? existing.crawl_strategy,
        trust_tier: patch.trust_tier ?? existing.trust_tier,
        confirmed: existing.confirmed,
        confirmation_status: existing.confirmation_status,
        is_wire_service: patch.is_wire_service ?? existing.is_wire_service,
        original_publisher_id: patch.original_publisher_id ?? existing.original_publisher_id,
        confirmed_by: existing.confirmed_by,
        confirmed_at: existing.confirmed_at,
        confirmation_rationale: existing.confirmation_rationale,
        created_at: existing.created_at,
        updated_at: new Date().toISOString(),
      };
      store.set(id, updated);
      return updated;
    },
    async list(filters) {
      if (overrides.listImpl) return overrides.listImpl(filters);
      return [...store.values()].filter((s) => {
        if (filters.source_type !== undefined && s.source_type !== filters.source_type) return false;
        if (filters.trust_tier !== undefined && s.trust_tier !== filters.trust_tier) return false;
        if (filters.confirmed !== undefined && s.confirmed !== filters.confirmed) return false;
        return true;
      });
    },
  };
}

/** Phantom-brand cast for tests: produce a valid RegisterSourcePayload from a partial. */
function seedSource(overrides: Partial<Parameters<SourceRegistryRepo['create']>[0]>): Parameters<SourceRegistryRepo['create']>[0] {
  return {
    name: 'Senate Press',
    url: 'https://senate.gov/press',
    source_type: 'government',
    crawl_strategy: 'rss',
    trust_tier: 1,
    is_wire_service: false,
    ...overrides,
  } as Parameters<SourceRegistryRepo['create']>[0];
}

/** Build an app with a stubbed principal carrying the given scopes. */
async function buildApp(
  repo: SourceRegistryRepo,
  scope: string[] = ['sources:write', 'sources:read'],
  opts: { authenticated?: boolean } = {},
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify();
  if (opts.authenticated !== false) {
    app.addHook('onRequest', async (req) => {
      req.principal = {
        sub: 'unit-test-operator', iss: 'iip-issuer', kid: 'test-key-1',
        scope, jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000),
      } as unknown as ResolvedPrincipal;
    });
  }
  await app.register(createSourceRoutes({ repo }));
  return app;
}

const validBody = {
  name: 'Senate Press', url: 'https://senate.gov/press',
  source_type: 'press_release', crawl_strategy: 'rss', trust_tier: 1, is_wire_service: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /sources
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /sources', () => {
  it('creates a source → 201 with tentative tier (AC-1, AC-2, AC-3)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.id).toBeDefined();
    expect(body.confirmed).toBe(false);
    expect(body.confirmation_status).toBe('tentative');
    await app.close();
  });

  it('rejects confirmed:true → 400 with bad_request code + message (DoD-3)', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, confirmed: true },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toBe('Invalid source registration payload');
    await app.close();
  });

  it('rejects invalid source_type → 400', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, source_type: 'blog' },
    });
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('bad_request');
    await app.close();
  });

  it('rejects invalid trust_tier → 400 (SEC-3)', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, trust_tier: 5 },
    });
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('bad_request');
    await app.close();
  });

  it('rejects an empty name → 400', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, name: '' },
    });
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('bad_request');
    await app.close();
  });

  it('returns 409 with existing_source_id on duplicate URL (AC-4)', async () => {
    const repo = makeRepo();
    const app = await buildApp(repo);
    await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const res = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, url: 'https://senate.gov/press/' },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; details?: { existing_source_id?: string } } };
    expect(body.error.code).toBe('conflict');
    expect(body.error.details?.existing_source_id).toBeDefined();
    await app.close();
  });

  it('maps a 23505 from create (no pre-check hit) → 409 with constraint detail', async () => {
    // findByUrl returns null (simulating a race), but create throws 23505.
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => {
        throw Object.assign(new Error('dup'), { code: '23505', constraint: 'sources_url_uq' });
      },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string; details?: { constraint?: string } } };
    expect(body.error.code).toBe('conflict');
    expect(body.error.message).toBe('Source URL already registered');
    expect(body.error.details?.constraint).toBe('sources_url_uq');
    await app.close();
  });

  it('maps a 23505 without constraint → 409 with default constraint', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => {
        throw Object.assign(new Error('dup'), { code: '23505' });
      },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { details?: { constraint?: string } } };
    expect(body.error.details?.constraint).toBe('sources_url_uq');
    await app.close();
  });

  it('maps a 23514 check violation → 400 with message', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => {
        throw Object.assign(new Error('check'), { code: '23514' });
      },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toBe('Database CHECK constraint violated');
    await app.close();
  });

  it('maps an unknown repo error → 500 internal (no message leakage)', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => { throw new Error('boom'); },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('internal');
    expect(body.error.message).toBe('source registry operation failed');
    await app.close();
  });

  it('maps a non-PG thrown object → 500', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => { throw 'string error'; },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(500);
    await app.close();
  });

  it('maps a null thrown → 500', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      createImpl: async () => { throw null; },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(500);
    await app.close();
  });

  it('requires sources:write scope → 403 without it (SEC-1)', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('auth.insufficient_scope');
    expect(body.error.message).toContain('insufficient scope');
    await app.close();
  });

  it('returns 401 when unauthenticated (SEC-1)', async () => {
    const app = await buildApp(makeRepo(), ['sources:write'], { authenticated: false });
    const res = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('unauthenticated');
    expect(body.error.message).toBe('missing authenticated principal');
    await app.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sources (list)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /sources', () => {
  it('lists sources → 200 array (AC-5)', async () => {
    const repo = makeRepo();
    await repo.create(seedSource({ source_type: 'government' }));
    const app = await buildApp(repo, ['sources:read']);
    const res = await app.inject({ method: 'GET', url: '/sources' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(JSON.parse(res.body))).toBe(true);
    await app.close();
  });

  it('returns empty array when no sources (AC-5)', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'GET', url: '/sources' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
    await app.close();
  });

  it('rejects invalid filter → 400', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'GET', url: '/sources?trust_tier=not-a-number' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('requires sources:read scope → 403 without it', async () => {
    const app = await buildApp(makeRepo(), ['sources:write']);
    const res = await app.inject({ method: 'GET', url: '/sources' });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const app = await buildApp(makeRepo(), ['sources:read'], { authenticated: false });
    const res = await app.inject({ method: 'GET', url: '/sources' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /sources/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /sources/:id', () => {
  it('returns a source → 200 (AC-5, AC-7)', async () => {
    const repo = makeRepo();
    const created = await repo.create(seedSource({ source_type: 'government' }));
    const app = await buildApp(repo, ['sources:read']);
    const res = await app.inject({ method: 'GET', url: `/sources/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect((JSON.parse(res.body) as SourceResponse).id).toBe(created.id);
    await app.close();
  });

  it('returns 404 for a nonexistent id with not_found code + message', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'GET', url: '/sources/00000000-0000-4000-8000-000000000099' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('Source not found');
    await app.close();
  });

  it('returns 404 for a malformed id (not a UUID)', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'GET', url: '/sources/not-a-uuid' });
    expect(res.statusCode).toBe(404);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('not_found');
    await app.close();
  });

  it('requires sources:read scope → 403 without it', async () => {
    const app = await buildApp(makeRepo(), ['sources:write']);
    const res = await app.inject({ method: 'GET', url: '/sources/00000000-0000-4000-8000-000000000001' });
    expect(res.statusCode).toBe(403);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('auth.insufficient_scope');
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const app = await buildApp(makeRepo(), ['sources:read'], { authenticated: false });
    const res = await app.inject({ method: 'GET', url: '/sources/00000000-0000-4000-8000-000000000001' });
    expect(res.statusCode).toBe(401);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('unauthenticated');
    await app.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /sources/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /sources/:id', () => {
  it('updates trust_tier → 200, confirmed stays false (AC-6)', async () => {
    const repo = makeRepo();
    const created = await repo.create(seedSource({ trust_tier: 2 }));
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'PATCH', url: `/sources/${created.id}`, payload: { trust_tier: 1 } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.trust_tier).toBe(1);
    expect(body.confirmed).toBe(false);
    await app.close();
  });

  it('rejects confirmed in the update payload → 400 (AC-6, AC-8)', async () => {
    const repo = makeRepo();
    const created = await repo.create(seedSource({}));
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'PATCH', url: `/sources/${created.id}`, payload: { confirmed: true } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 for a nonexistent id with not_found code + message', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({ method: 'PATCH', url: '/sources/00000000-0000-4000-8000-000000000099', payload: { trust_tier: 1 } });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('not_found');
    expect(body.error.message).toBe('Source not found');
    await app.close();
  });

  it('returns 409 when updating URL to a duplicate with existing id (AC-4, AC-6)', async () => {
    const repo = makeRepo();
    await repo.create(seedSource({ url: 'https://a.example.com' }));
    const second = await repo.create(seedSource({ url: 'https://b.example.com' }));
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'PATCH', url: `/sources/${second.id}`, payload: { url: 'https://a.example.com' } });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; details?: { existing_source_id?: string } } };
    expect(body.error.code).toBe('conflict');
    expect(body.error.details?.existing_source_id).toBeDefined();
    await app.close();
  });

  it('rejects invalid trust_tier → 400', async () => {
    const repo = makeRepo();
    const created = await repo.create(seedSource({}));
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'PATCH', url: `/sources/${created.id}`, payload: { trust_tier: 9 } });
    expect(res.statusCode).toBe(400);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('bad_request');
    await app.close();
  });

  it('requires sources:write scope → 403 without it', async () => {
    const app = await buildApp(makeRepo(), ['sources:read']);
    const res = await app.inject({ method: 'PATCH', url: '/sources/00000000-0000-4000-8000-000000000001', payload: { trust_tier: 1 } });
    expect(res.statusCode).toBe(403);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('auth.insufficient_scope');
    await app.close();
  });

  it('returns 401 when unauthenticated', async () => {
    const app = await buildApp(makeRepo(), ['sources:write'], { authenticated: false });
    const res = await app.inject({ method: 'PATCH', url: '/sources/00000000-0000-4000-8000-000000000001', payload: { trust_tier: 1 } });
    expect(res.statusCode).toBe(401);
    expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('unauthenticated');
    await app.close();
  });

  it('maps a 23505 from update (URL race) → 409 with constraint', async () => {
    const repo = makeRepo({
      findByUrlImpl: async () => null,
      updateImpl: async () => {
        throw Object.assign(new Error('dup'), { code: '23505', constraint: 'sources_url_uq' });
      },
    });
    const app = await buildApp(repo);
    const res = await app.inject({ method: 'PATCH', url: '/sources/00000000-0000-4000-8000-000000000001', payload: { url: 'https://race.example.com' } });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; details?: { constraint?: string } } };
    expect(body.error.code).toBe('conflict');
    expect(body.error.details?.constraint).toBe('sources_url_uq');
    await app.close();
  });

  it('returns 404 for a malformed id (not a UUID)', async () => {
    const app = await buildApp(makeRepo());
    const res = await app.inject({ method: 'PATCH', url: '/sources/not-a-uuid', payload: { trust_tier: 1 } });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
