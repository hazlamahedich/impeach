/**
 * Trust tiers — the editorial trust classification of a source (EI-8, SEC-3).
 *
 * Shared constant consumed by the render gate so the tier taxonomy is defined
 * in exactly one place. The gate imports `TRUST_TIERS`; it is never hardcoded
 * in gate logic (AC #6). Untiered sources (null / missing / out-of-set tier)
 * are default-deny at the gate.
 *
 * The numeric keys mirror `CitationRef.trust_tier` (1 | 2 | 3) — the only
 * sanctioned form (no TS `enum` in contracts; PC-4 #14).
 *
 * @rules EI-8, SEC-3, AC-2
 * @adr ADR-001
 */

export const TRUST_TIERS = {
  1: 'verified_multi_source',
  2: 'verified_single_source',
  3: 'unverified_manual',
} as const;

export type TrustTierNumber = keyof typeof TRUST_TIERS;

/** Human-readable tier label carried through the citation provenance surface. */
export type TrustTierLabel = (typeof TRUST_TIERS)[TrustTierNumber];

/** Type guard — true only for the closed tier set {1, 2, 3}. */
export function isValidTrustTier(tier: number): tier is TrustTierNumber {
  return tier === 1 || tier === 2 || tier === 3;
}
