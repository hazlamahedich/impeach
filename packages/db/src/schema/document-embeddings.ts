import { pgTable, uuid, timestamp, text, index } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { documents } from './documents.js';
import type { DocumentId } from '@iip/contracts';

/**
 * `document_embeddings` — embedding vectors in a SEPARATE table from documents
 * (AC-4 decoupling).
 *
 * Provenance is decoupled from embeddings: re-embedding a document (simulated
 * by bumping `embeddingVersion` in `fetch_metadata` on the documents row) does
 * NOT invalidate the citation tuple, does NOT alter `content_checksum`, and
 * does NOT alter `source_id`, `raw_snapshot_key`, or any citation-relevant
 * column. This is the defamation-critical property: a model swap (bge-m3 →
 * future model) must never break a citation.
 *
 * The `vector(1024)` column holds bge-m3 dense-only embeddings (ADR-020). The
 * `model_version` column records which embedding model produced the vector so
 * shadow re-index + diff can detect drift on a model swap.
 *
 * @rules FR-1.5, AC-4, ADR-020
 * @adr ADR-001, ADR-020
 */
export const documentEmbeddings = pgTable(
  'document_embeddings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    document_id: uuid('document_id')
      .$type<DocumentId>()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: 1024 }).notNull(),
    model_version: text('model_version').notNull(),
    created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    documentIdIdx: index('document_embeddings_document_id_idx').on(table.document_id),
    modelVersionIdx: index('document_embeddings_model_version_idx').on(table.model_version),
  }),
);
