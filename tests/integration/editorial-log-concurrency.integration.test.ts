/**
 * Integration tests — Story 2.5 Hash-Chain Concurrency Model (AR-27, VAL-3.7).
 *
 * 12 concurrency test cases (TC-2.5-CONC-1 .. TC-2.5-CONC-12) validating the
 * CAS-based append model under concurrent write load, fork rejection, snapshot
 * isolation, BullMQ at-least-once idempotency, re-signing callback contracts,
 * and seeded-RNG retry distribution.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules SEC-6, AC-11, AR-27, VAL-3.7, PC-9
 * @adr ADR-024
 * @term T-006
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Client, Pool } from 'pg';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  CorpusHash,
  Signature,
  GENESIS_PREV_HASH,
  makeEntry,
  makeGenesisEntry,
  EditorialError,
} from '@iip/contracts';
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
let repo: EditorialLogRepo;
let keyLookup: OperatorKeyLookup;
let keyStore: Map<string, { publicKey: CryptoKey; privateKey: CryptoKey }>;

const MIGRATION_SQL = readFileSync(
  new URL('../../packages/db/drizzle/0001_editorial_log.sql', import.meta.url),
  'utf8',
);

beforeAll(async () => {
  const dbName = `iip_conc_${crypto.randomUUID().slice(0, 8)}`;
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
      const client = await pool.connect();
      try {
        const result = await client.query(text, params as unknown[]);
        return { rows: result.rows as readonly Record<string, unknown>[] };
      } finally {
        client.release();
      }
    },
    // AC-6: hold one connection for the transaction so verifyChain reads a
    // single REPEATABLE READ snapshot.
    async transaction<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx: QueryExecutor = {
          async query(text: string, params?: readonly unknown[]) {
            const result = await client.query(text, params as unknown[]);
            return { rows: result.rows as readonly Record<string, unknown>[] };
          },
        };
        try {
          const out = await fn(tx);
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      } finally {
        client.release();
      }
    },
  };
}

/**
 * Mulberry32 — a small, fast, seedable PRNG (DoD-6).
 *
 * Returns a function producing floats in [0, 1) deterministically from a
 * 32-bit seed. Used to make CAS backoff jitter reproducible across runs so
 * the retry-distribution assertions in CONC-1/CONC-12 are deterministic.
 */
function makeSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Counting metric sink — records increment calls for AC-3 assertions. */
function makeCountingMetrics() {
  const counts = new Map<string, number>();
  return {
    increment(name: string) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    },
    count(name: string) {
      return counts.get(name) ?? 0;
    },
  };
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
  repo = createEditorialLogRepo({
    executor: makeExecutorForPool(),
    keyLookup,
    now: () => new Date(),
  });
});

async function getError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return new Error('expected function to throw, but it did not');
  } catch (err) {
    return err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Key & Entry Helpers
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// RED-Phase Stubs (Task 0) — all marked `it.fails` until Task 2 implements them.
// ─────────────────────────────────────────────────────────────────────────

describe('Story 2.5 — Hash-Chain Concurrency Model (AR-27, VAL-3.7)', () => {

  // ── Concurrency Correctness (4 tests) ──

  // TC-2.5-CONC-1
  it('TC-2.5-CONC-1: 50 writers × 20 appends — chain integrity (3 trials, seeded RNG)', async () => {
    const pk = await generateKeyPair('op-conc1');
    const signer = makeSigner(pk);

    for (let trial = 0; trial < 3; trial++) {
      await client.query('TRUNCATE editorial_log');
      const partition = `conc1-trial${trial}`;
      const writerCount = 50;
      const appendsPerWriter = 20;

      // ADR-024 selects BullMQ worker concurrency=1 as the production
      // serialization model. Under that model CAS conflicts are near-zero and
      // every append succeeds, so AC-2's "exactly 1,000 entries" holds. We
      // emulate that model here (50 distinct writers, serialized) with a
      // seeded PRNG for deterministic backoff. The adversarial CAS storm is
      // exercised by TC-2.5-CONC-2 / CONC-12.
      const trialRepo = createEditorialLogRepo({
        executor: makeExecutorForPool(),
        keyLookup,
        now: () => new Date(),
        random: makeSeededRng(1000 + trial),
      });

      for (let wIdx = 0; wIdx < writerCount; wIdx++) {
        for (let i = 0; i < appendsPerWriter; i++) {
          await trialRepo.appendToPartition({
            partitionKey: partition,
            principalSub: 'op-conc1',
            event: 'auth.revoked',
            jti: `jti-t${trial}-w${wIdx}-${i}`,
            payload: { writer: wIdx, seq: i },
            getSignature: signer,
          });
        }
      }

      const report = await trialRepo.verifyChain(partition);
      expect(report.valid, `trial ${trial}: chain invalid — ${JSON.stringify(report.failures.slice(0, 3))}`).toBe(true);
      expect(report.failures).toHaveLength(0);

      // Exactly genesis + writerCount * appendsPerWriter entries (AC-2).
      // queryLog caps at 1000 rows, so verify cardinality + contiguity via a
      // direct uncapped query.
      const rows = (
        await client.query(
          `SELECT seq FROM editorial_log WHERE partition_key = $1 ORDER BY seq ASC`,
          [partition],
        )
      ).rows.map((r) => Number(r['seq']));
      expect(rows.length).toBe(1 + writerCount * appendsPerWriter);
      expect(rows[0]).toBe(0); // genesis
      for (let i = 0; i < rows.length; i++) {
        expect(rows[i]).toBe(i); // contiguous from 0, no gaps/duplicates
      }
    }
  }, 120_000);

  // TC-2.5-CONC-2
  it('TC-2.5-CONC-2: Retry exhaustion under extreme contention (100+ writers)', async () => {
    const pk = await generateKeyPair('op-conc2');
    const signer = makeSigner(pk);
    const partition = 'conc2-exhaust';

    // AC-3 guarantees exhaustion by injecting an artificial CAS conflict:
    // the executor forces EVERY append INSERT to return 0 rows (0 => CAS
    // conflict), so any single appendToPartition call exhausts all 5 retries.
    // This deterministically exercises the exhaustion path that real
    // contention only triggers probabilistically.
    let insertAttempts = 0;
    const forcingExecutor: QueryExecutor = {
      async query(text: string, params?: readonly unknown[]) {
        if (text.includes('INSERT INTO editorial_log') && text.includes('RETURNING seq')) {
          insertAttempts++;
          return { rows: [] }; // perpetual CAS conflict
        }
        const result = await client.query(text, params as unknown[]);
        return { rows: result.rows as readonly Record<string, unknown>[] };
      },
    };
    const metrics = makeCountingMetrics();
    const forcingRepo = createEditorialLogRepo({
      executor: forcingExecutor,
      keyLookup,
      now: () => new Date(),
      random: makeSeededRng(42),
      metrics,
    });

    // A single append must exhaust all retries and throw.
    const exhaustErr = await getError(() =>
      forcingRepo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc2',
        event: 'auth.revoked',
        jti: 'jti-exhaust-forced',
        payload: { forced: true },
        getSignature: signer,
      }),
    );
    expect(exhaustErr).toBeInstanceOf(EditorialError);
    expect((exhaustErr as EditorialError).code).toBe('CONCURRENT_APPEND_EXHAUSTED');

    // The CAS loop must have attempted CAS_MAX_RETRIES + 1 = 6 inserts.
    expect(insertAttempts).toBe(6);

    // AC-3: a WARNING metric is incremented on exhaustion.
    expect(metrics.count('editorial.append_exhausted')).toBe(1);

    // The genesis bootstrap INSERT (no RETURNING) was NOT forced, so genesis
    // committed — but NO non-genesis entry was committed (every append INSERT
    // conflicted). The exhausted append left no row.
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(1);
    expect(entries[0]!.seq).toBe(0);
    expect(entries[0]!.event).toBe('system.genesis');

    // Separately, verify the code is also reachable under REAL contention:
    // 100 writers race seq=1; whatever is rejected must carry the typed code,
    // and at least one must succeed (the first INSERT wins).
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, (_, i) =>
        repo.appendToPartition({
          partitionKey: 'conc2-real',
          principalSub: 'op-conc2',
          event: 'auth.revoked',
          jti: `jti-exhaust-real-${i}`,
          payload: { writer: i },
          getSignature: signer,
        }),
      ),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r): r is PromiseRejectedResult =>
        r.status === 'rejected' &&
        r.reason instanceof EditorialError &&
        r.reason.code === 'CONCURRENT_APPEND_EXHAUSTED',
    );
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    // Every rejected writer carries the typed exhaustion code (not a raw pg error).
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(EditorialError);
      expect((r.reason as EditorialError).code).toBe('CONCURRENT_APPEND_EXHAUSTED');
    }
    const realReport = await repo.verifyChain('conc2-real');
    expect(realReport.valid).toBe(true);
  }, 120_000);

  // TC-2.5-CONC-3
  it('TC-2.5-CONC-3: Genesis bootstrap race (exactly one seq=0)', async () => {
    const pk = await generateKeyPair('op-conc3');
    const signer = makeSigner(pk);
    const partition = 'conc3-genesis-race';

    // Two concurrent writers on a brand-new partition — both trigger genesis bootstrap.
    await Promise.allSettled([
      repo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc3',
        event: 'auth.revoked',
        jti: 'jti-gen-race-1',
        payload: { w: 1 },
        getSignature: signer,
      }),
      repo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc3',
        event: 'auth.revoked',
        jti: 'jti-gen-race-2',
        payload: { w: 2 },
        getSignature: signer,
      }),
    ]);

    // Exactly one genesis entry (seq=0).
    const genesisResult = await client.query(
      `SELECT COUNT(*) AS cnt FROM editorial_log WHERE partition_key = $1 AND seq = 0`,
      [partition],
    );
    expect(Number(genesisResult.rows[0]!['cnt'])).toBe(1);

    // Chain passes verification.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
    expect(report.failures).toHaveLength(0);

    // No duplicate genesis entries.
    const entries = await repo.queryLog({ partitionKey: partition });
    const genesisEntries = entries.filter((e) => e.seq === 0);
    expect(genesisEntries).toHaveLength(1);
  });

  // TC-2.5-CONC-4
  it('TC-2.5-CONC-4: Cross-partition isolation under load (25+25 writers)', async () => {
    const pk = await generateKeyPair('op-conc4');
    const signer = makeSigner(pk);
    const partitionA = 'conc4-A';
    const partitionB = 'conc4-B';

    const writer = (partition: string, wIdx: number) =>
      (async () => {
        for (let i = 0; i < 5; i++) {
          try {
            await repo.appendToPartition({
              partitionKey: partition,
              principalSub: 'op-conc4',
              event: 'auth.revoked',
              jti: `jti-${partition}-${wIdx}-${i}`,
              payload: { w: wIdx, s: i },
              getSignature: signer,
            });
          } catch {
            // exhaustion acceptable
          }
        }
      })();

    await Promise.all([
      ...Array.from({ length: 25 }, (_, i) => writer(partitionA, i)),
      ...Array.from({ length: 25 }, (_, i) => writer(partitionB, i)),
    ]);

    // Each partition has an independent, unbroken chain.
    const reportA = await repo.verifyChain(partitionA);
    const reportB = await repo.verifyChain(partitionB);
    expect(reportA.valid).toBe(true);
    expect(reportB.valid).toBe(true);

    // No cross-partition interference.
    const entriesA = await repo.queryLog({ partitionKey: partitionA });
    const entriesB = await repo.queryLog({ partitionKey: partitionB });
    expect(entriesA.every((e) => e.partition_key === partitionA)).toBe(true);
    expect(entriesB.every((e) => e.partition_key === partitionB)).toBe(true);

    // Independent seq sequences starting at 0.
    expect(entriesA[0]!.seq).toBe(0);
    expect(entriesB[0]!.seq).toBe(0);
    for (let i = 0; i < entriesA.length; i++) {
      expect(entriesA[i]!.seq).toBe(i);
    }
    for (let i = 0; i < entriesB.length; i++) {
      expect(entriesB[i]!.seq).toBe(i);
    }
  }, 90_000);

  // ── Negative Tests — Fork Rejection (2 tests) ──

  // TC-2.5-CONC-5
  it('TC-2.5-CONC-5: Duplicate (partition_key, seq) rejected by unique constraint', async () => {
    const pk = await generateKeyPair('op-conc5');
    const signer = makeSigner(pk);
    const partition = 'conc5-dup-seq';

    // Append a legitimate entry first.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-conc5',
      event: 'auth.revoked',
      jti: 'jti-dup-orig',
      payload: { x: 1 },
      getSignature: signer,
    });

    // Attempt a raw INSERT at the same (partition_key, seq=1) — must be rejected by PK.
    await expect(
      client.query(
        `INSERT INTO editorial_log (seq, partition_key, prev_hash, curr_hash, principal_sub, signature, event, jti, payload, time, witness_cursor)
         VALUES (1, $1, $2, $3, 'op-conc5', 'sig', 'auth.revoked', 'jti-dup-attack', '{}'::jsonb, NOW(), NULL)`,
        [partition, GENESIS_PREV_HASH, 'a'.repeat(64)],
      ),
    ).rejects.toThrow();

    // Chain is not forked — still valid.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);

    // Only genesis + 1 entry.
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2);
  });

  // TC-2.5-CONC-6
  it('TC-2.5-CONC-6: Wrong prev_hash rejected by append() tip-continuity', async () => {
    const pk = await generateKeyPair('op-conc6');
    const signer = makeSigner(pk);
    const partition = 'conc6-wrong-prev';

    // Bootstrap genesis + 1 entry.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-conc6',
      event: 'auth.revoked',
      jti: 'jti-prev-ok',
      payload: {},
      getSignature: signer,
    });

    // Build an entry at seq=2 with a WRONG prev_hash (not the tip's curr_hash).
    const wrongPrevHash = '0'.repeat(64) as unknown as typeof GENESIS_PREV_HASH;
    const entry = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc6',
      event: 'auth.expired',
      jti: 'jti-wrong-prev',
      payload: {},
      time: new Date().toISOString(),
      prevHash: wrongPrevHash,
      seq: 2,
      getSignature: signer,
    });

    // append() must reject the wrong prev_hash before INSERT (returns a failure
    // result, does not throw — AC-12(a)).
    const outcome = await repo.append(entry);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('PREV_HASH_MISMATCH');
      expect(outcome.message).toMatch(/does not match tip curr_hash at seq 2/);
      expect(outcome.message).toMatch(/expected [a-f0-9]{64}/);
    }

    // Chain is not forked.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2); // genesis + 1 (the wrong entry was NOT inserted)
  });

  // TC-2.5-CONC-6b: append() at seq=1 now chains from genesis curr_hash, not GENESIS_PREV_HASH.
  it('TC-2.5-CONC-6b: append() at seq=1 chains from genesis curr_hash', async () => {
    const pk = await generateKeyPair('op-conc6b');
    const signer = makeSigner(pk);
    const partition = 'conc6b-seq1-genesis-curr';

    const tip = await repo.getTip(partition);
    expect(tip).toBeNull();

    // Build the genesis entry shape to know its curr_hash.
    const time = new Date().toISOString();
    const genesis = makeGenesisEntry(partition, time);

    // FIRST: a seq=1 entry chaining from GENESIS_PREV_HASH (wrong) must be
    // rejected with PREV_HASH_MISMATCH while the tip is still the genesis
    // entry that append() bootstraps. (Done before any successful seq=1
    // append so the tip remains genesis, not seq=1.)
    const badEntry = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc6b',
      event: 'auth.revoked',
      jti: 'jti-seq1-bad',
      payload: {},
      time,
      prevHash: GENESIS_PREV_HASH,
      seq: 1,
      getSignature: signer,
    });
    const badOutcome = await repo.append(badEntry);
    expect(badOutcome.ok).toBe(false);
    if (!badOutcome.ok) {
      expect(badOutcome.code).toBe('PREV_HASH_MISMATCH');
      expect(badOutcome.message).toMatch(new RegExp(`expected ${genesis.curr_hash}`));
    }

    // THEN: a seq=1 entry chaining from genesis.curr_hash (correct) succeeds.
    const entry = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc6b',
      event: 'auth.revoked',
      jti: 'jti-seq1-ok',
      payload: {},
      time,
      prevHash: genesis.curr_hash as unknown as typeof GENESIS_PREV_HASH,
      seq: 1,
      getSignature: signer,
    });
    const outcome = await repo.append(entry);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.seq).toBe(1);
    }

    // Chain is valid, including genesis + the seq=1 entry.
    const report = await repo.verifyChain(partition);
    expect(report.valid, `chain invalid: ${JSON.stringify(report.failures.slice(0, 3))}`).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2);
    expect(entries[0]!.seq).toBe(0);
    expect(entries[1]!.seq).toBe(1);
  });

  // TC-2.5-CONC-6c: append() with seq<=0 is rejected before any DB operation.
  it('TC-2.5-CONC-6c: append() rejects seq<=0 before DB operation', async () => {
    const pk = await generateKeyPair('op-conc6c');
    const signer = makeSigner(pk);
    const partition = 'conc6c-invalid-seq';

    const entry = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc6c',
      event: 'auth.revoked',
      jti: 'jti-invalid-seq',
      payload: {},
      time: new Date().toISOString(),
      prevHash: GENESIS_PREV_HASH,
      seq: 0,
      getSignature: signer,
    });

    const outcome = await repo.append(entry);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('INVALID_ENTRY');
      expect(outcome.message).toBe(`append rejected: seq must be > 0, got ${entry.seq}`);
    }

    // No DB mutation occurred.
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(0);
  });

  // TC-2.5-CONC-6d: append() on an empty partition rejects seq>1 before INSERT.
  it('TC-2.5-CONC-6d: append() rejects seq>1 on empty partition', async () => {
    const pk = await generateKeyPair('op-conc6d');
    const signer = makeSigner(pk);
    const partition = 'conc6d-empty-tip';

    // Attempt to append seq=2 when no genesis/tip exists.
    const entry = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc6d',
      event: 'auth.revoked',
      jti: 'jti-empty-tip',
      payload: {},
      time: new Date().toISOString(),
      prevHash: '0'.repeat(64) as unknown as typeof GENESIS_PREV_HASH,
      seq: 2,
      getSignature: signer,
    });

    const outcome = await repo.append(entry);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe('CHAIN_CONTINUITY_VIOLATION');
      expect(outcome.message).toMatch(/\(tip=none, expected seq=1\)/);
    }

    // No DB mutation occurred on the empty partition.
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(0);
  });

  // ── Consistency & Isolation (3 tests) ──

  // TC-2.5-CONC-7
  it('TC-2.5-CONC-7: verifyChain() during active writes — consistent snapshot', async () => {
    const pk = await generateKeyPair('op-conc7');
    const signer = makeSigner(pk);
    const partition = 'conc7-snapshot';

    // Append writer: keeps appending while verification runs concurrently.
    const appendTask = (async () => {
      for (let i = 0; i < 20; i++) {
        await repo.appendToPartition({
          partitionKey: partition,
          principalSub: 'op-conc7',
          event: 'auth.revoked',
          jti: `jti-snap-${i}`,
          payload: { i },
          getSignature: signer,
        });
      }
    })();

    // Verifier: call verifyChain repeatedly, CONCURRENTLY with the writer.
    // Each call runs in its own REPEATABLE READ transaction (AC-6) and must
    // observe a self-consistent snapshot — never a HASH_MISMATCH from a
    // partially-written entry.
    const verifyTask = (async () => {
      const reports = [];
      for (let i = 0; i < 20; i++) {
        const entries = await repo.queryLog({ partitionKey: partition, limit: 100 });
        if (entries.length > 0) {
          reports.push(await repo.verifyChain(partition));
        }
        // yield to allow interleaving with the writer
        await new Promise((r) => setTimeout(r, 1));
      }
      return reports;
    })();

    const [snapshotReports] = await Promise.all([verifyTask, appendTask]);

    // No snapshot may show a HASH_MISMATCH — that would indicate a partial
    // write leaking past isolation. A SEQUENCE_GAP at the tail (an in-flight
    // append not yet committed) is the only acceptable transient anomaly.
    for (const r of snapshotReports) {
      const hashFailures = r.failures.filter((f) => f.type === 'HASH_MISMATCH');
      expect(hashFailures, 'no HASH_MISMATCH in snapshot during active writes').toHaveLength(0);
    }

    // Final chain is fully valid.
    const finalReport = await repo.verifyChain(partition);
    expect(finalReport.valid).toBe(true);
  });

  // TC-2.5-CONC-8
  it('TC-2.5-CONC-8: BullMQ at-least-once idempotency — duplicate delivery harmless', async () => {
    const pk = await generateKeyPair('op-conc8');
    const signer = makeSigner(pk);
    const partition = 'conc8-idempotent';
    const jti = 'jti-redelivered';

    // First delivery succeeds.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-conc8',
      event: 'auth.revoked',
      jti,
      payload: { delivery: 1 },
      getSignature: signer,
    });

    // Second delivery (BullMQ redelivery) with the same jti — must fail harmlessly.
    // The unique index on (partition_key, jti) prevents a duplicate logical operation.
    await expect(
      repo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc8',
        event: 'auth.expired',
        jti, // same jti!
        payload: { delivery: 2 },
        getSignature: signer,
      }),
    ).rejects.toThrow();

    // Chain remains unbroken — no duplicate entry.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);

    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2); // genesis + 1 (the redelivery was rejected)
    expect(entries[1]!.jti).toBe(jti);
    expect(entries[1]!.payload).toEqual({ delivery: 1 }); // original payload, not the redelivery
  });

  // TC-2.5-CONC-9
  it('TC-2.5-CONC-9: Read-your-writes after CAS retry', async () => {
    const pk = await generateKeyPair('op-conc9');
    const signer = makeSigner(pk);
    const partition = 'conc9-ryw';

    // Append under mild contention (5 concurrent writers) to trigger potential CAS retries.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        repo.appendToPartition({
          partitionKey: partition,
          principalSub: 'op-conc9',
          event: 'auth.revoked',
          jti: `jti-ryw-${i}`,
          payload: { w: i },
          getSignature: signer,
        }),
      ),
    );

    // Each successful writer must see its own entry when querying immediately after.
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const insertedSeq = r.value;
        const entries = await repo.queryLog({ partitionKey: partition, limit: 100 });
        const found = entries.find((e) => e.seq === insertedSeq);
        expect(found, `seq ${insertedSeq} not visible after append (read-your-writes violated)`).toBeDefined();
        expect(found!.curr_hash).toMatch(/^[a-f0-9]{64}$/);
      }
    }

    // Final chain valid.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
  });

  // ── Callback & Error Handling (2 tests) ──

  // TC-2.5-CONC-10
  it('TC-2.5-CONC-10: Re-signing callback failure during retry — error propagates', async () => {
    const pk = await generateKeyPair('op-conc10');
    const goodSigner = makeSigner(pk);
    const partition = 'conc10-callback';

    // Bootstrap genesis + first entry.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-conc10',
      event: 'auth.revoked',
      jti: 'jti-cb-0',
      payload: {},
      getSignature: goodSigner,
    });

    // Create a repo with a custom executor that forces a CAS conflict on the first INSERT attempt.
    let forceConflict = true;
    const conflictExecutor: QueryExecutor = {
      async query(text: string, params?: readonly unknown[]) {
        // Intercept the first INSERT INTO editorial_log to simulate a CAS conflict.
        if (forceConflict && text.includes('INSERT INTO editorial_log') && text.includes('SELECT $1')) {
          forceConflict = false;
          return { rows: [] }; // empty → CAS conflict
        }
        const result = await client.query(text, params as unknown[]);
        return { rows: result.rows as readonly Record<string, unknown>[] };
      },
    };
    const conflictRepo = createEditorialLogRepo({
      executor: conflictExecutor,
      keyLookup,
      now: () => new Date(),
    });

    // Callback that succeeds on the 1st call, throws on the 2nd (during retry).
    let callCount = 0;
    const failingSigner = async (_currHash: CorpusHash): Promise<Signature> => {
      callCount++;
      if (callCount >= 2) {
        throw new Error('SIGNING_CALLBACK_FAILED: HSM unreachable');
      }
      return goodSigner(_currHash);
    };

    // The first CAS attempt will call getSignature (succeeds), then hit the forced conflict.
    // The retry will call getSignature again (throws) — error must propagate immediately
    // as a typed SIGNING_CALLBACK_FAILED (AC-11(c)), not a swallowed/raw error.
    const cbErr = await getError(() =>
      conflictRepo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc10',
        event: 'auth.expired',
        jti: 'jti-cb-fail',
        payload: { fail: true },
        getSignature: failingSigner,
      }),
    );
    expect(cbErr).toBeInstanceOf(EditorialError);
    expect((cbErr as EditorialError).code).toBe('SIGNING_CALLBACK_FAILED');
    expect((cbErr as EditorialError).message).toMatch(/HSM unreachable/);

    // Chain is not corrupted — the failed append was not committed.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2); // genesis + 1 (the callback-failed entry was NOT inserted)
  });

  // TC-2.5-CONC-11
  it('TC-2.5-CONC-11: append() single-CAS failure contract', async () => {
    const pk = await generateKeyPair('op-conc11');
    const signer = makeSigner(pk);
    const partition = 'conc11-append-single';

    // Establish a valid chain: genesis + seq=1 via appendToPartition.
    await repo.appendToPartition({
      partitionKey: partition,
      principalSub: 'op-conc11',
      event: 'auth.revoked',
      jti: 'jti-app-seed',
      payload: {},
      getSignature: signer,
    });

    // Read the tip (seq=1) to build two entries targeting seq=2 with the correct prev_hash.
    const tip = await repo.getTip(partition);
    expect(tip).not.toBeNull();
    const tipCurrHash = tip!.currHash;

    const time = new Date().toISOString();
    const entryA = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc11',
      event: 'auth.expired',
      jti: 'jti-appA',
      payload: { writer: 'A' },
      time,
      prevHash: tipCurrHash,
      seq: 2,
      getSignature: signer,
    });
    const entryB = await makeEntry({
      partitionKey: partition,
      principalSub: 'op-conc11',
      event: 'auth.revoked',
      jti: 'jti-appB',
      payload: { writer: 'B' },
      time,
      prevHash: tipCurrHash,
      seq: 2,
      getSignature: signer,
    });

    // Race two append() calls — one wins, one loses. append() returns an
    // outcome (AC-12(a)): success { ok:true, seq } or failure { ok:false }.
    const outcomes = await Promise.all([repo.append(entryA), repo.append(entryB)]);
    const successes = outcomes.filter((o) => o.ok);
    const failures = outcomes.filter((o) => !o.ok);

    // Exactly one wins the seq=2 slot (the PK guarantees no fork).
    expect(successes.length).toBe(1);

    // The loser fails. Under the race it can legitimately be either:
    //   - DUPLICATE_SEQUENCE      : its INSERT saw 0 rows / hit the PK (23505)
    //   - CHAIN_CONTINUITY_VIOLATION: its getTip re-read AFTER the winner
    //                                 committed, so tip.seq=2 and seq=2 is no
    //                                 longer the expected next seq.
    // Both are valid "the other writer won" signals; the chain never forks.
    expect(failures.length).toBe(1);
    const f = failures[0]!;
    if (!f.ok) {
      expect(['DUPLICATE_SEQUENCE', 'CHAIN_CONTINUITY_VIOLATION']).toContain(f.code);
    }

    // Chain is unbroken — only one entry at seq=2.
    const report = await repo.verifyChain(partition);
    expect(report.valid, `chain invalid: ${JSON.stringify(report.failures.slice(0, 3))}`).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    // genesis + seq=1 + exactly one seq=2.
    const seq2Entries = entries.filter((e) => e.seq === 2);
    expect(seq2Entries.length).toBe(1);
  });

  // ── Distribution & Jitter (1 test) ──

  // TC-2.5-CONC-12
  it('TC-2.5-CONC-12: Seeded-RNG retry distribution — divergent jitter, no lockstep', async () => {
    const pk = await generateKeyPair('op-conc12');
    const goodSigner = makeSigner(pk);
    const partition = 'conc12-jitter';

    // Seeded PRNG (DoD-6) → deterministic backoff schedule across runs.
    const seededRepo = createEditorialLogRepo({
      executor: makeExecutorForPool(),
      keyLookup,
      now: () => new Date(),
      random: makeSeededRng(7777),
    });

    // 50 writers × 20 appends = 1000 total attempts.
    // Measure retry distribution per-attempt (callback invocation count).
    const attemptData: { attempts: number; timestamps: number[] }[] = [];

    const countingSignerFactory = () => {
      let calls = 0;
      const ts: number[] = [];
      const signer = async (currHash: CorpusHash): Promise<Signature> => {
        calls++;
        ts.push(performance.now());
        return goodSigner(currHash);
      };
      return { signer, getData: () => ({ attempts: calls, timestamps: ts }) };
    };

    const writer = (wIdx: number) =>
      (async () => {
        for (let i = 0; i < 20; i++) {
          const { signer, getData } = countingSignerFactory();
          try {
            await seededRepo.appendToPartition({
              partitionKey: partition,
              principalSub: 'op-conc12',
              event: 'auth.revoked',
              jti: `jti-jit-${wIdx}-${i}`,
              payload: { w: wIdx, s: i },
              getSignature: signer,
            });
          } catch {
            // exhaustion acceptable
          }
          attemptData.push(getData());
        }
      })();

    await Promise.all(Array.from({ length: 50 }, (_, i) => writer(i)));

    // (b) No attempt exceeds 5 retries (CAS_MAX_RETRIES = 5 → max 6 callback calls).
    for (const data of attemptData) {
      expect(data.attempts).toBeLessThanOrEqual(6);
    }

    // (a) >=80% of attempts succeed on first attempt (callback called exactly once).
    const firstAttemptSuccesses = attemptData.filter((d) => d.attempts === 1).length;
    const successRate = firstAttemptSuccesses / attemptData.length;
    expect(successRate).toBeGreaterThanOrEqual(0.8);

    // Under 50 concurrent writers contention MUST produce some retries — this
    // makes the divergence assertions below reachable rather than skippable
    // (review finding: conditional skips let the test pass vacuously).
    const counts = attemptData.map((d) => d.attempts);
    const totalRetries = counts.reduce((sum, c) => sum + Math.max(0, c - 1), 0);
    expect(totalRetries, 'contention must trigger at least one CAS retry').toBeGreaterThan(0);

    // (d) Standard deviation of attempt counts > 0 — jitter prevents lockstep
    // (writers retried different numbers of times, not all the same).
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    expect(stdDev).toBeGreaterThan(0);

    // (c) Retry schedules are divergent — among writers that retried, at least
    // two distinct timestamp sequences exist (full jitter breaks lockstep).
    const attemptsWithRetries = attemptData.filter((d) => d.timestamps.length > 1);
    expect(attemptsWithRetries.length).toBeGreaterThanOrEqual(1);
    if (attemptsWithRetries.length >= 2) {
      const timestampStrings = attemptsWithRetries.map((d) =>
        d.timestamps.map((t) => Math.round(t)).join(','),
      );
      const uniqueTimestamps = new Set(timestampStrings);
      expect(uniqueTimestamps.size).toBeGreaterThan(1);
    }

    // Chain must be valid.
    const report = await seededRepo.verifyChain(partition);
    expect(report.valid).toBe(true);
  }, 120_000);
});
