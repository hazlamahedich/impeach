import { pgTable, uuid, timestamp, text, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { documents } from './documents.js';
import type { JobId, JobState, StateRunId, DocumentId } from '@iip/contracts';

/**
 * `ingestion_jobs` — idempotent, observable, resilient ingestion job state
 * (FR-1.6, PC-2.4, NFR-R-1..3).
 *
 * Tracks the lifecycle of each ingestion job: `pending → running → completed`
 * (happy path) or `→ failed → dead_lettered` (DLQ triage). The `job_id` is the
 * SHA-256 of the dedupe anchor (PC-2.4, FR-1.6) — re-enqueuing the same anchor
 * yields the same id, so a crashed-and-retried job resumes rather than
 * duplicates. `state_run_id` is the JOIN key to the LangGraph checkpoint store
 * (NFR-R-3): resume-after-crash reloads the graph from the last checkpoint.
 *
 * **Retry discipline (NFR-R-2):** `attempts` tracks the retry count; the
 * capped exponential backoff lives in `@iip/config` (`packages/config/src/queues.ts`,
 * PC-1d). `max_attempts` is stamped at enqueue time from config so a mid-flight
 * config change does not retroactively alter a running job's budget. When
 * `attempts > max_attempts`, the job transitions to `dead_lettered` and is
 * routed to `dlq:ingest` for operator triage (FR-1.7).
 *
 * **Observability (NFR-O-1):** the operator dashboard queries this table for
 * success rate, throughput, queue depth, and DLQ depth. `last_error` carries
 * the typed error category for triage classification.
 *
 * @rules FR-1.6, PC-2.4, NFR-R-1, NFR-R-2, NFR-R-3, NFR-O-1
 * @adr ADR-001
 */
export const ingestionJobs = pgTable(
  'ingestion_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    // job_id = sha256(dedupe-anchor) — the BullMQ idempotency key (PC-2.4).
    // Unique so re-enqueue of the same anchor is a no-op, not a duplicate.
    job_id: text('job_id').$type<JobId>().notNull(),
    document_id: uuid('document_id')
      .$type<DocumentId>()
      .references(() => documents.id),
    state: text('state').$type<JobState>().notNull().default(sql`'pending'`),
    // LangGraph checkpoint JOIN key (NFR-R-3). Nullable: pending jobs have no run yet.
    state_run_id: text('state_run_id').$type<StateRunId>(),
    attempts: integer('attempts').notNull().default(0),
    max_attempts: integer('max_attempts').notNull().default(5),
    // Typed error category for DLQ triage classification (FR-1.7). Nullable: no error yet.
    last_error: jsonb('last_error'),
    // Job payload (dedupe anchor, stage cursor, etc.). jsonb for flexibility.
    payload: jsonb('payload').notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Idempotency: the same dedupe anchor cannot produce two jobs (PC-2.4, FR-1.6).
    jobIdUq: uniqueIndex('ingestion_jobs_job_id_uq').on(table.job_id),
    // Index on state for the queue-depth / DLQ-depth dashboard queries (NFR-O-1).
    stateIdx: index('ingestion_jobs_state_idx').on(table.state),
    // Index on document_id for the "what jobs ran for this document?" query.
    documentIdIdx: index('ingestion_jobs_document_id_idx').on(table.document_id),
  }),
);
