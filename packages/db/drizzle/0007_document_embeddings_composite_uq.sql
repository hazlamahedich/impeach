-- Story 3.5: document_embeddings table + composite unique index on documents.
-- (FR-1.5, AC-3, AC-4, SEC-2).
-- Authored by hand following the conventions of 0003..0006: IF NOT EXISTS for
-- idempotent re-runs, UP block live, DOWN block documented (commented) for
-- operator rollback.
--
-- Two changes:
--  1. Replace the single-column unique index `documents_content_checksum_uq`
--     with a composite unique index on `(source_id, content_checksum)`. AC-3:
--     same content from a *different* source creates a separate document row.
--     The original 0004 index treated `content_checksum` as globally unique,
--     which incorrectly collapsed cross-source documents into one row.
--  2. Create the `document_embeddings` table (AC-4 decoupling). Embedding
--     vectors live in a separate table so re-embedding never touches the
--     `documents` row's provenance columns (content_checksum, source_id,
--     raw_snapshot_key). This is the defamation-critical property: a model
--     swap (bge-m3 → future model) must never break a citation.

-- ─────────────────────────────────────────────────────────────────────────
-- UP
-- ─────────────────────────────────────────────────────────────────────────

-- ── Composite unique index on documents (AC-3) ───────────────────────────
-- Create the replacement index BEFORE dropping the old one so uniqueness
-- enforcement is never removed on a live database.
CREATE UNIQUE INDEX IF NOT EXISTS "documents_source_id_content_checksum_uq"
    ON "documents" ("source_id", "content_checksum");
DROP INDEX IF EXISTS "documents_content_checksum_uq";

-- ── document_embeddings (AC-4 decoupling) ────────────────────────────────
CREATE TABLE IF NOT EXISTS "document_embeddings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "document_id" uuid NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "model_version" text NOT NULL,
    "created_at" timestamptz DEFAULT now() NOT NULL
);

-- FK to documents. ON DELETE CASCADE: deleting a document removes its
-- embeddings (the document is the provenance anchor; embeddings are derived).
ALTER TABLE "document_embeddings"
    DROP CONSTRAINT IF EXISTS "document_embeddings_document_id_documents_id_fk";
ALTER TABLE "document_embeddings"
    ADD CONSTRAINT "document_embeddings_document_id_documents_id_fk"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "document_embeddings_document_id_idx"
    ON "document_embeddings" ("document_id");
CREATE INDEX IF NOT EXISTS "document_embeddings_model_version_idx"
    ON "document_embeddings" ("model_version");

-- ─────────────────────────────────────────────────────────────────────────
-- DOWN (operator-run rollback; verified by ingest-schema integration test)
-- ─────────────────────────────────────────────────────────────────────────
--
-- DROP INDEX IF EXISTS "document_embeddings_model_version_idx";
-- DROP INDEX IF EXISTS "document_embeddings_document_id_idx";
-- ALTER TABLE "document_embeddings" DROP CONSTRAINT IF EXISTS "document_embeddings_document_id_documents_id_fk";
-- DROP TABLE IF EXISTS "document_embeddings";
-- DROP INDEX IF EXISTS "documents_source_id_content_checksum_uq";
-- CREATE UNIQUE INDEX IF NOT EXISTS "documents_content_checksum_uq" ON "documents" ("content_checksum");
