/**
 * Ingest domain contract types — Epic 3 source registry, documents, ingestion
 * jobs (FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6).
 *
 * Branded nominal types prevent transposition of identity fields across the
 * ingest pipeline (project-context Winston #1, SEC-6). A `SourceId` cannot be
 * assigned where a `DocumentId` belongs; a `ContentChecksum` cannot be assigned
 * where a `JobId` belongs — compile-time enforcement beyond runtime validation.
 *
 * Vocabulary enumerations use `z.enum` (not TS `enum`) per PC-4 #14: the
 * inferred union is the only sanctioned form. The enumerations are closed so
 * exhaustive `switch` works (Amelia TS pattern).
 *
 * @rules FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6, SEC-3, PC-1a, PC-2.4, PC-4
 * @adr ADR-001
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Source registry (FR-1.1, SEC-3 — trust tier assigned + confirmed at ingest)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SourceId — branded UUID v4 identifying a single `sources` row.
 *
 * Distinct from `DocumentId` (a source produces many documents). The brand
 * prevents a raw UUID string or a `DocumentId` from being silently assigned
 * where a source row ID is required.
 *
 * @rules FR-1.1, SEC-6
 */
export const SourceIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'must be a valid UUID v4',
  )
  .brand<'SourceId'>();
export type SourceId = z.infer<typeof SourceIdSchema>;

/**
 * SourceSourceType — the closed enumeration of source classifications.
 *
 * Determines eligibility + trust-tier defaults + citation rendering. Mirrored
 * as a CHECK constraint in the `sources` migration.
 *
 * Vocabulary (FR-1.1):
 *  - `government` — official government record (Tier-1 default)
 *  - `court` — court record / decision (Tier-1 default)
 *  - `media` — reputable media outlet (Tier-2 default)
 *  - `press_release` — official press release (Tier-2 default)
 *  - `transcript` — official transcript (Tier-1 default)
 *
 * @rules FR-1.1, SEC-3
 */
export const SourceSourceTypeLiteral = z.enum([
  'government',
  'court',
  'media',
  'press_release',
  'transcript',
]);
export type SourceSourceTypeLiteral = z.infer<typeof SourceSourceTypeLiteral>;
export const SourceSourceType = SourceSourceTypeLiteral.brand<'SourceSourceType'>();
export type SourceSourceType = z.infer<typeof SourceSourceType>;

/**
 * CrawlStrategy — the closed enumeration of document-discovery strategies.
 *
 * v1 ships Firecrawl (Tier-1 scrapable) + manual upload (Tier-4 blocked);
 * rss/sitemap/list-page/api are scaffolded interfaces (ADR-007). The
 * enumeration is closed so the dispatch table is exhaustive.
 *
 * Vocabulary (FR-1.3):
 *  - `rss` — RSS/Atom feed discovery
 *  - `sitemap` — XML sitemap crawl
 *  - `list_page` — list-page link extraction
 *  - `api` — structured API fetch
 *  - `manual` — operator manual upload (Tier-4)
 *
 * @rules FR-1.3, ADR-007
 */
export const CrawlStrategyLiteral = z.enum([
  'rss',
  'sitemap',
  'list_page',
  'api',
  'manual',
]);
export type CrawlStrategyLiteral = z.infer<typeof CrawlStrategyLiteral>;
export const CrawlStrategy = CrawlStrategyLiteral.brand<'CrawlStrategy'>();
export type CrawlStrategy = z.infer<typeof CrawlStrategy>;

// NOTE: TrustTier (1 | 2 | 3) is already defined in trust-tier.ts (TrustTierNumber).
// Re-exported here for ingest-domain convenience; the canonical home remains
// trust-tier.ts so the render gate (the load-bearing consumer) imports from one
// place. Do NOT duplicate the taxonomy (PC-4 #14).

// ─────────────────────────────────────────────────────────────────────────────
// Documents (FR-1.3, FR-1.5 — per-artifact provenance + content_checksum dedupe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DocumentId — branded UUID v4 identifying a single `documents` row.
 *
 * Distinct from `SourceId` (a source produces many documents) and from the
 * `intake_documents.id` (the SEC-2 gate state). A `documents` row is the
 * cleaned, provenance-bearing record post-ingest; `intake_documents` is the
 * two-person-intake gate state. The brand prevents transposition.
 *
 * @rules FR-1.5, SEC-6
 */
export const DocumentIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'must be a valid UUID v4',
  )
  .brand<'DocumentId'>();
export type DocumentId = z.infer<typeof DocumentIdSchema>;

/**
 * ContentChecksum — branded SHA-256 hex digest of cleaned document content.
 *
 * The dedupe anchor for idempotent ingestion (PC-1a, FR-1.3): the same document
 * ingested twice produces the same checksum and is processed once. 64-char
 * lowercase hex. Branded to prevent transposition with `IntakeContentHash`
 * (raw pre-clean hash) and `CorpusHash` (editorial-log hash chain).
 *
 * @rules FR-1.3, PC-1a, SEC-6
 */
export const ContentChecksumSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be a 64-char lowercase hex SHA-256 digest')
  .brand<'ContentChecksum'>();
export type ContentChecksum = z.infer<typeof ContentChecksumSchema>;

/**
 * RawSnapshotKey — branded content-addressed MinIO object key (SHA-256).
 *
 * Points to the immutable raw snapshot in MinIO (FR-1.4). Off the serving
 * path. Versioned append-only bucket (NFR-S-5). Branded to prevent
 * transposition with `ContentChecksum` (the snapshot includes original bytes +
 * fetch metadata; the checksum is over cleaned content only).
 *
 * @rules FR-1.4, NFR-S-5
 */
export const RawSnapshotKeySchema = z
  .string()
  .min(1)
  .brand<'RawSnapshotKey'>();
export type RawSnapshotKey = z.infer<typeof RawSnapshotKeySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Ingestion jobs (FR-1.6, PC-2.4 — idempotent observable resilient ingestion)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JobId — branded SHA-256 hex digest of the dedupe anchor.
 *
 * `jobId = sha256(dedupe-anchor)` (PC-2.4, FR-1.6): idempotency key for
 * BullMQ. Re-enqueuing the same anchor yields the same `jobId`, so a
 * crashed-and-retried job resumes rather than duplicates. 64-char lowercase
 * hex. Branded to prevent transposition with `ContentChecksum`.
 *
 * @rules FR-1.6, PC-2.4, STR-3
 */
export const JobIdSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'must be a 64-char lowercase hex SHA-256 digest')
  .brand<'JobId'>();
export type JobId = z.infer<typeof JobIdSchema>;

/**
 * JobState — the closed enumeration of ingestion-job lifecycle states.
 *
 * Drives the operator triage surface (FR-1.7) and the LangGraph checkpoint
 * resume-after-crash logic (NFR-R-3). Mirrored as a CHECK constraint in the
 * `ingestion_jobs` migration.
 *
 * Vocabulary (FR-1.6, NFR-R-1..3):
 *  - `pending` — enqueued, not yet picked up
 *  - `running` — worker actively processing
 *  - `completed` — finished successfully
 *  - `failed` — exhausted retries; routed to DLQ
 *  - `dead_lettered` — moved to `dlq:ingest` for operator triage
 *  - `cancelled` — operator-cancelled
 *
 * @rules FR-1.6, NFR-R-1, NFR-R-2
 */
export const JobStateLiteral = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'dead_lettered',
  'cancelled',
]);
export type JobStateLiteral = z.infer<typeof JobStateLiteral>;
export const JobState = JobStateLiteral.brand<'JobState'>();
export type JobState = z.infer<typeof JobState>;

/**
 * StateRunId — branded identifier for a LangGraph checkpoint run.
 *
 * The JOIN key between `ingestion_jobs.state_run_id` and the LangGraph
 * checkpoint store (PC-2.4, NFR-R-3). Resume-after-crash reloads the graph
 * state from the last checkpoint. Branded to prevent transposition with
 * `JobId`.
 *
 * @rules PC-2.4, NFR-R-3
 */
export const StateRunIdSchema = z.string().min(1).brand<'StateRunId'>();
export type StateRunId = z.infer<typeof StateRunIdSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Queue names + job schema (PC-2.4, STR-3 — BullMQ wiring lives in worker-side)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queue-name constants (STR-3). One queue per stage; DLQs first-class + pager-able.
 *
 * The BullMQ wiring lives in a worker package per STR-1 (the original
 * `packages/queues` was consolidated away). These constants are the single
 * source of truth for queue names so producer + consumer + DLQ handlers agree.
 *
 * @rules STR-3, PC-2.4, NFR-R-2
 */
export const INGEST_QUEUE_NAME = 'ingest:queue' as const;
export const INGEST_DLQ_NAME = 'dlq:ingest' as const;

/**
 * IngestJobPayload — the BullMQ job payload for an ingestion job (PC-2.4).
 *
 * `jobId` = sha256(dedupeAnchor) (FR-1.6) — the BullMQ job id, used for
 * idempotency. `documentId` and `sourceId` link the job to its provenance.
 * `stage` tracks the pipeline cursor (fetch → dedupe → snapshot → extract → index).
 *
 * @rules FR-1.6, PC-2.4, STR-3
 */
export const IngestJobPayloadSchema = z.object({
  jobId: JobIdSchema,
  documentId: DocumentIdSchema.optional(),
  sourceId: SourceIdSchema,
  dedupeAnchor: z.string().min(1),
  stage: z.string().min(1),
});
export type IngestJobPayload = z.infer<typeof IngestJobPayloadSchema>;

/**
 * Stage-event names written to Redis Streams (STR-3 — event-driven Enqueuer handoff).
 *
 * When a worker completes a stage, it emits `<stage>.completed` to the stream;
 * the Enqueuer (consumer-group leader) reads it and enqueues the next BullMQ
 * job. NO inline enqueue in stage handlers (loses the chain on crash + scatters
 * the DAG).
 *
 * @rules STR-3, PC-2.4
 */
export const STAGE_COMPLETED_SUFFIX = '.completed' as const;
