-- Story 2.10: config_history table (PC-2.6, AR-23, VAL-2, VAL-8 — the real G-2 close).
-- Authored by hand: drizzle-kit generate surfaced a false version-check against
-- the project's pinned drizzle-orm 0.45.2 / drizzle-kit 0.31.10 (project-context
-- pins); DDL mirrors the Drizzle schema in
-- packages/db/src/schema/config-history.ts exactly.
--
-- config_history is the versioned, append-only config-lineage table. Every
-- output-affecting config knob change (model IDs, thresholds, k, fusion
-- weights, eval splits) is recorded as a NEW ROW here. This is the
-- legal-defense prerequisite: without it, the team cannot prove what
-- model/prompt/threshold produced any given answer at the moment of alleged
-- harm — a spoliation gap in any Philippine defamation (RA 10175 / Civil
-- Code) defense.
--
-- **No `effective_until` column (AM-1).** Temporal validity is derived at
-- query time: a row is effective from `effective_from` until the
-- `effective_from` of the next row for the same key. This avoids the
-- contradiction between append-only (no UPDATE) and closing a previous row's
-- window (which would require UPDATE). The `getActiveConfigAt` query uses
-- `ORDER BY effective_from DESC LIMIT 1`.
--
-- **Append-only via trigger, not role REVOKE (AM-2).** The `editorial_log`
-- migration uses role-based REVOKE from `editorial_service`. `config_history`
-- is NOT editorial — it is written by `@iip/config`. Use a self-contained
-- `BEFORE UPDATE OR DELETE` trigger instead, which has no role dependency.
--
-- **Retention vocabulary is DIFFERENT from `intake_documents`.** config_history
-- uses `unbounded_legal_hold`/`superseded_retain`/`purged_after_audit` (NOT
-- `intake_documents`'s `standard`/`litigation_hold`/`immediate_takedown`).
-- The default `unbounded_legal_hold` is HONEST — config_history is unbounded
-- legal-hold *by design* per VAL-8; this is the one table where the default
-- is NOT a fabrication.
--
-- G-2 is CLOSED by this migration ( Story 2.10 completes the G-2 closure
-- criteria: every table in G-2's scope — `intake_documents` from 2.6a AND
-- `config_history` from this story — now has retention_class/legal_hold).
--
-- This file carries explicit UP + DOWN blocks. drizzle-kit migrate applies
-- the file forward-only (the tool has no first-class DOWN); the DOWN block is
-- documented here for operator-run rollbacks and is exercised by the
-- config-history-schema integration test (DoD).

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- IF NOT EXISTS: idempotent re-run safety (AC #6: "Running the UP migration
-- twice does not error"). The integration test exercises this path.
CREATE TABLE IF NOT EXISTS "config_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"effective_from" timestamptz NOT NULL,
	"acting_principal" text NOT NULL,
	"retention_class" text DEFAULT 'unbounded_legal_hold' NOT NULL,
	"legal_hold" boolean DEFAULT true NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL
);

-- No-fork guarantee: two writes to the same key at the same `effective_from`
-- cannot both succeed (mirrors editorial_log's (partition_key, seq) PK).
CREATE UNIQUE INDEX IF NOT EXISTS "config_history_key_effective_from_uq"
	ON "config_history" ("config_key", "effective_from");

-- Partial index scoped to legal_hold = true (sparse: few rows are ever
-- released from hold). Backs the "what is still on legal hold?" scan.
CREATE INDEX IF NOT EXISTS "config_history_legal_hold_idx"
	ON "config_history" ("legal_hold")
	WHERE "legal_hold" = true;

-- Vocabulary CHECK (belt-and-suspenders). The Drizzle def carries the brand;
-- this DB-level constraint rejects a misspelled class from any writer (raw
-- SQL, a future migration, a hand-fix). Matches the z.enum vocabulary in
-- packages/contracts/src/config-history.ts exactly. DISTINCT from
-- intake_documents's retention_class vocabulary.
ALTER TABLE "config_history"
	DROP CONSTRAINT IF EXISTS "config_history_retention_class_check";
ALTER TABLE "config_history"
	ADD CONSTRAINT "config_history_retention_class_check"
	CHECK ("retention_class" IN ('unbounded_legal_hold', 'superseded_retain', 'purged_after_audit'));

-- Hold CHECK: `legal_hold` CANNOT go false unless `retention_class` has
-- transitioned to `purged_after_audit` (AC #2: "a CHECK constraint forbids
-- legal_hold from going false unless retention_class has transitioned to
-- purged_after_audit"). This is the schema-level enforcement of the
-- "never purge" pin — the DEFAULT true + this CHECK = the only legal path
-- to releasing a row from hold is an explicit audit-driven class change.
ALTER TABLE "config_history"
	DROP CONSTRAINT IF EXISTS "config_history_legal_hold_check";
ALTER TABLE "config_history"
	ADD CONSTRAINT "config_history_legal_hold_check"
	CHECK ("legal_hold" = true OR "retention_class" = 'purged_after_audit');

-- Append-only trigger (AC #3, AM-2 — self-contained, no role dependency).
-- The editorial_log migration uses role-based REVOKE from editorial_service;
-- config_history is NOT editorial (written by @iip/config), so a trigger is
-- the correct mechanism. BEFORE UPDATE OR DELETE ... RETURN NULL rejects
-- every mutation with a clear exception. Supersession is recorded by a NEW
-- ROW with effective_from; the previous row's window is implicitly closed by
-- the successor's effective_from, never by mutating history (AM-1).
CREATE OR REPLACE FUNCTION reject_config_history_mutation()
RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'config_history is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS config_history_append_only ON "config_history";
CREATE TRIGGER config_history_append_only
	BEFORE UPDATE OR DELETE ON "config_history"
	FOR EACH ROW EXECUTE FUNCTION reject_config_history_mutation();

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; verified by config-history-schema integration test)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP TRIGGER IF EXISTS config_history_append_only ON "config_history";
-- DROP FUNCTION IF EXISTS reject_config_history_mutation();
-- ALTER TABLE "config_history" DROP CONSTRAINT IF EXISTS "config_history_legal_hold_check";
-- ALTER TABLE "config_history" DROP CONSTRAINT IF EXISTS "config_history_retention_class_check";
-- DROP INDEX IF EXISTS "config_history_legal_hold_idx";
-- DROP INDEX IF EXISTS "config_history_key_effective_from_uq";
-- DROP TABLE IF EXISTS "config_history";
