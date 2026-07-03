import { z } from 'zod';

/**
 * Retention / takedown contract types (AR-23, VAL-2 G-2 — Story 2.6a).
 *
 * Three orthogonal concepts are kept DISTINCT here and in the schema:
 *  - {@link RetentionPolicy} — the governance *class* a document is under
 *    (e.g. `litigation_hold`). It is the policy; it does not explain *why*
 *    the document is on hold or *when* it was placed there.
 *  - `takedown_trigger` (free text in the schema) — the *rationale* for
 *    removal (e.g. `court_order`, `dmca`, `editor_retraction`). The trigger
 *    is orthogonal to the class: a `litigation_hold` document may have been
 *    triggered by a `court_order`, while an `immediate_takedown` may be
 *    triggered by an `editor_retraction`. Conflating the two collapses the
 *    policy and its cause into one column, losing provenance.
 *  - `legal_hold` (boolean in the schema) — the litigation-*freeze* flag.
 *    Orthogonal to the class: a `standard`-retention document can be frozen
 *    by a late-arriving legal hold without re-classifying its retention.
 *
 * @rules AR-23, VAL-2, G-2
 *
 * Note: `superseded_at` was evicted from this story's scope into ADR-0017
 * (supersession-orchestration). ADR-0017 is referenced here as context only,
 * not as binding authority (its status is `Proposed`; PC-3 forbids citing a
 * Proposed ADR via the `@adr` form). Retention's own authority is the rule
 * set above.
 */

/**
 * RetentionPolicyLiteral — the closed enumeration of retention hold classes.
 *
 * `z.enum` (not TS `enum`) per PC-4 #14: the inferred union is the only
 * sanctioned form (a parallel TS `enum` drifts from the zod taxonomy within
 * one release). The enumeration is closed so exhaustive `switch` works
 * (Amelia TS pattern).
 *
 * Vocabulary (mirrored as a CHECK constraint in the hand-authored SQL
 * migration only — the Drizzle def stays nullable per Option A):
 *  - `standard` — ordinary retention; no special hold.
 *  - `litigation_hold` — under active legal hold; deletion is suspended.
 *  - `immediate_takedown` — flagged for prompt removal.
 *
 * @rules AR-23, VAL-2, G-2
 */
export const RetentionPolicyLiteral = z.enum([
  'standard',
  'litigation_hold',
  'immediate_takedown',
]);
export type RetentionPolicyLiteral = z.infer<typeof RetentionPolicyLiteral>;

/**
 * Branded RetentionPolicy — prevents transposition with other strings.
 *
 * Branded so a raw `takedown_trigger` (free text) cannot be assigned where a
 * governance *class* is required (project-context Winston #1 — every string
 * ID in a defamation-grade contract is a latent transposition bug).
 *
 * @rules AR-23, VAL-2, G-2
 */
export const RetentionPolicy = RetentionPolicyLiteral.brand('RetentionPolicy');
export type RetentionPolicy = z.infer<typeof RetentionPolicy>;
