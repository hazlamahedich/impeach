/**
 * Integration tests — Story 2.3 intake routes HTTP path + SEC-1 scope enforcement.
 *
 * Exercises the FULL HTTP path with the real `verifyMiddleware` (Story 2.2)
 * attached for the five intake endpoints registered in `apps/api/src/routes/intake.ts`:
 *
 *   POST /intake/:documentId/review      (requires intake:review)
 *   POST /intake/:documentId/approve     (requires intake:approve — two-person)
 *   POST /intake/:documentId/reject      (requires intake:review)
 *   POST /intake/:documentId/revise      (requires intake:review)
 *   GET  /intake/:documentId/attestation
 *
 * The existing `tests/contract/intake-routes.contract.test.ts` tests PURE HELPERS
 * only (it explicitly notes "We can't easily exercise the Fastify plugin here").
 * This file exercises the real plugin with auth middleware attached. No real DB:
 * the `gate` and `withTx` deps are injected stubs (established pattern from
 * `intake-routes.contract.test.ts:65-93`). Real Ed25519 JWT keys are minted via
 * `jose` so the middleware's signature + claim verification runs in full.
 *
 * @rules SEC-1, SEC-2, DoD-8
 * @adr ADR-0001
 */
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { generateKeyPair, SignJWT } from 'jose';
import { createVerifyJwt, createVerifyMiddleware, InMemoryReplayDetector, NoopAuthEventLogger } from '@iip/auth';
import type { KeyRegistry, ResolvedPrincipal, RevocationChecker } from '@iip/auth';
import { createIntakeRoutes } from '@iip/api/routes/intake';
import type { IntakeRouteDeps } from '@iip/api/routes/intake';
import type { IntakeDocument, IntakeGate, SignedAttestation } from '@iip/intake';

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

async function signTestToken(opts: { scope: string[]; sub?: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: opts.sub ?? 'operator-001',
    iss: 'iip-issuer',
    scope: opts.scope,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: testKey.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setJti(crypto.randomUUID())
    .sign(testKey.privateKey);
}

// ─────────────────────────────────────────────────────────────────────────
// Fake gate + withTx (no real DB)
// ─────────────────────────────────────────────────────────────────────────

/** A minimal in-memory IntakeDocument sufficient for the route's serialization. */
function fakeDoc(overrides: Partial<IntakeDocument> = {}): IntakeDocument {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    content_hash: 'a'.repeat(64),
    status: 'staging',
    tier: 1,
    source_uri: 'ipfs://test',
    depositor_sub: 'depositor-001',
    depositor_key_kid: 'dep-key-1',
    reviewer_sub: null,
    reviewer_key_kid: null,
    reviewed_at: null,
    approved_at: null,
    partner_kid: null,
    ...overrides,
  } as unknown as IntakeDocument;
}

interface FakeStore {
  docs: Map<string, IntakeDocument>;
  saved: IntakeDocument[];
}

function makeGate(): { gate: IntakeGate; store: FakeStore } {
  const store: FakeStore = { docs: new Map(), saved: [] };
  const gate: IntakeGate = {
    async review(doc) {
      return { ...doc, status: 'reviewed_once' } as IntakeDocument;
    },
    async approve(doc) {
      return { ...doc, status: 'approved' } as IntakeDocument;
    },
    async reject(doc) {
      return { ...doc, status: 'rejected' } as IntakeDocument;
    },
    async revise(doc) {
      return { ...doc, status: 'needs_revision' } as IntakeDocument;
    },
    async assertExtractable() {
      /* no-op for tests */
    },
    async beginExtraction(doc) {
      return { ...doc, status: 'extracting' } as IntakeDocument;
    },
    async completeIndexing(doc) {
      return { ...doc, status: 'indexed' } as IntakeDocument;
    },
    async issueAttestation(doc) {
      return {
        payload: { document_id: doc.id, content_hash: doc.content_hash },
        signature: 'fake-sig',
      } as unknown as SignedAttestation;
    },
  };
  return { gate, store };
}

function makeWithTx(store: FakeStore): IntakeRouteDeps['withTx'] {
  return async (fn) =>
    fn({
      loadDoc: async (id: string) => store.docs.get(id),
      saveDoc: async (doc: IntakeDocument) => {
        store.docs.set(doc.id, doc);
        store.saved.push(doc);
      },
    });
}

async function buildApp(store: FakeStore, gate: IntakeGate): Promise<FastifyInstance> {
  const app = Fastify();
  // Call the middleware plugin function DIRECTLY on `app` (not via app.register)
  // so the onRequest hook applies to routes registered in child plugin contexts.
  // Matches packages/auth/src/middleware.test.ts pattern.
  await createVerifyMiddleware({ verifyJwt: makeVerifyJwt() })(app);
  await app.register(
    createIntakeRoutes({
      gate,
      withTx: makeWithTx(store),
    }),
  );
  return app;
}

const DOC_ID = '00000000-0000-4000-8000-000000000010';

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Intake routes — HTTP-level integration with auth + scope enforcement (SEC-1, SEC-2)', () => {
  it('TC-1: POST /intake/:id/review with intake:review scope → 200', async () => {
    const { gate, store } = makeGate();
    store.docs.set(DOC_ID, fakeDoc({ status: 'staging' }));
    const app = await buildApp(store, gate);
    try {
      const token = await signTestToken({ scope: ['intake:review'], sub: 'reviewer-001' });
      const res = await app.inject({
        method: 'POST',
        url: `/intake/${DOC_ID}/review`,
        headers: { authorization: `Bearer ${token}` },
        payload: { signature: 'sig' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { status: string };
      expect(body.status).toBe('reviewed_once');
    } finally {
      await app.close();
    }
  });

  it('TC-2: POST /intake/:id/approve with intake:approve scope → 200 (two-person flow)', async () => {
    const { gate, store } = makeGate();
    store.docs.set(DOC_ID, fakeDoc({ status: 'reviewed_once', reviewer_sub: 'reviewer-001' }));
    const app = await buildApp(store, gate);
    try {
      const token = await signTestToken({ scope: ['intake:approve'], sub: 'approver-001' });
      const res = await app.inject({
        method: 'POST',
        url: `/intake/${DOC_ID}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          signature: 'sig',
          partnerSignature: { kid: 'partner-key', signature: 'psig' },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { status: string };
      expect(body.status).toBe('approved');
    } finally {
      await app.close();
    }
  });

  it('TC-3: intake:review scope trying /approve → 403 intake.insufficient_scope (scope-denied)', async () => {
    const { gate, store } = makeGate();
    store.docs.set(DOC_ID, fakeDoc({ status: 'reviewed_once' }));
    const app = await buildApp(store, gate);
    try {
      // Valid token but scope is intake:review, NOT intake:approve
      const token = await signTestToken({ scope: ['intake:review'], sub: 'reviewer-001' });
      const res = await app.inject({
        method: 'POST',
        url: `/intake/${DOC_ID}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: { signature: 'sig' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body) as { error: { code: string } };
      expect(body.error.code).toBe('intake.insufficient_scope');
      // Nothing was saved (guard fired before withTx save)
      expect(store.saved).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('TC-4: missing Authorization header → 401 (middleware rejects before route)', async () => {
    const { gate, store } = makeGate();
    store.docs.set(DOC_ID, fakeDoc({ status: 'staging' }));
    const app = await buildApp(store, gate);
    try {
      const res = await app.inject({
        method: 'POST',
        url: `/intake/${DOC_ID}/review`,
        payload: { signature: 'sig' },
      });
      expect(res.statusCode).toBe(401);
      expect(store.saved).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('TC-5: GET /intake/:id/attestation with authenticated principal → 200', async () => {
    const { gate, store } = makeGate();
    store.docs.set(DOC_ID, fakeDoc({ status: 'approved' }));
    const app = await buildApp(store, gate);
    try {
      const token = await signTestToken({ scope: ['read'], sub: 'auditor-001' });
      const res = await app.inject({
        method: 'GET',
        url: `/intake/${DOC_ID}/attestation`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { signature: string; payload: { document_id: string } };
      expect(body.signature).toBe('fake-sig');
      expect(body.payload.document_id).toBe(DOC_ID);
    } finally {
      await app.close();
    }
  });
});
