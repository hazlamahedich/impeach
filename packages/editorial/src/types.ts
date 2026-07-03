/**
 * Editorial log public types (SEC-6).
 *
 * Defines the repository interface and key-registry lookup contract consumed
 * by the API, workers, and tests. Implementation lives in
 * `./editorial-log-repo.js`.
 *
 * @rules SEC-6, AC-11, DoD-4, DoD-15
 * @adr ADR-0001
 * @term T-006
 */
import type {
  LogEntry,
  LogQueryFilter,
  VerificationReport,
  Seq,
  PartitionKey,
  CorpusHash,
  Signature,
  EditorialLogEvent,
  EditorialErrorCode,
} from '@iip/contracts';

/**
 * AppendSuccess — successful single-CAS append outcome (AC-12(a)).
 *
 * @rules SEC-6, AC-12, DoD-4
 */
export interface AppendSuccess {
  readonly ok: true;
  readonly seq: Seq;
}

/**
 * AppendFailure — single-CAS append failure outcome (AC-12(a)).
 *
 * `append()` is the low-level primitive: it returns a failure result instead
 * of throwing so callers handle CAS conflict explicitly (DoD-4, AC-12(a):
 * "returns a failure result (not throws — contract must be explicit)").
 *
 * @rules SEC-6, AC-12, DoD-4
 */
export interface AppendFailure {
  readonly ok: false;
  readonly code: EditorialErrorCode;
  readonly message: string;
}

/**
 * AppendOutcome — the result of `append(entry)` (AC-12(a)).
 *
 * Discriminated by `ok`. Callers MUST branch on `ok` before reading `seq`.
 *
 * @rules SEC-6, AC-12, DoD-4
 */
export type AppendOutcome = AppendSuccess | AppendFailure;

/**
 * AppendResult — result of `appendToPartition(params)` (AC-8).
 *
 * `appendToPartition` retries CAS conflicts internally and returns the
 * inserted `seq` on success; it throws `EditorialError` only on retry
 * exhaustion or unrecoverable failure (AC-3).
 *
 * @rules SEC-6, AC-8, DoD-4
 */
export type AppendResult = Seq;

/**
 * OperatorPublicKeyEntry — a resolved operator public key with validity window.
 *
 * Time-keyed lookup retrieves the correct public key for historical entries
 * after key rotation (AC-2).
 *
 * @rules AC-2, SEC-6
 */
export interface OperatorPublicKeyEntry {
  readonly publicKey: CryptoKey;
  readonly validFrom: Date;
  readonly validUntil?: Date;
}

/**
 * OperatorKeyLookup — resolves a principal's public key at a point in time.
 *
 * The implementer reads from `@iip/config → operatorKeys.getPublicKey(principal, atTime)`.
 * If the registry is unreachable, `get()` throws (AC-13: fail-closed, no
 * fallback to unsigned entries).
 *
 * @rules AC-2, AC-13, SEC-6
 */
export interface OperatorKeyLookup {
  getPublicKey(principalSub: string, atTime: Date): Promise<OperatorPublicKeyEntry | undefined>;
}

/**
 * QueryExecutor — the minimal database interface the repository needs.
 *
 * Accepts a parameterized query and returns rows. Implemented by `pg.Client`,
 * `pg.PoolClient`, or a test double. This abstraction keeps the repository
 * testable without coupling to a specific connection library.
 *
 * @rules SEC-6, DoD-4
 */
export interface QueryExecutor {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: readonly Record<string, unknown>[] }>;
  /**
   * Run a callback inside a single database transaction on one connection.
   *
   * When implemented (e.g. over a checked-out `PoolClient`), the callback
   * receives a transaction-scoped executor so multiple reads share one
   * snapshot. Used by `verifyChain` to obtain REPEATABLE READ isolation
   * (AC-6). Optional: when absent, reads run as individual autocommit
   * statements.
   *
   * @rules AC-6, SEC-6
   */
  transaction?<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T>;
}

/**
 * AppendParams — parameters for `appendToPartition` (CAS with retry).
 *
 * Includes the signing callback so the repository can rebuild entries on CAS
 * conflict (AC-8, DoD-13).
 *
 * @rules AC-1, AC-2, AC-8, DoD-2, DoD-13
 */
export interface AppendParams {
  readonly partitionKey: string;
  readonly principalSub: string;
  readonly event: EditorialLogEvent['event'];
  readonly jti: string;
  readonly payload: unknown;
  readonly getSignature: (currHash: CorpusHash) => Promise<Signature>;
}

/**
 * EditorialLogRepo — the write-only repository interface (DoD-4).
 *
 * Only `append`, `appendToPartition`, `getTip`, `queryLog`, and `verifyChain`
 * are exposed. No `update` or `delete` methods exist (DoD-4). The database
 * user for the editorial service has only `INSERT` and `SELECT` grants
 * (DoD-17).
 *
 * @rules SEC-6, AC-1, AC-7, AC-8, AC-9, DoD-4, DoD-13, DoD-15
 */
export interface EditorialLogRepo {
  /**
   * Single CAS insert attempt for a pre-built entry (DoD-4, AC-12(a)).
   *
   * Low-level primitive for internal use only. Returns an {@link AppendOutcome}
   * — a CAS conflict is reported as a failure result, NOT a throw, so callers
   * handle it explicitly. Direct calls from outside `packages/editorial` are
   * banned by ESLint (AC-12(c)).
   */
  append(entry: LogEntry): Promise<AppendOutcome>;
  /** CAS append with retry: re-reads tip, rebuilds entry, re-signs on conflict (AC-8, DoD-13). */
  appendToPartition(params: AppendParams): Promise<AppendResult>;
  getTip(partitionKey: PartitionKey | string): Promise<{ seq: Seq; currHash: CorpusHash } | null>;
  queryLog(filter: LogQueryFilter): Promise<LogEntry[]>;
  verifyChain(
    partitionKey: PartitionKey | string,
    fromSeq?: number,
    toSeq?: number,
  ): Promise<VerificationReport>;
}

/**
 * EditorialMetricSink — optional metrics hook (AC-3).
 *
 * When provided, the repository increments `editorial.append_exhausted` on
 * CAS retry exhaustion and `editorial.chain_integrity_failure` when
 * `verifyChain` detects corruption. Defaults to a no-op sink so production
 * wiring (@iip/config) can inject the real client without forcing tests to.
 *
 * @rules AC-3, SEC-6
 */
export interface EditorialMetricSink {
  increment(name: string, tags?: Readonly<Record<string, string>>): void;
}

/**
 * EditorialRepoConfig — injected dependencies for the repository.
 *
 * Dependencies are injected (not module-level) so Stryker can test every
 * branch in isolation (SEC-8, DoD-9). `now()` is injectable so temporal
 * constraints are deterministic under test. `random()` is injectable so the
 * CAS backoff jitter is seedable for deterministic concurrency tests (DoD-6).
 *
 * @rules SEC-6, SEC-8, DoD-6, DoD-9, AC-3
 */
export interface EditorialRepoConfig {
  readonly executor: QueryExecutor;
  readonly keyLookup: OperatorKeyLookup;
  readonly now: () => Date;
  /** Seedable RNG for CAS backoff jitter (DoD-6). Defaults to `Math.random`. */
  readonly random?: () => number;
  /** Optional metrics sink for exhaustion/integrity alerts (AC-3). */
  readonly metrics?: EditorialMetricSink;
}
