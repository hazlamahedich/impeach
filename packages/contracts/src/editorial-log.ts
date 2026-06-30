/**
 * Hash-chained editorial log contract types (SEC-6, AC-11).
 *
 * Defines the tamper-evident audit trail primitive: every editorial action
 * (auth events, intake transitions, editorial signoffs) is recorded as a
 * hash-chained, Ed25519-signed entry. Each entry's `curr_hash` is computed as
 * `SHA-256(prev_hash || JCS(canonical_payload))` (DoD-11). The chain is
 * partition-scoped with monotonic sequence numbers (AC-4).
 *
 * Branded nominal types prevent transposition of hash-chain fields
 * (project-context Winston #1, DoD-1). `CorpusHash` and `PrevHash` are
 * distinct branded types wrapping SHA-256 hex — the distinction prevents using
 * a previous-entry hash where a current-entry hash is expected.
 *
 * @rules AC-11, SEC-6, DoD-1, DoD-2, DoD-5, DoD-6, DoD-11, DoD-12, DoD-14
 * @adr ADR-0001
 * @term T-006
 */
import { z } from 'zod';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

// ─────────────────────────────────────────────────────────────────────────
// Branded Types (DoD-1)
// ─────────────────────────────────────────────────────────────────────────

/**
 * PrevHash — branded SHA-256 hex string for the previous entry's `curr_hash`.
 *
 * Distinct from `CorpusHash` so `prevHash = currHash` is a compile error
 * (DoD-1). Genesis entries use `GENESIS_PREV_HASH`.
 *
 * @rules SEC-6, DoD-1
 */
export const PrevHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'must be a 64-char hex SHA-256 hash')
  .brand('PrevHash');
export type PrevHash = z.infer<typeof PrevHash>;

/**
 * CorpusHash — branded SHA-256 hex string for the current entry's hash.
 *
 * Re-exported from citation.ts shape but branded under the editorial domain.
 * Distinct from `PrevHash` (DoD-1).
 *
 * @rules SEC-6, DoD-1, DoD-11
 */
export const CorpusHash = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'must be a 64-char hex SHA-256 hash')
  .brand('CorpusHash');
export type CorpusHash = z.infer<typeof CorpusHash>;

/**
 * Signature — branded base64url Ed25519 signature string.
 *
 * Allows empty string for genesis entries (signature = "" per AC-10). The
 * brand prevents transposition with other string fields (DoD-1).
 *
 * @rules SEC-6, DoD-1, DoD-12
 */
export const Signature = z
  .string()
  .regex(/^[A-Za-z0-9_-]*$/, 'must be base64url')
  .brand('Signature');
export type Signature = z.infer<typeof Signature>;

/**
 * Seq — branded BIGINT sequence number scoped to a partition.
 *
 * Monotonic per-partition (AC-4). Branding prevents transposition with other
 * numeric values.
 *
 * @rules SEC-6, AC-4, DoD-1
 */
export const Seq = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .brand('Seq');
export type Seq = z.infer<typeof Seq>;

/**
 * PartitionKey — branded text key scoping a hash chain partition.
 *
 * Typically the `intake_id` for intake events or `__system__` for system
 * events (AC-4). Branding prevents transposition with other string IDs.
 *
 * @rules SEC-6, AC-4, DoD-1
 */
export const PartitionKey = z.string().min(1).brand('PartitionKey');
export type PartitionKey = z.infer<typeof PartitionKey>;

// ─────────────────────────────────────────────────────────────────────────
// Genesis Hash (AC-1, TC-2.10)
// ─────────────────────────────────────────────────────────────────────────

/**
 * GENESIS_PREV_HASH — the `prev_hash` of the first entry in every partition.
 *
 * `SHA-256("IIP_EDITORIAL_LOG_GENESIS_v1")` — a well-known constant published
 * here and in the glossary so any verifier can recompute it (AC-1). Genesis
 * entries (seq=0) use this as their `prev_hash`.
 *
 * @rules AC-1, AC-10, DoD-11
 * @term T-006
 */
export const GENESIS_PREV_HASH: PrevHash = PrevHash.parse(
  createHash('sha256').update('IIP_EDITORIAL_LOG_GENESIS_v1').digest('hex'),
);

// ─────────────────────────────────────────────────────────────────────────
// Event Catalog (DoD-6, DoD-14) — z.discriminatedUnion('event', [...])
// ─────────────────────────────────────────────────────────────────────────

/**
 * Event name regex (AC-5): lowercase segments separated by dots, max 4
 * segments, max 128 chars.
 *
 * @rules AC-5, PC-1
 */
export const EVENT_NAME_REGEX = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,3}$/;

// ── Payload schemas per event variant (DoD-14, DoD-18: no PII) ──

const SystemGenesisPayload = z.object({}).strict();

const AuthRevokedPayload = z
  .object({ reason: z.string().min(1) })
  .strict();

const AuthExpiredPayload = z.object({}).strict();

const AuthInvalidSignaturePayload = z
  .object({ kid: z.string().min(1) })
  .strict();

const AuthMissingKidPayload = z.object({}).strict();

const AuthExpiredKeyPayload = z
  .object({ kid: z.string().min(1) })
  .strict();

const AuthInsufficientScopePayload = z
  .object({
    required: z.array(z.string().min(1)),
    actual: z.array(z.string().min(1)),
  })
  .strict();

const AuthReplayPayload = z
  .object({ jti: z.string().min(1) })
  .strict();

const IntakeApprovedPayload = z
  .object({
    intake_id: z.string().min(1),
    content_hash: z.string().min(1),
  })
  .strict();

const IntakeRejectedPayload = z
  .object({
    intake_id: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const IntakeBypassAttemptPayload = z
  .object({
    intake_id: z.string().min(1),
    current_state: z.string().min(1),
  })
  .strict();

const EditorialSignoffPayload = z
  .object({
    claim_id: z.string().min(1),
    citation_hash: z.string().min(1),
  })
  .strict();

const EditorialRevokeSignoffPayload = z
  .object({
    claim_id: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const SystemChainIntegrityFailurePayload = z
  .object({
    partition_key: z.string().min(1),
    failure_count: z.number().int().nonnegative(),
  })
  .strict();

/**
 * EditorialLogEvent — the complete event catalog as a discriminated union
 * (DoD-6). Each variant has a typed payload Zod schema. Adding a new event
 * type requires modifying this union and the event catalog documentation.
 *
 * @rules AC-5, DoD-6, DoD-14, DoD-18
 */
export const EditorialLogEvent = z.discriminatedUnion('event', [
  z.object({ event: z.literal('system.genesis'), payload: SystemGenesisPayload }),
  z.object({ event: z.literal('auth.revoked'), payload: AuthRevokedPayload }),
  z.object({ event: z.literal('auth.expired'), payload: AuthExpiredPayload }),
  z.object({ event: z.literal('auth.invalid_signature'), payload: AuthInvalidSignaturePayload }),
  z.object({ event: z.literal('auth.missing_kid'), payload: AuthMissingKidPayload }),
  z.object({ event: z.literal('auth.expired_key'), payload: AuthExpiredKeyPayload }),
  z.object({ event: z.literal('auth.insufficient_scope'), payload: AuthInsufficientScopePayload }),
  z.object({ event: z.literal('auth.replay'), payload: AuthReplayPayload }),
  z.object({ event: z.literal('intake.approved'), payload: IntakeApprovedPayload }),
  z.object({ event: z.literal('intake.rejected'), payload: IntakeRejectedPayload }),
  z.object({ event: z.literal('intake.bypass_attempt'), payload: IntakeBypassAttemptPayload }),
  z.object({ event: z.literal('editorial.signoff'), payload: EditorialSignoffPayload }),
  z.object({ event: z.literal('editorial.revoke_signoff'), payload: EditorialRevokeSignoffPayload }),
  z.object({
    event: z.literal('system.chain_integrity_failure'),
    payload: SystemChainIntegrityFailurePayload,
  }),
]);
export type EditorialLogEvent = z.infer<typeof EditorialLogEvent>;

// ─────────────────────────────────────────────────────────────────────────
// Canonical Payload & Log Entry (DoD-5, DoD-11)
// ─────────────────────────────────────────────────────────────────────────

/**
 * LogEntryCanonical — the shape that enters the JCS hash computation (DoD-5).
 *
 * `{seq, partition_key, principal_sub, event, jti, payload, time}` — sorted
 * keys, no `signature` or `curr_hash` (hash-then-sign: hash covers data,
 * signature covers hash).
 *
 * @rules AC-1, DoD-5, DoD-11
 */
export interface LogEntryCanonical {
  readonly seq: number;
  readonly partition_key: string;
  readonly principal_sub: string;
  readonly event: string;
  readonly jti: string;
  readonly payload: unknown;
  readonly time: string;
}

/**
 * LogEntry — the full editorial log row including hash-chain fields.
 *
 * This is the complete entry stored in `editorial_log` and returned by the
 * read path. No Zod `.default()` on `principal_sub`, `signature`, `curr_hash`,
 * `prev_hash`, `partition_key`, `jti` (DoD-3).
 *
 * @rules AC-1, AC-4, DoD-1, DoD-3, DoD-8
 */
export const LogEntry = z.object({
  seq: Seq,
  partition_key: PartitionKey,
  prev_hash: PrevHash,
  curr_hash: CorpusHash,
  principal_sub: z.string().min(1),
  signature: Signature,
  event: z.string().min(1).regex(EVENT_NAME_REGEX),
  jti: z.string().min(1),
  payload: z.unknown(),
  time: z
    .string()
    .min(1)
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
      'must be ISO 8601 UTC with Z suffix',
    ),
  witness_cursor: z.number().int().nullable().optional(),
});
export type LogEntry = z.infer<typeof LogEntry>;

// ─────────────────────────────────────────────────────────────────────────
// JCS Canonicalization (DoD-5, RFC 8785)
// ─────────────────────────────────────────────────────────────────────────

/**
 * JCS (JSON Canonicalization Scheme, RFC 8785) serialization.
 *
 * Produces a deterministic JSON representation by:
 * 1. Sorting object keys lexicographically by UTF-16 code unit value.
 * 2. Stripping all insignificant whitespace.
 * 3. Serializing numbers in minimal form (no exponential notation for
 *    representable values, no trailing zeros).
 *
 * For our constrained payload shapes (strings, integers, booleans, null,
 * arrays, nested objects) V8's number serialization matches RFC 8785 for all
 * practical domain values. The critical property is key sorting —
 * `JSON.stringify` is insertion-order-dependent and therefore non-deterministic
 * across independently constructed objects with the same fields.
 *
 * @returns a deterministic JSON string suitable for hashing
 *
 * @rules AC-1, DoD-5, DoD-11
 * @adr ADR-0001
 */
export function jcsCanonicalize(value: unknown): string {
  const result = canonicalize(value);
  if (result === undefined) {
    throw new Error('JCS: value cannot be canonicalized');
  }
  return result;
}


// ─────────────────────────────────────────────────────────────────────────
// Hash Computation (AC-1, DoD-11)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compute `curr_hash = SHA-256(prev_hash || JCS(canonical_payload))` (AC-1,
 * DoD-11).
 *
 * `prevHash` is hex-decoded to 32 bytes before concatenation. The JCS output
 * is UTF-8 encoded to bytes. The resulting SHA-256 is hex-encoded (lowercase,
 * 64 chars).
 *
 * @returns the branded `CorpusHash`
 *
 * @rules AC-1, DoD-11
 */
export function hashEntry(
  prevHash: PrevHash | string,
  canonicalPayload: LogEntryCanonical | string,
): CorpusHash {
  const prevStr = typeof prevHash === 'string' ? prevHash : (prevHash as unknown as string);
  if (!/^[a-f0-9]{64}$/.test(prevStr)) {
    throw new Error('hashEntry: prevHash must be 64-char lowercase hex SHA-256');
  }
  const prevBytes = Buffer.from(prevStr, 'hex');
  const payloadStr =
    typeof canonicalPayload === 'string'
      ? canonicalPayload
      : jcsCanonicalize(canonicalPayload);
  const payloadBytes = Buffer.from(payloadStr, 'utf8');
  const digest = createHash('sha256')
    .update(Buffer.concat([prevBytes, payloadBytes]))
    .digest('hex');
  return CorpusHash.parse(digest);
}

// ─────────────────────────────────────────────────────────────────────────
// makeEntry (DoD-2) — the sole entry construction gate
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parameters for {@link makeEntry}.
 *
 * `getSignature` is the ONLY injection point for signing — `makeEntry` never
 * accesses private keys (DoD-2). The server NEVER holds private keys; in
 * production the client signs the hash and transmits the signature with the
 * append request.
 *
 * @rules AC-2, DoD-2
 */
export interface MakeEntryParams {
  readonly partitionKey: PartitionKey | string;
  readonly principalSub: string;
  readonly event: EditorialLogEvent['event'];
  readonly jti: string;
  readonly payload: unknown;
  readonly time: string;
  readonly prevHash: PrevHash | string;
  readonly seq: number;
  readonly getSignature: (currHash: CorpusHash) => Promise<Signature>;
}

/**
 * Construct a fully-formed {@link LogEntry} (DoD-2).
 *
 * This is the SOLE sanctioned way to build a log entry. Direct object-literal
 * instantiation is banned (DoD-2). The function:
 * 1. Canonicalizes the payload via JCS.
 * 2. Computes `curr_hash = SHA-256(prev_hash || JCS(canonical_payload))`.
 * 3. Requests the Ed25519 signature via the `getSignature` callback.
 * 4. Returns a `LogEntry` with all fields populated.
 *
 * `makeEntry` never accesses private keys — it delegates signing to the
 * callback (AC-2, DoD-2).
 *
 * @rules AC-1, AC-2, DoD-2, DoD-11, DoD-12
 */
export async function makeEntry(params: MakeEntryParams): Promise<LogEntry> {
  const canonical: LogEntryCanonical = {
    seq: params.seq,
    partition_key: params.partitionKey,
    principal_sub: params.principalSub,
    event: params.event,
    jti: params.jti,
    payload: params.payload,
    time: params.time,
  };

  const currHash = hashEntry(params.prevHash, canonical);
  const signature = await params.getSignature(currHash);

  return {
    seq: Seq.parse(params.seq),
    partition_key: PartitionKey.parse(params.partitionKey),
    prev_hash: PrevHash.parse(params.prevHash),
    curr_hash: currHash,
    principal_sub: params.principalSub,
    signature,
    event: params.event,
    jti: params.jti,
    payload: params.payload,
    time: params.time,
  };
}

/**
 * Construct a genesis entry (seq=0) for a partition (AC-10).
 *
 * Genesis entries have `prev_hash = GENESIS_PREV_HASH`, `signature = ""`
 * (empty — genesis is unsigned), `principal_sub = "__genesis__"`, `jti =
 * "__genesis__"`, `event = "system.genesis"`, `payload = {}`.
 *
 * @rules AC-1, AC-10, DoD-11
 */
export function makeGenesisEntry(
  partitionKey: PartitionKey | string,
  time: string,
): LogEntry {
  const canonical: LogEntryCanonical = {
    seq: 0,
    partition_key: partitionKey,
    principal_sub: '__genesis__',
    event: 'system.genesis',
    jti: '__genesis__',
    payload: {},
    time,
  };
  const currHash = hashEntry(GENESIS_PREV_HASH, canonical);
  return {
    seq: Seq.parse(0),
    partition_key: PartitionKey.parse(partitionKey),
    prev_hash: GENESIS_PREV_HASH,
    curr_hash: currHash,
    principal_sub: '__genesis__',
    signature: Signature.parse(''),
    event: 'system.genesis',
    jti: '__genesis__',
    payload: {},
    time,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Query & Verification Types (DoD-15, AC-7, AC-9)
// ─────────────────────────────────────────────────────────────────────────

/**
 * LogQueryFilter — filter parameters for `queryLog` (AC-7, DoD-15).
 *
 * `partitionKey` is required; all other filters are optional.
 *
 * @rules AC-7, DoD-15
 */
export interface LogQueryFilter {
  readonly partitionKey: PartitionKey | string;
  readonly principalSub?: string;
  readonly event?: string;
  readonly timeRange?: { readonly after: Date; readonly before: Date };
  readonly seqRange?: { readonly from: number; readonly to: number };
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * ChainFailureType — the closed set of chain integrity failure kinds (AC-9).
 *
 * @rules AC-9
 */
export type ChainFailureType =
  | 'HASH_MISMATCH'
  | 'SIGNATURE_INVALID'
  | 'SEQUENCE_GAP'
  | 'MISSING_ENTRY';

/**
 * ChainFailure — a single chain integrity violation (AC-9).
 *
 * @rules AC-9
 */
export interface ChainFailure {
  readonly seq: number;
  readonly type: ChainFailureType;
  readonly expected?: string;
  readonly actual?: string;
  readonly detail: string;
}

/**
 * ChainWarningType — advisory (non-hard-failure) warnings (AC-11).
 *
 * @rules AC-11
 */
export type ChainWarningType = 'TRUNCATION_RISK_UNWITNESSED';

/**
 * ChainWarning — an advisory warning in the verification report (AC-11).
 *
 * @rules AC-11
 */
export interface ChainWarning {
  readonly type: ChainWarningType;
  readonly fromSeq: number;
  readonly toSeq: number;
  readonly detail: string;
}

/**
 * VerificationReport — result of `verifyChain` (AC-9).
 *
 * @rules AC-9, AC-11
 */
export interface VerificationReport {
  readonly partitionKey: string;
  readonly valid: boolean;
  readonly entriesVerified: number;
  readonly failures: ChainFailure[];
  readonly warnings: ChainWarning[];
  readonly verifiedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────
// Error Codes (AC-13, AC-14, AC-15)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Editorial log error codes (AC-13, AC-14, AC-15).
 *
 * @rules AC-13, AC-14, AC-15
 */
export type EditorialErrorCode =
  | 'CONCURRENT_APPEND_EXHAUSTED'
  | 'KEY_REGISTRY_UNAVAILABLE'
  | 'CHAIN_INTEGRITY_FAILURE'
  | 'JTI_REPLAY'
  | 'CHAIN_CONTINUITY_VIOLATION'
  | 'INVALID_ENTRY';

/**
 * EditorialError — closed set of editorial log failure variants.
 *
 * Mirrors `IntakeError` / `AppError` discipline (Winston #17).
 *
 * @rules AC-13, AC-14, AC-15
 */
export class EditorialError extends Error {
  override readonly name = 'EditorialError';
  constructor(
    message: string,
    readonly code: EditorialErrorCode,
  ) {
    super(message);
  }
}
