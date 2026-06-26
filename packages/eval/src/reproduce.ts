/**
 * Gate Decision & Reproduce Primitives (SC-7, AC-F1-10).
 *
 * Records a gate execution decision under a content-addressed path
 * ``eval/gates/<runId>/decision.json`` where ``runId`` is the SHA-256 of
 * the composite key ``(corpusHash, commit, modelDigest, harnessSha)``.
 * ``reproduceRun(runId)`` re-emits the recorded decision for gate-time
 * re-runs (PD-3 / SC-7 reproducibility contract).
 *
 * Output envelope — ``decision.json``:
 * ```json
 * {
 *   "schemaVersion": "1.0.0",
 *   "corpusHash": "sha256:<64-hex>",
 *   "commit": "<git-sha>",
 *   "timestamp": "2026-06-26T19:25:22.000Z",
 *   "decision": "pass" | "fail",
 *   "metrics": { "<name>": <number> }
 * }
 * ```
 *
 * The store is append-only: re-recording under the same ``runId``
 * supersedes the prior ``decision.json`` in place. The corpus + gate +
 * model + harness composite is the lookup key; the decision/metrics are
 * the mutable payload. Per-leaf supersede (never overwrite across runs)
 * is enforced because ``runId`` is bound to the inputs.
 *
 * @rules SC-7, AC-F1-10
 */
import { AppError, now } from '@iip/contracts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Pinned decision protocol version. */
export const DECISION_SCHEMA_VERSION = '1.0.0' as const;

/** Default gate-artifact root. */
export const DEFAULT_GATES_DIR = 'eval/gates';

/** ``decision`` is a closed two-element union (no third state). */
export type Decision = 'pass' | 'fail';

/**
 * Inputs to {@link recordGateDecision}. The first four fields form the
 * composite key (``runId``); ``decision`` + ``metrics`` are the payload.
 */
export interface GateDecisionInput {
  /** ``sha256:<64-hex>`` from {@link freezeCorpus}. */
  readonly corpusHash: string;
  /** Git commit SHA the gate ran against. */
  readonly commit: string;
  /** ``sha256:<64-hex>`` of the model + prompt bundle. */
  readonly modelDigest: string;
  /** ``sha256:<64-hex>`` of the eval harness source. */
  readonly harnessSha: string;
  readonly decision: Decision;
  /** Non-empty record of metric name → score. */
  readonly metrics: Record<string, number>;
}

/** The persisted decision envelope (AC-F1-10 output contract). */
export interface GateDecision {
  readonly schemaVersion: typeof DECISION_SCHEMA_VERSION;
  readonly corpusHash: string;
  readonly commit: string;
  /** ISO-8601 UTC timestamp of the recording (display-only, not ordering). */
  readonly timestamp: string;
  readonly decision: Decision;
  readonly metrics: Record<string, number>;
}

/** Result of {@link recordGateDecision}. */
export interface RecordResult {
  /** ``sha256:<64-hex>`` of the composite key — the lookup id. */
  readonly runId: string;
  /** Absolute path of the written ``decision.json``. */
  readonly decisionPath: string;
  readonly decision: GateDecision;
}

/** Input validation error for {@link recordGateDecision} (canonical AppError). */
export class GateInputError extends AppError {
  override readonly name = 'GateInputError';
  constructor(message: string) {
    super(message, 'gate:input_invalid');
  }
}

/** Reproduce-side error (canonical AppError with discriminator fields). */
export class ReproduceError extends AppError {
  override readonly name = 'ReproduceError';
  constructor(
    readonly kind: 'MALFORMED_RUN_ID' | 'UNKNOWN_RUN' | 'CORRUPT_DECISION',
    readonly runId: string,
    readonly reason?: string,
  ) {
    super(`reproduce ${kind}: ${runId}`, `reproduce:${kind}`);
  }
}

/** Alias kept for tests that import the discriminated shape by name. */
export type UnknownRunError = ReproduceError & { kind: 'UNKNOWN_RUN' };

/** SHA-256 hex digest with the ``sha256:`` prefix. */
type Sha256 = `sha256:${string}`;

/** Validate the ``sha256:<64-hex>`` shape used by every component of the key. */
function isSha256(s: string): s is Sha256 {
  return /^sha256:[0-9a-f]{64}$/.test(s);
}

/** Compute SHA-256 via Web Crypto and return ``sha256:<hex>``. */
async function sha256(data: Uint8Array): Promise<Sha256> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

/** Canonicalise a composite key into a deterministic byte sequence. */
async function runIdFromComposite(input: {
  corpusHash: string;
  commit: string;
  modelDigest: string;
  harnessSha: string;
}): Promise<Sha256> {
  const enc = new TextEncoder();
  // Field-order-stable, separator-stable canonicalisation. Each component is
  // length-prefixed so prefix-collisions between fields cannot move the hash.
  const parts = [
    input.corpusHash,
    input.commit,
    input.modelDigest,
    input.harnessSha,
  ];
  const chunks: Uint8Array[] = parts.map((p) => enc.encode(`${p.length}:${p}`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return sha256(merged);
}

/** ISO-8601 UTC timestamp with millisecond precision (PC-8). */
function utcNow(): string {
  return now();
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validateDecisionJson(parsed: unknown, runId: string): GateDecision {
  if (!isNonNullObject(parsed)) {
    throw new ReproduceError(
      'CORRUPT_DECISION',
      runId,
      'decision.json is not an object',
    );
  }
  const requiredFields = [
    'schemaVersion',
    'corpusHash',
    'commit',
    'timestamp',
    'decision',
    'metrics',
  ];
  for (const f of requiredFields) {
    if (!(f in parsed)) {
      throw new ReproduceError(
        'CORRUPT_DECISION',
        runId,
        `decision.json is missing required field: ${f}`,
      );
    }
  }
  if (parsed['schemaVersion'] !== DECISION_SCHEMA_VERSION) {
    throw new ReproduceError(
      'CORRUPT_DECISION',
      runId,
      `unsupported schemaVersion: ${String(parsed['schemaVersion'])}`,
    );
  }
  if (parsed['decision'] !== 'pass' && parsed['decision'] !== 'fail') {
    throw new ReproduceError(
      'CORRUPT_DECISION',
      runId,
      `invalid decision value: ${String(parsed['decision'])}`,
    );
  }
  const decision = parsed['decision'];
  if (!isNonNullObject(parsed['metrics'])) {
    throw new ReproduceError(
      'CORRUPT_DECISION',
      runId,
      'metrics must be a non-empty object',
    );
  }
  if (Object.keys(parsed['metrics']).length === 0) {
    throw new ReproduceError(
      'CORRUPT_DECISION',
      runId,
      'metrics must be a non-empty object',
    );
  }
  const metrics: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsed['metrics'])) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new ReproduceError(
        'CORRUPT_DECISION',
        runId,
        `metric ${k} must be a finite number`,
      );
    }
    metrics[k] = v;
  }
  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    corpusHash: String(parsed['corpusHash']),
    commit: String(parsed['commit']),
    timestamp: String(parsed['timestamp']),
    decision,
    metrics,
  };
}

/**
 * Record a gate execution decision under
 * ``<gatesDir>/<runId>/decision.json``. Re-recording under the same
 * ``runId`` supersedes the prior file (append-only by run, last-writer for
 * replay).
 *
 * @rules SC-7, AC-F1-10
 */
export async function recordGateDecision(
  input: GateDecisionInput,
  opts: { gatesDir?: string; timestamp?: string } = {},
): Promise<RecordResult> {
  // Validate inputs — corpusHash / modelDigest / harnessSha must be sha256.
  if (!isSha256(input.corpusHash)) {
    throw new GateInputError(
      `corpusHash is not a sha256:<hex>: ${input.corpusHash}`,
    );
  }
  if (!isSha256(input.modelDigest)) {
    throw new GateInputError(
      `modelDigest is not a sha256:<hex>: ${input.modelDigest}`,
    );
  }
  if (!isSha256(input.harnessSha)) {
    throw new GateInputError(
      `harnessSha is not a sha256:<hex>: ${input.harnessSha}`,
    );
  }
  if (input.commit.length === 0) {
    throw new GateInputError('commit must be a non-empty git SHA');
  }
  if (input.decision !== 'pass' && input.decision !== 'fail') {
    throw new GateInputError(
      `decision must be "pass" or "fail", got: ${input.decision}`,
    );
  }
  if (
    input.metrics === null ||
    typeof input.metrics !== 'object' ||
    Object.keys(input.metrics).length === 0
  ) {
    throw new GateInputError('metrics must be a non-empty object');
  }
  for (const v of Object.values(input.metrics)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new GateInputError('metrics must contain only finite numbers');
    }
  }

  const runId = await runIdFromComposite(input);
  const gatesRoot = opts.gatesDir ?? DEFAULT_GATES_DIR;
  const dir = join(gatesRoot, runId);
  await mkdir(dir, { recursive: true });

  const decision: GateDecision = {
    schemaVersion: DECISION_SCHEMA_VERSION,
    corpusHash: input.corpusHash,
    commit: input.commit,
    timestamp: opts.timestamp ?? utcNow(),
    decision: input.decision,
    metrics: input.metrics,
  };

  const decisionPath = join(dir, 'decision.json');
  await writeFile(decisionPath, JSON.stringify(decision, null, 2) + '\n');
  return { runId, decisionPath, decision };
}

/**
 * Re-emit the recorded gate decision for ``runId``. Throws a typed
 * {@link ReproduceError} on malformed id, unknown run, or corrupt payload.
 *
 * @rules SC-7, AC-F1-10
 */
export async function reproduceRun(
  runId: string,
  opts: { gatesDir?: string } = {},
): Promise<GateDecision> {
  if (!isSha256(runId)) {
    throw new ReproduceError('MALFORMED_RUN_ID', runId);
  }
  const gatesRoot = opts.gatesDir ?? DEFAULT_GATES_DIR;
  const decisionPath = join(gatesRoot, runId, 'decision.json');
  let raw: string;
  try {
    raw = await readFile(decisionPath, 'utf8');
  } catch {
    throw new ReproduceError('UNKNOWN_RUN', runId);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ReproduceError('CORRUPT_DECISION', runId, reason);
  }
  return validateDecisionJson(parsed, runId);
}
