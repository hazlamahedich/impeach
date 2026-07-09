/**
 * Story 3.2 — Lawful-Access Gate integration test (FR-1.2, AC-1..AC-9).
 *
 * Exercises the REAL lawful-access mechanism end-to-end with the actual
 * production components wired together:
 *
 *   - `createSourceRoutes` (@iip/api) — the Fastify plugin with the check /
 *     confirm / override endpoints.
 *   - `assessLawfulAccess` (@iip/ingest) — the pure gate decision.
 *   - An injected `LawfulAccessSignalFetcher` simulating robots.txt / paywall /
 *     login / CAPTCHA outcomes (Story 3.3 owns the real fetch adapter).
 *   - An injected in-memory `SourceRegistryRepo` (the DB-level behavior is
 *     covered by `ingest-schema.integration.test.ts` against live Postgres).
 *   - An injected editorial-log appender capturing `source.access_override`
 *     events (AC-11).
 *
 * Mirrors the established pattern from `audit-health-gate.integration.test.ts`
 * (real mechanism components against injected dependencies). The principal is
 * stubbed via an onRequest hook so the suite focuses on the gate mechanism, not
 * JWT verification (covered by `sources-registry.integration.test.ts`).
 *
 * @rules FR-1.2, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11
 * @adr ADR-0001, ADR-0007
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createSourceRoutes } from '@iip/api/routes/sources';
import type {
  SourceRegistryRepo,
  LawfulAccessSignalFetcher,
  LawfulAccessSignals,
} from '@iip/api/routes/sources';
import type { EditorialLogRepo } from '@iip/editorial';
import type { ResolvedPrincipal } from '@iip/auth';
import type { SourceResponse, SourceId, CorpusHash, Signature } from '@iip/contracts';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory repository stub
// ─────────────────────────────────────────────────────────────────────────────

function makeRepo(): SourceRegistryRepo & { store: Map<string, SourceResponse> } {
  const store = new Map<string, SourceResponse>();
  return {
    store,
    async create(input) {
      const id = crypto.randomUUID() as SourceId;
      const now = new Date().toISOString();
      const row: SourceResponse = {
        id, name: input.name, url: input.url, source_type: input.source_type,
        crawl_strategy: input.crawl_strategy, trust_tier: input.trust_tier ?? 1,
        confirmed: false, confirmation_status: 'tentative', is_wire_service: input.is_wire_service,
        original_publisher_id: input.original_publisher_id ?? null, confirmed_by: null,
        confirmed_at: null, confirmation_rationale: null,
        lawful_access_status: 'pending', lawful_access_checked_at: null, robots_status: null,
        paywall_detected: null, login_required: null, captcha_detected: null,
        terms_forbid_scraping: false, robots_txt_content: null,
        lawful_access_confirmed: false, lawful_access_confirmed_by: null,
        lawful_access_confirmed_at: null, lawful_access_override: false,
        lawful_access_override_by: null, lawful_access_override_at: null,
        lawful_access_override_rationale: null, crawling_disabled: true,
        created_at: now, updated_at: now,
      };
      store.set(id, row);
      return row;
    },
    async findById(id) { return store.get(id) ?? null; },
    async findByUrl() { return null; },
    async update() { return null; },
    async list(filters) {
      return [...store.values()].filter((s) => {
        if (filters.source_type !== undefined && s.source_type !== filters.source_type) return false;
        if (filters.trust_tier !== undefined && s.trust_tier !== filters.trust_tier) return false;
        if (filters.confirmed !== undefined && s.confirmed !== filters.confirmed) return false;
        if (filters.lawful_access_status !== undefined && s.lawful_access_status !== filters.lawful_access_status) return false;
        if (filters.crawling_disabled !== undefined && s.crawling_disabled !== filters.crawling_disabled) return false;
        return true;
      });
    },
    async saveLawfulAccessCheckResult(id, result, status) {
      const existing = store.get(id);
      if (existing === undefined) return null;
      const updated: SourceResponse = {
        ...existing,
        lawful_access_status: status,
        lawful_access_checked_at: result.recorded_at,
        robots_status: result.robots_status,
        paywall_detected: result.paywall_detected,
        login_required: result.login_required,
        captcha_detected: result.captcha_detected,
        robots_txt_content: result.robots_txt_content,
        crawling_disabled: true,
        updated_at: new Date().toISOString(),
      };
      store.set(id, updated);
      return updated;
    },
    async confirmLawfulAccess(id, confirmed, _rationale, operatorSub) {
      const existing = store.get(id);
      if (existing === undefined) return null;
      const enableCrawling = confirmed && existing.lawful_access_status === 'allowed';
      const updated: SourceResponse = {
        ...existing,
        lawful_access_confirmed: confirmed,
        lawful_access_confirmed_by: operatorSub,
        lawful_access_confirmed_at: new Date().toISOString(),
        crawling_disabled: !enableCrawling,
        updated_at: new Date().toISOString(),
      };
      store.set(id, updated);
      return updated;
    },
    async overrideLawfulAccess(id, rationale, operatorSub) {
      const existing = store.get(id);
      if (existing === undefined) return null;
      const updated: SourceResponse = {
        ...existing,
        lawful_access_override: true,
        lawful_access_override_by: operatorSub,
        lawful_access_override_at: new Date().toISOString(),
        lawful_access_override_rationale: rationale,
        crawling_disabled: false,
        updated_at: new Date().toISOString(),
      };
      store.set(id, updated);
      return updated;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllable signal fetcher
// ─────────────────────────────────────────────────────────────────────────────

function makeSignalFetcher(opts: {
  robotsStatus?: 'allowed' | 'disallowed' | 'unreachable';
  paywall?: boolean;
  login?: boolean;
  captcha?: boolean;
}): LawfulAccessSignalFetcher {
  const robotsStatus = opts.robotsStatus ?? 'allowed';
  const signals: LawfulAccessSignals = {
    robotsStatus,
    robotsAllowed: robotsStatus === 'allowed',
    robotsCrawlDelayMs: null,
    robotsTxtContent: robotsStatus === 'unreachable' ? null : `User-agent: *\n${robotsStatus === 'allowed' ? 'Allow: /' : 'Disallow: /'}`,
    paywallDetected: opts.paywall ?? false,
    loginRequired: opts.login ?? false,
    captchaRequired: opts.captcha ?? false,
  };
  return async () => signals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editorial-log appender capture
// ─────────────────────────────────────────────────────────────────────────────

function makeAppenderCapture(): {
  editorialLog: EditorialLogRepo;
  events: { event: string; payload: unknown; partitionKey: string }[];
} {
  const events: { event: string; payload: unknown; partitionKey: string }[] = [];
  return {
    events,
    editorialLog: {
      async appendToPartition(params) {
        events.push({ event: params.event, payload: params.payload, partitionKey: params.partitionKey });
        return 1n as never;
      },
      async append() { return { ok: true, seq: 1n as never }; },
      async getTip() { return null; },
      async queryLog() { return []; },
      async verifyChain() {
        return { ok: true, entries: [], failures: [], warnings: [] } as never;
      },
    } as unknown as EditorialLogRepo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App builder
// ─────────────────────────────────────────────────────────────────────────────

async function buildApp(opts: {
  repo: SourceRegistryRepo;
  fetcher: LawfulAccessSignalFetcher;
  editorialLog?: EditorialLogRepo;
  scope?: string[];
}): Promise<FastifyInstance> {
  const app = Fastify();
  const scope = opts.scope ?? ['sources:write', 'sources:read'];
  app.addHook('onRequest', async (req) => {
    req.principal = {
      sub: 'operator-1', iss: 'iip-issuer', kid: 'test-key-1',
      scope, jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000),
    } as unknown as ResolvedPrincipal;
  });
  const noopSigner = (async () => 'sig' as unknown as Signature) as (currHash: CorpusHash) => Promise<Signature>;
  await app.register(
    createSourceRoutes({
      repo: opts.repo,
      fetchSignals: opts.fetcher,
      editorialLog: opts.editorialLog,
      systemSigner: opts.editorialLog === undefined ? undefined : noopSigner,
    }),
  );
  return app;
}

const validBody = {
  name: 'Senate Press', url: 'https://senate.gov/press',
  source_type: 'press_release', crawl_strategy: 'rss', is_wire_service: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Story 3.2 — Lawful-Access Gate integration', () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
  });

  // ── AC-1: automated check (allowed) ──
  it('AC-1: a public source (robots allowed, no blocks) → lawful_access_status=allowed', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.lawful_access_status).toBe('allowed');
    expect(body.robots_status).toBe('allowed');
    expect(body.lawful_access_checked_at).not.toBeNull();
    expect(body.robots_txt_content).not.toBeNull();
    expect(body.crawling_disabled).toBe(true); // stays disabled until confirmation (AC-3)
    await app.close();
  });

  // ── AC-1 + AC-2: paywall detected → blocked + crawling_disabled ──
  it('AC-1/AC-2: a paywalled source → lawful_access_status=blocked + crawling_disabled', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed', paywall: true }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.lawful_access_status).toBe('blocked');
    expect(body.paywall_detected).toBe(true);
    expect(body.crawling_disabled).toBe(true);
    await app.close();
  });

  // ── AC-7: unreachable robots.txt → blocked ──
  it('AC-7: unreachable robots.txt → robots_status=unreachable + lawful_access_status=blocked', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'unreachable' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.robots_status).toBe('unreachable');
    expect(body.lawful_access_status).toBe('blocked');
    expect(body.robots_txt_content).toBeNull();
    await app.close();
  });

  // ── AC-3: confirm allowed source enables crawling ──
  it('AC-3: confirming an allowed source → crawling_disabled=false', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;
    await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });

    const res = await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/confirm`,
      payload: { confirmed: true },
    });
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.lawful_access_confirmed).toBe(true);
    expect(body.lawful_access_confirmed_by).toBe('operator-1');
    expect(body.crawling_disabled).toBe(false);
    await app.close();
  });

  // ── AC-3: confirm blocked source → 409 ──
  it('AC-3: confirming a blocked source → 409 conflict', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed', paywall: true }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;
    await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });

    const res = await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/confirm`,
      payload: { confirmed: true },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('conflict');
    await app.close();
  });

  // ── AC-4: override blocked source → enables crawling + AC-11 log ──
  it('AC-4: overriding a blocked source → crawling_disabled=false + AC-11 editorial log', async () => {
    const capture = makeAppenderCapture();
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed', paywall: true }),
      editorialLog: capture.editorialLog,
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;
    await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });

    const res = await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/override`,
      payload: { rationale: 'FOI request #1234 granted 2026-07-01' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.lawful_access_override).toBe(true);
    expect(body.lawful_access_override_by).toBe('operator-1');
    expect(body.lawful_access_override_rationale).toBe('FOI request #1234 granted 2026-07-01');
    expect(body.crawling_disabled).toBe(false);

    // AC-11 — the editorial log captured the source.access_override event.
    expect(capture.events).toHaveLength(1);
    expect(capture.events[0]?.event).toBe('source.access_override');
    expect(capture.events[0]?.partitionKey).toBe('__system__');
    await app.close();
  });

  // ── AC-5: source not found → 404 ──
  it('AC-5: lawful-access endpoints on a non-existent source → 404', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const missingId = '22222222-2222-4222-8222-222222222222';
    for (const ep of ['check', 'confirm', 'override']) {
      const payload = ep === 'check' ? {} : ep === 'confirm' ? { confirmed: true } : { rationale: 'x' };
      const res = await app.inject({ method: 'POST', url: `/sources/${missingId}/lawful-access/${ep}`, payload });
      expect(res.statusCode).toBe(404);
      expect((JSON.parse(res.body) as { error: { code: string } }).error.code).toBe('not_found');
    }
    await app.close();
  });

  // ── AC-6: manual crawl strategy → 400 ──
  it('AC-6: check on a manual-crawl source → 400', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const created = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, crawl_strategy: 'manual' },
    });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toContain('manual');
    await app.close();
  });

  // ── AC-4: override on unchecked source → 400 ──
  it('AC-4: override on a never-checked source → 400', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/override`,
      payload: { rationale: 'bypass' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toContain('check');
    await app.close();
  });

  // ── AC-8: override on allowed (non-blocked) source → 400 ──
  it('AC-8: override on an allowed non-disabled source → 400', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;
    await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    // Now confirm to make it allowed + crawling_enabled.
    await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/confirm`,
      payload: { confirmed: true },
    });

    const res = await app.inject({
      method: 'POST', url: `/sources/${id}/lawful-access/override`,
      payload: { rationale: 'bypass' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('bad_request');
    expect(body.error.message).toContain('blocked');
    await app.close();
  });

  // ── AC-9: list filtering ──
  it('AC-9: GET /sources filters by lawful_access_status + crawling_disabled', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'allowed', paywall: true }),
    });
    // Create + check two sources: one allowed, one blocked.
    const a = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const b = await app.inject({
      method: 'POST', url: '/sources',
      payload: { ...validBody, url: 'https://senate.gov/other' },
    });
    // 'a' checks as blocked (paywall fetcher).
    await app.inject({ method: 'POST', url: `/sources/${(JSON.parse(a.body) as SourceResponse).id}/lawful-access/check` });

    // Filter blocked.
    const blocked = await app.inject({ method: 'GET', url: '/sources?lawful_access_status=blocked' });
    const blockedRows = JSON.parse(blocked.body) as SourceResponse[];
    expect(blockedRows.every((s) => s.lawful_access_status === 'blocked')).toBe(true);

    // Filter crawling_disabled=true (both sources are disabled at this point).
    const disabled = await app.inject({ method: 'GET', url: '/sources?crawling_disabled=true' });
    const disabledRows = JSON.parse(disabled.body) as SourceResponse[];
    expect(disabledRows.every((s) => s.crawling_disabled)).toBe(true);

    void b; // 'b' stays pending — also disabled by default.
    await app.close();
  });

  // ── AC-1: robots_txt_content populated after a successful check ──
  it('AC-1: robots_txt_content is populated in the response after a successful check', async () => {
    const app = await buildApp({
      repo,
      fetcher: makeSignalFetcher({ robotsStatus: 'disallowed' }),
    });
    const created = await app.inject({ method: 'POST', url: '/sources', payload: validBody });
    const id = (JSON.parse(created.body) as SourceResponse).id;

    const res = await app.inject({ method: 'POST', url: `/sources/${id}/lawful-access/check` });
    const body = JSON.parse(res.body) as SourceResponse;
    expect(body.robots_txt_content).not.toBeNull();
    expect(body.robots_txt_content).toContain('Disallow');
    await app.close();
  });
});
