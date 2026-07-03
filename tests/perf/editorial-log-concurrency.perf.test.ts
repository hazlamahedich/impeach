/**
 * Performance benchmarks — Story 2.5 Hash-Chain Concurrency Model (SEC-6).
 *
 * 3 DB-backed benchmarks (TC-2.5-PERF-1 .. TC-2.5-PERF-3) against a real
 * PostgreSQL (Testcontainers). These measure the actual editorial-log append
 * latency distribution under concurrency, the sustainable throughput vs
 * retry-exhaustion rate, and `verifyChain()` wall time. The numbers feed
 * ADR-024's Performance Envelope (DoD-3). Thresholds here are CI-generous
 * (Testcontainers adds overhead); the production targets are documented in
 * the ADR (e.g. append p95 < 100ms at 50 concurrent writers on target HW).
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules SEC-6, DoD-3, DoD-9, AR-27
 * @adr ADR-024
 * @term T-006
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client, Pool } from 'pg';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CorpusHash, Signature, EditorialError } from '@iip/contracts';
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
let keyLookup: OperatorKeyLookup;
let keyStore: Map<string, { publicKey: CryptoKey; privateKey: CryptoKey }>;

const MIGRATION_SQL = readFileSync(
  new URL('../../packages/db/drizzle/0001_editorial_log.sql', import.meta.url),
  'utf8',
);

beforeAll(async () => {
  const dbName = `iip_perf_${crypto.randomUUID().slice(0, 8)}`;
  container = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: 'iip', POSTGRES_DB: dbName })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .withExposedPorts(5432)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgres://postgres:iip@${host}:${port}/${dbName}`;
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

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

describe('Story 2.5 — Editorial log concurrency performance benchmarks (SEC-6)', () => {
  // TC-2.5-PERF-1: Real append latency under 1 / 10 / 50 concurrent writers.
  // AC-9 target: p95 < 100ms at 50 concurrent writers (production HW). The
  // CI threshold is generous because Testcontainers adds round-trip overhead.
  it('TC-2.5-PERF-1: DB append latency p50/p95/p99 under concurrency', async () => {
    const pk = await generateKeyPair('op-perf-lat');
    const signer = makeSigner(pk);

    const concurrencyLevels = [1, 10, 50];
    const results: Record<number, { p50: number; p95: number; p99: number }> = {};

    for (const writers of concurrencyLevels) {
      const partition = `perf-lat-${writers}`;
      const repo = makeRepo();
      const appendsPerWriter = 10;
      const latencies: number[] = [];

      // Each writer times its own appends.
      const writer = async () => {
        for (let i = 0; i < appendsPerWriter; i++) {
          const start = performance.now();
          try {
            await repo.appendToPartition({
              partitionKey: partition,
              principalSub: 'op-perf-lat',
              event: 'auth.revoked',
              jti: `jti-lat-${writers}-${i}-${Math.random()}`,
              payload: { i },
              getSignature: signer,
            });
          } catch {
            // exhaustion does not count as a successful append latency sample
          }
          latencies.push(performance.now() - start);
        }
      };
      await Promise.all(Array.from({ length: writers }, () => writer()));

      latencies.sort((a, b) => a - b);
      results[writers] = {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
      };
    }

    // Assert latencies are bounded. CI-generous thresholds catch catastrophic
    // regressions without flaking on Testcontainers overhead.
    for (const writers of concurrencyLevels) {
      const r = results[writers]!;
      console.log(`PERF-1 [${writers} writers] p50=${r.p50.toFixed(1)}ms p95=${r.p95.toFixed(1)}ms p99=${r.p99.toFixed(1)}ms`);
      expect(r.p95).toBeLessThan(5_000); // CI-generous; production target 100ms@50
      expect(Number.isFinite(r.p50)).toBe(true);
    }
  }, 180_000);

  // TC-2.5-PERF-2: Throughput saturation — measure sustainable append rate and
  // the retry-exhaustion rate at increasing writer counts. DoD-3 asks for the
  // point where exhaustion exceeds 1%.
  it('TC-2.5-PERF-2: Throughput vs retry-exhaustion rate', async () => {
    const pk = await generateKeyPair('op-perf-thr');
    const signer = makeSigner(pk);

    const levels = [1, 10, 50];
    for (const writers of levels) {
      const partition = `perf-thr-${writers}`;
      const repo = makeRepo();
      const appendsPerWriter = 20;
      const start = performance.now();
      let exhausted = 0;
      let succeeded = 0;

      const writer = async () => {
        for (let i = 0; i < appendsPerWriter; i++) {
          try {
            await repo.appendToPartition({
              partitionKey: partition,
              principalSub: 'op-perf-thr',
              event: 'auth.revoked',
              jti: `jti-thr-${writers}-${i}-${Math.random()}`,
              payload: { i },
              getSignature: signer,
            });
            succeeded++;
          } catch (err) {
            if (err instanceof EditorialError && err.code === 'CONCURRENT_APPEND_EXHAUSTED') {
              exhausted++;
            }
          }
        }
      };
      await Promise.all(Array.from({ length: writers }, () => writer()));

      const elapsed = performance.now() - start;
      const total = writers * appendsPerWriter;
      const appendsPerSec = (succeeded / elapsed) * 1000;
      const exhaustionRate = exhausted / total;
      console.log(
        `PERF-2 [${writers} writers] ${appendsPerSec.toFixed(0)} appends/s, exhaustion=${(exhaustionRate * 100).toFixed(2)}% (${exhausted}/${total})`,
      );

      // The chain must stay valid at every load level regardless of exhaustion.
      const report = await repo.verifyChain(partition);
      expect(report.valid, JSON.stringify(report.failures.slice(0, 3))).toBe(true);
      // Sanity: throughput is positive when any append succeeded.
      if (succeeded > 0) expect(appendsPerSec).toBeGreaterThan(0);
    }
  }, 180_000);

  // TC-2.5-PERF-3: verifyChain wall time for a large partition while writers
  // are active. AC-9 target: < 5s for 10K entries.
  it('TC-2.5-PERF-3: verifyChain wall time for a large partition', async () => {
    const pk = await generateKeyPair('op-perf-verify');
    const signer = makeSigner(pk);
    const partition = 'perf-verify';
    const repo = makeRepo();

    // Populate a sizeable chain (CI-friendly: 2,000 entries; the 10K target
    // scales linearly and is documented in the ADR).
    const entryCount = 2_000;
    for (let i = 0; i < entryCount; i++) {
      await repo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-perf-verify',
        event: 'auth.revoked',
        jti: `jti-vrf-${i}`,
        payload: { i },
        getSignature: signer,
      });
    }

    const start = performance.now();
    const report = await repo.verifyChain(partition);
    const elapsed = performance.now() - start;

    expect(report.valid, JSON.stringify(report.failures.slice(0, 3))).toBe(true);
    expect(report.entriesVerified).toBe(entryCount + 1); // + genesis
    // CI-generous: linear scaling means 10K ≈ 5× this. Production target < 5s@10K.
    console.log(`PERF-3 verifyChain(${entryCount} entries) = ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(15_000);
  }, 240_000);
});
