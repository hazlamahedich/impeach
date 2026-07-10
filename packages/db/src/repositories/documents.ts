/**
 * DocumentsRepository — the data-access layer for the `documents` table
 * (FR-1.3, FR-1.5).
 *
 * Implements idempotent document storage via `upsertLastWriteWins` (PC-1a) on
 * the `content_checksum` unique index — the same document ingested twice
 * produces the same checksum and is stored once (the dedupe anchor).
 *
 * The repository interface is injectable so tests can stub it; production
 * wires the Drizzle implementation. Mirrors the `SourceRegistryRepo` pattern.
 *
 * **Idempotent upsert (PC-1a, FR-1.3):** `upsertDocument` calls
 * `upsertLastWriteWins` on `content_checksum` — on conflict the incoming row's
 * `fetch_metadata` + `raw_snapshot_key` replace the existing values
 * (last-write-wins: the latest fetch is authoritative). The `id` (primary key)
 * is immutable on update.
 *
 * @rules FR-1.3, FR-1.5, PC-1a, SEC-6
 * @adr ADR-001, ADR-010
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { documents } from '../schema/documents.js';
import type {
  DocumentId,
  SourceId,
  ContentChecksum,
  RawSnapshotKey,
  FetchMetadata,
} from '@iip/contracts';

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
  /** Idempotent upsert on content_checksum (PC-1a, FR-1.3). */
  upsertDocument(input: UpsertDocumentInput): Promise<DocumentRow>;
  /** Find a document by ID, or null. */
  findById(id: DocumentId): Promise<DocumentRow | null>;
  /** Find a document by content_checksum (the dedupe key), or null. */
  findByContentChecksum(checksum: ContentChecksum): Promise<DocumentRow | null>;
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
    async upsertDocument(input: UpsertDocumentInput): Promise<DocumentRow> {
      // Idempotent upsert on content_checksum (PC-1a, FR-1.3). On conflict,
      // the incoming row's fetch_metadata + raw_snapshot_key replace the
      // existing values (last-write-wins: the latest fetch is authoritative).
      // The id (primary key) is immutable on update.
      const [row] = await db
        .insert(documents)
        .values({
          source_id: input.sourceId,
          content_checksum: input.contentChecksum,
          raw_snapshot_key: input.rawSnapshotKey,
          fetch_metadata: input.fetchMetadata,
          ...(input.intakeDocumentId !== undefined
            ? { intake_document_id: input.intakeDocumentId }
            : {}),
        })
        .onConflictDoUpdate({
          target: documents.content_checksum,
          set: {
            // source_id is intentionally NOT updated: the first source to
            // observe a content_checksum owns the document (first-write-wins).
            // Updating it would migrate attribution on re-discovery (FR-1.3).
            raw_snapshot_key: input.rawSnapshotKey,
            fetch_metadata: input.fetchMetadata,
            updated_at: new Date(),
          },
        })
        .returning();
      if (!row) {
        throw new Error('documents upsert returned no row');
      }
      return toDocumentRow(row);
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
    fetchMetadata: r.fetch_metadata as FetchMetadata,
    intakeDocumentId: r.intake_document_id ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}
