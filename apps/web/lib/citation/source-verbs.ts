/**
 * Preserved source-verb registry (EI-3, UX-DR12).
 *
 * Every extraction verb that reaches the UI is resolved against this registry.
 * Adding a verb is a one-line edit (EI-3). A verb absent from the registry is
 * rendered as a fallback by `<SourceVerbTag>` and surfaced via `console.warn`
 * so an unregistered verb can never silently impersonate a primary source.
 *
 * - `bias`  — editorial weight the verb lends a claim (raise / lower / neutral).
 * - `variant` — primary (default treatment) | risk (defamation-risk styling).
 * - `floor`  — minimum trust tier the verb may promote to (primary / secondary).
 *
 * @rules EI-3
 */

export type VerbBias = 'raise' | 'lower' | 'neutral';
export type VerbVariant = 'primary' | 'risk';
export type VerbFloor = 'primary' | 'secondary';

export interface SourceVerbConfig {
  verb: string;
  bias: VerbBias;
  variant: VerbVariant;
  floor: VerbFloor;
}

export const sourceVerbs: Record<string, SourceVerbConfig> = {
  documents: { verb: 'documents', bias: 'raise', variant: 'primary', floor: 'primary' },
  alleges: { verb: 'alleges', bias: 'neutral', variant: 'primary', floor: 'secondary' },
  retracts: { verb: 'retracts', bias: 'lower', variant: 'risk', floor: 'secondary' },
  alleged: { verb: 'alleged', bias: 'lower', variant: 'risk', floor: 'secondary' },
  testified: { verb: 'testified', bias: 'raise', variant: 'primary', floor: 'primary' },
  voted: { verb: 'voted', bias: 'raise', variant: 'primary', floor: 'primary' },
  denied: { verb: 'denied', bias: 'neutral', variant: 'primary', floor: 'secondary' },
  claimed: { verb: 'claimed', bias: 'neutral', variant: 'primary', floor: 'secondary' },
};

export function getSourceVerb(verb: string): SourceVerbConfig | undefined {
  return sourceVerbs[verb];
}
