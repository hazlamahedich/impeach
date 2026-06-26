/**
 * <Claim> — a claim primitive with a mechanical citation invariant (UX-DR10/36).
 *
 * AC-2 enforced at the component boundary (STR-10): a claim with zero citations
 * is NEVER rendered as bare text. It suppresses the claim body and surfaces an
 * `insufficient` trust badge instead. "No citation, no claim" is defamation-
 * load-bearing — a journalist who sees an allegation-as-fact rendered without a
 * source is a republication audience.
 *
 * Variants:
 *  - `fact`       — solid left rule, full ink weight.
 *  - `attributed` — dashed left rule, italic.
 *  - `dashed`     — dashed left rule, strikethrough (superseded).
 *
 * @rules AC-2, STR-8, STR-10, UX-DR10, UX-DR36
 */

import type { ReactNode } from 'react';
import type { CitationProvenance } from '@iip/contracts';
import { TrustBadge } from '@/components/iip/trust-badge';

export type ClaimVariant = 'fact' | 'attributed' | 'dashed';

/** Minimal citation ref <Claim> accepts (a structural subset of CitationProvenance). */
export type ClaimCitation = Pick<
  CitationProvenance,
  'sourceDocId' | 'spanStart' | 'spanEnd' | 'contentHash'
>;

export interface ClaimProps {
  variant: ClaimVariant;
  citations: ReadonlyArray<ClaimCitation>;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<ClaimVariant, string> = {
  fact: 'border-l-3 border-claim-fact text-claim-fact font-sans text-base',
  attributed:
    'border-l-3 border-dashed border-claim-attributed text-claim-attributed italic font-sans text-base',
  dashed:
    'border-l-3 border-dashed border-claim-dashed text-claim-dashed line-through font-sans text-base',
};

const VARIANT_ARIA_PREFIX: Record<ClaimVariant, string> = {
  fact: 'Fact: ',
  attributed: 'Attributed Claim: ',
  dashed: 'Superseded Claim: ',
};

export function Claim({ variant, citations, children }: ClaimProps): ReactNode {
  const ariaPrefix = VARIANT_ARIA_PREFIX[variant];
  const text = typeof children === 'string' ? children : '';

  // Mechanical "no citation, no claim" (AC-2). Suppress the claim body and
  // surface an insufficient badge so the omission is visible, not invisible.
  if (citations.length === 0) {
    return (
      <article
        data-testid="claim"
        aria-label={`${ariaPrefix}not shown — no sources`}
      >
        <TrustBadge tier="insufficient" sourceCount={0} data-testid="trust-badge-insufficient">
          No sources — not shown
        </TrustBadge>
      </article>
    );
  }

  return (
    <article
      data-testid="claim"
      aria-label={`${ariaPrefix}${text}`}
      className={`${VARIANT_CLASS[variant]} rounded-sm py-1 pl-3`}
    >
      {children}
    </article>
  );
}
