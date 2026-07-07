/**
 * Shared test factories for packages/render co-located tests.
 *
 * Package tests MUST NOT import from tests/support/ (boundary: packages
 * must not depend on tests/). Repo-level suites use tests/support/fixtures.ts.
 *
 * @rules AC-2, AC-4, SC-2
 * @adr ADR-001, ADR-010
 */

import { CitationTuple } from '@iip/contracts';
import type {
  CitationRefType,
  CitationTuple as CitationTupleType,
  RenderInputType,
  SourceDocSnapshot,
  SourceResolver,
  GateContext,
} from '@iip/contracts';
import { StubEntailmentChecker } from '../entailment.js';

/** A minimal valid CitationRef for render-gate tests. */
export function validCitation(overrides: Partial<CitationRefType> = {}): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: '00000000-0000-4000-8000-000000000001',
    trust_tier: 1,
    tuple: CitationTuple.parse({
      source_doc_id: '00000000-0000-4000-8000-000000000002',
      span_start: 0,
      span_end: 100,
      content_hash: 'a'.repeat(64),
    }),
    ...overrides,
  };
}

const DEFAULT_DOC_ID = '00000000-0000-4000-8000-000000000002';

/** A deterministic source-document snapshot (defamation-load-bearing fields are fixed). */
export function sourceDoc(overrides: Partial<SourceDocSnapshot> = {}): SourceDocSnapshot {
  return {
    id: DEFAULT_DOC_ID,
    text: 'The senator voted YES on the resolution on 2024-01-15.',
    trust_tier: 1,
    superseded_at: null,
    takedown_trigger: false,
    // Neutral default from the RetentionPolicyLiteral vocabulary (standard |
    // litigation_hold | immediate_takedown). Gate does not yet consume this.
    retention_policy: 'standard',
    ...overrides,
  };
}

/** A tuple referencing the full text of `doc` (span covers `[0, doc.text.length)`). */
export function fullTextTuple(doc: SourceDocSnapshot): CitationTupleType {
  return CitationTuple.parse({
    source_doc_id: doc.id,
    span_start: 0,
    span_end: doc.text.length,
    content_hash: 'a'.repeat(64),
  });
}

/** Build a CitationRef tied to `doc` over its full text at the given tier. */
export function citationFor(
  doc: SourceDocSnapshot,
  overrides: Partial<CitationRefType> = {},
): CitationRefType {
  return {
    citation_id: 'cit-001',
    source_id: '00000000-0000-4000-8000-000000000001',
    trust_tier: doc.trust_tier,
    tuple: fullTextTuple(doc),
    ...overrides,
  };
}

/** A cited claim span whose text exactly matches `doc.text` (full-document span). */
export function citedClaimFor(
  doc: SourceDocSnapshot,
  overrides: { text?: string; trust_tier?: 1 | 2 | 3 } = {},
): RenderInputType['spans'][number] {
  return {
    text: overrides.text ?? doc.text,
    is_claim: true,
    claim_type: 'fact',
    citation_ref: citationFor(doc, {
      trust_tier: overrides.trust_tier ?? doc.trust_tier,
    }),
  };
}

/**
 * A cited claim span over an explicit `[span_start, span_end)` range of `doc`.
 * `text` defaults to the actual source substring at those offsets (valid).
 * Pass a divergent `text` to simulate tampering, or `trust_tier` to override.
 */
export function claimWithSpan(
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
      source_id: '00000000-0000-4000-8000-000000000001',
      trust_tier: range.trust_tier ?? doc.trust_tier,
      tuple,
    },
  };
}

/** An uncited claim span (must be stripped fail-closed). */
export function uncitedClaim(text: string): RenderInputType['spans'][number] {
  return { text, is_claim: true, claim_type: 'attributed', citation_ref: null };
}

/** A non-claim context span (always passes through). */
export function contextFor(text: string): RenderInputType['spans'][number] {
  return { text, is_claim: false, citation_ref: null };
}

/** In-memory resolver over a fixed doc set; returns null for unknown IDs. */
export function makeResolver(docs: SourceDocSnapshot[]): SourceResolver {
  const map = new Map(docs.map((d) => [d.id, d]));
  return {
    async resolve(id: string): Promise<SourceDocSnapshot | null> {
      return map.get(id) ?? null;
    },
  };
}

/**
 * Build a GateContext. The citation verifier defaults to "always valid"; pass
 * `verify: false` to force a hash mismatch, or a custom fn for finer control.
 */
export function makeGateContext(opts: {
  resolver: SourceResolver;
  verify?: boolean | ((t: CitationTupleType, s: { content: string }) => Promise<boolean>);
  entailment?: GateContext['entailment'];
  auditHealth?: GateContext['auditHealth'];
}): GateContext {
  const verifyFn: GateContext['verifyCitation'] =
    typeof opts.verify === 'function'
      ? (opts.verify as GateContext['verifyCitation'])
      : async () => opts.verify !== false;
  return {
    resolver: opts.resolver,
    verifyCitation: verifyFn,
    entailment: opts.entailment ?? new StubEntailmentChecker(),
    ...(opts.auditHealth !== undefined ? { auditHealth: opts.auditHealth } : {}),
  };
}
