/**
 * KpiLogger — typed PD-2 KPI observation logger (Story 2.8, AR-25, G-6).
 *
 * Exposes typed functions for appending PD-2 cascade events and gate forensic
 * events to the cryptographic {@link EditorialLogRepo} (AC-11). Every event
 * is constructed via the repository's `appendToPartition` primitive, which in
 * turn delegates to `makeEntry` — the SOLE sanctioned entry-construction gate
 * (DoD-2). Direct object-literal construction of `EditorialLogEvent` is
 * banned; a unit test (`kpi-logger.test.ts`) asserts that no public method
 * bypasses `appendToPartition`.
 *
 * Failure mode: if the signing callback throws, `appendToPartition` already
 * normalises the error to `EditorialError('SIGNING_CALLBACK_FAILED')`
 * (per `editorial-log-repo.ts`). `KpiLogger` does not catch and re-wrap — it
 * lets that normalisation propagate so callers receive the canonical closed
 * error variant (AC-11, Dev Notes: "Ed25519 signing failure must throw
 * EditorialError with code SIGNING_CALLBACK_FAILED — never return unsigned or
 * null").
 *
 * PII: payloads carry organizational partner names only (DoD-18). The
 * `GateBypassAttemptPayload.query` field is captured for forensic triage and
 * MUST NOT carry user PII — Task 7's automated PII scan enforces this at CI.
 *
 * @rules AR-25, G-6, AC-11, SEC-6, DoD-2, DoD-18, VAL-9, PD-2
 * @adr ADR-0001
 * @term T-006
 */
import type { EditorialLogRepo } from './types.js';
import type { CorpusHash, Signature } from '@iip/contracts';

/**
 * The system principal that owns PD-2 KPI events. KPI observation is a
 * platform-integrity concern, not an end-user action — the system principal
 * is the actor of record (AR-25).
 */
const KPI_PRINCIPAL_SUB = '__system_pd2__';

/**
 * The partition key scoping the PD-2 KPI hash chain. All PD-2 cascade events
 * share one partition so a single `verifyChain('__pd2__')` walk produces the
 * full audit trail for a post-proceeding audit (AR-25, AC-11).
 */
const KPI_PARTITION_KEY = '__pd2__';

/**
 * Signing callback — the ONLY injection point for Ed25519 signing (DoD-2).
 *
 * In production this is wired to the system operator key held by
 * `@iip/config`; in tests it is a deterministic stub. The callback receives
 * the computed `curr_hash` and returns the base64url signature.
 */
export type KpiSigner = (currHash: CorpusHash) => Promise<Signature>;

/**
 * Configuration for {@link createKpiLogger}.
 *
 * @rules AR-25, DoD-2
 */
export interface KpiLoggerConfig {
  /** The write-only editorial log repository (SEC-6, DoD-4). */
  readonly repo: EditorialLogRepo;
  /** Ed25519 signing callback (DoD-2 sole injection point). */
  readonly signer: KpiSigner;
  /** Injectable JTI generator for deterministic tests. */
  readonly jti?: () => string;
}

/**
 * Payload for the Day 30 `external.verification.observed` event (AR-25).
 */
export interface VerificationObservedInput {
  readonly partner_name: string;
  readonly corpus_hash?: string;
  readonly sample_size: number;
  readonly errors_found: number;
  readonly details?: string;
}

/**
 * Payload for the Day 60 `external.engagement.rationale` event (AR-25).
 */
export interface EngagementRationaleInput {
  readonly partner_name: string;
  readonly rationale_summary: string;
  readonly provenance_cited: boolean;
  readonly details?: string;
}

/**
 * Payload for the Day 90 `external.pd2.day90` event — question_donated variant.
 */
export interface Day90QuestionDonatedInput {
  readonly outcome: 'question_donated';
  readonly partner_name: string;
  readonly document_count: number;
  readonly details?: string;
}

/**
 * Payload for the Day 90 `external.pd2.day90` event — partnership_committed variant.
 */
export interface Day90PartnershipCommittedInput {
  readonly outcome: 'partnership_committed';
  readonly partner_name: string;
  readonly commitment_type: 'pilot_access' | 'partnership' | 'funding_next_step';
  readonly details?: string;
}

/** Day 90 input is the discriminated union of the two variants. */
export type Day90Input = Day90QuestionDonatedInput | Day90PartnershipCommittedInput;

/**
 * Payload for the `gate.bypass_attempt` forensic event (VAL-9, SEC-5).
 */
export interface GateBypassAttemptInput {
  readonly query: string;
  readonly details?: string;
}

/**
 * Payload for the `proceeding.early_termination` event (PD-2 time-bound).
 */
export interface ProceedingEarlyTerminationInput {
  readonly proceeding_id: string;
  readonly termination_date: string;
  readonly kpi_status: Readonly<Record<string, unknown>>;
  readonly details?: string;
}

/**
 * KpiLogger — typed PD-2 KPI observation surface (AR-25).
 *
 * Construct via {@link createKpiLogger}. Every method returns the inserted
 * partition sequence number (`Seq`) on success and throws `EditorialError` on
 * signing failure (`SIGNING_CALLBACK_FAILED`) or CAS exhaustion
 * (`CONCURRENT_APPEND_EXHAUSTED`).
 *
 * @rules AR-25, G-6, AC-11, DoD-2, DoD-18
 */
export interface KpiLogger {
  /** Append a Day 30 external-verification-observed event (AR-25). */
  logVerificationObserved(input: VerificationObservedInput): Promise<number>;
  /** Append a Day 60 external-engagement-rationale event (AR-25). */
  logEngagementRationale(input: EngagementRationaleInput): Promise<number>;
  /** Append a Day 90 external.pd2.day90 event (AR-25 — discriminated union). */
  logDay90(input: Day90Input): Promise<number>;
  /** Append a gate.bypass_attempt forensic event (VAL-9, SEC-5). */
  logGateBypassAttempt(input: GateBypassAttemptInput): Promise<number>;
  /** Append a proceeding.early_termination event (PD-2 time-bound). */
  logProceedingEarlyTermination(input: ProceedingEarlyTerminationInput): Promise<number>;
}

/**
 * Create a {@link KpiLogger} bound to a repository and signer (AR-25, DoD-2).
 *
 * @rules AR-25, G-6, AC-11, DoD-2, DoD-18
 */
export function createKpiLogger(config: KpiLoggerConfig): KpiLogger {
  const { repo, signer } = config;
  const jti = config.jti ?? (() => `pd2-${crypto.randomUUID()}`);

  /**
   * Internal funnel — every public method delegates here so there is exactly
   * ONE call site for `repo.appendToPartition`. This makes the DoD-2
   * "makeEntry is the sole construction gate" invariant mechanically
   * enforceable: a unit test asserts that no public method calls any other
   * repository primitive, and the only repository primitive touched is
   * `appendToPartition` (which itself calls `makeEntry`).
   */
  async function appendKpi(event: string, payload: unknown): Promise<number> {
    const seq = await repo.appendToPartition({
      partitionKey: KPI_PARTITION_KEY,
      principalSub: KPI_PRINCIPAL_SUB,
      event: event as Parameters<typeof repo.appendToPartition>[0]['event'],
      jti: jti(),
      payload,
      getSignature: signer,
    });
    // Seq is branded; tests read it as a number. The brand is phantom so the
    // cast is shape-preserving.
    return seq as unknown as number;
  }

  return {
    async logVerificationObserved(input) {
      return appendKpi('external.verification.observed', input);
    },
    async logEngagementRationale(input) {
      return appendKpi('external.engagement.rationale', input);
    },
    async logDay90(input) {
      return appendKpi('external.pd2.day90', input);
    },
    async logGateBypassAttempt(input) {
      return appendKpi('gate.bypass_attempt', input);
    },
    async logProceedingEarlyTermination(input) {
      return appendKpi('proceeding.early_termination', input);
    },
  };
}

// Re-export the partition key for tests / verifyChain consumers.
export const PD2_PARTITION_KEY = KPI_PARTITION_KEY;
