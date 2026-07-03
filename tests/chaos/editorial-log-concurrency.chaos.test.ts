/**
 * Chaos tests — Story 2.5 Hash-Chain Concurrency Model (SC-6, SEC-6).
 *
 * 4 chaos tests (TC-2.5-CHAOS-1 .. TC-2.5-CHAOS-4). These are DB-backed
 * fault-injection tests against a real PostgreSQL (Testcontainers): they
 * exercise the editorial log under failure scenarios and assert the hash-chain
 * invariants hold. Where a true infrastructure fault (TCP partition, Redis
 * broker restart) is not available in the unit-test environment, the fault is
 * injected at the application/executor layer — the defamation-critical
 * invariant under test is chain integrity, not TCP mechanics.
 *
 *   CHAOS-1 network partition  → one writer sees a stale tip (partition), then
 *                                heals; assert no persistent fork.
 *   CHAOS-2 pool exhaustion     → real pool saturated; writers queue/fail, no
 *                                corruption.
 *   CHAOS-3 broker restart      → duplicate (jti) redelivery against the real
 *                                unique index; assert idempotency.
 *   CHAOS-4 clock skew          → skewed `now()` on one writer; assert seq
 *                                (not time) governs ordering.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules SEC-6, SC-6, AC-11
 * @adr ADR-024
 * @term T-006
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client, Pool } from 'pg';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CorpusHash, Signature, makeEntry, EditorialError } from '@iip/contracts';
import { createEditorialLogRepo } from '@iip/editorial';
import type {
  EditorialLogRepo,
  OperatorKeyLookup,
  OperatorPublicKeyEntry,
  QueryExecutor,
} from '@iip/editorial';

// ─────────────────────────────────────────────────────────────────────────
// Harness
// ─────────────────────────────────────────────────────────────────────────

const PG_IMAGE =
  process.env['IIP_PG_AGE_VECTOR_IMAGE'] ||
  'ghcr.io/iip/postgres-age-pgvector:pg16';

let container: StartedTestContainer;
let client: Client;
let pool: Pool;
let connectionString: string;
let keyLookup: OperatorKeyLookup;
let keyStore: Map<string, { publicKey: CryptoKey; privateKey: CryptoKey }>;

const MIGRATION_SQL = readFileSync(
  new URL('../../packages/db/drizzle/0001_editorial_log.sql', import.meta.url),
  'utf8',
);

beforeAll(async () => {
  const dbName = `iip_chaos_${crypto.randomUUID().slice(0, 8)}`;
  container = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;
  client = new Client({ connectionString });
  await client.connect();
  await client.query(MIGRATION_SQL);
  pool = new Pool({ connectionString, max: 25 });
  await pool.query('SELECT 1');
}, 240_000);

afterAll(async () => {
  await client?.end();
  await pool?.end();
  await container?.stop();
});

function makeExecutorForPool(): QueryExecutor {
  return {
    async query(text: string, params?: readonly unknown[]) {
      const c = await pool.connect();
      try {
        const result = await c.query(text, params as unknown[]);
        return { rows: result.rows as readonly Record<string, unknown>[] };
      } finally {
        c.release();
      }
    },
  };
}

function makeRepo(): EditorialLogRepo {
  return createEditorialLogRepo({
    executor: makeExecutorForPool(),
    keyLookup,
    now: () => new Date(),
  });
}

beforeEach(async () => {
  await client.query('TRUNCATE editorial_log');
  keyStore = new Map();
  keyLookup = {
    async getPublicKey(principalSub: string): Promise<OperatorPublicKeyEntry | undefined> {
      const entry = keyStore.get(principalSub);
      if (entry === undefined) return undefined;
      return { publicKey: entry.publicKey, validFrom: new Date(0) };
    },
  };
});

async function generateKeyPair(principalSub: string): Promise<CryptoKey> {
  const pair = (await webcrypto.subtle.generateKey(
    'Ed25519',
    true,
    ['sign', 'verify'],
  )) as webcrypto.CryptoKeyPair;
  keyStore.set(principalSub, { publicKey: pair.publicKey, privateKey: pair.privateKey });
  return pair.privateKey;
}

function makeSigner(privateKey: CryptoKey) {
  return async (currHash: CorpusHash): Promise<Signature> => {
    const hashBytes = Buffer.from(currHash, 'hex');
    const sig = await webcrypto.subtle.sign('Ed25519', privateKey, hashBytes);
    return Signature.parse(Buffer.from(sig).toString('base64url'));
  };
}

describe('Story 2.5 — Editorial log concurrency chaos tests (SC-6, SEC-6)', () => {
  // TC-2.5-CHAOS-1: Network partition between writers — divergent chains
  // detected, never silently merged. Two writers read the SAME stale tip
  // (simulating a partition where neither sees the other's write); both
  // attempt to chain off it. The composite PK + CAS guard must ensure only
  // one INSERT per seq persists — the chain never forks.
  it('TC-2.5-CHAOS-1: Network partition between writers — no persistent fork after heal', async () => {
    const pk = await generateKeyPair('op-chaos-a');
    const signer = makeSigner(pk);
    const partition = 'chaos-partition';
    const repo = makeRepo();

    // Bootstrap genesis + one entry so a real tip exists.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-chaos-a',
      event: 'auth.revoked',
      jti: 'jti-seed',
      payload: {},
      getSignature: signer,
    });
    const realTip = await repo.getTip(partition);

    // Both writers target seq = realTip.seq + 1, chained off the SAME stale tip
    // (the partition scenario: neither saw the other advance the chain).
    const targetSeq = realTip!.seq + 1;
    const entryA = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-chaos-a',
      event: 'auth.revoked',
      jti: 'jti-A',
      payload: { writer: 'A' },
      time: new Date().toISOString(),
      prevHash: realTip!.currHash,
      seq: targetSeq,
      getSignature: signer,
    });
    const entryB = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-chaos-a',
      event: 'auth.expired',
      jti: 'jti-B',
      payload: { writer: 'B' },
      time: new Date().toISOString(),
      prevHash: realTip!.currHash,
      seq: targetSeq,
      getSignature: signer,
    });

    // Race both inserts directly (bypassing retry) to force the duplicate-seq
    // collision the partition would cause.
    const outcomes = await Promise.all([repo.append(entryA), repo.append(entryB)]);
    const successes = outcomes.filter((o) => o.ok);

    // Exactly one seq slot wins — the PK rejects the fork.
    expect(successes.length).toBe(1);

    // After "heal": the chain has no fork — exactly one entry at targetSeq.
    const report = await repo.verifyChain(partition);
    expect(report.valid, JSON.stringify(report.failures.slice(0, 3))).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    const atTarget = entries.filter((e) => e.seq === targetSeq);
    expect(atTarget.length).toBe(1);
  }, 60_000);

  // TC-2.5-CHAOS-2: DB connection pool exhaustion — 20 concurrent writers
  // against a pool of 2. Writers must queue (not corrupt the chain) and
  // recover when connections free up.
  it('TC-2.5-CHAOS-2: DB connection pool exhaustion — no chain corruption', async () => {
    const pk = await generateKeyPair('op-chaos-pool');
    const signer = makeSigner(pk);
    const partition = 'chaos-pool';

    // A tiny pool forces real saturation/queueing.
    const smallPool = new Pool({ connectionString, max: 2 });
    const exhaustedExecutor: QueryExecutor = {
      async query(text: string, params?: readonly unknown[]) {
        const c = await smallPool.connect();
        try {
          const result = await c.query(text, params as unknown[]);
          return { rows: result.rows as readonly Record<string, unknown>[] };
        } finally {
          c.release();
        }
      },
    };
    const repo = createEditorialLogRepo({
      executor: exhaustedExecutor,
      keyLookup,
      now: () => new Date(),
    });

    const writerCount = 20;
    const results = await Promise.allSettled(
      Array.from({ length: writerCount }, (_, i) =>
        repo.appendToPartition({
          partitionKey: partition,
          principalSub: 'op-chaos-pool',
          event: 'auth.revoked',
          jti: `jti-pool-${i}`,
          payload: { w: i },
          getSignature: signer,
        }),
      ),
    );

    await smallPool.end();

    // Every writer either succeeded or failed with a typed EditorialError —
    // never a raw/unclassified error, never a corrupted chain.
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(EditorialError);
      }
    }

    // The committed entries form a valid, unbroken chain (no corruption).
    const verifyRepo = makeRepo();
    const report = await verifyRepo.verifyChain(partition);
    expect(report.valid, JSON.stringify(report.failures.slice(0, 3))).toBe(true);
    const entries = await verifyRepo.queryLog({ partitionKey: partition });
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i]!.seq).toBe(i);
    }
  }, 90_000);

  // TC-2.5-CHAOS-3: BullMQ broker restart → at-least-once redelivery. The
  // same logical operation (jti) is delivered twice against the real unique
  // index; the duplicate must be rejected and the chain must not corrupt.
  it('TC-2.5-CHAOS-3: Broker restart redelivery — CAS idempotency holds', async () => {
    const pk = await generateKeyPair('op-chaos-broker');
    const signer = makeSigner(pk);
    const partition = 'chaos-broker-restart';
    const jti = 'jti-redelivered';
    const repo = makeRepo();

    // First delivery succeeds.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-chaos-broker',
      event: 'auth.revoked',
      jti,
      payload: { delivery: 1 },
      getSignature: signer,
    });

    // Broker restart → same job redelivered (same jti). The unique index on
    // (partition_key, jti) rejects it as JTI_REPLAY — no duplicate entry.
    let redeliveryError: unknown;
    try {
      await repo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-chaos-broker',
        event: 'auth.expired',
        jti, // same jti!
        payload: { delivery: 2 },
        getSignature: signer,
      });
    } catch (err) {
      redeliveryError = err;
    }
    expect(redeliveryError).toBeInstanceOf(EditorialError);
    expect((redeliveryError as EditorialError).code).toBe('JTI_REPLAY');

    // Chain unbroken, exactly one entry for this jti, original payload preserved.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2); // genesis + 1
    expect(entries[1]!.jti).toBe(jti);
    expect(entries[1]!.payload).toEqual({ delivery: 1 });
  }, 60_000);

  // TC-2.5-CHAOS-4: Clock skew injection — one writer's `now()` is advanced
  // 5s. seq (not time) governs ordering; hashes are deterministic; the chain
  // verifies regardless of time-field skew.
  it('TC-2.5-CHAOS-4: Clock skew injection — seq ordering preserved', async () => {
    const pk = await generateKeyPair('op-chaos-clock');
    const signer = makeSigner(pk);
    const partition = 'chaos-clock-skew';

    const baseTime = new Date('2026-07-01T12:00:00.000Z');
    // Skewed clock: 5s ahead.
    const skewedRepo = createEditorialLogRepo({
      executor: makeExecutorForPool(),
      keyLookup,
      now: () => new Date(baseTime.getTime() + 5_000),
    });
    // Normal clock.
    const normalRepo = createEditorialLogRepo({
      executor: makeExecutorForPool(),
      keyLookup,
      now: () => baseTime,
    });

    // Skewed writer appends first, then the normal writer.
    await skewedRepo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-chaos-clock',
      event: 'auth.revoked',
      jti: 'jti-skewed',
      payload: { clock: 'skewed' },
      getSignature: signer,
    });
    await normalRepo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-chaos-clock',
      event: 'auth.expired',
      jti: 'jti-normal',
      payload: { clock: 'normal' },
      getSignature: signer,
    });

    // seq governs ordering: skewed (seq=1) before normal (seq=2), even though
    // the normal writer's time field is EARLIER.
    const report = await normalRepo.verifyChain(partition);
    expect(report.valid, JSON.stringify(report.failures.slice(0, 3))).toBe(true);
    const entries = await normalRepo.queryLog({ partitionKey: partition });
    expect(entries[1]!.seq).toBe(1);
    expect(entries[1]!.jti).toBe('jti-skewed');
    expect(entries[2]!.seq).toBe(2);
    expect(entries[2]!.jti).toBe('jti-normal');
    // The skewed entry's time is ahead of the normal entry's time, yet seq
    // kept them in append order — proving time is display-only.
    expect(entries[1]!.time > entries[2]!.time).toBe(true);
  }, 60_000);
});
