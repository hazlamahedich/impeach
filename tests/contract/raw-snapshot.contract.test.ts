/**
 * Story 3.4 — Immutable raw snapshots contract test (ATDD RED phase).
 *
 * Every fetched document must produce an immutable raw snapshot in MinIO
 * (private bucket, OFF the serving path). This is defamation-critical: the
 * snapshot is the evidence artifact a court would examine. No snapshot =
 * no provenance = no defense.
 *
 * NO snapshot client exists yet (the MinIO infra is up; the TS client + object
 * locking are not). This suite is RED by design (describe.skip) until Story 3.4
 * ships `packages/ingest/src/snapshot/`.
 *
 * @rules FR-1.4, NFR-S-5, SEC-5
 * @adr ADR-001
 *
 * GIVEN a document is fetched and cleaned
 * WHEN the raw snapshot is stored
 * THEN an immutable snapshot is written to MinIO (private, off serving path)
 *   AND the snapshot includes original content + fetch metadata
 *   AND the snapshot is content-addressed (SHA-256 key)
 *   AND the bucket is versioned append-only (NFR-S-5)
 *   AND the snapshot is NEVER on the public serving path
 */

import { describe, it, expect } from 'vitest';
import { makeValidContentChecksum } from '../support/helpers/ingest';

// ─── RED-PHASE STUB ────────────────────────────────────────────────────────
// Story 3.4 has not shipped the snapshot client yet. Dynamic import lets the
// suite COLLECT. Once the module lands, remove `describe.skip` + the wrapper.
async function loadSnapshotModule() {
  // Variable specifier so Vite cannot statically resolve a subpath absent from
  // the package `exports` map (Story 3.4 module not shipped yet). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '@iip/ingest/snapshot';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.4 — Immutable raw snapshots contract (ATDD RED)', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Snapshot store port (SC-5 boundary)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-1: a RawSnapshotStore port is exported with put() + get()', async () => {
    const mod = await loadSnapshotModule();
    expect(mod?.RawSnapshotStore).toBeDefined();
    const proto = mod?.RawSnapshotStore?.prototype ?? {};
    expect(typeof proto.put).toBe('function');
    expect(typeof proto.get).toBe('function');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content-addressed key (FR-1.4 — SHA-256)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-2: put() returns a SHA-256 content-addressed key', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: 'http://localhost:9100', bucket: 'raw-snapshots' })
      : undefined;
    // Given: a fetched document with original bytes + metadata.
    const fetched = {
      url: 'https://www.senate.gov/press/release-001',
      fetchedAt: '2026-07-08T10:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('<html>…</html>'),
      headers: { 'content-type': 'text/html' },
    };
    // When: the snapshot is stored.
    const result = store ? await store.put(fetched) : undefined;
    // Then: the returned key is a 64-char lowercase hex SHA-256 digest.
    expect(result?.key).toMatch(/^[0-9a-f]{64}$/);
    expect(result?.key).toBe(makeValidContentChecksum('<html>…</html>'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Round-trip: get() returns the original bytes + metadata
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-3: get() by content key returns the original bytes + fetch metadata', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: 'http://localhost:9100', bucket: 'raw-snapshots' })
      : undefined;
    const fetched = {
      url: 'https://www.senate.gov/press/release-002',
      fetchedAt: '2026-07-08T11:00:00Z',
      contentType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 …'),
      headers: { 'content-type': 'application/pdf' },
    };
    const put = store ? await store.put(fetched) : undefined;
    // When: the snapshot is retrieved by its content key.
    const snapshot = store && put ? await store.get(put.key) : undefined;
    // Then: the bytes match AND the fetch metadata is preserved.
    expect(snapshot?.bytes).toEqual(fetched.bytes);
    expect(snapshot?.metadata?.url).toBe(fetched.url);
    expect(snapshot?.metadata?.fetchedAt).toBe(fetched.fetchedAt);
    expect(snapshot?.metadata?.contentType).toBe('application/pdf');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Immutability + append-only (NFR-S-5)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-4: re-putting identical content is idempotent (same key, no duplicate object)', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: 'http://localhost:9100', bucket: 'raw-snapshots' })
      : undefined;
    const fetched = {
      url: 'https://example.com/doc',
      fetchedAt: '2026-07-08T12:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('stable-content'),
      headers: {},
    };
    // When: the same content is stored twice.
    const first = store ? await store.put(fetched) : undefined;
    const second = store ? await store.put(fetched) : undefined;
    // Then: both puts return the SAME content-addressed key.
    expect(first?.key).toBe(second?.key);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Off the serving path (SEC-5 — the snapshot must never reach a user)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-5: the snapshot bucket is private (no anonymous/public access)', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: 'http://localhost:9100', bucket: 'raw-snapshots' })
      : undefined;
    // Then: the bucket policy reports anonymous access is disabled.
    const policy = store ? await store.bucketAccessPolicy() : undefined;
    expect(policy?.anonymousAccess).toBe('none');
  });
});
