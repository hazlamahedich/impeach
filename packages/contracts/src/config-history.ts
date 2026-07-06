/**
 * config_history contract types (PC-2.6, AR-23, VAL-2, VAL-8 — Story 2.10).
 *
 * Defines the versioned, append-only config-lineage primitive: every
 * output-affecting config knob change (model IDs, thresholds, k, fusion
 * weights, eval splits) is recorded as a new row in `config_history`, proving
 * threshold-at-time-T for AC-2 reproducibility. This is the legal-defense
 * prerequisite: without it, the team cannot prove what model/prompt/threshold
 * produced any given answer at the moment of alleged harm — a spoliation gap
 * in any Philippine defamation (RA 10175 / Civil Code) defense.
 *
 * Branded nominal types prevent transposition of config-history identity
 * fields (project-context Winston #1, SEC-6). A `ConfigKey` cannot be
 * assigned where a `ConfigHistoryId` belongs — compile-time enforcement
 * beyond runtime validation.
 *
 * Retention vocabulary note: `config_history` uses a DIFFERENT vocabulary
 * from `intake_documents` (`standard`/`litigation_hold`/`immediate_takedown`).
 * `config_history` uses `unbounded_legal_hold`/`superseded_retain`/
 * `purged_after_audit` — the tables serve different purposes, and
 * `config_history`'s default (`unbounded_legal_hold`) is honest: the default
 * IS the truth (VAL-8), unlike `intake_documents` where a default would
 * fabricate a classification.
 *
 * @rules PC-2.6, AR-23, VAL-2, VAL-8
 */
import { z } from 'zod';

/**
 * ConfigKey — branded text key identifying an output-affecting config knob.
 *
 * Examples: `model.qwen3.id`, `render.citation_threshold`, `eval.split.ratio`,
 * `rag.fusion.weight_k`. Branding prevents transposition with other string
 * fields (a `ConfigKey` cannot be assigned where a `ConfigHistoryId` is
 * expected, and vice versa).
 *
 * @rules PC-2.6, SEC-6
 */
export const ConfigKeySchema = z.string().min(1).brand('ConfigKey');
export type ConfigKey = z.infer<typeof ConfigKeySchema>;

/**
 * ConfigHistoryId — branded UUID v4 identifying a single config_history row.
 *
 * Distinct from `ConfigKey` (which names a knob) and from `Principal`
 * (which names the actor). The brand prevents a raw `crypto.randomUUID()`
 * string or a `ConfigKey` from being silently assigned where a row ID is
 * required.
 *
 * Enforces UUID **v4** explicitly via regex: plain `.uuid()` accepts v1
 * (MAC-address-leaking). The regex pins version nibble `4` and variant
 * nibble `[89ab]` (project-context: `z.string().uuid({ version: 'v4' })`
 * is the documented intent; the installed zod's `.uuid()` does not accept
 * the `version` param, so the constraint is expressed as a regex).
 *
 * @rules PC-2.6, SEC-6
 */
export const ConfigHistoryIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'must be a valid UUID v4',
  )
  .brand('ConfigHistoryId');
export type ConfigHistoryId = z.infer<typeof ConfigHistoryIdSchema>;

/**
 * ConfigHistoryRetentionClassLiteral — the closed enumeration of config_history
 * retention hold classes.
 *
 * `z.enum` (not TS `enum`) per PC-4 #14: the inferred union is the only
 * sanctioned form (a parallel TS `enum` drifts from the zod taxonomy within
 * one release). The enumeration is closed so exhaustive `switch` works
 * (Amelia TS pattern).
 *
 * Vocabulary (mirrored as a CHECK constraint in the hand-authored SQL
 * migration `0003_config_history.sql`):
 *  - `unbounded_legal_hold` — the DEFAULT; config_history is unbounded
 *    legal-hold *by design* per VAL-8. This is the one table where the
 *    default is NOT a fabrication — the default IS the truth.
 *  - `superseded_retain` — superseded by a newer effective_from row, but
 *    retained for audit (the previous row in a supersession chain).
 *  - `purged_after_audit` — released from legal hold after an audit. This
 *    is the ONLY value that permits `legal_hold = false`.
 *
 * @rules PC-2.6, VAL-2, VAL-8, G-2
 */
export const ConfigHistoryRetentionClassLiteral = z.enum([
  'unbounded_legal_hold',
  'superseded_retain',
  'purged_after_audit',
]);
export type ConfigHistoryRetentionClassLiteral = z.infer<
  typeof ConfigHistoryRetentionClassLiteral
>;

/**
 * Branded ConfigHistoryRetentionClass — prevents transposition with other
 * strings (e.g. the `intake_documents` `RetentionPolicy` vocabulary, which is
 * a DIFFERENT set of values despite the similar name).
 *
 * @rules PC-2.6, VAL-2, VAL-8, G-2
 */
export const ConfigHistoryRetentionClass = ConfigHistoryRetentionClassLiteral.brand(
  'ConfigHistoryRetentionClass',
);
export type ConfigHistoryRetentionClass = z.infer<typeof ConfigHistoryRetentionClass>;
