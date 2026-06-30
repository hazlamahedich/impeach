-- Story 2.4: editorial_log table (SEC-6 hash-chained editorial log).
-- Authored by hand: drizzle-kit generate surfaced a false version-check
-- against the project's pinned drizzle-orm 0.35.3 / drizzle-kit 0.28.1
-- (project-context pins); DDL mirrors the Drizzle schema exactly.
-- Columns follow DoD-8. The table is append-only (DoD-17): UPDATE and DELETE
-- are revoked from the editorial_service role.

CREATE TABLE IF NOT EXISTS "editorial_log" (
	"seq" bigint NOT NULL,
	"partition_key" text NOT NULL,
	"prev_hash" text NOT NULL,
	"curr_hash" text NOT NULL,
	"principal_sub" text NOT NULL,
	"signature" text NOT NULL,
	"event" text NOT NULL,
	"jti" text NOT NULL,
	"payload" jsonb NOT NULL,
	"time" timestamptz NOT NULL,
	"witness_cursor" bigint
);

-- No-Fork Guarantee (AC-16): composite PK rejects duplicate (partition_key, seq).
ALTER TABLE "editorial_log" ADD CONSTRAINT "editorial_log_pk" PRIMARY KEY ("partition_key", "seq");

-- jti replay prevention (AC-3): unique per partition.
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_log_partition_jti_uq" ON "editorial_log" ("partition_key", "jti");

-- Time-range query index (DoD-8).
CREATE INDEX IF NOT EXISTS "editorial_log_partition_time_idx" ON "editorial_log" ("partition_key", "time");

-- DoD-17: revoke UPDATE and DELETE from the editorial_service role.
-- The editorial service DB user has INSERT and SELECT only.
-- (Role creation is handled by infra provisioning; this GRANT/REVOKE pair is idempotent.)
DO $$
BEGIN
  -- REVOKE only if the role exists (idempotent across environments).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'editorial_service') THEN
    GRANT INSERT, SELECT ON "editorial_log" TO "editorial_service";
    REVOKE UPDATE, DELETE ON "editorial_log" FROM "editorial_service";
  END IF;
END $$;
