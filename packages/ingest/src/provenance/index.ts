/**
 * Per-artifact provenance coordinator — wires document registration, citation
 * emission/verification, and re-embedding (FR-1.5, AC-1..12).
 *
 * This module is the JOIN layer between `@iip/db` (document persistence) and
 * `@iip/citation` (citation tuple emit/verify). It does NOT expose raw Drizzle
 * types or citation-internal types — only the coordinator interface
 * (registerDocument, emitCitationForArtifact, verifyCitation, reembedDocument).
 *
 * Provenance is the defamation-defense spine: "nothing exists without a source
 * pointer" (FR-1.5) is mechanically enforced here.
 *
 * @rules FR-1.5, AC-1..12, PC-1a, PC-1b, SEC-2, SEC-6
 * @adr ADR-001, ADR-010
 */

import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '@iip/db';
import { documents, documentEmbeddings } from '@iip/db';
import { withTx } from '@iip/db';
import { createDocumentsRepository, type DocumentRow, createSourcesRepository } from '@iip/db';
import * as citation from '@iip/citation';
import type { CitationTuple as CitationTupleType, LogEntry } from '@iip/contracts';
import {
  SourceIdSchema,
  DocumentIdSchema,
  ContentChecksumSchema,
  RawSnapshotKeySchema,
  FetchMetadataSchema,
  makeEntry,
  Signature,
  type SourceId,
  type DocumentId,
  AppError,
  SourceNotFoundError,
  SourceHasDocumentsError,
  InvalidSpanError,
} from '@iip/contracts';
import pino from 'pino';

const logger = pino({ name: '@iip/ingest/provenance' });

// ─────────────────────────────────────────────────────────────────────────────
// Input schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RegisterDocumentInput — the payload for `registerDocument` (AC-1, AC-7, AC-8).
 *
 * `content` is the UTF-8 document content; `contentChecksum` is computed from
 * it as SHA-256 hex. `spanStart`/`spanEnd` are validated at registration time
 * (AC-7): character offsets using UTF-16 code units (matching JS
 * `String.prototype.length`), inclusive start, exclusive end.
 *
 * @rules FR-1.5, AC-1, AC-7, AC-8
 */
export const RegisterDocumentInput = z.object({
  sourceId: SourceIdSchema,
  content: z.string(),
  rawSnapshotKey: RawSnapshotKeySchema,
  fetchMetadata: FetchMetadataSchema,
  // spanStart/spanEnd validated by validateSpan() for AC-7 — not by Zod, so
  // that all span validation goes through one code path with typed errors.
  spanStart: z.number().int(),
  spanEnd: z.number().int(),
});
export type RegisterDocumentInput = z.infer<typeof RegisterDocumentInput>;

/**
 * CitationInput — the payload for `emitCitationForArtifact` (AC-2).
 *
 * `documentId` identifies the registered document; `spanStart`/`spanEnd` are
 * character offsets into the document's content (AC-7 encoding semantics).
 *
 * @rules FR-1.5, AC-2, AC-7
 */
export const CitationInput = z.object({
  documentId: DocumentIdSchema,
  spanStart: z.number().int().nonnegative(),
  spanEnd: z.number().int().nonnegative(),
});
export type CitationInput = z.infer<typeof CitationInput>;

/**
 * VerificationResult — the return type of `verifyCitation` (AC-11).
 *
 * `valid: false` for any structural problem (missing document, tampered
 * checksum, wrong span). `valid: true` + `contentHash` when the citation
 * re-verifies against the stored document content.
 *
 * @rules FR-1.5, AC-11
 */
export interface VerificationResult {
  valid: boolean;
  /** Present only when `valid` is true (the SHA-256 of the cited span). */
  contentHash?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Span validation (AC-7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate span boundaries before any DB write (AC-7).
 *
 * Spans are character offsets using UTF-16 code units (matching JavaScript
 * `String.prototype.length`). `spanStart` is inclusive, `spanEnd` is exclusive.
 * `content.substring(spanStart, spanEnd)` must produce the exact cited text.
 *
 * Rejects: `spanStart < 0`, `spanStart >= spanEnd`, `spanEnd > content.length`.
 *
 * @throws {InvalidSpanError} on any boundary violation.
 * @rules FR-1.5, AC-7
 */
function validateSpan(spanStart: number, spanEnd: number, contentLength: number): void {
  if (spanStart < 0) {
    throw new InvalidSpanError(
      `spanStart (${spanStart}) must be non-negative`,
    );
  }
  if (spanEnd < 0) {
    throw new InvalidSpanError(
      `spanEnd (${spanEnd}) must be non-negative`,
    );
  }
  if (spanStart >= spanEnd) {
    throw new InvalidSpanError(
      `spanStart (${spanStart}) must be less than spanEnd (${spanEnd})`,
    );
  }
  if (spanEnd > contentLength) {
    throw new InvalidSpanError(
      `spanEnd (${spanEnd}) exceeds content length (${contentLength})`,
    );
  }
}

/**
 * Verify span endpoints do not fall inside a UTF-16 surrogate pair.
 * JavaScript string indices are UTF-16 code units; slicing a surrogate pair
 * produces invalid lone surrogates.
 */
function validateSpanScalarBoundaries(spanStart: number, spanEnd: number, content: string): void {
  const isHighSurrogate = (i: number) => (content.charCodeAt(i) & 0xFC00) === 0xD800;
  const isLowSurrogate = (i: number) => (content.charCodeAt(i) & 0xFC00) === 0xDC00;
  if (isLowSurrogate(spanStart)) {
    throw new InvalidSpanError(
      `spanStart (${spanStart}) falls inside a surrogate pair`,
    );
  }
  if (isHighSurrogate(spanEnd - 1)) {
    throw new InvalidSpanError(
      `spanEnd (${spanEnd}) falls inside a surrogate pair`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hex of UTF-8 encoded content (the content_checksum).
 * Uses the global Web Crypto API (portable across Node/edge/browser).
 */
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

// ─────────────────────────────────────────────────────────────────────────────
// EditoriaLog appender interface (injectable seam for AC-6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EditorialLogAppender — the injectable seam for appending editorial log
 * entries (AC-6). The production wiring (apps/api server.ts) provides the real
 * implementation; tests inject a stub to capture entries without a running
 * editorial-log partition.
 *
 * @rules FR-1.5, AC-6, SEC-6
 */
export interface EditorialLogAppender {
  /**
   * Append a canonical editorial log entry.
   * @param entry — the entry constructed via makeEntry(...).
   */
  append(entry: LogEntry): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// registerDocument (AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a document with full provenance (FR-1.5).
 *
 * Computes `contentChecksum` as SHA-256 of `content`, validates span
 * boundaries (AC-7), then idempotently upserts on `(source_id,
 * content_checksum)` (AC-3, PC-1a). First-write-wins: re-registering the same
 * content from the same source is a no-op that returns the existing row. Same
 * content from a different source creates a separate row.
 *
 * FK violation (non-existent `source_id`) is wrapped as `SourceNotFoundError`
 * (AC-5). Every successful registration appends a `document.registered`
 * editorial-log entry (AC-6).
 *
 * @returns the persisted `DocumentRow` with all provenance fields.
 * @throws {InvalidSpanError} on span boundary violations (AC-7).
 * @throws {SourceNotFoundError} on non-existent `source_id` (AC-5).
 *
 * @rules FR-1.5, AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, PC-1a, PC-1b
 */
export async function registerDocument(
  db: Db,
  input: RegisterDocumentInput,
  appender: EditorialLogAppender,
  principalSub: string,
): Promise<DocumentRow> {
  const parsed = RegisterDocumentInput.parse(input);

  // AC-7: validate span boundaries before any DB write.
  validateSpan(parsed.spanStart, parsed.spanEnd, parsed.content.length);
  validateSpanScalarBoundaries(parsed.spanStart, parsed.spanEnd, parsed.content);

  // Compute content_checksum (SHA-256 of content).
  const checksumHex = await sha256Hex(parsed.content);
  const contentChecksum = ContentChecksumSchema.parse(checksumHex);

  // Idempotent upsert inside a SERIALIZABLE transaction (PC-1a, PC-1b, AC-9).
  let row: DocumentRow;
  let inserted: boolean;
  try {
    ({ row, inserted } = await withTx(
      db,
      async (tx) => {
        const r = await createDocumentsRepository(tx).upsertDocument({
          sourceId: parsed.sourceId,
          contentChecksum,
          rawSnapshotKey: parsed.rawSnapshotKey,
          fetchMetadata: parsed.fetchMetadata,
        });
        return r;
      },
      { isolationLevel: 'serializable' },
    ));
  } catch (err: unknown) {
    // AC-5: FK violation on non-existent source_id → SourceNotFoundError.
    if (isPgForeignKeyViolation(err)) {
      throw new SourceNotFoundError(
        `source_id ${parsed.sourceId} does not exist in sources table`,
      );
    }
    throw err;
  }

  // AC-6: append editorial log entry for document.registered, but only on a
  // fresh insert. Re-registrations are no-ops and must not duplicate the audit trail.
  if (inserted) {
    const entry = await makeEntry({
      partitionKey: '__system__',
      principalSub: principalSub ?? '__system__',
      event: 'document.registered',
      jti: crypto.randomUUID(),
      payload: {
        document_id: row.id,
        content_checksum: row.contentChecksum,
        source_id: row.sourceId,
      },
      time: new Date().toISOString(),
      prevHash: '0'.repeat(64),
      seq: 0,
      getSignature: async () => Signature.parse(''),
    });
    await appender.append(entry);
  }

  logger.info({
    operation: 'document.registered',
    documentId: row.id,
    contentChecksum: row.contentChecksum,
    sourceId: row.sourceId,
    inserted,
  });

  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// emitCitationForArtifact (AC-2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emit a citation tuple for an artifact within a registered document (FR-1.5,
 * AC-2). Retrieves the document row, constructs a citation source, and calls
 * `@iip/citation`'s `emit(span, source)`.
 *
 * NOTE: `emitCitationForArtifact` takes a `content` parameter — the document
 * text that the span references. This is because `fetch_metadata` does NOT
 * store the full document content (only metadata); the caller (e.g. the
 * extraction pipeline) has the content in memory. The `spanStart`/`spanEnd`
 * are validated against this content.
 *
 * @returns a `CitationTuple` that `@iip/citation` can verify.
 * @throws {InvalidSpanError} on span boundary violations.
 *
 * @rules FR-1.5, AC-2, AC-7
 */
export async function emitCitationForArtifact(
  db: Db,
  input: {
    documentId: DocumentId;
    content: string;
    spanStart: number;
    spanEnd: number;
  },
): Promise<CitationTupleType> {
  // AC-7: validate span boundaries.
  validateSpan(input.spanStart, input.spanEnd, input.content.length);
  validateSpanScalarBoundaries(input.spanStart, input.spanEnd, input.content);

  // Retrieve document row to confirm it exists.
  const repo = createDocumentsRepository(db);
  const doc = await repo.findById(input.documentId);
  if (!doc) {
    throw new AppError(
      `document ${input.documentId} not found`,
      'document_not_found',
    );
  }

  // Construct citation source + span, then emit.
  const tuple = await citation.emit(
    { start: input.spanStart, end: input.spanEnd, text: input.content.substring(input.spanStart, input.spanEnd) },
    { doc_id: doc.id, content: input.content },
  );

  logger.info({
    operation: 'citation.emitted',
    documentId: doc.id,
    spanStart: input.spanStart,
    spanEnd: input.spanEnd,
    contentHash: tuple.content_hash,
  });

  return tuple;
}

// ─────────────────────────────────────────────────────────────────────────────
// verifyCitation (AC-11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a citation tuple against a document's content (AC-11).
 *
 * Re-derives the SHA-256 of the cited span and compares it to the tuple's
 * `content_hash`. Returns `{ valid: true, contentHash }` on match, `{ valid:
 * false }` on any mismatch or structural problem.
 *
 * `content` is the document text (the caller has it in memory; `fetch_metadata`
 * does not store full content).
 *
 * @rules FR-1.5, AC-11
 */
export async function verifyCitation(
  db: Db,
  tuple: CitationTupleType,
  content: string,
): Promise<VerificationResult> {
  // AC-11: a citation must point to a persisted document.
  const repo = createDocumentsRepository(db);
  const doc = await repo.findById(tuple.source_doc_id as DocumentId);
  if (!doc) {
    logger.info({ operation: 'citation.verified', valid: false, reason: 'document_not_found' });
    return { valid: false };
  }

  // The caller-provided content must match the stored document checksum.
  const recomputedChecksum = await sha256Hex(content);
  if (recomputedChecksum !== doc.contentChecksum) {
    logger.info({
      operation: 'citation.verified',
      valid: false,
      reason: 'content_checksum_mismatch',
    });
    return { valid: false };
  }

  // Verify the citation against the content via @iip/citation.
  const isValid = await citation.verify(tuple, { content });

  if (!isValid) {
    logger.info({ operation: 'citation.verified', valid: false });
    return { valid: false };
  }

  const contentHash = tuple.content_hash;
  logger.info({ operation: 'citation.verified', valid: true, contentHash });
  return { valid: true, contentHash };
}

// ─────────────────────────────────────────────────────────────────────────────
// reembedDocument (AC-4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-embed a document (AC-4 decoupling). Writes ONLY to the
 * `document_embeddings` table and bumps `fetch_metadata.embeddingVersion` on
 * the documents row via a targeted update. Does NOT touch `content_checksum`,
 * `source_id`, `raw_snapshot_key`, or any citation-relevant column.
 *
 * This is the defamation-critical property: re-embedding on model swaps
 * (bge-m3 → future model) must never break a citation.
 *
 * @rules FR-1.5, AC-4, PC-1b
 */
export async function reembedDocument(
  db: Db,
  documentId: DocumentId,
  embedding: number[],
  modelVersion: string,
): Promise<{ embeddingVersion: number }> {
  // Validate embedding dimensions and finiteness (bge-m3 dense-only, 1024-dim).
  if (embedding.length !== 1024) {
    throw new AppError(
      `embedding must have exactly 1024 dimensions (got ${embedding.length})`,
      'invalid_embedding_dimensions',
    );
  }
  if (embedding.some((v) => !Number.isFinite(v))) {
    throw new AppError('embedding contains non-finite value', 'invalid_embedding_values');
  }
  if (!modelVersion || modelVersion.trim().length === 0) {
    throw new AppError('modelVersion is required', 'invalid_model_version');
  }

  return withTx(db, async (tx) => {
    // 1. Insert the new embedding vector.
    await tx.insert(documentEmbeddings).values({
      document_id: documentId,
      embedding,
      model_version: modelVersion,
    });

    // 2. Atomically bump fetch_metadata.embeddingVersion in the DB.
    await tx
      .update(documents)
      .set({
        fetch_metadata: sql`
          jsonb_set(
            coalesce(${documents.fetch_metadata}, '{}'::jsonb),
            '{embeddingVersion}',
            (coalesce((${documents.fetch_metadata}->'embeddingVersion')::int, 0) + 1)::text::jsonb
          )
        `,
        updated_at: new Date(),
      })
      .where(eq(documents.id, documentId));

    // 3. Read back the new version for the return value + log.
    const [updated] = await tx
      .select({ fetch_metadata: documents.fetch_metadata })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!updated) {
      throw new AppError(`document ${documentId} not found`, 'document_not_found');
    }

    const meta = FetchMetadataSchema.parse(updated.fetch_metadata ?? {});
    const newVersion = meta.embeddingVersion ?? 0;

    logger.info({
      operation: 'document.reembedded',
      documentId,
      embeddingVersion: newVersion,
    });

    return { embeddingVersion: newVersion };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteSource (AC-10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to delete a source (AC-10). Fails with `SourceHasDocumentsError` if
 * the source has associated documents — the documents and their citation tuples
 * remain intact. The FK constraint `documents.source_id → sources.id ON DELETE
 * RESTRICT` is the DB-level enforcement; this function wraps the raw PG error
 * into a typed `AppError`.
 *
 * @throws {SourceHasDocumentsError} if the source has documents.
 *
 * @rules FR-1.5, AC-10, SEC-2
 */
export async function deleteSource(
  db: Db,
  sourceId: SourceId,
): Promise<void> {
  // Soft-delete the source inside a transaction. If documents still reference
  // it, the FK constraint (ON DELETE RESTRICT) will throw SQLSTATE 23503,
  // which we translate into a typed SourceHasDocumentsError (AC-10).
  try {
    await withTx(db, async (tx) => {
      await createSourcesRepository(tx).delete(sourceId);
    });
  } catch (err: unknown) {
    if (isPgForeignKeyViolation(err)) {
      throw new SourceHasDocumentsError(
        `source ${sourceId} has documents; cannot delete`,
      );
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect a Postgres foreign-key violation (SQLSTATE 23503).
 * Works with both `pg` library errors (which carry a `code` property) and
 * Drizzle-wrapped errors (which nest the original error under `cause` or
 * embed the constraint name in the message).
 */
function isPgForeignKeyViolation(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;

  // Direct pg error: has `code` property.
  const directCode = (err as { code?: string }).code;
  if (directCode === '23503') return true;

  // Nested cause (Drizzle wraps PG errors under `cause`).
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== null && typeof cause === 'object') {
    const causeCode = (cause as { code?: string }).code;
    if (causeCode === '23503') return true;
  }

  // Fallback: check message for FK constraint name or SQLSTATE.
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('23503') ||
    message.includes('foreign key constraint') ||
    message.includes('documents_source_id_sources_id_fk')
  );
}
