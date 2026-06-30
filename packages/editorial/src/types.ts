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
} from '@iip/contracts';

/**
 * AppendResult — result of `append(entry)` and `appendToPartition(params)`.
 *
 * Returns the inserted `seq`. If a CAS conflict occurs, callers receive the
 * conflict details so they can decide whether to retry.
 *
 * @rules SEC-6, DoD-4
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
  /** Single CAS insert attempt for a pre-built entry (DoD-4). Validates chain continuity. */
  append(entry: LogEntry): Promise<AppendResult>;
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
 * EditorialRepoConfig — injected dependencies for the repository.
 *
 * Dependencies are injected (not module-level) so Stryker can test every
 * branch in isolation (SEC-8, DoD-9). `now()` is injectable so temporal
 * constraints are deterministic under test.
 *
 * @rules SEC-6, SEC-8, DoD-9
 */
export interface EditorialRepoConfig {
  readonly executor: QueryExecutor;
  readonly keyLookup: OperatorKeyLookup;
  readonly now: () => Date;
}
