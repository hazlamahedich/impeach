import { z } from 'zod';

/**
 * Polyglot eval seam contracts (SC-1, ADR-014).
 *
 * `EvalInput` is the request shape sent from TS to the Python eval
 * subprocess over stdin (one JSON line). `EvalResult` is the response
 * shape read from stdout (one JSON line). Both carry a pinned
 * `schemaVersion` so a Python minor lift cannot silently break the gate;
 * both reject unknown fields (`z.strictObject` ↔ Pydantic
 * `extra = "forbid"`).
 *
 * Generated Pydantic mirrors live in `tools/eval/src/eval/models.py` and
 * are produced by `packages/contracts/scripts/gen-pydantic.ts`. Do NOT
 * hand-write Pydantic models that mirror these schemas (SC-1).
 *
 * @rules SC-1, AC-1
 * @adr ADR-014
 */

/**
 * Pinned protocol version. Both TS and Python sides MUST assert equality
 * on receipt. A mismatch is a hard error, not a warning.
 */
export const EVAL_SCHEMA_VERSION = '1.0.0' as const;
export type EvalSchemaVersion = typeof EVAL_SCHEMA_VERSION;

/**
 * A single fixture payload passed into the eval harness. Opaque to the
 * seam itself — real metric semantics arrive in Epic 4+.
 */
export const EvalFixture = z.strictObject({
  /** Fixture identifier (stable across runs). */
  id: z.string().min(1),
  /** Free-form JSON-serialisable payload. */
  payload: z.unknown(),
});

export type EvalFixture = z.infer<typeof EvalFixture>;

/**
 * EvalInput — the request shape crossing the TS→Python subprocess seam.
 *
 * @rules SC-1, AC-1, AC-7
 * @adr ADR-014
 */
export const EvalInput = z.strictObject({
  schemaVersion: z.literal(EVAL_SCHEMA_VERSION),
  /** Logical suite name (e.g. "smoke", "faithfulness"). */
  suite: z.string().min(1),
  /** Fixtures to evaluate. May be empty. */
  fixtures: z.array(EvalFixture),
});

export type EvalInput = z.infer<typeof EvalInput>;

/**
 * A single per-fixture measurement. Opaque to the seam; scored by
 * Epic 4+ metric logic.
 */
export const EvalMetric = z.strictObject({
  fixture_id: z.string().min(1),
  /** Metric name (e.g. "faithfulness", "citation_fidelity"). */
  metric: z.string().min(1),
  /** Score in [0, 1]. */
  score: z.number().min(0).max(1).multipleOf(0.001).refine(
    (n) => Number.isFinite(n),
    'must be finite',
  ),
});

export type EvalMetric = z.infer<typeof EvalMetric>;

/**
 * EvalResult — the response shape returned by the Python eval subprocess.
 *
 * @rules SC-1, AC-1, AC-7
 * @adr ADR-014
 */
export const EvalResult = z.strictObject({
  schemaVersion: z.literal(EVAL_SCHEMA_VERSION),
  suite: z.string().min(1),
  metrics: z.array(EvalMetric),
});

export type EvalResult = z.infer<typeof EvalResult>;
