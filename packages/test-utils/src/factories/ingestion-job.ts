/**
 * Test factory for `ingestion_jobs` rows (Story 3.5, FR-1.6, PC-2.4, NFR-R-1..3).
 *
 * Produces valid `TestIngestionJob` records with sensible defaults that the
 * ingestion-job repository (and integration tests) can consume directly. The
 * branded types (`JobId`, `JobState`, `StateRunId`, `DocumentId`) are
 * constructed via `asJobId` / `asJobState` / `asStateRunId` cast helpers
 * (`asDocumentId` is available from `./document.js` when a non-null document_id
 * override is needed) because the brand is a phantom — the runtime value is the
 * plain string. Tests do not need to exercise the zod `.parse` gate on every
 * field to obtain a typed value.
 *
 * @rules FR-1.6, PC-2.4, NFR-R-1, NFR-R-2, NFR-R-3
 */
import {
  JobIdSchema,
  JobState as JobStateSchema,
  StateRunIdSchema,
} from '@iip/contracts';
import type {
  JobId,
  JobState,
  StateRunId,
  DocumentId,
} from '@iip/contracts';

/** Branded-bypass for tests: parse a 64-char hex digest into a branded JobId. */
export function asJobId(hex64: string): JobId {
  return JobIdSchema.parse(hex64);
}

/** Branded-bypass for tests: parse a sanctioned value into a branded JobState. */
export function asJobState(
  value: 'pending' | 'running' | 'completed' | 'failed' | 'dead_lettered' | 'cancelled',
): JobState {
  return JobStateSchema.parse(value);
}

/** Branded-bypass for tests: parse a plain string into a branded StateRunId. */
export function asStateRunId(value: string): StateRunId {
  return StateRunIdSchema.parse(value);
}

/**
 * TestJobError — the `ingestion_jobs.last_error` jsonb sub-document.
 *
 * Captures the terminal failure of an exhausted-retry job (NFR-R-1): a
 * machine-readable `code`, a human-readable `message`, and an optional
 * `category` for triage grouping. Nullable at the column level: a successful
 * or in-flight job has `last_error = null`.
 *
 * @rules FR-1.6, NFR-R-1, NFR-R-2
 */
export interface TestJobError {
  readonly code: string;
  readonly message: string;
  readonly category?: string;
}

/**
 * TestIngestionJob — a single `ingestion_jobs` row.
 *
 * Mirrors the `ingestion_jobs` Drizzle schema
 * (`packages/db/src/schema/ingestion-jobs.ts`, migration `0004_epic3_ingest_tables.sql`).
 *
 * NOTE: `id` is a PLAIN string uuid — the schema's `uuid('id').primaryKey()`
 * is NOT branded with `.$type<>()`, unlike the `job_id` column which is
 * branded `JobId`. This mirrors the migration exactly
 * (`"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `"job_id" text NOT NULL`).
 *
 * `job_id` = `sha256(dedupeAnchor)` (PC-2.4, FR-1.6): the BullMQ idempotency
 * key. `document_id` is nullable — a pending job has no document yet.
 * `state_run_id` is nullable — set once the LangGraph checkpoint is created
 * (NFR-R-3). `last_error` is nullable — set only on terminal failure.
 *
 * @rules FR-1.6, PC-2.4, NFR-R-1, NFR-R-2, NFR-R-3
 */
export interface TestIngestionJob {
  readonly id: string;
  readonly job_id: JobId;
  readonly document_id: DocumentId | null;
  readonly state: JobState;
  readonly state_run_id: StateRunId | null;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly last_error: TestJobError | null;
  readonly payload: Record<string, unknown>;
  readonly created_at: Date;
  readonly updated_at: Date;
}

const DEFAULT_NOW = () => new Date('2026-07-08T00:00:00.000Z');

/**
 * Build an `ingestion_jobs` row with sensible defaults (FR-1.6, PC-2.4).
 *
 * Every field can be overridden. The defaults are:
 *  - `id`: a fixed UUID v4 `00000000-0000-4000-8000-000000000003` (deterministic; plain string — NOT branded, matches schema)
 *  - `job_id`: `'b'.repeat(64)` (a valid 64-char lowercase hex SHA-256 digest — the BullMQ idempotency key)
 *  - `document_id`: `null` (a pending job has no document yet)
 *  - `state`: `pending` (enqueued, not yet picked up — NFR-R-1)
 *  - `state_run_id`: `null` (no LangGraph checkpoint yet — NFR-R-3)
 *  - `attempts`: `0` (no retries yet)
 *  - `max_attempts`: `5` (the schema DEFAULT — NFR-R-2 bounded retries)
 *  - `last_error`: `null` (no failure yet)
 *  - `payload`: `{ stage: 'fetch' }` (minimal valid jsonb — the pipeline cursor)
 *  - `created_at` / `updated_at`: `2026-07-08T00:00:00.000Z` (deterministic)
 *
 * Deterministic timestamps + IDs (rather than `new Date()` / `crypto.randomUUID()`)
 * keep test assertions stable; tests that need fresh values pass them explicitly.
 *
 * @rules FR-1.6, PC-2.4, NFR-R-1, NFR-R-2, NFR-R-3
 */
export function makeIngestionJob(
  overrides: Partial<TestIngestionJob> = {},
): TestIngestionJob {
  const now = overrides.updated_at ?? DEFAULT_NOW();
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000003',
    job_id: overrides.job_id ?? asJobId('b'.repeat(64)),
    document_id: overrides.document_id ?? null,
    state: overrides.state ?? asJobState('pending'),
    state_run_id: overrides.state_run_id ?? null,
    attempts: overrides.attempts ?? 0,
    max_attempts: overrides.max_attempts ?? 5,
    last_error: overrides.last_error ?? null,
    payload: overrides.payload ?? { stage: 'fetch' },
    created_at: overrides.created_at ?? DEFAULT_NOW(),
    updated_at: now,
  };
}
