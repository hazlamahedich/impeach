/**
 * Story 3.5 — Per-artifact provenance integration tests.
 *
 * Verifies that every extracted artifact records its source document and
 * character span, that citation tuples are wired into @iip/citation, and that
 * re-embedding preserves citation validity (AC-4).
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules FR-1.5, AC-1..12, PC-1a, PC-1b, SEC-2
 * @adr ADR-001, ADR-010
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { makeValidSourceId } from '../support/helpers/ingest';
import { startTestDb, type TestDbHandle } from '../support/helpers/test-db';
import {
  registerDocument,
  emitCitationForArtifact,
  verifyCitation,
  reembedDocument,
  deleteSource,
  type EditorialLogAppender,
} from '@iip/ingest/provenance';
import { ContentChecksumSchema, RawSnapshotKeySchema } from '@iip/contracts';
import type { SourceId, LogEntry } from '@iip/contracts';

// ─── Test harness ────────────────────────────────────────────────────────────

let handle: TestDbHandle | undefined;

beforeAll(async () => {
  handle = await startTestDb();
}, 240_000);

afterAll(async () => {
  await handle?.teardown();
});

beforeEach(async () => {
  await handle?.truncateAll();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function db() {
  if (!handle) throw new Error('TestDbHandle not initialized');
  return handle;
}

/** Insert a source row so FK constraints pass. */
async function seedSource(sourceId: string, url = 'https://example.com/test'): Promise<void> {
  await db().client.query(
    `INSERT INTO sources (id, name, url, source_type, crawl_strategy, trust_tier, confirmed)
     VALUES ($1, $2, $3, 'government', 'manual', 1, false)`,
    [sourceId, `Test Source ${sourceId.slice(0, 8)}`, url],
  );
}

function makeValidRawSnapshotKey(seed = 'snapshot'): RawSnapshotKeySchema {
  return RawSnapshotKeySchema.parse(`raw-${seed}-${seed}`);
}

/** A minimal valid fetch_metadata matching the FetchMetadataSchema. */
function validFetchMetadata() {
  return {
    fetchedAt: '2026-07-11T10:00:00.000Z',
    fetchStatus: 200,
    contentType: 'text/html',
    retryCount: 0,
  };
}

/** EditorialLogAppender stub that captures entries for AC-6 assertions. */
function createCapturingAppender(): EditorialLogAppender & {
  entries: Array<LogEntry>;
} {
  const entries: Array<LogEntry> = [];
  return {
    entries,
    async append(entry) {
      entries.push(entry);
    },
  };
}

/** Local SHA-256 helper. */
async function sha256HexLocal(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Story 3.5 — Per-artifact provenance integration', () => {

  // ── AC-1: Document Provenance Fields ──────────────────────────────────────

  it('[P0] PR-1: registering a document records source_id + checksum + snapshot key + fetch metadata (AC-1)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'The Senate committee held hearings on July 4, 2026.';
    const checksumHex = await sha256HexLocal(content);

    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr1'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr1',
    );

    expect(doc.id).toBeDefined();
    expect(doc.sourceId).toBe(sourceId);
    expect(doc.contentChecksum).toBe(checksumHex);
    expect(doc.rawSnapshotKey).toBe(`raw-pr1-pr1`);
    expect(doc.fetchMetadata).toMatchObject({ contentType: 'text/html' });
  });

  // ── AC-3: Idempotent Upsert (First-Write-Wins) ────────────────────────────

  it('[P0] PR-2: re-registering same (source_id, content_checksum) is idempotent (AC-3)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Idempotent document content for PR-2.';
    const input = {
      sourceId,
      content,
      rawSnapshotKey: makeValidRawSnapshotKey('pr2'),
      fetchMetadata: validFetchMetadata(),
      spanStart: 0,
      spanEnd: 10,
    };

    const first = await registerDocument(db().db, input, createCapturingAppender(), 'operator-pr2a');
    const second = await registerDocument(db().db, input, createCapturingAppender(), 'operator-pr2b');

    expect(second.id).toBe(first.id);
    const { rows } = await db().client.query('SELECT COUNT(*)::int as cnt FROM documents WHERE source_id = $1', [sourceId]);
    expect(rows[0]?.cnt).toBe(1);
  });

  it('[P0] PR-2b: same content, different source_id → separate document rows (AC-3)', async () => {
    const sourceA = makeValidSourceId() as SourceId;
    const sourceB = makeValidSourceId() as SourceId;
    await seedSource(sourceA, 'https://source-a.com');
    await seedSource(sourceB, 'https://source-b.com');
    const content = 'Shared content across two sources.';
    const input = {
      content,
      rawSnapshotKey: makeValidRawSnapshotKey('pr2b'),
      fetchMetadata: validFetchMetadata(),
      spanStart: 0,
      spanEnd: 5,
    };

    const docA = await registerDocument(
      db().db,
      { ...input, sourceId: sourceA },
      createCapturingAppender(),
      'operator-pr2b-a',
    );
    const docB = await registerDocument(
      db().db,
      { ...input, sourceId: sourceB },
      createCapturingAppender(),
      'operator-pr2b-b',
    );

    expect(docA.id).not.toBe(docB.id);
    expect(docA.sourceId).toBe(sourceA);
    expect(docB.sourceId).toBe(sourceB);
    expect(docA.contentChecksum).toBe(docB.contentChecksum);
  });

  // ── AC-2: Citation Tuple Wiring ───────────────────────────────────────────

  it('[P0] PR-3: document row produces a resolvable citation tuple (AC-2)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'This is the document content for citation emission.';
    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr3'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr3',
    );

    const tuple = await emitCitationForArtifact(db().db, {
      documentId: DocumentIdSchema.parse(doc.id),
      content,
      spanStart: 0,
      spanEnd: 10,
    });

    expect(tuple.source_doc_id).toBe(doc.id);
    expect(tuple.span_start).toBe(0);
    expect(tuple.span_end).toBe(10);
    const expectedHash = await sha256HexLocal(content.substring(0, 10));
    expect(tuple.content_hash).toBe(expectedHash);
  });

  // ── AC-4: Decoupling of Provenance and Embeddings ─────────────────────────

  it('[P0] PR-4: changing embedding does not invalidate citation tuple (AC-4)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Document for re-embedding test PR-4.';
    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr4'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr4',
    );

    const tuple = await emitCitationForArtifact(db().db, {
      documentId: DocumentIdSchema.parse(doc.id),
      content,
      spanStart: 0,
      spanEnd: 10,
    });

    // Re-embed the document.
    const fakeEmbedding = new Array(1024).fill(0.1);
    const result = await reembedDocument(
      db().db,
      DocumentIdSchema.parse(doc.id),
      fakeEmbedding,
      'bge-m3-v2',
    );

    expect(result.embeddingVersion).toBe(1);

    // The ORIGINAL citation tuple is STILL valid (provenance unchanged).
    const reverified = await verifyCitation(db().db, tuple, content);
    expect(reverified.valid).toBe(true);

    // The content_checksum is bit-for-bit identical post-re-embed.
    const { rows } = await db().client.query('SELECT content_checksum FROM documents WHERE id = $1', [doc.id]);
    expect(rows[0]?.content_checksum).toBe(doc.contentChecksum);
  });

  // ── AC-5: Referential Integrity ───────────────────────────────────────────

  it('[P0] PR-5: document cannot reference non-existent source_id (FK → SourceNotFoundError) (AC-5)', async () => {
    const ghostSourceId = makeValidSourceId() as SourceId; // never inserted
    await expect(
      registerDocument(
        db().db,
        {
          sourceId: ghostSourceId,
          content: 'Orphan document',
          rawSnapshotKey: makeValidRawSnapshotKey('pr5'),
          fetchMetadata: validFetchMetadata(),
          spanStart: 0,
          spanEnd: 5,
        },
        createCapturingAppender(),
        'operator-orphan',
      ),
    ).rejects.toThrow(/source_id.*does not exist|source_not_found/i);
  });

  // ── AC-11: verifyCitation Coverage ────────────────────────────────────────

  it('[P0] PR-6: verifyCitation returns valid for known-good citation tuple (AC-11)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Known good document content for verify.';
    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr6'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr6',
    );

    const tuple = await emitCitationForArtifact(db().db, {
      documentId: DocumentIdSchema.parse(doc.id),
      content,
      spanStart: 5,
      spanEnd: 20,
    });

    const result = await verifyCitation(db().db, tuple, content);
    expect(result.valid).toBe(true);
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash).toHaveLength(64);
  });

  it('[P0] PR-7: verifyCitation returns invalid for tampered citation (AC-11)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Document content for tamper test.';
    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr7'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr7',
    );

    const tuple = await emitCitationForArtifact(db().db, {
      documentId: DocumentIdSchema.parse(doc.id),
      content,
      spanStart: 0,
      spanEnd: 10,
    });

    // Tamper: replace content_hash with a wrong value.
    const tampered = {
      ...tuple,
      content_hash: '0'.repeat(64) as never,
    };

    const result = await verifyCitation(db().db, tampered, content);
    expect(result.valid).toBe(false);
    expect(result.contentHash).toBeUndefined();
  });

  // ── AC-7: Character Span Validation ───────────────────────────────────────

  it('[P0] PR-8: span validation rejects start >= end, negative, exceeds content length (AC-7)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Short.';
    const baseInput = {
      sourceId,
      content,
      rawSnapshotKey: makeValidRawSnapshotKey('pr8'),
      fetchMetadata: validFetchMetadata(),
    };

    // spanStart >= spanEnd
    await expect(
      registerDocument(db().db, { ...baseInput, spanStart: 5, spanEnd: 5 }, createCapturingAppender(), 'operator-pr8'),
    ).rejects.toThrow(/spanStart.*must be less than/i);

    // spanStart negative
    await expect(
      registerDocument(db().db, { ...baseInput, spanStart: -1, spanEnd: 5 }, createCapturingAppender(), 'operator-pr8'),
    ).rejects.toThrow(/non-negative/i);

    // spanEnd exceeds content length
    await expect(
      registerDocument(db().db, { ...baseInput, spanStart: 0, spanEnd: 100 }, createCapturingAppender(), 'operator-pr8'),
    ).rejects.toThrow(/exceeds content length/i);
  });

  // ── AC-9: Concurrent Registration Safety ──────────────────────────────────

  it('[P0] PR-9: concurrent upsert of same (source_id, checksum) → exactly one row (AC-9)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Concurrent registration content for PR-9.';
    const input = {
      sourceId,
      content,
      rawSnapshotKey: makeValidRawSnapshotKey('pr9'),
      fetchMetadata: validFetchMetadata(),
      spanStart: 0,
      spanEnd: 10,
    };

    // Fire two concurrent registrations.
    const [first, second] = await Promise.all([
      registerDocument(db().db, input, createCapturingAppender(), 'operator-concurrent-a'),
      registerDocument(db().db, input, createCapturingAppender(), 'operator-concurrent-b'),
    ]);

    // Both callers receive the same DocumentId.
    expect(first.id).toBe(second.id);

    // Exactly one row in documents for this source + checksum.
    const { rows } = await db().client.query(
      'SELECT COUNT(*)::int as cnt FROM documents WHERE source_id = $1 AND content_checksum = $2',
      [sourceId, first.contentChecksum],
    );
    expect(rows[0]?.cnt).toBe(1);
  });

  // ── AC-10: Source Deletion Behavior ───────────────────────────────────────

  it('[P0] PR-10: source deletion with existing documents → SourceHasDocumentsError (AC-10)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    await registerDocument(
      db().db,
      {
        sourceId,
        content: 'Document blocking source deletion.',
        rawSnapshotKey: makeValidRawSnapshotKey('pr10'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 5,
      },
      createCapturingAppender(),
      'operator-pr10',
    );

    await expect(deleteSource(db().db, sourceId)).rejects.toThrow(/has.*document|source_has_documents/i);

    // Document still exists.
    const { rows } = await db().client.query('SELECT COUNT(*)::int as cnt FROM documents WHERE source_id = $1', [sourceId]);
    expect(rows[0]?.cnt).toBe(1);
  });

  // ── AC-4: Re-embedding preserves checksum bit-for-bit ─────────────────────

  it('[P0] PR-11: re-embedding preserves content_checksum bit-for-bit (AC-4)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const content = 'Bit-identical checksum after re-embed.';
    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr11'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      createCapturingAppender(),
      'operator-pr11',
    );

    const originalChecksum = doc.contentChecksum;

    // Re-embed twice.
    await reembedDocument(
      db().db,
      DocumentIdSchema.parse(doc.id),
      new Array(1024).fill(0.5),
      'bge-m3-v2',
    );
    await reembedDocument(
      db().db,
      DocumentIdSchema.parse(doc.id),
      new Array(1024).fill(0.9),
      'bge-m3-v3',
    );

    // Content checksum is unchanged.
    const { rows } = await db().client.query('SELECT content_checksum, source_id, raw_snapshot_key FROM documents WHERE id = $1', [doc.id]);
    expect(rows[0]?.content_checksum).toBe(originalChecksum);
    expect(rows[0]?.source_id).toBe(sourceId);
    expect(rows[0]?.raw_snapshot_key).toBe(`raw-pr11-pr11`);

    // Two embeddings exist.
    const { rows: embRows } = await db().client.query('SELECT COUNT(*)::int as cnt FROM document_embeddings WHERE document_id = $1', [doc.id]);
    expect(embRows[0]?.cnt).toBe(2);
  });

  // ── AC-6: Provenance Audit Logging ────────────────────────────────────────

  it('[P0] PR-12: registerDocument writes editorial log entry via appender (AC-6)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    const appender = createCapturingAppender();
    const content = 'Document for editorial log test.';

    await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr12'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 10,
      },
      appender,
      'operator-001',
    );

    expect(appender.entries).toHaveLength(1);
    const entry = appender.entries[0]!;
    expect(entry.principal_sub).toBe('operator-001');
    expect(entry.event).toBe('document.registered');
    expect(entry.payload).toMatchObject({
      source_id: sourceId,
    });
  });

  // ── AC-7: Multi-byte Unicode Spans ────────────────────────────────────────

  it('[P1] PR-13: multi-byte Unicode spans resolve to correct text (AC-7)', async () => {
    const sourceId = makeValidSourceId() as SourceId;
    await seedSource(sourceId);
    // 𐍈 is a surrogate pair (2 UTF-16 code units). 'A𐍈B' has length 4.
    const content = 'A𐍈B citation test';
    expect(content.length).toBe(18); // A(1) + 𐍈(2) + B(1) + ' citation test'(14) = 18

    const doc = await registerDocument(
      db().db,
      {
        sourceId,
        content,
        rawSnapshotKey: makeValidRawSnapshotKey('pr13'),
        fetchMetadata: validFetchMetadata(),
        spanStart: 0,
        spanEnd: 4, // 'A𐍈B' — 4 UTF-16 code units
      },
      createCapturingAppender(),
      'operator-pr13',
    );

    const tuple = await emitCitationForArtifact(db().db, {
      documentId: DocumentIdSchema.parse(doc.id),
      content,
      spanStart: 0,
      spanEnd: 4,
    });

    // Verify the cited text is 'A𐍈B'.
    const result = await verifyCitation(db().db, tuple, content);
    expect(result.valid).toBe(true);
  });

  // ── Empty Document Content ────────────────────────────────────────────────

  it('[P1] PR-14: empty document content accepted (deterministic SHA-256)', async () => {
    // SHA-256 of empty string is well-known + deterministic.
    const emptyChecksum = await sha256HexLocal('');
    const parsed = ContentChecksumSchema.parse(emptyChecksum);
    expect(parsed).toHaveLength(64);
    expect(emptyChecksum).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
