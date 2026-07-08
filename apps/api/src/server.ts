/**
 * API server bootstrap — the real Fastify entrypoint (TD1 + TD5, Epic 3 prep).
 *
 * This module instantiates the full dependency graph at startup and registers
 * the route plugins that were authored in Stories 2.2/2.3/2.11 but never
 * mounted in a running server (the "stub-stack trap" that split Story 2.9 and
 * forced deviations in 2.11). The registration order is authoritative, copied
 * from `tests/integration/api-routes-query.integration.test.ts:116-136`.
 *
 * **process.env reads (entrypoint exemption):** per project-context, env reads
 * are permitted in the entrypoint layer. `@iip/config.bootOrDie()` validates
 * the shared config; server-specific vars (PORT, HOST, AUDIT_WORKER_HEALTH_URL,
 * JWT_ISSUER_PUBLIC_KEYS, SYSTEM_SIGNING_PRIVATE_KEY) are read here because
 * they are server-bootstrap concerns, not shared-config concerns.
 *
 * **System signing key (TD5):** the editorial log's `appendToPartition`
 * requires a `getSignature` callback. System-emitted events (audit
 * circuit-breaker transitions, auth events) have no client to delegate signing
 * to, so the server holds a dedicated system Ed25519 private key — the
 * sanctioned exception to the "server never holds operator private keys" rule
 * (precedent: intake's `systemSignKey`). The rule means operator/human keys
 * stay client-side; a service-owned key for platform-integrity events is a
 * distinct custody domain.
 *
 * @rules D7, NFR-S-4, SEC-1, SEC-2, SEC-6, ADR-0029 §5, STR-2
 * @adr ADR-0001, ADR-0029
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';

import { bootOrDie, type ValidatedConfig } from '@iip/config';
import { createAuditHealthClient, type AuditHealthClient } from '@iip/config';
import { createDb, closeDb, type DbHandle } from '@iip/db';
import { createSourcesRepository } from '@iip/db';
import {
  createEditorialLogRepo,
  EditorialAuthEventLogger,
} from '@iip/editorial';
import {
  createVerifyJwt,
  createVerifyMiddleware,
  InMemoryReplayDetector,
  type KeyRegistry,
  type RevocationChecker,
} from '@iip/auth';
import {
  createIntakeGate,
  createOperatorKeyRegistry,
  createPartnerKeyRegistry,
  InMemoryIntakeReplayDetector,
} from '@iip/ingest';
import { renderGateLive } from '@iip/render';
import type { CorpusHash, Signature, GateContext } from '@iip/contracts';
import { NoopIntakeEventLogger } from '@iip/contracts';

import { createIntakeRoutes } from './routes/intake.js';
import { createQueryRoutes } from './routes/query.js';
import { createSourceRoutes } from './routes/sources.js';
import { createRateLimitPlugin } from './routes/rate-limit.js';
import { createRepositoryForTx } from './intake/repository.js';

// ─────────────────────────────────────────────────────────────────────────────
// Server-specific env reads (entrypoint exemption)
// ─────────────────────────────────────────────────────────────────────────────

function readPort(): number {
  const raw = process.env['PORT'];
  const port = raw === undefined || raw.trim() === '' ? 3000 : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'PORT',
        reason: 'must be an integer in [1, 65535]',
      }) + '\n',
    );
    process.exit(1);
  }
  return port;
}

function readHost(): string {
  return process.env['HOST'] ?? '0.0.0.0';
}

function readAuditWorkerHealthUrl(): string {
  const url = process.env['AUDIT_WORKER_HEALTH_URL'];
  if (url === undefined || url.trim() === '') {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'AUDIT_WORKER_HEALTH_URL',
        reason: 'missing',
      }) + '\n',
    );
    process.exit(1);
  }
  return url;
}

/**
 * Load the system Ed25519 signing key from `SYSTEM_SIGNING_PRIVATE_KEY`
 * (PKCS#8 DER, base64). Returns both halves: the private key (for signing
 * system-emitted editorial events) and the public key (to register in the
 * editorial key lookup so verifyChain resolves `__system__` entries).
 *
 * This is the sanctioned service-key custody domain (TD5). The "server never
 * holds private keys" rule governs OPERATOR/HUMAN keys; system platform-
 * integrity events have no client signer.
 */
async function loadSystemSigningKey(): Promise<{
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  const b64 = process.env['SYSTEM_SIGNING_PRIVATE_KEY'];
  if (b64 === undefined || b64.trim() === '') {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'SYSTEM_SIGNING_PRIVATE_KEY',
        reason: 'missing (Ed25519 PKCS#8 base64 required)',
      }) + '\n',
    );
    process.exit(1);
  }
  const der = Buffer.from(b64, 'base64');
  const privateKey = await webcrypto.subtle.importKey('pkcs8', der, 'Ed25519', false, ['sign']);
  // Derive the public key by generating from the same key material is not
  // possible with Ed25519 importKey; instead we import the public SPKI if
  // provided separately, OR we sign+verify is not how to extract. The simplest
  // correct path: require SYSTEM_SIGNING_PUBLIC_KEY alongside the private key.
  const pubB64 = process.env['SYSTEM_SIGNING_PUBLIC_KEY'];
  if (pubB64 === undefined || pubB64.trim() === '') {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'SYSTEM_SIGNING_PUBLIC_KEY',
        reason: 'missing (Ed25519 SPKI base64 required for verifyChain key lookup)',
      }) + '\n',
    );
    process.exit(1);
  }
  const pubDer = Buffer.from(pubB64, 'base64');
  const publicKey = await webcrypto.subtle.importKey('spki', pubDer, 'Ed25519', false, ['verify']);
  return { privateKey, publicKey };
}

/**
 * Build the system signer closure: signs the 32-byte curr_hash with the
 * system Ed25519 private key and returns a base64url Signature.
 *
 * Mirrors the integration-test signer at `editorial-log.integration.test.ts:110-116`.
 */
function buildSystemSigner(privateKey: CryptoKey): (currHash: CorpusHash) => Promise<Signature> {
  return async (currHash: CorpusHash): Promise<Signature> => {
    const hashBytes = Buffer.from(currHash, 'hex');
    const sig = await webcrypto.subtle.sign('Ed25519', privateKey, hashBytes);
    return Buffer.from(sig).toString('base64url') as Signature;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT issuer key registry (distinct from intake operator keys)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the auth `KeyRegistry` from `JWT_ISSUER_PUBLIC_KEYS` (JSON: kid → base64 SPKI).
 * These are the keys that SIGN JWTs (the API verifies them); they are distinct
 * from intake operator keys (which sign intake transitions). A separate env var
 * because the custody + rotation cadence differ.
 */
async function buildIssuerKeyRegistry(): Promise<KeyRegistry> {
  const raw = process.env['JWT_ISSUER_PUBLIC_KEYS'];
  if (raw === undefined || raw.trim() === '') {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'JWT_ISSUER_PUBLIC_KEYS',
        reason: 'missing (JSON kid→base64 SPKI required)',
      }) + '\n',
    );
    process.exit(1);
  }
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(raw) as Record<string, string>;
  } catch {
    process.stderr.write(
      JSON.stringify({
        level: 60,
        time: Date.now(),
        msg: 'config validation failed — refusing to boot',
        name: 'JWT_ISSUER_PUBLIC_KEYS',
        reason: 'must be valid JSON',
      }) + '\n',
    );
    process.exit(1);
  }
  const cache = new Map<string, CryptoKey>();
  for (const [kid, base64] of Object.entries(parsed)) {
    const der = Buffer.from(base64, 'base64');
    cache.set(kid, await webcrypto.subtle.importKey('spki', der, 'Ed25519', false, ['verify']));
  }
  return {
    get(kid: string) {
      const publicKey = cache.get(kid);
      if (publicKey === undefined) return undefined;
      return { kid, publicKey };
    },
  };
}

/** No-op revocation checker (v1: revocation via key status flip, not a list). */
const noopRevocationChecker: RevocationChecker = { isRevoked: () => false };

// ─────────────────────────────────────────────────────────────────────────────
// Dependency graph construction
// ─────────────────────────────────────────────────────────────────────────────

async function buildApp(config: ValidatedConfig): Promise<{
  app: FastifyInstance;
  dbHandle: DbHandle;
}> {
  // ── DB ──────────────────────────────────────────────────────────────────
  const dbHandle = createDb(config.databaseUrl);

  // ── Source registry repository (Story 3.1, FR-1.1) ──────────────────────
  const sourcesRepo = createSourcesRepository(dbHandle.db);

  // ── System signing key + signer (TD5) ───────────────────────────────────
  const { privateKey: systemPrivateKey, publicKey: systemPublicKey } = await loadSystemSigningKey();
  const systemSigner = buildSystemSigner(systemPrivateKey);

  // ── Editorial log repo (TD5) ────────────────────────────────────────────
  // The repo needs an executor (pg client) + key lookup + clock. We check out
  // a long-lived pool client for the repo's executor (the append path is
  // single-threaded per partition via CAS, so one client suffices for v1).
  const editorialClient = await dbHandle.pool.connect();
  const editorialRepo = createEditorialLogRepo({
    executor: {
      // Adapt pg's QueryResult to the QueryExecutor shape. The repo reads
      // `rows` as Record<string, unknown>[]; pg returns any[] which is
      // assignable via cast.
      query: (text, params) =>
        editorialClient.query(text, [...(params ?? [])]) as unknown as Promise<{
          rows: readonly Record<string, unknown>[];
        }>,
    },
    keyLookup: {
      // The system principal's public key is always valid from epoch.
      async getPublicKey(principalSub) {
        if (principalSub === '__system__' || principalSub === '__system_pd2__' || principalSub === '__audit__') {
          return { publicKey: systemPublicKey, validFrom: new Date(0) };
        }
        // Operator keys: look up in the intake keyring (best-effort; full
        // operator-key rotation tracking is a future hardening item).
        const entry = config.intake.operatorPublicKeys[principalSub];
        if (entry === undefined) return undefined;
        const der = Buffer.from(entry.key, 'base64');
        const publicKey = await webcrypto.subtle.importKey('spki', der, 'Ed25519', false, ['verify']);
        return { publicKey, validFrom: new Date(0) };
      },
    },
    now: () => new Date(),
  });

  // ── Audit-health client with onTransition → editorial log (TD5, ADR-0029 §5) ──
  const auditHealth: AuditHealthClient = createAuditHealthClient({
    baseUrl: readAuditWorkerHealthUrl(),
    onTransition: (state, status) => {
      // Fire-and-forget; observer failures are swallowed by the client (SEC-5).
      void editorialRepo
        .appendToPartition({
          partitionKey: '__audit__',
          principalSub: '__system__',
          event: state === 'Open' ? 'audit.circuit_breaker.opened' : 'audit.circuit_breaker.closed',
          jti: webcrypto.randomUUID(),
          payload: { state, status },
          getSignature: systemSigner,
        })
        .catch((err: unknown) => {
          // Log but never throw — a broken editorial log must not change the
          // breaker decision (SEC-5: render > observability).
          process.stderr.write(
            JSON.stringify({
              level: 50,
              time: Date.now(),
              msg: 'editorial log append failed for audit circuit-breaker transition',
              error: err instanceof Error ? err.message : String(err),
            }) + '\n',
          );
        });
    },
  });

  // ── Auth: JWT verifier + middleware ─────────────────────────────────────
  const issuerKeyRegistry = await buildIssuerKeyRegistry();
  const verifyJwt = createVerifyJwt({
    keyRegistry: issuerKeyRegistry,
    replayDetector: new InMemoryReplayDetector(),
    eventLogger: new EditorialAuthEventLogger(
      {
        async append(params) {
          await editorialRepo.appendToPartition({
            partitionKey: params.partitionKey,
            principalSub: params.principalSub,
            event: params.event as never, // EditorialLogEvent literal
            jti: params.jti,
            payload: params.payload,
            getSignature: systemSigner,
          });
        },
      },
    ),
    revocationChecker: noopRevocationChecker,
  });

  // ── Intake gate (SEC-2) ─────────────────────────────────────────────────
  const operatorRegistry = await createOperatorKeyRegistry(
    config.intake.operatorPublicKeys as Record<
      string,
      { key: string; status: 'active' | 'revoked'; revokedAt?: string }
    >,
  );
  const partnerRegistry = await createPartnerKeyRegistry(
    config.intake.partnerPublicKeys as Record<string, string>,
  );
  const gate = createIntakeGate({
    operatorKeyring: operatorRegistry,
    partnerKeyring: partnerRegistry,
    eventLogger: NoopIntakeEventLogger,
    replayDetector: new InMemoryIntakeReplayDetector(),
    approvalWindowSeconds: config.intake.approvalWindowSeconds,
    minInterSignatureDelayMs: config.intake.minInterSignatureDelayMs,
    now: () => new Date(),
    systemSignKey: systemPrivateKey,
  });

  // ── Intake withTx bridge (DoD-8 atomicity) ──────────────────────────────
  const withTx = <T>(
    fn: (txDeps: {
      loadDoc: (documentId: string) => Promise<unknown>;
      saveDoc: (doc: unknown) => Promise<void>;
    }) => Promise<T>,
  ): Promise<T> =>
    // Cast: drizzle's transaction callback yields a PgTransaction, but
    // createRepositoryForTx expects the Db type. They share the query surface
    // this bridge uses; the $client property mismatch is an
    // exactOptionalPropertyTypes artifact, not a real incompatibility.
    dbHandle.db.transaction(async (txDb) =>
      fn(createRepositoryForTx(txDb as never) as never),
    );

  // ── serveClaims: in-process render gate (per user choice) ───────────────
  // Real RAG pipeline is Epic 5 (serve-worker). For first boot, run the render
  // gate in-process so the API is functional for local dev without faking Epic 5.
  const auditHealthProbe = { isAuditReachable: () => auditHealth.getCircuitBreakerState() === 'Closed' };
  const gateContext: GateContext = {
    resolver: { resolve: async () => null }, // no documents ingested yet (Epic 3+)
    entailment: { check: async () => ({ entailed: false }) }, // fail-closed: no entailment claim without Epic 4
    verifyCitation: async () => false, // fail-closed: no citation verification without Epic 4
    auditHealth: auditHealthProbe,
  };
  const serveClaims = async (input: { readonly query: string }): Promise<unknown> => {
    // Minimal GateInput — the real shape arrives with Epic 5. For now the gate
    // runs against an empty render, which fail-closes to no_evidence.
    return renderGateLive(
      { query: input.query, answer_text: '', spans: [] } as never,
      gateContext,
    );
  };

  // ── Fastify app + registration (authoritative order) ────────────────────
  const app = Fastify({ logger: true });

  // 1. Auth middleware — DIRECT call (NOT app.register) because it is NOT
  //    fp-wrapped; the onRequest hook must reach sibling route plugins.
  await createVerifyMiddleware({ verifyJwt })(app);

  // 2. Rate limit — IS fp-wrapped; safe to register.
  await app.register(createRateLimitPlugin(config.rateLimit));

  // 3. Intake routes.
  await app.register(createIntakeRoutes({ gate, withTx } as never));

  // 4. Source registry routes (Story 3.1, FR-1.1).
  await app.register(createSourceRoutes({ repo: sourcesRepo }));

  // 5. Query routes (ADR-0029 §5 fail-closed).
  await app.register(createQueryRoutes({ auditHealth, serveClaims }));

  return { app, dbHandle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────────

export async function buildServer(): Promise<{ app: FastifyInstance; dbHandle: DbHandle }> {
  const config = bootOrDie();
  return buildApp(config);
}

async function main(): Promise<void> {
  // Preserve the docker-compose healthcheck signal (it greps for 'alive:').
  process.stdout.write('alive: api\n');
  const { app, dbHandle } = await buildServer();
  const port = readPort();
  const host = readHost();

  // Graceful shutdown (NFR-R-1).
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await closeDb(dbHandle);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, 'API server listening');
  } catch (err) {
    app.log.error({ err }, 'failed to listen');
    await closeDb(dbHandle);
    process.exit(1);
  }
}

// Run only when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
