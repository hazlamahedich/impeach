/**
 * Story 3.5 — Per-artifact provenance integration test (ATDD RED phase).
 *
 * Every document must record its source pointer + content checksum + raw
 * snapshot key + fetch metadata, and the citation tuple must be wired so that
 * re-embedding preserves citation validity (AC-4). The `documents` table +
 * `upsertLastWriteWins` helper exist (TD3/Story 1.6), but the application-level
 * wiring that creates a documents row AND feeds it into the citation emit/verify
 * path does NOT exist yet. This suite is RED by design (describe.skip).
 *
 * Provenance is the defamation-defense spine: "nothing exists without a source
 * pointer" (FR-1.5) is mechanically enforced here.
 *
 * @rules FR-1.5, AC-4, PC-1a, SEC-2
 * @adr ADR-001, ADR-010
 *
 * GIVEN a document is ingested and stored
 * WHEN the documents table record is created
 * THEN it records source_id, content_checksum, raw_snapshot_key, fetch metadata
 *   AND per-artifact provenance is wired into the citation package (FR-1.5)
 *   AND the documents table uses idempotent upsert on content_checksum (PC-1a)
 *   AND provenance is decoupled from embeddings (AC-4)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makeValidSourceId, makeValidContentChecksum } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.5 has not shipped the provenance-wiring service yet. Dynamic import
// lets the suite COLLECT. Once the module lands, remove `describe.skip`.
async function loadProvenanceService() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.5 module not shipped yet). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/ingest/provenance';
  return import(specifier).catch(() => null);
}

// The Testcontainers PG harness is shared with the existing integration suite.
// We load it lazily so collection doesn't fail if Docker is unavailable.
async function loadTestDb() {
  // Variable specifier so Vite cannot statically resolve a not-yet-existing
  // helper (the Testcontainers harness is authored at green phase). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '../support/helpers/test-db';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.5 — Per-artifact provenance integration (ATDD RED)', () => {
  // The testcontainers + Drizzle client are set up once for the whole suite.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let teardown: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const harness = await loadTestDb();
    const started = harness ? await harness.startTestDb() : null;
    db = started?.client;
    teardown = started?.teardown;
  });

  afterAll(async () => {
    await teardown?.();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE: documents row carries full provenance (FR-1.5)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] PR-1: registering a document records source_id + checksum + snapshot key + fetch metadata', async () => {
    const svc = await loadProvenanceService();
    // Given: an ingested document with provenance.
    const sourceId = makeValidSourceId();
    const checksum = makeValidContentChecksum('provenance-doc-a');
    const input = {
      sourceId,
      contentChecksum: checksum,
      rawSnapshotKey: checksum,
      fetchMetadata: { url: 'https://www.senate.gov/press/a', fetchedAt: '2026-07-08T10:00:00Z', contentType: 'text/html' },
    };
    // When: the provenance service records the document.
    const doc = svc ? await svc.registerDocument(db, input) : undefined;
    // Then: every provenance field is persisted.
    expect(doc?.id).toBeDefined();
    expect(doc?.sourceId).toBe(sourceId);
    expect(doc?.contentChecksum).toBe(checksum);
    expect(doc?.rawSnapshotKey).toBe(checksum);
    expect(doc?.fetchMetadata?.url).toBe('https://www.senate.gov/press/a');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotent upsert on content_checksum (PC-1a)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] PR-2: re-registering the same content_checksum is idempotent (no duplicate row)', async () => {
    const svc = await loadProvenanceService();
    const sourceId = makeValidSourceId();
    const checksum = makeValidContentChecksum('idempotent-doc');
    const input = {
      sourceId,
      contentChecksum: checksum,
      rawSnapshotKey: checksum,
      fetchMetadata: { url: 'https://example.com/idem', fetchedAt: '2026-07-08T10:00:00Z', contentType: 'text/html' },
    };
    // When: the same document is registered twice.
    const first = svc ? await svc.registerDocument(db, input) : undefined;
    const second = svc ? await svc.registerDocument(db, input) : undefined;
    // Then: both calls return the SAME document id (upsert, not insert).
    expect(first?.id).toBe(second?.id);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Citation-tuple wiring (FR-1.5 — provenance feeds the citation package)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] PR-3: a document row produces a resolvable citation tuple (source_doc_id, span, content_hash)', async () => {
    const svc = await loadProvenanceService();
    const sourceId = makeValidSourceId();
    const checksum = makeValidContentChecksum('citation-wired-doc');
    const doc = svc ? await svc.registerDocument(db, {
      sourceId,
      contentChecksum: checksum,
      rawSnapshotKey: checksum,
      fetchMetadata: { url: 'https://example.com/cite', fetchedAt: '2026-07-08T10:00:00Z', contentType: 'text/html' },
    }) : undefined;
    // When: a citation is emitted against this document.
    const tuple = svc && doc ? await svc.emitCitationForDocument(db, doc.id, { spanStart: 0, spanEnd: 42 }) : undefined;
    // Then: the tuple carries the document's source_doc_id + content_hash.
    expect(tuple?.sourceDocId).toBe(doc?.id);
    expect(tuple?.contentHash).toBe(checksum);
    expect(tuple?.spanStart).toBe(0);
    expect(tuple?.spanEnd).toBe(42);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-4 decoupling: provenance survives re-embedding
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] PR-4: changing the embedding does not invalidate the citation tuple (AC-4 decoupling)', async () => {
    const svc = await loadProvenanceService();
    const sourceId = makeValidSourceId();
    const checksum = makeValidContentChecksum('reembed-doc');
    const doc = svc ? await svc.registerDocument(db, {
      sourceId,
      contentChecksum: checksum,
      rawSnapshotKey: checksum,
      fetchMetadata: { url: 'https://example.com/reembed', fetchedAt: '2026-07-08T10:00:00Z', contentType: 'text/html' },
    }) : undefined;
    const tuple = svc && doc ? await svc.emitCitationForDocument(db, doc.id, { spanStart: 10, spanEnd: 99 }) : undefined;
    // When: the document is "re-embedded" (simulated embedding-version bump).
    const reembedded = svc && doc ? await svc.reembedDocument(db, doc.id, { newEmbeddingVersion: 'bge-m3-v2' }) : undefined;
    // Then: the ORIGINAL citation tuple is STILL valid (provenance unchanged).
    const reverified = svc && tuple ? await svc.verifyCitation(db, tuple) : undefined;
    expect(reembedded?.embeddingVersion).toBe('bge-m3-v2');
    expect(reverified?.valid).toBe(true);
    expect(reverified?.contentHash).toBe(checksum);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FK integrity: documents.source_id → sources.id (SEC-2 referential integrity)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] PR-5: a document cannot reference a non-existent source_id (FK violation rejected)', async () => {
    const svc = await loadProvenanceService();
    const ghostSourceId = makeValidSourceId(); // never inserted into sources
    const checksum = makeValidContentChecksum('orphan-doc');
    // When: a document is registered against a non-existent source.
    // Then: the operation rejects (foreign-key violation — referential integrity).
    await expect(
      svc ? svc.registerDocument(db, {
        sourceId: ghostSourceId,
        contentChecksum: checksum,
        rawSnapshotKey: checksum,
        fetchMetadata: { url: 'https://example.com/orphan', fetchedAt: '2026-07-08T10:00:00Z', contentType: 'text/html' },
      }) : Promise.resolve(undefined),
    ).rejects.toThrow();
  });
});
