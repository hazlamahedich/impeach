import { pgTable, uuid, timestamp, text, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { sources } from './sources.js';
import type { DocumentId, SourceId, ContentChecksum, RawSnapshotKey } from '@iip/contracts';

/**
 * `documents` — per-artifact provenance record (FR-1.5, FR-1.3).
 *
 * A document is a single cleaned, provenance-bearing artifact produced by
 * ingestion. This table records `source_id` + `content_checksum` +
 * `raw_snapshot_key` + fetch metadata; per-artifact provenance (`source_doc_id`
 * + character span) is wired into the citation package from Story 1.6.
 *
 * **Idempotent upsert on `(source_id, content_checksum)` (PC-1a, FR-1.3, AC-3):**
 * the same document ingested twice from the same source produces the same row.
 * The composite unique index is the dedupe anchor; `upsertFirstWriteWins`
 * (PC-1a, packages/db/src/upsert.ts) resolves conflicts. Provenance is
 * decoupled from embeddings (AC-4): re-embedding preserves the citation.
 *
 * **Lineage relationship to `intake_documents`:** `intake_documents` is the
 * SEC-2 two-person-intake gate state (reviewer/approver signatures); `documents`
 * is the cleaned provenance record post-ingest. A `documents` row may reference
 * an `intake_documents` row via the nullable `intake_document_id` FK (manual
 * uploads skip the gate; automated fetches go through it). The relationship is
 * nullable because not every document traverses the two-person gate.
 *
 * Nullability discipline (project-context: `.notNull()` by default): only
 * `intake_document_id` is nullable (manual uploads); the provenance columns
 * (`source_id`, `content_checksum`, `raw_snapshot_key`) are NOT NULL — a
 * document without provenance is a defect.
 *
 * @rules FR-1.5, FR-1.3, SEC-3, PC-1a, AC-4
 * @adr ADR-001, ADR-010
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').$type<DocumentId>().primaryKey().default(sql`gen_random_uuid()`),
    source_id: uuid('source_id')
      .$type<SourceId>()
      .notNull()
      .references(() => sources.id),
    content_checksum: text('content_checksum').$type<ContentChecksum>().notNull(),
    raw_snapshot_key: text('raw_snapshot_key').$type<RawSnapshotKey>().notNull(),
    // Fetch metadata: { fetchedAt, fetchStatus, contentType, lastModified?, retryCount, embeddingVersion? }
    // (FR-1.5 AC-8 provenance record). jsonb validated by FetchMetadataSchema at write/read boundaries.
    fetch_metadata: jsonb('fetch_metadata').notNull(),
    // Nullable lineage to intake_documents (SEC-2 gate state). Manual uploads skip the gate.
    intake_document_id: uuid('intake_document_id'),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Composite dedupe anchor (PC-1a, FR-1.3, AC-3): the same content_checksum
    // from the SAME source is idempotent; from a DIFFERENT source creates a
    // separate document row. upsertFirstWriteWins resolves conflicts.
    sourceIdContentChecksumUq: uniqueIndex('documents_source_id_content_checksum_uq').on(
      table.source_id,
      table.content_checksum,
    ),
    // Index on source_id for the "list documents from this source" query.
    sourceIdIdx: index('documents_source_id_idx').on(table.source_id),
    // Index on intake_document_id for the gate-state join (sparse: nullable).
    intakeDocumentIdIdx: index('documents_intake_document_id_idx').on(table.intake_document_id),
  }),
);
