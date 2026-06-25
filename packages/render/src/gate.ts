/**
 * Render Gate — the mechanical enforcement point for citation-or-silence.
 *
 * @rules AC-2, SEC-5, EI-1
 * @adr ADR-001
 *
 * STUB (Story 1.4): Deterministic fail-closed placeholder.
 * Real substring/NLI validation is Story 2.1.
 *
 * ENFORCES (this story):
 *   - Claim spans with non-null citation_ref → preserved, citation mapped to output
 *   - Claim spans with null citation_ref → stripped (fail-closed)
 *   - Non-claim spans → passed through unchanged
 *   - no_evidence flag set when zero cited claim spans remain
 *
 * DOES NOT ENFORCE (deferred to Story 2.1+):
 *   - Citation factual accuracy or cross-reference validity
 *   - Source document accessibility or chain-of-custody
 *   - Trust-tier gating or corroboration requirements
 *   - Expired/retracted citation detection
 *   - Runtime enforcement when lint is bypassed
 */

import type { RenderInputType, RenderDocumentType, RenderSpanType } from '@iip/contracts';

type InputSpan = RenderInputType['spans'][number];

function mapSpan(span: InputSpan): RenderSpanType | null {
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

export function renderGate(input: RenderInputType): RenderDocumentType {
  const mapped = input.spans
    .map(mapSpan)
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
