-- Story 2.3: intake_documents table (SEC-2 two-person intake state machine).
-- Authored by hand: drizzle-kit generate surfaced a false version-check
-- against the project's pinned drizzle-orm 0.35.3 / drizzle-kit 0.28.1
-- (project-context pins); DDL mirrors the Drizzle schema exactly.
-- Columns follow DoD-7. content_hash is a 64-char lowercase hex SHA-256;
-- status is branded DocumentStatus (enforced at the app layer via @iip/contracts).

CREATE TABLE IF NOT EXISTS "intake_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_hash" text NOT NULL,
	"status" text NOT NULL,
	"reviewer_sub" text,
	"reviewer_signature" text,
	"reviewer_key_kid" text,
	"reviewed_at" timestamptz,
	"approver_sub" text,
	"approver_signature" text,
	"approver_key_kid" text,
	"approved_at" timestamptz,
	"partner_kid" text,
	"partner_signature" text,
	"tier" integer NOT NULL,
	"created_at" timestamptz DEFAULT now() NOT NULL,
	"updated_at" timestamptz DEFAULT now() NOT NULL
);
