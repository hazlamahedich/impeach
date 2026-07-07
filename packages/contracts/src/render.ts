import { z } from 'zod';
import { CitationRef } from './citation.js';
import type { CitationTuple } from './citation.js';

/**
 * RenderSpan — a single unit of rendered output.
 *
 * A claim-bearing clause. Either carries a citation (served) or
 * does not (must be stripped by the render gate).
 *
 * @rules AC-2, EI-1, EI-7
 * @adr ADR-001
 */
export const RenderSpan = z.object({
  text: z.string().min(1),
  is_claim: z.boolean(),
  claim_type: z.union([
    z.literal('fact'),
    z.literal('attributed'),
  ]).optional(),
  citation: CitationRef.nullable(),
});

export type RenderSpan = z.infer<typeof RenderSpan>;

/**
 * RenderDocument — the sealed typed AST output of the render pipeline.
 *
 * NEVER a raw string. The only sanctioned serializer lives in
 * packages/render/src/serialize.ts (Winston #4).
 *
 * @rules AC-2, SEC-5
 * @adr ADR-001
 */
export const RenderDocument = z.object({
  spans: z.array(RenderSpan),
  no_evidence: z.boolean().default(false),
  essence_sentence: z.string().optional(),
});

export type RenderDocument = z.infer<typeof RenderDocument>;

/**
 * RenderInput — the shared symbol between rag and render.
 *
 * This is the ONLY type that crosses the rag→render boundary (SC-3).
 *
 * @rules SC-3, STR-4
 */
export const RenderInput = z.object({
  query: z.string(),
  answer_text: z.string(),
  spans: z.array(z.object({
    text: z.string(),
    is_claim: z.boolean(),
    claim_type: z.union([
      z.literal('fact'),
      z.literal('attributed'),
    ]).optional(),
    citation_ref: CitationRef.nullable(),
  })),
});

export type RenderInput = z.infer<typeof RenderInput>;

/**
 * RenderViolation — error thrown when the render gate detects
 * an uncited claim-bearing clause.
 *
 * @rules AC-2, SEC-5
 */
export class RenderViolation extends Error {
  override readonly name = 'RenderViolation';
  constructor(
    message: string,
    readonly span_text: string,
  ) {
    super(message);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Live render gate types (Story 2.1 — AC-2 / SEC-5 / EI-1 / EI-8 / SEC-3).
//
// The live gate is ASYNC and dependency-injected so `packages/render` imports
// ONLY `@iip/contracts` (SC-3): source-document resolution, citation-hash
// verification, and NLI entailment are all injected via {@link GateContext}.
// The serve-worker wires the real implementations; the gate stays pure and
// unit-testable without a database.
//
// @rules AC-2, SEC-5, EI-1, EI-8, SEC-3, SC-3
// @adr ADR-001, ADR-010
// ───────────────────────────────────────────────────────────────────────────

/**
 * Snapshot of a source document as resolved for the render gate.
 *
 * The `SourceResolver` implementation (injected by the serve-worker) owns data
 * freshness: it is responsible for returning up-to-date metadata
 * (`superseded_at`, `takedown_trigger`, `retention_policy`). The gate trusts
 * the resolver's snapshot; it does not independently verify freshness.
 *
 * @rules AC-4, EI-1
 */
export interface SourceDocSnapshot {
  readonly id: string;
  readonly text: string;
  readonly trust_tier: 1 | 2 | 3;
  /** ISO-8601 UTC; `null` = live (not superseded). */
  readonly superseded_at: string | null;
  readonly takedown_trigger: boolean;
  /** e.g. `defamation_grade_permanent` — lands concretely in Story 2.6. */
  readonly retention_policy: string;
}

/**
 * Resolves a source-document UUID to a {@link SourceDocSnapshot}, or `null`
 * when the document does not exist / is inaccessible. Returning `null` is
 * fail-closed: the gate strips the citing span and logs `source_not_found`.
 *
 * @rules EI-1, AC-4, SC-3
 */
export interface SourceResolver {
  resolve(sourceDocId: string): Promise<SourceDocSnapshot | null>;
}

/**
 * NLI entailment checker — backs the substring prefilter (AC #5).
 *
 * Story 2.1 ships a no-op pass-through (`StubEntailmentChecker`); a model-backed
 * cross-encoder / LLM check swaps in later without a gate refactor.
 */
export interface EntailmentChecker {
  check(claim: string, source: string): Promise<{ entailed: boolean; score?: number }>;
}

/**
 * Citation-hash verifier — injected from `@iip/citation` (`verify`) so the gate
 * authenticates each `content_hash` (ADR-010) without importing `@iip/citation`
 * directly, preserving the SC-3 boundary.
 */
export interface CitationVerifier {
  verify(
    tuple: CitationTuple,
    source: { content: string },
  ): Promise<boolean>;
}

/**
 * Audit-health probe — injected from `@iip/config` so the render gate can read
 * the audit-worker circuit-breaker state (Story 2.11, ADR-0029 §5) without
 * importing `@iip/config` directly, preserving the SC-3 boundary
 * (`packages/render` imports ONLY `@iip/contracts`).
 *
 * When `isAuditReachable()` returns `false`, the render gate treats every claim
 * as a citation-support failure → WITHHOLD (`audit_offline` violation). The
 * gate does NOT independently poll audit-worker — single source of truth lives
 * in `@iip/config`'s circuit-breaker.
 *
 * The probe is OPTIONAL: when omitted (Story 2.1–2.10 callers), the gate runs
 * without the audit-health check, preserving backward compatibility. The
 * serve-worker wires the real probe; unit tests inject a stub.
 *
 * @rules ADR-0029 §5, SEC-5, SC-3, AC-2
 */
export interface AuditHealthProbe {
  /** Returns `true` only when the audit-worker circuit-breaker is Closed (healthy). */
  isAuditReachable(): boolean;
}

/**
 * Gate-invocation observation record (Story 2.8, VAL-9, AR-25).
 *
 * Emitted by `renderGateLive` on every invocation via the optional
 * {@link GateContext.onInvocation} observer. The serve-worker wires this
 * callback to the editorial log (`gate.invocation` / KPI logger) so that
 * post-proceeding audit can verify the gate fired on every served response
 * (VAL-9: "gate-invocation-per-served-response").
 *
 * The `responseId` is supplied by the caller (serve-worker) — it ties the
 * gate invocation to a specific served response, making "was the gate
 * invoked per served response?" a queryable property rather than an
 * aspiration. `served` carries the gate's final decision: `true` only when
 * the gate returned a document with at least one cited claim that survived
 * the chain (i.e. the gate result WAS the deciding factor in serving —
 * VAL-9: "invocation ≠ enforcement").
 *
 * @rules VAL-9, AR-25, SEC-5, AC-11
 */
export interface GateInvocationObservation {
  /** Caller-supplied response identifier (ties invocation to served response). */
  readonly responseId: string;
  /** The gate's final decision — `true` only if the response is serve-eligible. */
  readonly served: boolean;
  /** Number of cited claim spans that survived the gate. */
  readonly claimsServed: number;
  /** Violations recorded during this invocation (may be empty). */
  readonly violations: readonly GateViolationKind[];
  /** ISO-8601 UTC timestamp of the invocation. */
  readonly time: string;
}

/**
 * Bundle of injected gate dependencies. The gate is a pure function of
 * `(input, ctx)` — everything external (resolver, entailment, hash verifier,
 * invocation observer) flows through here.
 *
 * `onInvocation` is OPTIONAL: when omitted, the gate runs unobserved (useful
 * for unit tests). When present, the gate invokes it exactly once per
 * `renderGateLive` call, after the chain completes, with the final decision.
 * The observer MUST NOT throw — if it does, the gate records a `gate.degraded`
 * violation (the gate never lets an observer failure block a render decision;
 * SEC-5: render correctness > observability).
 *
 * @rules AC-2, SEC-5, EI-1, EI-8, SEC-3, VAL-9
 */
export interface GateContext {
  readonly resolver: SourceResolver;
  readonly entailment: EntailmentChecker;
  readonly verifyCitation: CitationVerifier['verify'];
  /** Optional gate-invocation observer for VAL-9 audit (Story 2.8). */
  readonly onInvocation?: (obs: GateInvocationObservation) => void;
  /**
   * Optional audit-health probe for ADR-0029 §5 fail-closed on audit-death
   * (Story 2.11). When provided AND it reports audit unreachable, every claim
   * is WITHHELD with an `audit_offline` violation. When omitted, the gate runs
   * without the audit-health check (backward compatible).
   */
  readonly auditHealth?: AuditHealthProbe;
}

/** Discriminator for every violation the gate can emit (exhaustive). */
export type GateViolationKind =
  | 'citation_mismatch'
  | 'source_not_found'
  | 'hash_mismatch'
  | 'superseded'
  | 'invalid_tier'
  | 'trust_tier_mismatch'
  | 'gate.degraded'
  | 'entailment_failed'
  | 'empty_span'
  | 'inverted_span'
  | 'out_of_bounds'
  // Reserved — emitted when Story 2.6 (retention/takedown schema) lands:
  | 'citation_expired'
  // Story 2.11 — audit-worker unreachable: claim WITHHELD because the audit
  // trail cannot be kept (ADR-0029 §5). The render gate reads the
  // circuit-breaker state from @iip/config; it does NOT independently poll.
  | 'audit_offline';

/** A single gate violation logged to the output document's `violations` array. */
export interface GateViolation {
  readonly kind: GateViolationKind;
  readonly source_doc_id?: string;
  readonly span_text?: string;
  /** Human-readable degradation context (e.g., the original error message). */
  readonly details?: string;
}

/**
 * A rendered span as emitted by the live gate. Extends {@link RenderSpan} with
 * the `uncorroborated` provenance marker surfaced for tier-3 single-source
 * claims (SEC-3).
 */
export interface GateSpan extends RenderSpan {
  readonly uncorroborated?: boolean;
}

/**
 * Output of the live render gate. Carries the filtered spans, the silence flag,
 * the recorded violations, and (only when silenced) the PD-1 essence sentence.
 */
export interface GateOutput {
  readonly spans: readonly GateSpan[];
  readonly no_evidence: boolean;
  readonly violations: readonly GateViolation[];
  readonly essence_sentence?: string;
}

/** Input to the live gate — the shared rag→render symbol (SC-3). */
export type GateInput = RenderInput;
