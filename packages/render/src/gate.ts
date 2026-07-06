/**
 * Render Gate — the mechanical enforcement point for citation-or-silence.
 *
 * @rules AC-2, SEC-5, EI-1, EI-8, SEC-3
 * @adr ADR-001, ADR-010
 *
 * Two exports:
 *
 * 1. `renderGateLive(input, ctx)` — the canonical ASYNC gate (Story 2.1).
 *    A chain of responsibility: each validation concern is a separate step,
 *    short-circuiting to structured silence on first failure. The gate NEVER
 *    throws — all failures (including backing-service degradation) return a
 *    `gate.degraded` violation and strip the offending span (SEC-5: unavailable
 *    > wrong). Dependencies (source resolver, citation-hash verifier, NLI
 *    entailment checker) are injected via {@link GateContext} so `packages/render`
 *    imports ONLY `@iip/contracts` (SC-3).
 *
 * 2. `renderGate(input)` — the SYNC structural-subset gate from Story 1.4,
 *    retained as a deprecated compatibility wrapper so the Epic 1 contract test
 *    (`tests/contract/citation-or-silence.test.ts`) keeps its import path. It
 *    cannot delegate to the async live gate (a sync function cannot `await`),
 *    so it implements the structural subset directly: null-citation claims are
 *    stripped, `no_evidence` / `essence_sentence` are set on silence.
 *
 * ENFORCED by `renderGateLive`:
 *   - null citation        → strip (fail-closed)
 *   - source not found     → strip + `source_not_found`
 *   - superseded source    → strip + `superseded`
 *   - substring mismatch   → strip + `citation_mismatch` / bounds / empty kinds
 *   - hash mismatch        → strip + `hash_mismatch` (ADR-010)
 *   - entailment failure   → strip + `entailment_failed`
 *   - invalid trust tier   → strip + `invalid_tier`
 *   - tier-3 claim served  → `uncorroborated: true` provenance marker (SEC-3)
 *   - any thrown error     → strip + `gate.degraded` (never rethrows)
 */

import type {
  RenderInputType,
  RenderDocumentType,
  RenderSpanType,
  CitationRefType,
  GateInput,
  GateOutput,
  GateContext,
  GateSpan,
  GateViolation,
  GateViolationKind,
} from '@iip/contracts';
import { isValidTrustTier } from '@iip/contracts';
import { z } from 'zod';
import { validateSubstring } from './substring.js';

type InputSpan = RenderInputType['spans'][number];

// ───────────────────────────────────────────────────────────────────────────
// SYNC structural-subset gate (Story 1.4 compatibility wrapper) — @deprecated
// ───────────────────────────────────────────────────────────────────────────

/**
 * @deprecated Use `renderGateLive` (async). This sync wrapper is retained as a
 * compatibility regression net for the Epic 1 contract test; it does NOT
 * perform source/substring/hash/tier validation. Sync → async delegation is
 * structurally impossible, so the structural subset is implemented directly.
 */
export function renderGate(input: RenderInputType): RenderDocumentType {
  const mapped = input.spans
    .map(mapSpanStructural)
    .filter((s): s is RenderSpanType => s !== null);

  const citedClaims = mapped.filter((s) => s.is_claim);
  const noEvidence = citedClaims.length === 0;

  if (noEvidence) {
    return {
      spans: mapped,
      no_evidence: true,
      essence_sentence: (input.answer_text ?? '').slice(0, 200),
    };
  }

  return {
    spans: mapped,
    no_evidence: false,
  };
}

function mapSpanStructural(span: InputSpan): RenderSpanType | null {
  if (!span.is_claim) {
    return {
      text: span.text,
      is_claim: false,
      citation: null,
    };
  }

  if (span.citation_ref === null) {
    return null;
  }

  return {
    text: span.text,
    is_claim: true,
    claim_type: span.claim_type,
    citation: span.citation_ref,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// ASYNC live gate (Story 2.1) — chain of responsibility
// ───────────────────────────────────────────────────────────────────────────

const ESSENCE_LIMIT = 200;
const DEFAULT_TIMEOUT_MS = 1000;

/** Race an async operation against a deadline; failures are left to the caller to catch. */
function withTimeout<T>(promise: Promise<T>, label: string, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * The canonical render gate. Fires on every render (SEC-5); fails closed into
 * structured silence on any uncited / unverifiable / degraded claim.
 *
 * Story 2.8 (VAL-9): when `ctx.onInvocation` is provided, the gate emits a
 * {@link GateInvocationObservation} exactly once after the chain completes.
 * The caller supplies `responseId` so the observation ties to a specific
 * served response — making "was the gate invoked per served response?" a
 * queryable property (VAL-9). The observer is OPTIONAL and its failure is
 * swallowed (SEC-5: render correctness > observability).
 *
 * @param input  — the render input (spans + answer text)
 * @param ctx    — injected dependencies (resolver, entailment, verifier, observer)
 * @param responseId — caller-supplied response identifier for VAL-9 audit
 */
export async function renderGateLive(
  input: GateInput,
  ctx: GateContext,
  responseId?: string,
): Promise<GateOutput> {
  const effectiveResponseId = responseId?.trim() ? responseId : 'unknown';
  const spans: GateSpan[] = [];
  const violations: GateViolation[] = [];

  for (const span of input.spans) {
    // Non-claim context spans always pass through unchanged.
    if (!span.is_claim) {
      spans.push({
        text: span.text,
        is_claim: false,
        citation: null,
      });
      continue;
    }

    const citation = span.citation_ref;
    if (citation == null) {
      // Uncited declarative claim — fail-closed strip (no violation logged;
      // mirrors the structural subset; the absence IS the silence).
      continue;
    }

    try {
      const served = await validateClaim(span, citation, ctx, violations);
      if (served !== null) {
        spans.push(served);
      }
    } catch (error) {
      // SEC-5: backing-service degradation → structured silence, never rethrow.
      violations.push({
        kind: 'gate.degraded',
        source_doc_id: citation.tuple.source_doc_id,
        span_text: span.text,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const hasClaim = spans.some((s) => s.is_claim);

  const essence = typeof input.answer_text === 'string'
    ? input.answer_text.slice(0, ESSENCE_LIMIT)
    : '';

  const claimsServed = spans.filter((s) => s.is_claim).length;
  const served = hasClaim;

  // Story 2.8 (VAL-9): emit the gate-invocation observation. The observer is
  // optional; if absent or if it throws, the gate decision is unaffected
  // (SEC-5: render correctness > observability — a broken observer MUST NOT
  // change what gets served). Observer failure is recorded as a gate.degraded
  // violation so the audit trail knows observability was impaired.
  if (ctx.onInvocation !== undefined) {
    try {
      ctx.onInvocation({
        responseId: effectiveResponseId,
        served,
        claimsServed,
        violations: violations.map((v) => v.kind),
        time: new Date().toISOString(),
      });
    } catch (error) {
      violations.push({
        kind: 'gate.degraded',
        source_doc_id: 'observer',
        span_text: effectiveResponseId,
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!hasClaim) {
    return {
      spans,
      no_evidence: true,
      violations,
      essence_sentence: essence,
    };
  }

  return {
    spans,
    no_evidence: false,
    violations,
  };
}

/**
 * Run the full validation chain for a single cited claim span.
 * Returns the served {@link GateSpan} on success, or `null` when the chain
 * short-circuits to silence (appending a {@link GateViolation}).
 */
async function validateClaim(
  span: InputSpan,
  citation: CitationRefType,
  ctx: GateContext,
  violations: GateViolation[],
): Promise<GateSpan | null> {
  const sourceDocId = citation.tuple.source_doc_id;

  // (2) Source-document existence.
  const source = await withTimeout(ctx.resolver.resolve(sourceDocId), 'resolver');
  if (source === null) {
    violations.push({ kind: 'source_not_found', source_doc_id: sourceDocId });
    return null;
  }

  // (3) Supersession check — fail-closed reject (mark-don't-delete surfaces
  //     upstream; the gate refuses to serve a superseded span).
  //     Only non-null ISO-8601 timestamps are treated as superseded.
  if (isSuperseded(source.superseded_at)) {
    violations.push({ kind: 'superseded', source_doc_id: sourceDocId });
    return null;
  }

  // (4) Substring accuracy (fast-fail prefilter).
  // (4) Substring accuracy (fast-fail prefilter).
  // Empty claim text is rejected here so the downstream RenderSpan schema
  // (z.string().min(1)) is never violated.
  const sub = validateSubstring(span.text, citation.tuple, source.text);
  if (!sub.passed) {
    violations.push({ kind: sub.kind, source_doc_id: sourceDocId });
    return null;
  }

  // (5) Citation-hash verification (ADR-010) via injected verifier.
  const hashOk = await withTimeout(
    ctx.verifyCitation(citation.tuple, { content: source.text }),
    'verifyCitation',
  );
  if (!hashOk) {
    violations.push({ kind: 'hash_mismatch', source_doc_id: sourceDocId });
    return null;
  }

  // NLI entailment (stub in 2.1 — always entailed; real check swaps in later).
  const entailed = await withTimeout(ctx.entailment.check(span.text, source.text), 'entailment');
  if (!entailed.entailed) {
    violations.push({ kind: 'entailment_failed', source_doc_id: sourceDocId });
    return null;
  }

  // (6) Trust-tier classification — closed set {1, 2, 3}; default-deny otherwise.
  const citationTier = citation.trust_tier;
  if (!isValidTrustTier(citationTier)) {
    violations.push({ kind: 'invalid_tier', source_doc_id: sourceDocId });
    return null;
  }

  // The citation's claimed tier must match the source's registered tier.
  // Mismatch is a provenance inconsistency; fail-safe to the more conservative
  // (higher-numbered / lower-trust) tier.
  const sourceTier = source.trust_tier;
  if (citationTier !== sourceTier) {
    violations.push({ kind: 'trust_tier_mismatch', source_doc_id: sourceDocId });
  }
  const effectiveTier = Math.max(citationTier, sourceTier) as 1 | 2 | 3;

  // (7) Corroboration flag — tier-3 (single manual source) is uncorroborated.
  const uncorroborated = effectiveTier === 3;

  return {
    text: span.text,
    is_claim: true,
    claim_type: span.claim_type,
    citation,
    ...(uncorroborated ? { uncorroborated: true } : {}),
  };
}

/** ISO-8601 UTC timestamp schema; only non-null valid timestamps count as superseded. */
const ISO_TIMESTAMP = z.string().datetime();

/** Returns true only for a non-null ISO-8601 UTC timestamp. */
function isSuperseded(value: unknown): boolean {
  return ISO_TIMESTAMP.safeParse(value).success;
}

/** Re-exported for callers that need the violation kind union (exhaustive switch). */
export type { GateViolationKind };
