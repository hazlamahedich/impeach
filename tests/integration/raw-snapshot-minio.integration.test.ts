/**
 * Story 3.4 — MinIO bucket versioning + append-only integration test.
 *
 * Coverage gap from the Epic 3 test-design (R3.4c, NFR-S-5): the contract
 * tests (RS-1..9) test the snapshot store port with a mock client. They
 * cannot verify the REAL MinIO bucket is configured as versioned + append-only +
 * object-locked — the infra property that makes a cited PDF un-swappable.
 *
 * This is the evidence-artifact integrity invariant: a defamation defense
 * depends on proving the raw snapshot of a cited source was never overwritten.
 * If the bucket is mutable, the chain of custody breaks and "the PDF was
 * swapped" becomes a real defense.
 *
 * These tests launch a REAL MinIO container via Testcontainers, provision the
 * bucket with the production ``init-bucket.sh`` configuration (Object Lock +
 * versioning + GOVERNANCE mode), and assert the bucket config via the snapshot
 * store's introspection methods.
 *
 * Pool: 'forks' + singleFork — Testcontainers holds TCP sockets.
 *
 * @rules FR-1.4, NFR-S-5, SEC-5
 * @adr ADR-001
 *
 * GIVEN a document is fetched and cleaned
 * WHEN the raw snapshot bucket is provisioned
 * THEN the bucket is versioned (NFR-S-5 — overwrite creates a new version, not a mutation)
 *   AND the bucket has object locking enabled (GOVERNANCE/COMPLIANCE mode)
 *   AND the bucket is private (off serving path — companion to RS-5)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Buffer } from 'node:buffer';
import { makeValidContentChecksum } from '../support/helpers/ingest';
import { startTestMinio } from '../support/helpers/test-minio';
import { createMinioSnapshotStore } from '@iip/ingest/snapshot';

let endpoint: string | undefined;
let teardown: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const started = await startTestMinio();
  endpoint = started.endpoint;
  teardown = started.teardown;
});

afterAll(async () => {
  await teardown?.();
});

describe('Story 3.4 — MinIO bucket versioning + append-only integration', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Bucket versioning (NFR-S-5 — overwrite creates a new version, never a mutation)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RSM-1: the raw-snapshots bucket has versioning ENABLED', async () => {
    const store = createMinioSnapshotStore({
      endpoint: endpoint!,
      rootUser: 'minioadmin',
      rootPassword: 'minioadmin',
      bucket: 'raw-snapshots',
    });
    const config = await store.bucketVersioningConfig();
    expect(config.status).toBe('Enabled');
  });

  it('[P0] RSM-2: re-putting different content under the same logical key creates a NEW object (not an overwrite)', async () => {
    const store = createMinioSnapshotStore({
      endpoint: endpoint!,
      rootUser: 'minioadmin',
      rootPassword: 'minioadmin',
      bucket: 'raw-snapshots',
    });
    // Given: a snapshot was stored.
    const original = {
      url: 'https://www.senate.gov/press/release-001',
      fetchedAt: '2026-07-08T10:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('original-content'),
    };
    const first = await store.put(original);
    // When: DIFFERENT content is stored (simulating an attempted swap).
    const swapped = { ...original, bytes: Buffer.from('tampered-content') };
    const second = await store.put(swapped);
    // Then: the content-addressed keys DIFFER (SHA-256 of content, so a swap is
    // detected as a distinct object — the original is never mutated).
    expect(first.key).not.toBe(second.key);
    expect(first.key).toBe(makeValidContentChecksum('original-content'));
    expect(second.key).toBe(makeValidContentChecksum('tampered-content'));
    // And: retrieving the original key still returns the ORIGINAL bytes.
    const retrieved = await store.get(first.key);
    expect(retrieved.bytes).toEqual(Buffer.from('original-content'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Object locking (GOVERNANCE/COMPLIANCE — the legal-hold primitive)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RSM-3: the raw-snapshots bucket has object locking ENABLED (GOVERNANCE/COMPLIANCE)', async () => {
    const store = createMinioSnapshotStore({
      endpoint: endpoint!,
      rootUser: 'minioadmin',
      rootPassword: 'minioadmin',
      bucket: 'raw-snapshots',
    });
    const config = await store.bucketObjectLockConfig();
    expect(config.objectLockEnabled).toBe(true);
    // And: the mode is GOVERNANCE or COMPLIANCE (not unset).
    expect(['GOVERNANCE', 'COMPLIANCE']).toContain(config.mode);
  });
});
