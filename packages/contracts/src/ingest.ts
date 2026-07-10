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
import { isValidTrustTier } from './trust-tier.js';

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
// place. Do NOT duplicate the taxonomy (PC-4 #14). `isValidTrustTier` is
// imported above for local use in the source-registry schemas and re-exported
// here so ingest-domain consumers can import it from one place.
export { isValidTrustTier } from './trust-tier.js';
export type { TrustTierNumber } from './trust-tier.js';

// ─────────────────────────────────────────────────────────────────────────────
// Source registry API schemas (FR-1.1, Story 3.1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default `trust_tier` mapping by `source_type` (AC-2, SEC-3).
 *
 * A source's tentative tier is derived from its classification at registration
 * time. The operator MAY override the tier to 1, 2, or 3 in the payload — the
 * override is validated server-side (DoD-3); clients cannot self-attest trust.
 *
 * The tier is always persisted as provisional (`confirmed = false`) until the
 * deferred legal/editorial confirmation workflow runs (AC-8).
 *
 * @rules FR-1.1, SEC-3, AC-2
 */
export const DEFAULT_TRUST_TIER_BY_SOURCE_TYPE: Readonly<Record<SourceSourceTypeLiteral, 1 | 2>> = {
  government: 1,
  court: 1,
  transcript: 1,
  media: 2,
  press_release: 2,
};

/**
 * RegisterSourcePayloadSchema — the request body for `POST /sources` (FR-1.1).
 *
 * The `trust_tier` field is OPTIONAL: when omitted the server assigns the
 * `DEFAULT_TRUST_TIER_BY_SOURCE_TYPE` default (AC-2). When present it MUST be a
 * valid tier (1 | 2 | 3) — `isValidTrustTier` enforces the closed set (SEC-3).
 *
 * The `confirmed` field is REJECTED via `.strict()`: callers cannot self-attest
 * trust (DoD-3, AC-4). Any unknown key (including `confirmed`) is a validation
 * error — the server is the sole authority over `confirmed`, always `false` on
 * registration. Confirmation is a separate deferred workflow (AC-8).
 *
 * `trust_tier` is OPTIONAL: when omitted the server assigns the default tier
 * from `DEFAULT_TRUST_TIER_BY_SOURCE_TYPE` (AC-2); when present it must be a
 * valid tier (1 | 2 | 3). The operator MAY override the default.
 *
 * `original_publisher_id` is the nullable FK to `sources.id` for EI-2
 * independence tracking (a wire-service story syndicated across outlets is NOT
 * independent corroboration). Nullable + optional: a primary origin has none.
 *
 * @rules FR-1.1, SEC-3, AC-1, AC-2, AC-7, DoD-3
 */
export const RegisterSourcePayloadSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url(),
    source_type: SourceSourceTypeLiteral,
    crawl_strategy: CrawlStrategyLiteral,
    trust_tier: z
      .number()
      .int()
      .refine(isValidTrustTier, {
        message: 'trust_tier must be one of: 1, 2, 3',
      })
      .optional(),
    is_wire_service: z.boolean().default(false),
    original_publisher_id: SourceIdSchema.optional(),
    // Story 3.2 — manual operator flag for ToS scraping prohibition (AC-1).
    terms_forbid_scraping: z.boolean().optional(),
  })
  // REJECT `confirmed` + all unknown keys: callers cannot self-attest trust
  // (DoD-3). `.strict()` makes any unrecognized key a validation error so the
  // schema itself (not just the route handler) enforces that `confirmed` is
  // server-controlled. The contract test (TC-2.1) asserts `confirmed: true`
  // fails parse; the integration test (TC-1.4) asserts the 400.
  .strict();
export type RegisterSourcePayload = z.infer<typeof RegisterSourcePayloadSchema>;

/**
 * UpdateSourcePayloadSchema — the request body for `PATCH /sources/:id` (AC-6).
 *
 * Every mutable registration field is optional here (partial update). The
 * `confirmed` field is ABSENT from this schema entirely — confirmation is a
 * separate deferred workflow (AC-8) and must not be reachable via the update
 * endpoint. Unknown keys are stripped (`.strip()`).
 *
 * @rules FR-1.1, AC-6, DoD-3
 */
export const UpdateSourcePayloadSchema = z
  .object({
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    source_type: SourceSourceTypeLiteral.optional(),
    crawl_strategy: CrawlStrategyLiteral.optional(),
    trust_tier: z
      .number()
      .int()
      .refine(isValidTrustTier, { message: 'trust_tier must be one of: 1, 2, 3' })
      .optional(),
    is_wire_service: z.boolean().optional(),
    original_publisher_id: SourceIdSchema.nullable().optional(),
    // Story 3.2 — manual operator flag for ToS scraping prohibition (AC-1).
    terms_forbid_scraping: z.boolean().optional(),
  })
  .strict();
export type UpdateSourcePayload = z.infer<typeof UpdateSourcePayloadSchema>;

/**
 * ConfirmationStatus — the derived transparency flag (AC-3).
 *
 * `"tentative"` when `confirmed = false` (the tier is provisional, subject to
 * legal/editorial review); `"confirmed"` when the deferred confirmation
 * workflow has run. The API derives this from `confirmed`; it is never written
 * directly.
 *
 * @rules FR-1.1, AC-3
 */
export const ConfirmationStatusLiteral = z.enum(['tentative', 'confirmed']);
export type ConfirmationStatusLiteral = z.infer<typeof ConfirmationStatusLiteral>;

/**
 * SourceResponseSchema — the API response shape for a single source (AC-5, AC-7).
 *
 * Carries every `sources` column plus the derived `confirmation_status`. The
 * AC-7 deferred fields (`confirmed_by`, `confirmed_at`, `confirmation_rationale`)
 * are nullable — they exist in the schema from day one but are NOT writable in
 * this story (the confirmation workflow is deferred, AC-8).
 *
 * `original_publisher_id` is a nullable `SourceId` FK (EI-2 independence). On
 * responses it is `null` for a primary origin.
 *
 * @rules FR-1.1, AC-3, AC-5, AC-7
 */
export const SourceResponseSchema = z.object({
  id: SourceIdSchema,
  name: z.string(),
  url: z.string(),
  source_type: SourceSourceTypeLiteral,
  crawl_strategy: CrawlStrategyLiteral,
  trust_tier: z.number().int(),
  confirmed: z.boolean(),
  confirmation_status: ConfirmationStatusLiteral,
  is_wire_service: z.boolean(),
  original_publisher_id: SourceIdSchema.nullable(),
  confirmed_by: z.string().nullable(),
  confirmed_at: z.string().datetime().nullable(),
  confirmation_rationale: z.string().nullable(),
  // Story 3.2 — lawful-access gate fields (FR-1.2). The automated check fields
  // are nullable until the first check runs; the confirmation + override fields
  // mirror the SEC-6 provenance discipline. `crawling_disabled` defaults true
  // (fail-closed: a source cannot be crawled until cleared). `terms_forbid_scraping`
  // is NOT nullable — it is a NOT NULL DEFAULT false manual operator flag (AC-1).
  lawful_access_status: z.enum(['pending', 'allowed', 'blocked']),
  lawful_access_checked_at: z.string().datetime().nullable(),
  robots_status: z.enum(['allowed', 'disallowed', 'unreachable']).nullable(),
  paywall_detected: z.boolean().nullable(),
  login_required: z.boolean().nullable(),
  captcha_detected: z.boolean().nullable(),
  terms_forbid_scraping: z.boolean(),
  robots_txt_content: z.string().nullable(),
  lawful_access_confirmed: z.boolean(),
  lawful_access_confirmed_by: z.string().nullable(),
  lawful_access_confirmed_at: z.string().datetime().nullable(),
  lawful_access_override: z.boolean(),
  lawful_access_override_by: z.string().nullable(),
  lawful_access_override_at: z.string().datetime().nullable(),
  lawful_access_override_rationale: z.string().nullable(),
  crawling_disabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type SourceResponse = z.infer<typeof SourceResponseSchema>;

/**
 * SourceListFiltersSchema — the query-string filters for `GET /sources` (AC-5).
 *
 * All optional. `confirmed` is a boolean coerced from the query string.
 *
 * @rules FR-1.1, AC-5
 */
export const SourceListFiltersSchema = z
  .object({
    source_type: SourceSourceTypeLiteral.optional(),
    trust_tier: z.coerce.number().int().refine(isValidTrustTier).optional(),
    confirmed: z.coerce.boolean().optional(),
    lawful_access_status: z.enum(['pending', 'allowed', 'blocked']).optional(),
    crawling_disabled: z.coerce.boolean().optional(),
  })
  .strip();
export type SourceListFilters = z.infer<typeof SourceListFiltersSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Lawful-access gate (FR-1.2, Story 3.2 — the pure decision function's I/O)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LawfulAccessInputSchema — the pre-computed detection signals fed to the pure
 * `assessLawfulAccess` decision function (Story 3.2).
 *
 * The gate is a pure function over these signals; the HTTP-fetching + HTML-
 * scanning logic that POPULATES them lives in Story 3.3's fetch adapter. This
 * decoupling keeps the gate trivially testable + free of network I/O. The
 * signals cover the five AC-1 checks:
 *  - `robotsCheck.allowed` — does the source's robots.txt permit `User-Agent: *`?
 *  - `paywallDetected` — paywall indicators (Piano / subscription blockers)?
 *  - `loginRequired` — HTML forms with `type="password"` / auth gates?
 *  - `captchaRequired` — Turnstile / ReCAPTCHA / DataDome challenge scripts?
 *  - `tosForbidden` — the manual operator flag for ToS scraping prohibition
 *    (NOT auto-detected from HTML; read from the persisted source record).
 *
 * `crawlDelayMs` is the robots.txt `Crawl-delay` directive (null when absent);
 * recorded for provenance but does not affect the allowed/blocked decision.
 *
 * @rules FR-1.2, SEC-5, AC-1
 */
export const LawfulAccessInputSchema = z
  .object({
    robotsCheck: z.object({
      allowed: z.boolean(),
      crawlDelayMs: z.number().nullable(),
    }),
    paywallDetected: z.boolean(),
    loginRequired: z.boolean(),
    captchaRequired: z.boolean(),
    tosForbidden: z.boolean(),
  })
  .strict();
export type LawfulAccessInput = z.infer<typeof LawfulAccessInputSchema>;

/**
 * LawfulAccessCheckResultSchema — the persisted shape of a completed automated
 * lawful-access check (AC-1). The route handler writes this to the source row
 * via `repo.saveLawfulAccessCheckResult`.
 *
 * `robots_status` is the three-valued robots.txt outcome (`'allowed'` /
 * `'disallowed'` / `'unreachable'`); an unreachable robots.txt is treated as a
 * block (AC-7, fail-closed). `robots_txt_content` captures the fetched
 * robots.txt body for forensic provenance (null on unreachable). `recorded_at`
 * is the ISO-8601 UTC timestamp the check ran.
 *
 * @rules FR-1.2, AC-1, AC-7
 */
export const LawfulAccessCheckResultSchema = z.object({
  robots_status: z.enum(['allowed', 'disallowed', 'unreachable']),
  paywall_detected: z.boolean(),
  login_required: z.boolean(),
  captcha_detected: z.boolean(),
  terms_forbid_scraping: z.boolean(),
  robots_txt_content: z.string().nullable(),
  recorded_at: z.string().datetime(),
});
export type LawfulAccessCheckResult = z.infer<typeof LawfulAccessCheckResultSchema>;

/**
 * ConfirmLawfulAccessPayloadSchema — the request body for
 * `POST /sources/:id/lawful-access/confirm` (AC-3).
 *
 * `confirmed` toggles operator confirmation; `rationale` is an optional free-
 * text note. Confirmation is not a backdoor: confirming a blocked source is
 * rejected with 409 (AC-3); blocked sources must go through the override
 * workflow (AC-4).
 *
 * @rules FR-1.2, AC-3
 */
export const ConfirmLawfulAccessPayloadSchema = z
  .object({
    confirmed: z.boolean(),
    rationale: z.string().optional(),
  })
  .strict();
export type ConfirmLawfulAccessPayload = z.infer<typeof ConfirmLawfulAccessPayloadSchema>;

/**
 * OverrideLawfulAccessPayloadSchema — the request body for
 * `POST /sources/:id/lawful-access/override` (AC-4).
 *
 * `rationale` is REQUIRED + non-empty: an override bypasses a lawful-access
 * block, so a non-empty justification MUST be recorded and appended to the
 * hash-chained editorial log (AC-11). An empty rationale is a validation
 * error at this schema layer.
 *
 * @rules FR-1.2, AC-4, AC-11
 */
export const OverrideLawfulAccessPayloadSchema = z
  .object({
    rationale: z.string().min(1),
  })
  .strict();
export type OverrideLawfulAccessPayload = z.infer<typeof OverrideLawfulAccessPayloadSchema>;

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

// ─────────────────────────────────────────────────────────────────────────────
// Fetch adapters (FR-1.3, Story 3.3 — Crawler port I/O contracts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DiscoveredUrl — a URL discovered by a Crawler's `discover()` method (AC-1).
 *
 * Carries the URL plus optional metadata the crawl strategy extracted (e.g. the
 * feed entry title, the sitemap lastmod). `discovered_at` is the ISO-8601 UTC
 * timestamp the URL was discovered (PC-8).
 *
 * @rules FR-1.3, AC-1
 */
export const DiscoveredUrlSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  discovered_at: z.string().datetime(),
});
export type DiscoveredUrl = z.infer<typeof DiscoveredUrlSchema>;

/**
 * ManualUploadProvenance — the operator-supplied provenance record for manually
 * uploaded documents (AC-5, FR-1.3).
 *
 * Every field is REQUIRED: a manually uploaded document without full provenance
 * is a provenance gap that breaks the citation chain. `obtained_via` records
 * HOW the document was obtained (manual download, FOI request, partnership
 * drop). `content_hash` is the hash of the raw uploaded bytes (distinct from
 * `ContentChecksum` which is over the cleaned text). `legal_basis` records the
 * legal basis for obtaining the document (public record, FOI, court order).
 *
 * @rules FR-1.3, AC-5
 */
export const ManualUploadProvenanceSchema = z.object({
  source_url: z.string().url(),
  obtained_via: z.string().min(1),
  retrieved_at: z.string().datetime(),
  uploader_id: z.string().min(1),
  reviewer_id: z.string().min(1),
  content_hash: ContentChecksumSchema,
  legal_basis: z.string().min(1),
});
export type ManualUploadProvenance = z.infer<typeof ManualUploadProvenanceSchema>;

/**
 * FetchedDocument — the raw bytes + metadata returned by a Crawler's `fetch()`
 * method (AC-2).
 *
 * The raw bytes are the unmodified HTTP response body (HTML, PDF, etc.); the
 * `clean()` step transforms them into `CleanedDocument`. `contentType` drives
 * the cleanup pipeline (HTML stripping vs PDF OCR). `fetchedAt` is the
 * ISO-8601 UTC timestamp the fetch completed (PC-8); it is optional because
 * the `clean()` step can be invoked with a raw document that was not fetched
 * through the adapter (e.g. a pre-existing byte buffer in tests).
 *
 * `provenance` carries the manual-upload provenance record when the document
 * was obtained via manual upload (AC-5); automated fetches omit it.
 *
 * @rules FR-1.3, AC-2, AC-5
 */
export const FetchedDocumentSchema = z.object({
  url: z.string().url(),
  rawBytes: z.custom<Uint8Array>((val) => val instanceof Uint8Array),
  contentType: z.string(),
  fetchedAt: z.string().datetime().optional(),
  provenance: ManualUploadProvenanceSchema.optional(),
});
export type FetchedDocument = z.infer<typeof FetchedDocumentSchema>;

/**
 * CleanedDocument — the structured-text output of a Crawler's `clean()` method
 * (AC-2, FA-7).
 *
 * `text` is the cleaned content: HTML stripped to text, PDF OCR'd to text. The
 * text MUST be a faithful containment of the source — no hallucinated tokens
 * (FA-7). `contentChecksum` is the SHA-256 of the cleaned text (the dedupe
 * anchor, FR-1.3). `provenance` is carried through from the fetch step for
 * manual uploads (AC-5).
 *
 * @rules FR-1.3, AC-2, AC-3, FA-7
 */
export const CleanedDocumentSchema = z.object({
  url: z.string().url(),
  text: z.string(),
  contentChecksum: ContentChecksumSchema,
  provenance: ManualUploadProvenanceSchema.optional(),
});
export type CleanedDocument = z.infer<typeof CleanedDocumentSchema>;

/**
 * FetchMetadata — the metadata persisted alongside a document in the
 * `documents.fetch_metadata` jsonb column (AC-5, FR-1.3).
 *
 * This is the database-level shape; the API-level shape is `FetchedDocument`.
 * `headers` are the HTTP response headers (content-type, etag, last-modified);
 * the provenance fields are populated for manual uploads and absent for
 * automated fetches.
 *
 * @rules FR-1.3, AC-5
 */
export const FetchMetadataSchema = z.object({
  url: z.string().url(),
  retrieved_at: z.string().datetime(),
  headers: z.record(z.string(), z.string()).optional(),
  obtained_via: z.string().optional(),
  uploader_id: z.string().optional(),
  reviewer_id: z.string().optional(),
  legal_basis: z.string().optional(),
});
export type FetchMetadata = z.infer<typeof FetchMetadataSchema>;
