/**
 * Queue backoff config knob with config_history lineage (TD4, PC-1d, PC-2.4).
 *
 * Capped exponential backoff parameters for ingestion-job retries (NFR-R-2).
 * Reuses the `setLogLevel` → `notifyConfigChange` → `config_history` pattern
 * (Story 2.10) so every backoff-parameter change is version-controlled for
 * audit defensibility.
 *
 * The defaults are conservative for a single-workstation v1: 5 max attempts,
 * 1s base delay, 1.6× growth, 30s cap. BullMQ reads these at enqueue time so
 * a mid-flight job keeps its original budget (the retry policy is stamped on
 * the job, not re-read on each attempt).
 *
 * @rules PC-1d, PC-2.4, NFR-R-2, PC-2.6
 * @adr ADR-0027
 */
import { ConfigKeySchema } from '@iip/contracts';
import type { ConfigKey } from '@iip/contracts';
import { notifyConfigChange } from './config-history-repo.js';

const QUEUES_BACKOFF_KEY: ConfigKey = ConfigKeySchema.parse('queues.ingest_backoff');

export interface BackoffConfig {
  /** Maximum retry attempts per job before routing to the DLQ (NFR-R-2). */
  readonly maxAttempts: number;
  /** Base delay in ms for the first retry. */
  readonly baseDelayMs: number;
  /** Exponential growth factor (e.g. 1.6 = 60% growth per attempt). */
  readonly growthFactor: number;
  /** Cap on the delay between retries (ms). */
  readonly maxDelayMs: number;
}

/** Default backoff: conservative for single-workstation v1 (NFR-R-2). */
const DEFAULT_BACKOFF: BackoffConfig = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  growthFactor: 1.6,
  maxDelayMs: 30_000,
};

let currentBackoff: BackoffConfig = DEFAULT_BACKOFF;

/** Read the current ingest-queue backoff configuration. */
export function getBackoff(): BackoffConfig {
  return currentBackoff;
}

/**
 * Set the ingest-queue backoff configuration and emit a config_history change
 * event. The acting principal is required (SEC-1).
 *
 * @throws if any parameter is invalid (non-positive, non-finite, growth < 1).
 */
export function setBackoff(config: Partial<BackoffConfig>, _actingPrincipal: import('@iip/contracts').Principal): BackoffConfig {
  const candidate: BackoffConfig = { ...currentBackoff, ...config };
  if (!Number.isInteger(candidate.maxAttempts) || candidate.maxAttempts < 1) {
    throw new Error(`Invalid maxAttempts: ${candidate.maxAttempts}. Must be a positive integer.`);
  }
  if (!Number.isFinite(candidate.baseDelayMs) || candidate.baseDelayMs <= 0) {
    throw new Error(`Invalid baseDelayMs: ${candidate.baseDelayMs}. Must be a positive finite number.`);
  }
  if (!Number.isFinite(candidate.growthFactor) || candidate.growthFactor < 1) {
    throw new Error(`Invalid growthFactor: ${candidate.growthFactor}. Must be ≥ 1.`);
  }
  if (!Number.isFinite(candidate.maxDelayMs) || candidate.maxDelayMs < candidate.baseDelayMs) {
    throw new Error(`Invalid maxDelayMs: must be finite and ≥ baseDelayMs (${candidate.baseDelayMs}).`);
  }
  const oldValue = currentBackoff;
  currentBackoff = candidate;
  notifyConfigChange(QUEUES_BACKOFF_KEY, oldValue, candidate);
  return currentBackoff;
}

/**
 * Compute the delay (ms) for a given attempt number under the current backoff.
 * `attempt` is 1-indexed (attempt 1 = first retry). Capped at `maxDelayMs`.
 */
export function backoffDelayMs(attempt: number, config: BackoffConfig = currentBackoff): number {
  const raw = config.baseDelayMs * Math.pow(config.growthFactor, attempt - 1);
  return Math.min(raw, config.maxDelayMs);
}

export { QUEUES_BACKOFF_KEY };
