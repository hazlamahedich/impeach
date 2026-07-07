/**
 * Shared test fixtures for cross-suite defamation-spine tests.
 *
 * Consumed by tests/contract and tests/integration suites to avoid
 * duplicating `validCitation()` / `makeRenderInput()` across files.
 * Package-co-located tests keep their own helpers (packages must not
 * depend on tests/); this module serves the repo-level test suites.
 *
 * @rules AC-2, AC-4, SC-2
 * @adr ADR-001, ADR-010
 *
 * Usage:
 *   import { makeCitationRef, makeRenderInput } from '../support/fixtures';
 */

import { CitationTuple } from '@iip/contracts';
import type {
  CitationRefType,
  CitationTuple as CitationTupleType,
  RenderInputType,
  SourceDocSnapshot,
  SourceResolver,
  GateContext,
  EntailmentChecker,
} from '@iip/contracts';
import { StubEntailmentChecker } from '@iip/render';

const SOURCE_DOC = '00000000-0000-4000-8000-000000000002';
const SOURCE = '00000000-0000-4000-8000-000000000001';

/** A minimal valid CitationRef for render-gate / contract tests. */
export function makeCitationRef(overrides: Partial<CitationRefType> = {}): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: SOURCE,
    trust_tier: 1,
    tuple: CitationTuple.parse({
      source_doc_id: SOURCE_DOC,
      span_start: 0,
      span_end: 100,
      content_hash: 'a'.repeat(64),
    }),
    ...overrides,
  };
}

/** A claim span carrying a valid citation. */
export function citedSpan(text: string, claimType: 'fact' | 'attributed' = 'fact') {
  return { text, is_claim: true as const, claim_type: claimType, citation_ref: makeCitationRef() };
}

/** A claim span with NO citation (must be stripped fail-closed). */
export function uncitedSpan(text: string, claimType: 'fact' | 'attributed' = 'attributed') {
  return { text, is_claim: true as const, claim_type: claimType, citation_ref: null };
}

/** A non-claim context span (always passed through). */
export function contextSpan(text: string) {
  return { text, is_claim: false as const, citation_ref: null };
}

/** Build a RenderInput from spans + answer text. */
export function makeRenderInput(
  answer_text: string,
  spans: RenderInputType['spans'],
  query = 'test query',
): RenderInputType {
  return { query, answer_text, spans };
}

// ───────────────────────────────────────────────────────────────────────────
// Story 2.1 — live render-gate fixtures (repo-level; mirror the package-local
// factories so tests/ never reaches into packages/render internals).
// @rules AC-2, SEC-5, EI-1, EI-8
// ───────────────────────────────────────────────────────────────────────────

const LIVE_DOC_ID = '00000000-0000-4000-8000-000000000002';
const LIVE_SOURCE_ID = '00000000-0000-4000-8000-000000000001';

/** Deterministic source-document snapshot for live-gate tests. */
export function liveSourceDoc(overrides: Partial<SourceDocSnapshot> = {}): SourceDocSnapshot {
  return {
    id: LIVE_DOC_ID,
    text: 'The senator voted YES on the resolution on 2024-01-15.',
    trust_tier: 1,
    superseded_at: null,
    takedown_trigger: false,
    retention_policy: 'defamation_grade_permanent',
    ...overrides,
  };
}

/** In-memory resolver over a fixed doc set; returns null for unknown IDs. */
export function liveResolver(docs: SourceDocSnapshot[]): SourceResolver {
  const map = new Map(docs.map((d) => [d.id, d]));
  return {
    async resolve(id: string): Promise<SourceDocSnapshot | null> {
      return map.get(id) ?? null;
    },
  };
}

/** A CitationRef tied to `doc` over its full text at the given tier. */
export function liveCitation(
  doc: SourceDocSnapshot,
  overrides: Partial<CitationRefType> = {},
): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: LIVE_SOURCE_ID,
    trust_tier: doc.trust_tier,
    tuple: CitationTuple.parse({
      source_doc_id: doc.id,
      span_start: 0,
      span_end: doc.text.length,
      content_hash: 'a'.repeat(64),
    }),
    ...overrides,
  };
}

/** A cited claim span whose text exactly matches `doc.text` (full-document span). */
export function liveCitedClaim(
  doc: SourceDocSnapshot,
  overrides: { text?: string; trust_tier?: 1 | 2 | 3 } = {},
): RenderInputType['spans'][number] {
  return {
    text: overrides.text ?? doc.text,
    is_claim: true,
    claim_type: 'fact',
    citation_ref: liveCitation(doc, { trust_tier: overrides.trust_tier ?? doc.trust_tier }),
  };
}

/** A cited claim span over an explicit `[span_start, span_end)` range. */
export function liveClaimSpan(
  doc: SourceDocSnapshot,
  range: { span_start: number; span_end: number; text?: string; trust_tier?: 1 | 2 | 3 },
): RenderInputType['spans'][number] {
  const tuple = CitationTuple.parse({
    source_doc_id: doc.id,
    span_start: range.span_start,
    span_end: range.span_end,
    content_hash: 'a'.repeat(64),
  });
  return {
    text: range.text ?? doc.text.substring(range.span_start, range.span_end),
    is_claim: true,
    claim_type: 'fact',
    citation_ref: {
      citation_id: 'cit-001',
      source_id: LIVE_SOURCE_ID,
      trust_tier: range.trust_tier ?? doc.trust_tier,
      tuple,
    },
  };
}

/** Build a GateContext. `verify` defaults to always-valid; pass false to force a mismatch. */
export function liveGateContext(opts: {
  resolver: SourceResolver;
  verify?: boolean | ((t: CitationTupleType, s: { content: string }) => Promise<boolean>);
  entailment?: EntailmentChecker;
  /** Optional gate-invocation observer (Story 2.8 VAL-9). */
  onInvocation?: GateContext['onInvocation'];
  /** Optional audit-health probe (Story 2.11, ADR-0029 §5). */
  auditHealth?: GateContext['auditHealth'];
}): GateContext {
  const verifyFn: GateContext['verifyCitation'] =
    typeof opts.verify === 'function'
      ? (opts.verify as GateContext['verifyCitation'])
      : async () => opts.verify !== false;
  const ctx: { resolver: SourceResolver; verifyCitation: GateContext['verifyCitation']; entailment?: EntailmentChecker; onInvocation?: GateContext['onInvocation']; auditHealth?: GateContext['auditHealth'] } = {
    resolver: opts.resolver,
    verifyCitation: verifyFn,
  };
  if (opts.entailment !== undefined) {
    ctx.entailment = opts.entailment;
  } else {
    ctx.entailment = new StubEntailmentChecker();
  }
  if (opts.onInvocation !== undefined) {
    ctx.onInvocation = opts.onInvocation;
  }
  if (opts.auditHealth !== undefined) {
    ctx.auditHealth = opts.auditHealth;
  }
  return ctx;
}
