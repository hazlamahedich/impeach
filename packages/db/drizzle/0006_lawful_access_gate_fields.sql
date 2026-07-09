-- Story 3.2: lawful-access gate fields on `sources` (FR-1.2).
-- Authored by hand following the conventions of 0003_config_history.sql +
-- 0005_sources_deferred_fields.sql: IF NOT EXISTS for idempotent re-runs,
-- UP block live, DOWN block documented (commented) for operator rollback.
--
-- The lawful-access gate (Story 3.2) records the result of the automated
-- public-accessibility check (robots.txt, paywall, login, CAPTCHA, ToS) and
-- the operator confirmation/override provenance on the source row. The gate
-- is fail-closed: `crawling_disabled` defaults true so a source cannot be
-- crawled until cleared by the automated check + operator confirmation (AC-2).
--
-- CHECK constraints mirror the zod enums (lawful_access_status, robots_status)
-- so DB-level drift is caught. Indexes serve operator triage (blocked sources)
-- + the crawler pre-flight (crawlable sources).

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- lawful_access_status: NOT NULL DEFAULT 'pending' (the gate has not run yet).
-- One of 'pending' | 'allowed' | 'blocked' (CHECK added below).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_status" text DEFAULT 'pending' NOT NULL;

-- lawful_access_checked_at: nullable timestamptz (when the automated check ran).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_checked_at" timestamptz;

-- robots_status: nullable text. NULL until the first check; one of
-- 'allowed' | 'disallowed' | 'unreachable' (CHECK added below). An unreachable
-- robots.txt is treated as a block (AC-7, fail-closed).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "robots_status" text;

-- paywall_detected / login_required / captcha_detected: nullable boolean.
-- NULL until the first check runs.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "paywall_detected" boolean;
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "login_required" boolean;
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "captcha_detected" boolean;

-- terms_forbid_scraping: NOT NULL DEFAULT false (AC-1 manual operator flag —
-- NOT auto-detected from HTML; honest-by-default).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "terms_forbid_scraping" boolean DEFAULT false NOT NULL;

-- robots_txt_content: nullable text. Captures the fetched robots.txt body for
-- forensic provenance (NULL on unreachable).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "robots_txt_content" text;

-- lawful_access_confirmed: NOT NULL DEFAULT false (operator confirmation of the
-- automated check result). Populated by POST /sources/:id/lawful-access/confirm.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_confirmed" boolean DEFAULT false NOT NULL;

-- lawful_access_confirmed_by / _at: nullable provenance (NULL until confirmed).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_confirmed_by" text;
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_confirmed_at" timestamptz;

-- lawful_access_override: NOT NULL DEFAULT false (operator override of a block).
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_override" boolean DEFAULT false NOT NULL;

-- lawful_access_override_by / _at / _rationale: nullable provenance (NULL until
-- overridden). The rationale is REQUIRED + non-empty at the API layer; the DB
-- column is plain nullable text.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_override_by" text;
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_override_at" timestamptz;
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "lawful_access_override_rationale" text;

-- crawling_disabled: NOT NULL DEFAULT true (fail-closed). A source cannot be
-- crawled until the automated check + operator confirmation/override clears it.
ALTER TABLE "sources"
	ADD COLUMN IF NOT EXISTS "crawling_disabled" boolean DEFAULT true NOT NULL;

-- ── CHECK constraints (mirror the zod enums) ──

ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_lawful_access_status_check";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_lawful_access_status_check"
		CHECK ("lawful_access_status" IN ('pending', 'allowed', 'blocked'));

ALTER TABLE "sources"
	DROP CONSTRAINT IF EXISTS "sources_robots_status_check";
ALTER TABLE "sources"
	ADD CONSTRAINT "sources_robots_status_check"
		CHECK ("robots_status" IS NULL OR "robots_status" IN ('allowed', 'disallowed', 'unreachable'));

-- ── Indexes (operator triage + crawler pre-flight) ──

CREATE INDEX IF NOT EXISTS "sources_lawful_access_status_idx"
	ON "sources" ("lawful_access_status");

CREATE INDEX IF NOT EXISTS "sources_crawling_disabled_idx"
	ON "sources" ("crawling_disabled");

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; documented for manual rollback)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS "sources_crawling_disabled_idx";
-- DROP INDEX IF EXISTS "sources_lawful_access_status_idx";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_robots_status_check";
-- ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_lawful_access_status_check";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "crawling_disabled";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_override_rationale";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_override_at";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_override_by";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_override";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_confirmed_at";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_confirmed_by";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_confirmed";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "robots_txt_content";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "terms_forbid_scraping";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "captcha_detected";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "login_required";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "paywall_detected";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "robots_status";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_checked_at";
-- ALTER TABLE "sources" DROP COLUMN IF EXISTS "lawful_access_status";
