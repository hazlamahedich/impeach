-- Epic 3 prep (TD3): sources, documents, ingestion_jobs tables
-- (FR-1.1, FR-1.3, FR-1.4, FR-1.5, FR-1.6, SEC-3, PC-1a, PC-2.4).
-- Authored by hand: drizzle-kit generate surfaced a false version-check against
-- the project's pinned drizzle-orm 0.45.2 / drizzle-kit 0.31.10 (project-context
-- pins, established Story 2.6a); DDL mirrors the Drizzle schemas in
-- packages/db/src/schema/{sources,documents,ingestion-jobs}.ts exactly.
--
-- These three tables are the Epic 3 ingest pipeline substrate:
--  - sources: source registry with confirmed trust tiers (FR-1.1, SEC-3)
--  - documents: per-artifact provenance + content_checksum dedupe (FR-1.3, FR-1.5)
--  - ingestion_jobs: idempotent observable resilient job state (FR-1.6, PC-2.4)
--
-- Conventions mirror 0003_config_history.sql (the cleanest precedent):
--  - snake_case tables/columns; UUID PKs via gen_random_uuid()
--  - FKs = <entity>_id; indexes = idx_<table>_<cols>; uniqueness = uq_<table>_<cols>
--  - CHECK-constraint enums synced to packages/contracts zod (PC-4)
--  - IF NOT EXISTS for idempotent re-runs
--  - UP block live; DOWN block documented (commented) for operator rollback
--
-- This file carries explicit UP + DOWN blocks. drizzle-kit migrate applies
-- the file forward-only (the tool has no first-class DOWN); the DOWN block is
-- documented here for operator-run rollbacks and is exercised by the
-- ingest-schema integration test (DoD).

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- ── sources (FR-1.1, SEC-3) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"source_type" text NOT NULL,
	"crawl_strategy" text NOT NULL,
	"trust_tier" integer NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"wire_service" text,
	"original_publisher" text,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sources_url_uq" ON "sources" ("url");
CREATE INDEX IF NOT EXISTS "sources_confirmed_idx" ON "sources" ("confirmed");
CREATE INDEX IF NOT EXISTS "sources_trust_tier_idx" ON "sources" ("trust_tier");

-- Vocabulary CHECKs (belt-and-suspenders, synced to packages/contracts/src/ingest.ts z.enum).
ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_source_type_check";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_source_type_check"
	CHECK ("source_type" IN ('government', 'court', 'media', 'press_release', 'transcript'));

ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_crawl_strategy_check";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_crawl_strategy_check"
	CHECK ("crawl_strategy" IN ('rss', 'sitemap', 'list_page', 'api', 'manual'));

-- Trust tier CHECK: must be 1, 2, or 3 (T-007). Mirrors isValidTrustTier.
ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_trust_tier_check";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_trust_tier_check"
	CHECK ("trust_tier" IN (1, 2, 3));

-- ── documents (FR-1.3, FR-1.5, PC-1a, SEC-3) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"content_checksum" text NOT NULL,
	"raw_snapshot_key" text NOT NULL,
	"fetch_metadata" jsonb NOT NULL,
	"intake_document_id" uuid,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

-- FK to sources (lineage). ON DELETE RESTRICT: a source with documents cannot
-- be deleted (provenance chain integrity — SEC-3).
ALTER TABLE "documents"
	DROP CONSTRAINT IF EXISTS "documents_source_id_sources_id_fk";
ALTER TABLE "documents"
	ADD CONSTRAINT "documents_source_id_sources_id_fk"
	FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT;

-- Dedupe anchor (PC-1a, FR-1.3): the same content_checksum cannot produce two documents.
CREATE UNIQUE INDEX IF NOT EXISTS "documents_content_checksum_uq"
	ON "documents" ("content_checksum");
CREATE INDEX IF NOT EXISTS "documents_source_id_idx" ON "documents" ("source_id");
CREATE INDEX IF NOT EXISTS "documents_intake_document_id_idx" ON "documents" ("intake_document_id");

-- ── ingestion_jobs (FR-1.6, PC-2.4, NFR-R-1..3) ──────────────────────────
CREATE TABLE IF NOT EXISTS "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"document_id" uuid,
	"state" text DEFAULT 'pending' NOT NULL,
	"state_run_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" jsonb,
	"payload" jsonb NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);

-- FK to documents (nullable: pending jobs have no document yet).
ALTER TABLE "ingestion_jobs"
	DROP CONSTRAINT IF EXISTS "ingestion_jobs_document_id_documents_id_fk";
ALTER TABLE "ingestion_jobs"
	ADD CONSTRAINT "ingestion_jobs_document_id_documents_id_fk"
	FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL;

-- Idempotency: the same dedupe anchor cannot produce two jobs (PC-2.4, FR-1.6).
CREATE UNIQUE INDEX IF NOT EXISTS "ingestion_jobs_job_id_uq"
	ON "ingestion_jobs" ("job_id");
CREATE INDEX IF NOT EXISTS "ingestion_jobs_state_idx" ON "ingestion_jobs" ("state");
CREATE INDEX IF NOT EXISTS "ingestion_jobs_document_id_idx" ON "ingestion_jobs" ("document_id");

-- Vocabulary CHECK: job state synced to packages/contracts/src/ingest.ts z.enum.
ALTER TABLE "ingestion_jobs"
	DROP CONSTRAINT IF EXISTS "ingestion_jobs_state_check";
ALTER TABLE "ingestion_jobs"
	ADD CONSTRAINT "ingestion_jobs_state_check"
	CHECK ("state" IN ('pending', 'running', 'completed', 'failed', 'dead_lettered', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; verified by ingest-schema integration test)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS "ingestion_jobs_document_id_idx";
-- DROP INDEX IF EXISTS "ingestion_jobs_state_idx";
-- DROP INDEX IF EXISTS "ingestion_jobs_job_id_uq";
-- ALTER TABLE "ingestion_jobs" DROP CONSTRAINT IF EXISTS "ingestion_jobs_state_check";
-- ALTER TABLE "ingestion_jobs" DROP CONSTRAINT IF EXISTS "ingestion_jobs_document_id_documents_id_fk";
-- DROP TABLE IF EXISTS "ingestion_jobs";
-- DROP INDEX IF EXISTS "documents_intake_document_id_idx";
-- DROP INDEX IF EXISTS "documents_source_id_idx";
-- DROP INDEX IF EXISTS "documents_content_checksum_uq";
-- ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_source_id_sources_id_fk";
-- DROP TABLE IF EXISTS "documents";
-- DROP INDEX IF EXISTS "sources_trust_tier_idx";
-- DROP INDEX IF EXISTS "sources_confirmed_idx";
-- DROP INDEX IF EXISTS "sources_url_uq";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_trust_tier_check";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_crawl_strategy_check";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_source_type_check";
-- DROP TABLE IF EXISTS "sources";
