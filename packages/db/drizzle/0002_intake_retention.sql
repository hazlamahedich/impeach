-- Story 2.6a: retention/takedown metadata on intake_documents (AR-23, VAL-2 G-2).
-- Authored by hand: drizzle-kit generate surfaced a false version-check against
-- the project's pinned drizzle-orm 0.35.3 / drizzle-kit 0.28.1 (project-context
-- pins); DDL mirrors the Drizzle schema in
-- packages/db/src/schema/intake-documents.ts exactly.
--
-- Three ORTHOGONAL concepts (see packages/contracts/src/intake/retention.ts):
--   retention_class   — governance HOLD CLASS (branded RetentionPolicy).
--   takedown_trigger  — removal RATIONALE (free text; court_order/dmca/
--                       editor_retraction). Distinct from the class + freeze.
--   legal_hold        — litigation-FREEZE flag (boolean).
--   retention_set_at  — when the non-default class/hold was set.
--
-- Nullability (Option A): retention_class/takedown_trigger/retention_set_at
-- are NULLABLE because they are populated only when a takedown/hold event
-- triggers. At defamation grade, NULL retention_class = "no decision yet"
-- (honest); a fabricated 'standard' default = a lie that looks like
-- compliance (Winston #2/#20). legal_hold is the SOLE exception: NOT NULL
-- DEFAULT false (boolean-NULL is an anti-pattern). A vocabulary CHECK on
-- retention_class is included here as near-zero-cost belt-and-suspenders
-- (the Drizzle def stays nullable).
--
-- `superseded_at` is NOT in this story — moved to ADR-0017
-- (supersession-orchestration) scope.
--
-- G-2 is NOT closed by this migration — config_history (Story 2.10) is still
-- unbuilt. G-2 stays OPEN until 2.10 lands.
--
-- This file carries explicit UP + DOWN blocks. drizzle-kit migrate applies
-- the file forward-only (the tool has no first-class DOWN); the DOWN block is
-- documented here for operator-run rollbacks and is exercised by the
-- retention-schema integration test (DoD).

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- legal_hold FIRST: NOT NULL requires a default for existing rows. DEFAULT
-- false populates every existing row with the honest "not held" value before
-- the constraint is enforced.
ALTER TABLE "intake_documents" ADD COLUMN IF NOT EXISTS "legal_hold" boolean NOT NULL DEFAULT false;

ALTER TABLE "intake_documents" ADD COLUMN IF NOT EXISTS "retention_class" text;
ALTER TABLE "intake_documents" ADD COLUMN IF NOT EXISTS "takedown_trigger" text;
ALTER TABLE "intake_documents" ADD COLUMN IF NOT EXISTS "retention_set_at" timestamptz;

-- Vocabulary CHECK (belt-and-suspenders). The Drizzle def stays nullable per
-- Option A; this DB-level constraint rejects a misspelled class from any
-- writer (raw SQL, a future migration, a hand-fix). Matches the z.enum
-- vocabulary in packages/contracts/src/intake/retention.ts exactly.
ALTER TABLE "intake_documents"
  DROP CONSTRAINT IF EXISTS "intake_documents_retention_class_check";
ALTER TABLE "intake_documents"
  ADD CONSTRAINT "intake_documents_retention_class_check"
  CHECK ("retention_class" IS NULL OR "retention_class" IN ('standard', 'litigation_hold', 'immediate_takedown'));

-- Partial indexes backing the two hot scans:
--   - legal_hold = true  : the "what is frozen?" hold scan (sparse: few rows
--                          are on hold, so the partial index stays small).
--   - retention_class    : the "what is on a non-default class?" audit scan.
--                          WHERE NOT NULL keeps the index sparse (NULL rows
--                          are not indexed).
CREATE INDEX IF NOT EXISTS "intake_documents_legal_hold_idx"
  ON "intake_documents" ("legal_hold")
  WHERE "legal_hold" = true;

CREATE INDEX IF NOT EXISTS "intake_documents_retention_class_idx"
  ON "intake_documents" ("retention_class")
  WHERE "retention_class" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; verified by retention-schema integration test)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS "intake_documents_retention_class_idx";
-- DROP INDEX IF EXISTS "intake_documents_legal_hold_idx";
-- ALTER TABLE "intake_documents" DROP CONSTRAINT IF EXISTS "intake_documents_retention_class_check";
-- ALTER TABLE "intake_documents" DROP COLUMN IF EXISTS "retention_set_at";
-- ALTER TABLE "intake_documents" DROP COLUMN IF EXISTS "takedown_trigger";
-- ALTER TABLE "intake_documents" DROP COLUMN IF EXISTS "retention_class";
-- ALTER TABLE "intake_documents" DROP COLUMN IF EXISTS "legal_hold";
