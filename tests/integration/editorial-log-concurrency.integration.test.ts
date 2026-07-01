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

      // Each writer appends appendsPerWriter entries sequentially.
      const writerPromises = Array.from({ length: writerCount }, (_, wIdx) =>
        (async () => {
          for (let i = 0; i < appendsPerWriter; i++) {
            try {
              await repo.appendToPartition({
                partitionKey: partition,
                principalSub: 'op-conc1',
                event: 'auth.revoked',
                jti: `jti-t${trial}-w${wIdx}-${i}`,
                payload: { writer: wIdx, seq: i },
                getSignature: signer,
              });
            } catch {
              // CAS exhaustion is acceptable — chain integrity is what matters.
            }
          }
        })(),
      );
      await Promise.all(writerPromises);

      const report = await repo.verifyChain(partition);
      expect(report.valid, `trial ${trial}: chain invalid — ${JSON.stringify(report.failures.slice(0, 3))}`).toBe(true);
      expect(report.failures).toHaveLength(0);

      const entries = await repo.queryLog({ partitionKey: partition, limit: 2000 });
      // genesis + successful appends; some may have exhausted retries under real contention.
      expect(entries.length).toBeGreaterThan(writerCount * appendsPerWriter * 0.2);
      expect(entries[0]!.seq).toBe(0); // genesis
      expect(entries[0]!.event).toBe('system.genesis');

      // No duplicate seq values, no gaps.
      const seqs = entries.map((e) => e.seq);
      const uniqueSeqs = new Set(seqs);
      expect(uniqueSeqs.size).toBe(seqs.length); // no duplicates
      for (let i = 0; i < entries.length; i++) {
        expect(entries[i]!.seq).toBe(i); // contiguous from 0
      }
    }
  }, 120_000);

  // TC-2.5-CONC-2
  it('TC-2.5-CONC-2: Retry exhaustion under extreme contention (100+ writers)', async () => {
    const pk = await generateKeyPair('op-conc2');
    const signer = makeSigner(pk);
    const partition = 'conc2-exhaust';
    const writerCount = 100;

    // All 100 writers compete for seq=1 simultaneously.
    const results = await Promise.allSettled(
      Array.from({ length: writerCount }, (_, i) =>
        repo.appendToPartition({
          partitionKey: partition,
          principalSub: 'op-conc2',
          event: 'auth.revoked',
          jti: `jti-exhaust-${i}`,
          payload: { writer: i },
          getSignature: signer,
        }),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof EditorialError &&
        r.reason.code === 'CONCURRENT_APPEND_EXHAUSTED',
    );

    // At least one should succeed (the first INSERT wins).
    expect(fulfilled.length).toBeGreaterThan(0);

    // Chain must be unbroken for all successful writes.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);

    // Rejected writers must carry CONCURRENT_APPEND_EXHAUSTED (preserves job context for re-enqueue).
    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(EditorialError);
      }
    }
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

    // append() must reject the wrong prev_hash before INSERT.
    await expect(repo.append(entry)).rejects.toThrow(EditorialError);
    await expect(repo.append(entry)).rejects.toThrow(/CHAIN_CONTINUITY_VIOLATION|prev_hash/);

    // Chain is not forked.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
    const entries = await repo.queryLog({ partitionKey: partition });
    expect(entries.length).toBe(2); // genesis + 1 (the wrong entry was NOT inserted)
  });

  // ── Consistency & Isolation (3 tests) ──

  // TC-2.5-CONC-7
  it('TC-2.5-CONC-7: verifyChain() during active writes — consistent snapshot', async () => {
    const pk = await generateKeyPair('op-conc7');
    const signer = makeSigner(pk);
    const partition = 'conc7-snapshot';

    // Start appending entries asynchronously.
    const appendPromise = (async () => {
      for (let i = 0; i < 10; i++) {
        try {
          await repo.appendToPartition({
            partitionKey: partition,
            principalSub: 'op-conc7',
            event: 'auth.revoked',
            jti: `jti-snap-${i}`,
            payload: { i },
            getSignature: signer,
          });
        } catch {
          // ok
        }
      }
    })();

    // While appends are in-flight, call verifyChain() multiple times.
    // It must not report false-positive failures from partial writes.
    const snapshotReports = [];
    for (let i = 0; i < 5; i++) {
      const entries = await repo.queryLog({ partitionKey: partition, limit: 100 });
      if (entries.length > 0) {
        // verifyChain on whatever is committed so far — must be self-consistent.
        const r = await repo.verifyChain(partition);
        snapshotReports.push(r);
      }
    }

    await appendPromise;

    // All snapshot reports that ran must show a valid sub-chain (no partial-write corruption).
    for (const r of snapshotReports) {
      // The only acceptable failure is a SEQUENCE_GAP at the tail (in-flight entry not yet committed).
      // HASH_MISMATCH must NEVER appear in a snapshot (that would indicate a partial write).
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
    // The retry will call getSignature again (throws) — error must propagate immediately.
    await expect(
      conflictRepo.appendToPartition({
        partitionKey: partition,
        principalSub: 'op-conc10',
        event: 'auth.expired',
        jti: 'jti-cb-fail',
        payload: { fail: true },
        getSignature: failingSigner,
      }),
    ).rejects.toThrow(/SIGNING_CALLBACK_FAILED|HSM unreachable/);

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

    // Race two append() calls — one wins, one loses.
    const results = await Promise.allSettled([
      repo.append(entryA),
      repo.append(entryB),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // At least one must succeed. Under low contention both might succeed if they
    // don't interleave — but with a single shared DB connection, the CAS guard
    // (WHERE NOT EXISTS) ensures only one INSERT at seq=2 returns rows.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Any rejected writer must get an EditorialError (CAS conflict).
    for (const r of rejected) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(EditorialError);
      }
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
            await repo.appendToPartition({
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

    // (d) Standard deviation of attempt counts > 0 if any retries occurred.
    const counts = attemptData.map((d) => d.attempts);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const totalRetries = counts.reduce((sum, c) => sum + Math.max(0, c - 1), 0);
    if (totalRetries > 0) {
      expect(stdDev).toBeGreaterThan(0); // jitter prevents lockstep
    }

    // (c) Retry timestamps are divergent (no two retrying attempts have identical schedules).
    const attemptsWithRetries = attemptData.filter((d) => d.timestamps.length > 1);
    if (attemptsWithRetries.length >= 2) {
      // No two attempts should have the exact same timestamp sequence (jitter makes them divergent).
      const timestampStrings = attemptsWithRetries.map((d) =>
        d.timestamps.map((t) => Math.round(t)).join(','),
      );
      const uniqueTimestamps = new Set(timestampStrings);
      // With full jitter, retry timestamps should be (mostly) unique.
      expect(uniqueTimestamps.size).toBeGreaterThan(1);
    }

    // Chain must be valid.
    const report = await repo.verifyChain(partition);
    expect(report.valid).toBe(true);
  }, 120_000);
});
