/**
 * Story 3.7 — Operator triage API routes integration test (ATDD RED phase).
 *
 * The operator triage surface (FR-1.7) is backed by API routes that serve the
 * failed/dead-lettered job list, reprocess action, spot-check view, and health
 * metrics. These routes DO NOT EXIST YET — this suite is RED by design
 * (describe.skip) until Story 3.7 ships `createTriageRoutes`.
 *
 * Mirrors the established integration-test pattern (Story 2.3 / 3.1): real
 * Ed25519 JWTs, Fastify `app.inject()`, injected deps.
 *
 * @rules FR-1.7, SEC-1, NFR-O-1
 * @adr ADR-001
 * @activates-in Epic 3 (Story 3.7 — createTriageRoutes handler + lawful-access re-check)
 *
 * GIVEN the operator accesses the ingestion dashboard
 * WHEN viewing the triage surface
 * THEN failed/dead-lettered jobs are displayed with typed error categories
 *   AND the operator can reprocess a failed job
 *   AND the operator can spot-check extraction output against source text
 *   AND the dashboard shows ingestion health metrics (NFR-O-1)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createVerifyMiddleware, InMemoryReplayDetector, NoopAuthEventLogger } from '@iip/auth';
import type { KeyRegistry, RevocationChecker } from '@iip/auth';
import { createKeyPair } from '@iip/test-utils';
import { makeValidJobId } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.7 has not shipped `createTriageRoutes` yet. Dynamic import lets the
// suite COLLECT. Once the route module lands, remove `describe.skip`.
async function loadTriageRoutes() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.7 route module not shipped yet). The
  // catch keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/api/routes/triage';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.7 — Operator triage API routes (ATDD RED)', () => {
  let testKey: { kid: string; privateKey: Uint8Array; publicKey: Uint8Array } | undefined;
  let keyRegistry: KeyRegistry | undefined;

  beforeAll(async () => {
    const pair = await createKeyPair('Ed25519');
    testKey = {
      kid: 'test-key-3-7',
      privateKey: pair.privateKey,
      publicKey: pair.publicKey,
    };
    keyRegistry = new Map([['test-key-3-7', testKey]]) as unknown as KeyRegistry;
  });

  async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify();
    const verifyJwt = async () => ({ key: testKey!.publicKey, algorithms: ['EdDSA'] });
    const noopRevocation: RevocationChecker = async () => ({ revoked: false });
    const verifyMiddleware = createVerifyMiddleware({
      verifyJwt,
      keyRegistry: keyRegistry!,
      replayDetector: new InMemoryReplayDetector(),
      authEventLogger: new NoopAuthEventLogger(),
      revocationChecker: noopRevocation,
    });
    await verifyMiddleware(app);
    const triage = await loadTriageRoutes();
    if (triage?.createTriageRoutes) {
      app.register(triage.createTriageRoutes({}));
    }
    return app;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /admin/ingest/jobs — triage queue (FR-1.7)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] OT-API-1: GET /admin/ingest/jobs returns failed + dead-lettered jobs with typed errors', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:read']);
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ingest/jobs?filter=failed,dead_lettered',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.data)).toBe(true);
      // And: each job carries a typed error category.
      const first = body.data?.[0];
      expect(first).toHaveProperty('errorCategory');
      expect(first.errorCategory).not.toBe('unknown_unknown'); // must be typed, not a raw stack
    } finally {
      await app.close();
    }
  });

  it('[P0] OT-API-2: GET /admin/ingest/jobs without admin:ingest:read scope → 403 (SEC-1)', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'reviewer-001', ['intake:review']);
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ingest/jobs',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /admin/ingest/jobs/:id/reprocess — re-enqueue (FR-1.7)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] OT-API-3: POST /admin/ingest/jobs/:id/reprocess re-enqueues a failed job', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:write']);
      const jobId = makeValidJobId('triage-reprocess');
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ingest/jobs/${jobId}/reprocess`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('requeued');
      expect(body.jobId).toBe(jobId);
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /admin/ingest/jobs/:id/spot-check — side-by-side view (FR-1.7)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] OT-API-4: GET /admin/ingest/jobs/:id/spot-check returns source text + extracted artifacts', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:read']);
      const jobId = makeValidJobId('triage-spotcheck');
      const res = await app.inject({
        method: 'GET',
        url: `/admin/ingest/jobs/${jobId}/spot-check`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // And: the response carries the source document text.
      expect(body.sourceText).toBeTypeOf('string');
      // And: the extracted artifacts (entities + claims + citations) are present.
      expect(Array.isArray(body.artifacts?.entities)).toBe(true);
      expect(Array.isArray(body.artifacts?.claims)).toBe(true);
      expect(Array.isArray(body.artifacts?.citations)).toBe(true);
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /admin/ingest/metrics — health dashboard (NFR-O-1)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] OT-API-5: GET /admin/ingest/metrics returns the four health metrics (NFR-O-1)', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:read']);
      const res = await app.inject({
        method: 'GET',
        url: '/admin/ingest/metrics',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Then: all four NFR-O-1 metrics are present.
      expect(body).toHaveProperty('successRate');
      expect(body).toHaveProperty('throughput');
      expect(body).toHaveProperty('queueDepth');
      expect(body).toHaveProperty('dlqDepth');
    } finally {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /admin/ingest/jobs/:id/reprocess — lawful-access RE-CHECK (coverage gap R3.7b)
  // A reprocessed job MUST re-run the lawful-access gate before re-ingesting.
  // Without this, a source that was DISABLED after the original ingest (e.g.
  // a paywall appeared, robots.txt changed) gets silently re-ingested — unlawful
  // ingestion re-triggered by the operator "reprocess" button.
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] OT-API-6: reprocess a job whose source is now DISABLED → 409, no re-ingest (FR-1.2)', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:write']);
      const jobId = makeValidJobId('triage-reprocess-disabled');
      // Given: a job whose source has since been DISABLED by the lawful-access gate
      // (e.g. a paywall appeared between the original fetch and the reprocess).
      // The injected deps seed this state (green-phase wiring).
      // When: the operator hits reprocess.
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ingest/jobs/${jobId}/reprocess`,
        headers: { authorization: `Bearer ${token}` },
      });
      // Then: 409 Conflict — the gate re-ran and BLOCKED re-ingest of a disabled source.
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('conflict');
      // And: the error names the lawful-access failure as the reason (auditable).
      expect(body.error.message).toMatch(/lawful.access|disabled/i);
      // And: the job was NOT re-enqueued (no requeue status).
      expect(body.status).not.toBe('requeued');
    } finally {
      await app.close();
    }
  });

  it('[P1] OT-API-7: reprocess a job whose source is still ALLOWED → 202, gate re-ran and passed', async () => {
    const app = await buildApp();
    try {
      const token = await signTestToken(testKey!, 'operator-001', ['admin:ingest:write']);
      const jobId = makeValidJobId('triage-reprocess-allowed');
      // Given: a job whose source is still lawfully accessible (gate re-check passes).
      // When: the operator hits reprocess.
      const res = await app.inject({
        method: 'POST',
        url: `/admin/ingest/jobs/${jobId}/reprocess`,
        headers: { authorization: `Bearer ${token}` },
      });
      // Then: 202 — the gate re-ran, passed, and the job was re-enqueued.
      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('requeued');
      // And: the response records that the gate was re-checked (auditable evidence).
      expect(body.lawfulAccessChecked).toBe(true);
    } finally {
      await app.close();
    }
  });
});

// ─── Helper (mirrors the Story 3.1 + 2.3 integration-test pattern) ─────────

async function signTestToken(
  key: { kid: string; privateKey: Uint8Array },
  sub: string,
  scope: string[],
): Promise<string> {
  const { SignJWT } = await import('jose');
  return new SignJWT({ sub, iss: 'test-iss', scope })
    .setProtectedHeader({ alg: 'EdDSA', kid: key.kid })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key.privateKey as unknown as CryptoKey);
}
