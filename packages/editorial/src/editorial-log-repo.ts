/**
 * Write-only hash-chained editorial log repository (SEC-6, AC-11).
 *
 * Implements CAS-based append with exponential backoff retry, genesis
 * auto-bootstrap, chain verification with signature checks, and the read path
 * (queryLog, getTip, verifyChain).
 *
 * The repository is write-only (DoD-4): only `append`, `getTip`, `queryLog`,
 * and `verifyChain` are exposed. No `update` or `delete` capabilities.
 *
 * @rules SEC-6, AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9, AC-10, AC-11,
 *        AC-13, AC-14, AC-15, AC-16, DoD-4, DoD-13, DoD-15
 * @adr ADR-0001
 * @term T-006
 */
import type { ClientBase } from 'pg';
import { webcrypto } from 'node:crypto';
import {
  EditorialError,
  GENESIS_PREV_HASH,
  hashEntry,
  LogEntry,
  makeEntry,
  makeGenesisEntry,
  PrevHash,
  Seq,
  PartitionKey,
  Signature,
  CorpusHash,
} from '@iip/contracts';
import type {
  LogEntryCanonical,
  LogQueryFilter,
  VerificationReport,
  ChainFailure,
  ChainWarning,
} from '@iip/contracts';
import type {
  AppendParams,
  AppendFailure,
  AppendOutcome,
  EditorialLogRepo,
  EditorialMetricSink,
  EditorialRepoConfig,
  QueryExecutor,
} from './types.js';

/**
 * CAS retry configuration (DoD-13, AC-8).
 *
 * Exponential backoff: 100ms base, 1.6x multiplier, max 5 retries, full jitter.
 */
const CAS_BASE_DELAY_MS = 100;
const CAS_BACKOFF_MULTIPLIER = 1.6;
const CAS_MAX_RETRIES = 5;

/**
 * Convert a `pg` Client/ClientBase/PoolClient to a QueryExecutor.
 *
 * @rules SEC-6
 */
function asExecutor(client: ClientBase): QueryExecutor {
  return {
    async query(text: string, params?: readonly unknown[]) {
      const result = await client.query(text, params as unknown[]);
      return { rows: result.rows as readonly Record<string, unknown>[] };
    },
  };
}

/**
 * Create the editorial log repository with injected dependencies (SEC-6).
 *
 * @param config — executor (DB connection), keyLookup (operator keys), now (clock)
 * @returns the write-only repository
 *
 * @rules SEC-6, DoD-4, DoD-9
 */
export function createEditorialLogRepo(config: EditorialRepoConfig): EditorialLogRepo {
  const { executor, keyLookup, now } = config;
  const random = config.random ?? Math.random;
  const metrics = config.metrics ?? NOOP_METRICS;

  /**
   * Append a pre-built log entry using a single CAS attempt (DoD-4, AC-12(a)).
   *
   * Low-level primitive for internal use only. Returns an {@link AppendOutcome}
   * — a failure is reported as a result, NOT a thrown error, so callers handle
   * CAS conflict explicitly. Callers needing automatic retry should use
   * `appendToPartition`.
   *
   * Genesis auto-bootstrap: if seq=1 and no seq=0 exists, insert a genesis
   * entry atomically first (AC-10).
   *
   * @rules AC-1, AC-10, AC-12, AC-16, DoD-4
   */
  async function append(entry: LogEntry): Promise<AppendOutcome> {
    // Validate the entry shape before any DB operation.
    LogEntry.parse(entry);

    // Reject non-positive sequence numbers before any DB operation.
    if (entry.seq <= 0) {
      return {
        ok: false,
        code: 'INVALID_ENTRY',
        message: `append rejected: seq must be > 0, got ${entry.seq}`,
      };
    }

    // Genesis auto-bootstrap: if this is seq=1 and no genesis exists, insert it.
    if (entry.seq === 1) {
      await bootstrapGenesisIfMissing(executor, entry.partition_key, entry.time);
    }

    // Enforce chain continuity against the current tip.
    const tip = await getTip(entry.partition_key);
    const continuity = checkContinuity(entry, tip);
    if (continuity !== null) {
      return continuity;
    }

    // CAS insert: only insert if no entry exists at (partition_key, seq).
    let result: { rows: readonly Record<string, unknown>[] };
    try {
      result = await executor.query(
        `INSERT INTO editorial_log
           (seq, partition_key, prev_hash, curr_hash, principal_sub, signature, event, jti, payload, time, witness_cursor)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         WHERE NOT EXISTS (
           SELECT 1 FROM editorial_log WHERE partition_key = $2 AND seq = $1
         )
         RETURNING seq`,
        [
          entry.seq,
          entry.partition_key,
          entry.prev_hash,
          entry.curr_hash,
          entry.principal_sub,
          entry.signature,
          entry.event,
          entry.jti,
          JSON.stringify(entry.payload),
          entry.time,
          null,
        ],
      );
    } catch (err) {
      // Defensive normalization: under real DB-level concurrency, a race between
      // the CAS guard and a unique index can surface as SQLSTATE 23505.
      const violation = classifyUniqueViolation(err);
      if (violation === 'jti') {
        return {
          ok: false,
          code: 'JTI_REPLAY',
          message: `jti replay at (partition_key=${entry.partition_key}, jti=${entry.jti})`,
        };
      }
      if (violation === 'seq') {
        return {
          ok: false,
          code: 'DUPLICATE_SEQUENCE',
          message: `CAS conflict at (partition_key=${entry.partition_key}, seq=${entry.seq})`,
        };
      }
      throw err;
    }

    if (result.rows.length > 0) {
      const insertedSeq = Number(result.rows[0]!['seq']);
      return { ok: true, seq: Seq.parse(insertedSeq) };
    }

    // 0-row CAS result: another writer inserted this seq first.
    return {
      ok: false,
      code: 'DUPLICATE_SEQUENCE',
      message: `CAS conflict at (partition_key=${entry.partition_key}, seq=${entry.seq})`,
    };
  }

  /**
   * Append with CAS retry: re-reads tip, rebuilds entry via `makeEntry`,
   * re-signs on each conflict (AC-8, DoD-13).
   *
   * The full retry loop:
   * 1. Read the tip (seq, curr_hash) for the partition.
   * 2. Compute next seq = tip.seq + 1 (or 1 if no tip), prev_hash = tip.curr_hash (or GENESIS).
   * 3. Bootstrap genesis if needed.
   * 4. Build entry via `makeEntry` with the signing callback.
   * 5. Attempt CAS insert.
   * 6. On conflict: exponential backoff, re-read tip, rebuild, retry.
   * 7. After max retries: throw `ConcurrentAppendExhaustedError`.
   *
   * @rules AC-1, AC-8, AC-10, DoD-2, DoD-13
   */
  async function appendToPartition(params: AppendParams): Promise<Seq> {
    let lastError: EditorialError | null = null;

    for (let attempt = 0; attempt <= CAS_MAX_RETRIES; attempt++) {
      // Step 1: read the current tip.
      let tip = await getTip(params.partitionKey);

      // Step 2: if partition is empty, bootstrap genesis and re-read tip.
      if (tip === null) {
        const genTime = now().toISOString();
        await bootstrapGenesisIfMissing(executor, params.partitionKey, genTime);
        tip = await getTip(params.partitionKey);
      }

      // Step 3: compute next seq and prev_hash from the (possibly new) tip.
      const seq = tip === null ? 1 : tip.seq + 1;
      const prevHash = tip === null ? GENESIS_PREV_HASH : tip.currHash;

      // Step 4: build the entry via makeEntry with the signing callback.
      // A callback failure propagates as SIGNING_CALLBACK_FAILED immediately —
      // no swallowing, no fallback to unsigned entries (AC-11, review finding).
      const timeStr = now().toISOString();
      let entry: LogEntry;
      try {
        entry = await makeEntry({
          partitionKey: params.partitionKey,
          principalSub: params.principalSub,
          event: params.event,
          jti: params.jti,
          payload: params.payload,
          time: timeStr,
          prevHash,
          seq,
          getSignature: params.getSignature,
        });
      } catch (err) {
        throw new EditorialError(
          `signing callback failed during append to partition ${params.partitionKey}: ${err instanceof Error ? err.message : 'unknown'}`,
          'SIGNING_CALLBACK_FAILED',
        );
      }

      // Step 5: CAS insert. Under READ COMMITTED, two writers can both miss the
      // WHERE NOT EXISTS sub-select and hit the composite PK as SQLSTATE 23505.
      // That must be caught here and treated as a CAS conflict (retry), not
      // allowed to escape as a raw pg error past the retry loop (review finding:
      // appendToPartition did not normalize 23505). A jti-unique violation is a
      // BullMQ replay and is NOT retryable.
      let result: { rows: readonly Record<string, unknown>[] };
      try {
        result = await executor.query(
          `INSERT INTO editorial_log
             (seq, partition_key, prev_hash, curr_hash, principal_sub, signature, event, jti, payload, time, witness_cursor)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
           WHERE NOT EXISTS (
             SELECT 1 FROM editorial_log WHERE partition_key = $2 AND seq = $1
           )
           RETURNING seq`,
          [
            entry.seq,
            entry.partition_key,
            entry.prev_hash,
            entry.curr_hash,
            entry.principal_sub,
            entry.signature,
            entry.event,
            entry.jti,
            JSON.stringify(entry.payload),
            entry.time,
            null,
          ],
        );
      } catch (err) {
        const violation = classifyUniqueViolation(err);
        if (violation === 'jti') {
          // BullMQ redelivery of the same logical operation — not retryable.
          throw new EditorialError(
            `jti replay at (partition_key=${params.partitionKey}, jti=${params.jti})`,
            'JTI_REPLAY',
          );
        }
        if (violation === 'seq') {
          // Composite-PK race — same as a 0-row CAS result: backoff and retry.
          result = { rows: [] };
        } else {
          throw err;
        }
      }

      if (result.rows.length > 0) {
        return Seq.parse(Number(result.rows[0]!['seq']));
      }

      // Step 6: CAS conflict — backoff and retry.
      lastError = new EditorialError(
        `CAS conflict at (partition_key=${params.partitionKey}, seq=${seq}), attempt ${attempt + 1}`,
        'CONCURRENT_APPEND_EXHAUSTED',
      );

      if (attempt < CAS_MAX_RETRIES) {
        await sleep(computeBackoffDelay(attempt, random));
      }
    }

    // Step 7: exhausted all retries — emit WARNING metric (AC-3) and throw so
    // BullMQ can re-enqueue with backoff. The job context is preserved on the
    // rejected promise.
    metrics.increment(METRIC_APPEND_EXHAUSTED, { partition_key: params.partitionKey });
    throw lastError;
  }

  /**
   * Get the latest (seq, curr_hash) for a partition (DoD-15).
   *
   * Returns null for empty partitions. Used by CAS callers to compute the
   * expected next seq and prev_hash.
   *
   * @rules AC-8, DoD-15
   */
  async function getTip(
    partitionKey: PartitionKey | string,
  ): Promise<{ seq: Seq; currHash: CorpusHash } | null> {
    const result = await executor.query(
      `SELECT seq, curr_hash FROM editorial_log
       WHERE partition_key = $1
       ORDER BY seq DESC
       LIMIT 1`,
      [partitionKey],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0]!;
    return {
      seq: Seq.parse(Number(row['seq'])),
      currHash: CorpusHash.parse(row['curr_hash'] as string),
    };
  }

  /**
   * Query the log with filters (AC-7, DoD-15).
   *
   * Supports filters by partition_key (required), principal_sub, event, time
   * range, and seq range. Results are ordered by seq ascending.
   *
   * @rules AC-7, DoD-15
   */
  async function queryLog(filter: LogQueryFilter): Promise<LogEntry[]> {
    const conditions: string[] = ['partition_key = $1'];
    const params: unknown[] = [filter.partitionKey];
    let paramIdx = 2;

    if (filter.principalSub !== undefined) {
      conditions.push(`principal_sub = $${paramIdx++}`);
      params.push(filter.principalSub);
    }
    if (filter.event !== undefined) {
      conditions.push(`event = $${paramIdx++}`);
      params.push(filter.event);
    }
    if (filter.timeRange !== undefined) {
      conditions.push(`time >= $${paramIdx++}`);
      params.push(filter.timeRange.after);
      conditions.push(`time <= $${paramIdx++}`);
      params.push(filter.timeRange.before);
    }
    if (filter.seqRange !== undefined) {
      conditions.push(`seq >= $${paramIdx++}`);
      params.push(filter.seqRange.from);
      conditions.push(`seq <= $${paramIdx++}`);
      params.push(filter.seqRange.to);
    }

    const limit = Math.min(Math.max(filter.limit ?? 100, 0), 1000);
    const offset = Math.max(filter.offset ?? 0, 0);
    params.push(limit, offset);

    const sql = `SELECT * FROM editorial_log WHERE ${conditions.join(' AND ')} ORDER BY seq ASC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;

    const result = await executor.query(sql, params);
    return result.rows.map(rowToLogEntry);
  }

  /**
   * Verify chain integrity for a partition (AC-9, AC-11, AC-14).
   *
   * Walks entries in seq order, recomputes each `curr_hash`, verifies
   * `prev_hash` linkage, verifies Ed25519 signatures, detects gaps/missing
   * entries, and checks witness_cursor for truncation risk.
   *
   * @rules AC-9, AC-11, AC-14
   */
  async function verifyChain(
    partitionKey: PartitionKey | string,
    fromSeq?: number,
    toSeq?: number,
  ): Promise<VerificationReport> {
    const conditions: string[] = ['partition_key = $1'];
    const params: unknown[] = [partitionKey];
    let paramIdx = 2;

    const failures: ChainFailure[] = [];
    const warnings: ChainWarning[] = [];

    if (fromSeq !== undefined && toSeq !== undefined && fromSeq > toSeq) {
      failures.push({
        seq: fromSeq,
        type: 'SEQUENCE_GAP',
        detail: `Invalid range: fromSeq (${fromSeq}) > toSeq (${toSeq})`,
      });
    }

    if (fromSeq !== undefined) {
      conditions.push(`seq >= $${paramIdx++}`);
      params.push(fromSeq);
    }
    if (toSeq !== undefined) {
      conditions.push(`seq <= $${paramIdx++}`);
      params.push(toSeq);
    }

    const entriesSql = `SELECT * FROM editorial_log WHERE ${conditions.join(' AND ')} ORDER BY seq ASC`;
    const witnessSql = `SELECT witness_cursor FROM editorial_log
         WHERE partition_key = $1 AND witness_cursor IS NOT NULL
         ORDER BY witness_cursor DESC LIMIT 1`;

    // AC-6: read a consistent snapshot. When the executor exposes a
    // transaction (single held connection), run both reads inside a
    // REPEATABLE READ transaction so a concurrent append cannot split the
    // snapshot between the entries SELECT and the witness SELECT. Otherwise
    // (autocommit-per-query executors) each statement is still individually
    // snapshot-consistent under PostgreSQL READ COMMITTED.
    let entries: LogEntry[];
    let witnessCursor: number | null = null;
    if (typeof executor.transaction === 'function') {
      [entries, witnessCursor] = await executor.transaction(async (tx) => {
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        const er = await tx.query(entriesSql, params);
        const entriesLocal = er.rows.map(rowToLogEntry);
        let wc: number | null = null;
        if (entriesLocal.length > 0) {
          const wr = await tx.query(witnessSql, [partitionKey]);
          if (wr.rows.length > 0) {
            wc = Number(wr.rows[0]!['witness_cursor']);
          }
        }
        return [entriesLocal, wc] as const;
      });
    } else {
      const result = await executor.query(entriesSql, params);
      entries = result.rows.map(rowToLogEntry);
      if (entries.length > 0) {
        const witnessResult = await executor.query(witnessSql, [partitionKey]);
        if (witnessResult.rows.length > 0) {
          witnessCursor = Number(witnessResult.rows[0]!['witness_cursor']);
        }
      }
    }

    let expectedSeq = fromSeq ?? 0;
    let prevHash: string | null = null;

    for (const entry of entries) {
      // Sequence gap detection (AC-9).
      if (entry.seq !== expectedSeq) {
        failures.push({
          seq: expectedSeq,
          type: 'SEQUENCE_GAP',
          detail: `Expected seq ${expectedSeq}, found ${entry.seq}`,
        });
        expectedSeq = entry.seq;
      }

      // Hash linkage verification (AC-9).
      const canonical: LogEntryCanonical = {
        seq: entry.seq,
        partition_key: entry.partition_key,
        principal_sub: entry.principal_sub,
        event: entry.event,
        jti: entry.jti,
        payload: entry.payload,
        time: entry.time,
      };
      const computedHash = hashEntry(entry.prev_hash, canonical);

      if (entry.curr_hash !== computedHash) {
        failures.push({
          seq: entry.seq,
          type: 'HASH_MISMATCH',
          expected: computedHash,
          actual: entry.curr_hash,
          detail: `Hash mismatch at seq ${entry.seq}`,
        });
      }

      // Prev hash linkage (cascade detection for tampered prev_hash).
      if (prevHash !== null && entry.prev_hash !== prevHash) {
        failures.push({
          seq: entry.seq,
          type: 'HASH_MISMATCH',
          expected: prevHash,
          actual: entry.prev_hash,
          detail: `prev_hash does not match prior entry's curr_hash at seq ${entry.seq}`,
        });
      }
      prevHash = entry.curr_hash;

      // Signature verification (AC-9, AC-2) — genesis is unsigned.
      if (entry.event !== 'system.genesis') {
        if (entry.signature === '') {
          failures.push({
            seq: entry.seq,
            type: 'SIGNATURE_INVALID',
            detail: `Non-genesis entry has empty signature at seq ${entry.seq}`,
          });
        } else {
          try {
            const keyEntry = await keyLookup.getPublicKey(
              entry.principal_sub,
              new Date(entry.time),
            );
            if (keyEntry === undefined) {
              failures.push({
                seq: entry.seq,
                type: 'SIGNATURE_INVALID',
                detail: `No public key found for principal ${entry.principal_sub} at ${entry.time}`,
              });
            } else {
              const entryTime = new Date(entry.time);
              if (
                keyEntry.validFrom > entryTime ||
                (keyEntry.validUntil !== undefined && keyEntry.validUntil < entryTime)
              ) {
                failures.push({
                  seq: entry.seq,
                  type: 'SIGNATURE_INVALID',
                  detail: `Public key for principal ${entry.principal_sub} is not valid at ${entry.time}`,
                });
              } else {
                const isValid = await verifyEd25519Signature(
                  keyEntry.publicKey,
                  entry.curr_hash,
                  entry.signature,
                );
                if (!isValid) {
                  failures.push({
                    seq: entry.seq,
                    type: 'SIGNATURE_INVALID',
                    detail: `Invalid Ed25519 signature at seq ${entry.seq}`,
                  });
                }
              }
            }
          } catch (err) {
            failures.push({
              seq: entry.seq,
              type: 'SIGNATURE_INVALID',
              detail: `Key registry error verifying signature at seq ${entry.seq}: ${err instanceof Error ? err.message : 'unknown'}`,
            });
          }
        }
      }

      expectedSeq++;
    }

    // Truncation detection (AC-11).
    if (witnessCursor !== null && entries.length > 0) {
      const lastSeq = entries[entries.length - 1]!.seq;
      if (lastSeq > witnessCursor) {
        warnings.push({
          type: 'TRUNCATION_RISK_UNWITNESSED',
          fromSeq: witnessCursor + 1,
          toSeq: lastSeq,
          detail: `Entries ${witnessCursor + 1}..${lastSeq} are beyond the last witnessed sequence`,
        });
      } else if (lastSeq < witnessCursor) {
        warnings.push({
          type: 'TRUNCATION_RISK_UNWITNESSED',
          fromSeq: lastSeq + 1,
          toSeq: witnessCursor,
          detail: `Entries ${lastSeq + 1}..${witnessCursor} appear to have been truncated (witness_cursor is ahead of chain tail)`,
        });
      }
    } else if (witnessCursor === null && entries.length > 1) {
      // No witnessing at all — all entries after genesis carry advisory risk.
      warnings.push({
        type: 'TRUNCATION_RISK_UNWITNESSED',
        fromSeq: 1,
        toSeq: entries[entries.length - 1]!.seq,
        detail: 'No witness_cursor set; unwitnessed tail entries could be truncated',
      });
    }

    const valid = failures.length === 0;

    // Chain corruption alert (AC-3, AC-14): increment the integrity-failure
    // metric so monitoring/alerting can fire. The forensic append of a
    // `system.chain_integrity_failure` event is handled by the audit worker.
    if (!valid) {
      metrics.increment(METRIC_CHAIN_INTEGRITY_FAILURE, { partition_key: String(partitionKey) });
    }

    return {
      partitionKey: partitionKey as string,
      valid,
      entriesVerified: entries.length,
      failures,
      warnings,
      verifiedAt: now(),
    };
  }

  return { append, appendToPartition, getTip, queryLog, verifyChain };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * No-op metric sink used when none is injected (AC-3).
 *
 * Production wiring (@iip/config) injects the real client; tests inject a
 * counter when they need to assert on increments.
 */
const NOOP_METRICS: EditorialMetricSink = { increment() {} };

/**
 * Metric names emitted by the repository (AC-3).
 */
const METRIC_APPEND_EXHAUSTED = 'editorial.append_exhausted';
const METRIC_CHAIN_INTEGRITY_FAILURE = 'editorial.chain_integrity_failure';

/**
 * Classify a PostgreSQL unique-constraint violation (SQLSTATE 23505) by the
 * constraint that fired (AC-3, AC-16).
 *
 * The composite PK `editorial_log_pk (partition_key, seq)` is a CAS conflict
 * (retryable). The unique index `editorial_log_partition_jti_uq
 * (partition_key, jti)` is a BullMQ replay (NOT retryable — re-enqueuing a
 * duplicate-jti job would loop forever). Discriminating these prevents
 * misclassifying a redelivery as contention (review finding: jti replay
 * conflated into CONCURRENT_APPEND_EXHAUSTED).
 *
 * @returns `'seq'` | `'jti'` | null (not a 23505)
 */
function classifyUniqueViolation(err: unknown): 'seq' | 'jti' | null {
  if (err === null || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  if (e['code'] !== '23505') return null;
  const constraint = e['constraint'];
  if (constraint === 'editorial_log_partition_jti_uq') return 'jti';
  // editorial_log_pk or any other 23505 on this table is a seq conflict.
  return 'seq';
}

/**
 * Verify that `entry` chains correctly off the current `tip` (AC-16, AC-12).
 *
 * Uses the STORED tip `curr_hash` rather than recomputing the genesis hash
 * from a guessed canonical form — the previous implementation recomputed the
 * genesis hash from `entry.time`, falsely rejecting any seq=1 entry whose
 * timestamp differed from genesis creation (review finding).
 *
 * @returns an {@link AppendFailure} if continuity is broken, else `null`.
 */
function checkContinuity(
  entry: LogEntry,
  tip: { seq: Seq; currHash: CorpusHash } | null,
): AppendFailure | null {
  if (tip === null) {
    return {
      ok: false,
      code: 'CHAIN_CONTINUITY_VIOLATION',
      message: `append rejected: seq/prev_hash does not continue the chain (tip=none, expected seq=1)`,
    };
  }
  const expectedSeq = tip.seq + 1;
  if (entry.seq !== expectedSeq) {
    return {
      ok: false,
      code: 'CHAIN_CONTINUITY_VIOLATION',
      message: `append rejected: seq/prev_hash does not continue the chain (tip=${tip.seq}, expected seq=${expectedSeq})`,
    };
  }
  if ((entry.prev_hash as unknown as string) !== (tip.currHash as unknown as string)) {
    return {
      ok: false,
      code: 'PREV_HASH_MISMATCH',
      message: `append rejected: prev_hash does not match tip curr_hash at seq ${entry.seq} (expected ${tip.currHash})`,
    };
  }
  return null;
}

/**
 * Bootstrap a genesis entry if seq=0 doesn't exist for the partition (AC-10).
 *
 * Called by `append` when seq=1 is being written. The genesis entry is
 * inserted atomically; if it already exists (race), the unique constraint
 * silently prevents duplication.
 *
 * @rules AC-1, AC-10, DoD-11
 */
async function bootstrapGenesisIfMissing(
  executor: QueryExecutor,
  partitionKey: string,
  time: string,
): Promise<void> {
  const genesis = makeGenesisEntry(partitionKey, time);
  await executor.query(
    `INSERT INTO editorial_log
       (seq, partition_key, prev_hash, curr_hash, principal_sub, signature, event, jti, payload, time, witness_cursor)
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
     WHERE NOT EXISTS (
       SELECT 1 FROM editorial_log WHERE partition_key = $2 AND seq = 0
     )
     ON CONFLICT DO NOTHING`,
    [
      genesis.seq,
      genesis.partition_key,
      genesis.prev_hash,
      genesis.curr_hash,
      genesis.principal_sub,
      genesis.signature,
      genesis.event,
      genesis.jti,
      JSON.stringify(genesis.payload),
      genesis.time,
      null,
    ],
  );
}

/**
 * Compute exponential backoff delay with full jitter (DoD-13).
 *
 * Base: 100ms, multiplier: 1.6x, full jitter: uniform random in [0, cap].
 *
 * @rules AC-8, DoD-13
 */
function computeBackoffDelay(attempt: number, random: () => number = Math.random): number {
  const cap = CAS_BASE_DELAY_MS * Math.pow(CAS_BACKOFF_MULTIPLIER, attempt);
  return random() * cap;
}

/**
 * Sleep for the specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify an Ed25519 signature over the raw 32 bytes of curr_hash (DoD-12).
 *
 * The signature covers `Buffer.from(currHash, 'hex')` (32 bytes), not the hex
 * string. The signature is stored as base64url.
 *
 * @rules AC-2, AC-9, DoD-12
 */
async function verifyEd25519Signature(
  publicKey: CryptoKey,
  currHash: string,
  signatureBase64: string,
): Promise<boolean> {
  const hashBytes = Buffer.from(currHash, 'hex');
  const sigBytes = Buffer.from(signatureBase64, 'base64url');
  return webcrypto.subtle.verify('Ed25519', publicKey, sigBytes, hashBytes);
}

/**
 * Convert a database row to a LogEntry.
 *
 * @rules SEC-6
 */
function rowToLogEntry(row: Record<string, unknown>): LogEntry {
  const rawTime = row['time'];
  const rawWitness = row['witness_cursor'];
  return {
    seq: Seq.parse(Number(row['seq'])),
    partition_key: PartitionKey.parse(row['partition_key'] as string),
    prev_hash: PrevHash.parse(row['prev_hash'] as string),
    curr_hash: CorpusHash.parse(row['curr_hash'] as string),
    principal_sub: row['principal_sub'] as string,
    signature: Signature.parse(row['signature'] as string),
    event: row['event'] as string,
    jti: row['jti'] as string,
    payload: row['payload'],
    time: rawTime instanceof Date
      ? (rawTime as Date).toISOString()
      : (rawTime as string),
    witness_cursor:
      rawWitness === null || rawWitness === undefined
        ? null
        : Seq.parse(Number(rawWitness)),
  };
}

/**
 * Re-export the executor adapter for convenience.
 *
 * @rules SEC-6
 */
export { asExecutor };
