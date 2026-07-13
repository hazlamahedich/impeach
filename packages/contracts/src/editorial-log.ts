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
import { SourceIdSchema, DocumentIdSchema, ContentChecksumSchema } from './ingest.js';

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

// ── Story 2.8 — PD-2 KPI Observation payloads (AR-25, G-6, DoD-18: no PII) ──
//
// The PD-2 cascade tracks external-audience engagement with the platform's
// citation-provenance mechanism across 30/60/90 day horizons. Each payload
// MUST be organizational/high-level — partner names are organization names
// (e.g. "PRESS_FORUM_X"), never individual humans (DoD-18: no PII).

/**
 * Day 30 (leading indicator) — an external-audience-segment partner ran
 * spot-verification on a self-sampled slice of IIP output (AR-25).
 *
 * @rules AR-25, G-6, DoD-18
 */
const ExternalVerificationObservedPayload = z
  .object({
    partner_name: z.string().min(1).max(128),
    corpus_hash: z.string().min(1).max(128).optional(),
    sample_size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    errors_found: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict()
  .refine((data) => data.errors_found <= data.sample_size, {
    message: 'errors_found cannot exceed sample_size',
    path: ['errors_found'],
  });

/**
 * Day 60 (mid indicator) — a partner published or shared a written rationale
 * that cites IIP's citation-provenance or auditability as a reason for use
 * (AR-25).
 *
 * @rules AR-25, G-6, DoD-18
 */
const ExternalEngagementRationalePayload = z
  .object({
    partner_name: z.string().min(1).max(128),
    rationale_summary: z.string().min(1).max(4096),
    provenance_cited: z.boolean(),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

/**
 * Day 90 (strongest indicator) — `question_donated` variant of the
 * `external.pd2.day90` discriminated union. A partner has donated their own
 * questions or source documents for IIP to process (AR-25).
 *
 * The XOR constraint between this and `ExternalPd2Day90PartnershipPayload` is
 * enforced structurally by the single discriminated-union event type: a
 * single `external.pd2.day90` event carries exactly one `outcome` value, so
 * emitting both variants for the same PD-2 instance is impossible.
 *
 * @rules AR-25, G-6, DoD-18
 */
const ExternalPd2Day90QuestionDonatedPayload = z
  .object({
    outcome: z.literal('question_donated'),
    partner_name: z.string().min(1).max(128),
    document_count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

/**
 * Day 90 (strongest indicator) — `partnership_committed` variant of the
 * `external.pd2.day90` discriminated union. A partner has committed to a
 * concrete next step: pilot access, formal partnership, or funding (AR-25).
 *
 * @rules AR-25, G-6, DoD-18
 */
const ExternalPd2Day90PartnershipPayload = z
  .object({
    outcome: z.literal('partnership_committed'),
    partner_name: z.string().min(1).max(128),
    commitment_type: z.enum(['pilot_access', 'partnership', 'funding_next_step']),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

/**
 * Day 90 (strongest indicator) — discriminated union keyed on `outcome`
 * (AR-25). This is the payload type for `external.pd2.day90`; the XOR between
 * question-donated and partnership-committed is structural (one outcome per
 * event), NOT behavioral.
 *
 * @rules AR-25, G-6, DoD-18
 */
export const ExternalPd2Day90Payload = z.discriminatedUnion('outcome', [
  ExternalPd2Day90QuestionDonatedPayload,
  ExternalPd2Day90PartnershipPayload,
]);
export type ExternalPd2Day90Payload = z.infer<typeof ExternalPd2Day90Payload>;

/**
 * Gate-bypass attempt — a serve-path component attempted to serve a response
 * without invoking `renderGateLive`, or ignored the gate result (VAL-9).
 *
 * `query` is captured for forensic triage; it MUST NOT carry PII (DoD-18).
 *
 * @rules VAL-9, SEC-5, AC-11, DoD-18
 */
const GateBypassAttemptPayload = z
  .object({
    query: z.string().min(1).max(4096),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

/**
 * Proceeding early-termination — when the impeachment proceeding concludes
 * before the PD-2 cascade completes, the KPI observation mechanism records
 * the KPI status at the inflection point (PD-2, AC-7).
 *
 * `kpi_status` is an opaque object summarising which cascade stages fired
 * before termination. It carries no PII.
 *
 * @rules PD-2, AC-7, DoD-18
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ProceedingEarlyTerminationPayload = z
  .object({
    proceeding_id: z.string().min(1).max(128),
    termination_date: z.string().min(1).max(32).regex(ISO_DATE_RE),
    kpi_status: z.record(z.string(), z.unknown()),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

// ── Story 2.11 — Audit circuit-breaker transition payloads (ADR-0029 §5) ──
//
// The serving-path audit health gate records its state-machine transitions to
// the editorial log so the audit trail can answer "when did the platform stop
// serving claims because audit-worker was unreachable, and when did it resume?"
// (AC-11, ADR-0029 §5). These are the mechanism events for OQ-29.6.

/**
 * Audit circuit-breaker opened — `audit-worker` is unreachable (or its fresh
 * health poll exceeded the 100ms budget), so the serving path is fail-closed
 * for claim-serving `/query` requests (ADR-0029 §5). Carries the triggering
 * reason and the poll latency for forensic triage.
 *
 * @rules ADR-0029 §5, SEC-5, AC-11
 */
const AuditCircuitBreakerOpenedPayload = z
  .object({
    reason: z.string().min(1).max(256),
    /** Latency of the triggering health poll in milliseconds (0 if the poll never completed). */
    poll_latency_ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

/**
 * Audit circuit-breaker closed — a fresh health poll succeeded in Half-Open
 * state, so the serving path resumes serving claims (ADR-0029 §5). Carries the
 * successful poll latency.
 *
 * @rules ADR-0029 §5, SEC-5, AC-11
 */
const AuditCircuitBreakerClosedPayload = z
  .object({
    /** Latency of the successful health poll in milliseconds. */
    poll_latency_ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    details: z.string().min(1).max(4096).optional(),
  })
  .strict();

// ── Story 3.2 — Source lawful-access manual override payload (FR-1.2, AC-11) ──
//
// When an operator overrides a lawful-access block, the override MUST be
// recorded in the hash-chained editorial log so the bypass is attributable
// (AC-11 personal-criminal-exposure defense). The payload names the source, the
// URL that was overridden, and the operator's non-empty rationale.

/**
 * Source lawful-access override — an operator bypassed an automated lawful-access
 * block (e.g. an FOI-grant permits crawling a ToS-forbidden source). The
 * rationale is REQUIRED + non-empty; the editorial-log append makes the bypass
 * attributable (AC-11).
 *
 * @rules FR-1.2, AC-4, AC-11
 */
const SourceAccessOverridePayload = z
  .object({
    source_id: SourceIdSchema,
    url: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

// ── Story 3.5 — Document registered payload (FR-1.5, AC-6, SEC-6) ──
//
// Every `registerDocument` call MUST produce an editorial log entry recording
// the provenance fields so the act of creating a document row is attributable
// (AC-6 personal-criminal-exposure defense). The payload names the documentId,
// the content_checksum (the dedupe anchor), and the source_id it was derived
// from.

/**
 * Document registered — a new per-artifact provenance record was created in the
 * `documents` table (FR-1.5). The editorial-log append makes the registration
 * attributable (AC-6, SEC-6). Carries the `documentId` + `contentChecksum` +
 * `sourceId` triple so the provenance chain is mechanically auditable.
 *
 * @rules FR-1.5, AC-6, SEC-6
 */
const DocumentRegisteredPayload = z
  .object({
    document_id: DocumentIdSchema,
    content_checksum: ContentChecksumSchema,
    source_id: SourceIdSchema,
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
  // Story 2.8 — PD-2 KPI Observation cascade (AR-25, G-6)
  z.object({
    event: z.literal('external.verification.observed'),
    payload: ExternalVerificationObservedPayload,
  }),
  z.object({
    event: z.literal('external.engagement.rationale'),
    payload: ExternalEngagementRationalePayload,
  }),
  z.object({
    event: z.literal('external.pd2.day90'),
    payload: ExternalPd2Day90Payload,
  }),
  z.object({
    event: z.literal('gate.bypass_attempt'),
    payload: GateBypassAttemptPayload,
  }),
  z.object({
    event: z.literal('proceeding.early_termination'),
    payload: ProceedingEarlyTerminationPayload,
  }),
  // Story 2.11 — audit circuit-breaker transitions (ADR-0029 §5, AC-11)
  z.object({
    event: z.literal('audit.circuit_breaker.opened'),
    payload: AuditCircuitBreakerOpenedPayload,
  }),
  z.object({
    event: z.literal('audit.circuit_breaker.closed'),
    payload: AuditCircuitBreakerClosedPayload,
  }),
  // Story 3.2 — source lawful-access manual override (FR-1.2, AC-4, AC-11)
  z.object({
    event: z.literal('source.access_override'),
    payload: SourceAccessOverridePayload,
  }),
  // Story 3.5 — document registration provenance (FR-1.5, AC-6, SEC-6)
  z.object({
    event: z.literal('document.registered'),
    payload: DocumentRegisteredPayload,
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
  | 'INVALID_ENTRY'
  | 'DUPLICATE_SEQUENCE'
  | 'PREV_HASH_MISMATCH'
  | 'SIGNING_CALLBACK_FAILED';

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
    super(`${message} [${code}]`);
    // Preserve the original message for exact-match assertions.
    this.originalMessage = message;
  }

  readonly originalMessage: string;
}
