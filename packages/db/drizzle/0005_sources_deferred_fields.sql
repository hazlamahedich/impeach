-- Story 3.1: sources deferred + EI-2 provenance fields (AC-7, FR-1.1, SEC-3, EI-2).
-- Authored by hand: the fields align the `sources` table with the amended
-- Story 3.1 contract (party-mode review 2026-07-08). Migration 0004 shipped
-- `wire_service` (text) + `original_publisher` (text); the amended story's
-- data model uses `is_wire_service` (boolean) + `original_publisher_id`
-- (self-referential FK) per AC-1/AC-7. This migration:
--  (1) drops the two superseded text columns (no data in them yet — 0004 is
--      new and the table has no rows in any deployed environment), and
--  (2) adds the AC-7 fields: is_wire_service, original_publisher_id (FK),
--      confirmed_by, confirmed_at, confirmation_rationale.
--
-- Conventions mirror 0003_config_history.sql + 0004_epic3_ingest_tables.sql:
--  - IF NOT EXISTS for idempotent re-runs
--  - UP block live; DOWN block documented (commented) for operator rollback

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- (1) Drop superseded text columns from 0004. No data migration: these columns
-- are new (TD3, 2026-07-08) and carry no rows in any deployed environment.
ALTER TABLE "sources" DROP COLUMN IF EXISTS "wire_service";
ALTER TABLE "sources" DROP COLUMN IF EXISTS "original_publisher";

-- (2) Add AC-7 deferred + EI-2 provenance fields.

-- is_wire_service: NOT NULL with false default (EI-2 independence). A source is
-- a wire service only when explicitly marked; honest-by-default.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "is_wire_service" boolean DEFAULT false NOT NULL;

-- original_publisher_id: nullable self-referential FK (EI-2). A republisher
-- points at its primary origin; a primary origin has NULL. ON DELETE SET NULL:
-- deleting the primary origin orphans the republisher (does not cascade-delete
-- the republisher — provenance lineage is preserved, the pointer is severed).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "original_publisher_id" uuid;

ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_original_publisher_id_sources_id_fk";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_original_publisher_id_sources_id_fk"
		FOREIGN KEY ("original_publisher_id") REFERENCES "sources"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "sources_original_publisher_id_idx"
	ON "sources" ("original_publisher_id");

-- confirmed_by: nullable text (the principal who confirmed). Populated by the
-- deferred confirmation workflow (AC-8), NULL until then.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "confirmed_by" text;

-- confirmed_at: nullable timestamptz (when confirmation occurred). NULL until
-- the deferred confirmation workflow runs.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz;

-- confirmation_rationale: nullable text (legal/editorial justification).
-- NULL until the deferred confirmation workflow runs.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "confirmation_rationale" text;

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; documented for manual rollback)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS "sources_original_publisher_id_idx";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_original_publisher_id_sources_id_fk";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "confirmation_rationale";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "confirmed_at";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "confirmed_by";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "original_publisher_id";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "is_wire_service";
-- -- Restore the superseded 0004 columns (data lost; columns re-added empty):
-- ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "wire_service" text;
-- ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "original_publisher" text;
