/**
 * DocumentsRepository — the data-access layer for the `documents` table
 * (FR-1.3, FR-1.5).
 *
 * Implements idempotent document storage via `onConflictDoNothing` (PC-1a,
 * first-write-wins) on the composite `(source_id, content_checksum)` unique
 * index — the same document ingested twice from the same source produces the
 * same row and is stored once (the dedupe anchor). Same content from a
 * different source_id creates a separate row (AC-3).
 *
 * The repository interface is injectable so tests can stub it; production
 * wires the Drizzle implementation. Mirrors the `SourceRegistryRepo` pattern.
 *
 * **Idempotent upsert (PC-1a, FR-1.3, AC-3):** `upsertDocument` uses
 * `onConflictDoNothing` on `(source_id, content_checksum)` — on conflict the
 * existing row is returned unchanged (first-write-wins: the first
 * registration is authoritative).
 *
 * @rules FR-1.3, FR-1.5, PC-1a, SEC-6
 * @adr ADR-001, ADR-010
 */
import { eq, and } from 'drizzle-orm';
import type { Db } from '../client.js';
import { documents } from '../schema/documents.js';
import {
  FetchMetadataSchema,
  type DocumentId,
  type SourceId,
  type ContentChecksum,
  type RawSnapshotKey,
  type FetchMetadata,
} from '@iip/contracts';
import { upsertFirstWriteWins, type UpsertFirstWriteWinsResult } from '../upsert.js';

/**
 * The row shape returned by the repository (the persisted document).
 */
export interface DocumentRow {
  id: string;
  sourceId: string;
  contentChecksum: string;
  rawSnapshotKey: string;
  fetchMetadata: FetchMetadata;
  intakeDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The payload for creating/upserting a document.
 */
export interface UpsertDocumentInput {
  sourceId: SourceId;
  contentChecksum: ContentChecksum;
  rawSnapshotKey: RawSnapshotKey;
  fetchMetadata: FetchMetadata;
  intakeDocumentId?: string;
}

/**
 * The injectable repository contract for document persistence.
 *
 * @rules FR-1.3, PC-1a
 */
export interface DocumentsRepository {
  /** Idempotent upsert on (source_id, content_checksum) (PC-1a, FR-1.3, AC-3). */
  upsertDocument(input: UpsertDocumentInput): Promise<UpsertFirstWriteWinsResult<DocumentRow>>;
  /** Find a document by ID, or null. */
  findById(id: DocumentId): Promise<DocumentRow | null>;
  /** Find a document by content_checksum (the dedupe key), or null. */
  findByContentChecksum(checksum: ContentChecksum): Promise<DocumentRow | null>;
  /** Find a document by composite (source_id, content_checksum), or null. */
  findBySourceAndChecksum(sourceId: SourceId, checksum: ContentChecksum): Promise<DocumentRow | null>;
  /** List documents for a source. */
  listBySource(sourceId: SourceId): Promise<DocumentRow[]>;
}

/**
 * Create the Drizzle-backed `DocumentsRepository`.
 *
 * @param db - the Db handle (pool or transaction)
 * @returns the repository implementation
 *
 * @rules FR-1.3, PC-1a
 */
export function createDocumentsRepository(db: Db): DocumentsRepository {
  return {
    async upsertDocument(input: UpsertDocumentInput): Promise<UpsertFirstWriteWinsResult<DocumentRow>> {
      // Idempotent upsert on (source_id, content_checksum) (PC-1a, FR-1.3,
      // AC-3). First-write-wins: on conflict the existing row is kept. Same
      // content from a different source_id creates a separate document row.
      const result = await upsertFirstWriteWins(
        db,
        documents,
        {
          source_id: input.sourceId,
          content_checksum: input.contentChecksum,
          raw_snapshot_key: input.rawSnapshotKey,
          fetch_metadata: input.fetchMetadata,
          ...(input.intakeDocumentId !== undefined
            ? { intake_document_id: input.intakeDocumentId }
            : {}),
        } as Record<string, unknown>,
        [documents.source_id, documents.content_checksum],
      );

      if (result.inserted) {
        return { row: toDocumentRow(result.row as typeof documents.$inferSelect), inserted: true };
      }

      // On conflict the helper returns no row; re-fetch the existing one.
      const existing = await this.findBySourceAndChecksum(input.sourceId, input.contentChecksum);
      if (!existing) {
        throw new Error('documents upsert conflict: existing row not found');
      }
      return { row: existing, inserted: false };
    },

    async findById(id: DocumentId): Promise<DocumentRow | null> {
      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.id, id))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return toDocumentRow(r);
    },

    async findByContentChecksum(checksum: ContentChecksum): Promise<DocumentRow | null> {
      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.content_checksum, checksum))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return toDocumentRow(r);
    },

    async findBySourceAndChecksum(
      sourceId: SourceId,
      checksum: ContentChecksum,
    ): Promise<DocumentRow | null> {
      const rows = await db
        .select()
        .from(documents)
        .where(and(eq(documents.source_id, sourceId), eq(documents.content_checksum, checksum)))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      return toDocumentRow(r);
    },

    async listBySource(sourceId: SourceId): Promise<DocumentRow[]> {
      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.source_id, sourceId));
      return rows.map(toDocumentRow);
    },
  };
}

/**
 * Map a Drizzle row to a `DocumentRow`.
 */
function toDocumentRow(r: typeof documents.$inferSelect): DocumentRow {
  return {
    id: r.id,
    sourceId: r.source_id,
    contentChecksum: r.content_checksum,
    rawSnapshotKey: r.raw_snapshot_key,
    fetchMetadata: FetchMetadataSchema.parse(r.fetch_metadata),
    intakeDocumentId: r.intake_document_id ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}
