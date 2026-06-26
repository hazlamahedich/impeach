/**
 * <TrustBadge> — trust-tier badge with three redundant a11y channels (UX-DR11).
 *
 * WCAG 2.1 AA: trust state is NEVER conveyed by colour alone. Every tier pairs
 * colour (semantic token) + icon + text label, and exposes a single
 * `role="img"` with a descriptive `aria-label`.
 *
 * @rules STR-10, UX-DR11
 */

import type { HTMLAttributes, ReactNode } from 'react';

export type TrustTier = 'verified' | 'contradicted' | 'caution' | 'insufficient';

export interface TrustBadgeProps extends HTMLAttributes<HTMLElement> {
  tier: TrustTier;
  sourceCount?: number;
  children?: ReactNode;
}

const TIER_LABEL: Record<TrustTier, string> = {
  verified: 'Verified',
  contradicted: 'Contradicted',
  caution: 'Caution',
  insufficient: 'Insufficient',
};

const TIER_CLASS: Record<TrustTier, string> = {
  verified: 'bg-trust-tier-verified text-white',
  contradicted: 'bg-trust-tier-contradicted text-white',
  caution: 'bg-surface-sunken border border-trust-tier-caution text-trust-tier-caution',
  insufficient: 'bg-surface-sunken border border-muted-foreground text-muted-foreground',
};

function TrustIcon({ tier }: { tier: TrustTier }): ReactNode {
  return (
    <svg
      data-testid={`trust-icon-${tier}`}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      {tier === 'verified' ? (
        <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {tier === 'contradicted' ? (
        <>
          <circle cx="4" cy="12" r="1.6" />
          <circle cx="12" cy="4" r="1.6" />
          <path d="M4 10.4V7a2 2 0 0 1 2-2h4" strokeLinecap="round" />
        </>
      ) : null}
      {tier === 'caution' ? (
        <>
          <path d="M8 2.5L14.5 13.5h-13L8 2.5z" strokeLinejoin="round" />
          <path d="M8 6.5v3" strokeLinecap="round" />
          <path d="M8 11.4v.1" strokeLinecap="round" />
        </>
      ) : null}
      {tier === 'insufficient' ? (
        <>
          <circle cx="8" cy="8" r="6.25" />
          <path d="M8 5v3.25" strokeLinecap="round" />
          <path d="M8 11v.1" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

export function TrustBadge({
  tier,
  sourceCount,
  children,
  className,
  ...rest
}: TrustBadgeProps): ReactNode {
  const label = TIER_LABEL[tier];
  const text = children ?? label;
  const count = sourceCount ?? 0;
  // The accessible name must always include the trust tier, even when custom
  // visible text is supplied (e.g. "No sources — not shown" in Claim).
  const countPhrase = `${count} ${count === 1 ? 'source' : 'sources'}`;
  const ariaLabel = children !== undefined
    ? `${label} — ${String(children)} (${countPhrase})`
    : `${label} — ${countPhrase}`;

  return (
    <span
      data-testid="trust-badge"
      role="img"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-label-caps text-xs uppercase tracking-wide ${TIER_CLASS[tier]} ${className ?? ''}`}
      {...rest}
    >
      <TrustIcon tier={tier} />
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
