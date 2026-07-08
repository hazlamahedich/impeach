/**
 * Story 3.4 — MinIO bucket versioning + append-only integration test (ATDD RED).
 *
 * Coverage gap from the Epic 3 test-design (R3.4c, NFR-S-5): the existing RS-1..5
 * scaffolds are CONTRACT tests on the snapshot store port (pure logic). They
 * cannot verify the REAL MinIO bucket is configured as versioned + append-only +
 * object-locked — the infra property that makes a cited PDF un-swappable.
 *
 * This is the evidence-artifact integrity invariant: a defamation defense
 * depends on proving the raw snapshot of a cited source was never overwritten.
 * If the bucket is mutable, the chain of custody breaks and "the PDF was
 * swapped" becomes a real defense.
 *
 * The MinIO infra is UP (`infra/docker-compose.yml` + `infra/minio/init-bucket.sh`)
 * but no TS client consumes it yet, and no test asserts the bucket CONFIG. This
 * suite is RED by design (describe.skip) until Story 3.4 ships the snapshot
 * client + a bucket-config introspection method.
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

// The Testcontainers MinIO harness is shared with the integration suite.
async function loadTestMinio() {
  // Variable specifier so Vite cannot statically resolve a not-yet-existing
  // helper (the Testcontainers harness is authored at green phase). The catch
  // keeps the suite GREEN at collection; describe.skip quarantines the body.
  const specifier = '../support/helpers/test-minio';
  return import(specifier).catch(() => null);
}

describe.skip('Story 3.4 — MinIO bucket versioning + append-only integration (ATDD RED)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let minio: any;
  let teardown: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const harness = await loadTestMinio();
    const started = harness ? await harness.startTestMinio() : null;
    minio = started?.client;
    teardown = started?.teardown;
  });

  afterAll(async () => {
    await teardown?.();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Bucket versioning (NFR-S-5 — overwrite creates a new version, never a mutation)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RSM-1: the raw-snapshots bucket has versioning ENABLED', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: minio?.endpoint, bucket: 'raw-snapshots' })
      : undefined;
    // Then: the bucket reports versioning is enabled (NFR-S-5).
    const config = store ? await store.bucketVersioningConfig() : undefined;
    expect(config?.status).toBe('Enabled');
  });

  it('[P0] RSM-2: re-putting different content under the same logical key creates a NEW version (not an overwrite)', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: minio?.endpoint, bucket: 'raw-snapshots' })
      : undefined;
    // Given: a snapshot was stored.
    const original = {
      url: 'https://www.senate.gov/press/release-001',
      fetchedAt: '2026-07-08T10:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('original-content'),
      headers: {},
    };
    const first = store ? await store.put(original) : undefined;
    // When: DIFFERENT content is stored (simulating an attempted swap).
    const swapped = { ...original, bytes: Buffer.from('tampered-content') };
    const second = store ? await store.put(swapped) : undefined;
    // Then: the content-addressed keys DIFFER (SHA-256 of content, so a swap is
    // detected as a distinct object — the original is never mutated).
    expect(first?.key).not.toBe(second?.key);
    expect(first?.key).toBe(makeValidContentChecksum('original-content'));
    expect(second?.key).toBe(makeValidContentChecksum('tampered-content'));
    // And: retrieving the original key still returns the ORIGINAL bytes.
    const retrieved = store && first ? await store.get(first.key) : undefined;
    expect(retrieved?.bytes).toEqual(Buffer.from('original-content'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Object locking (GOVERNANCE/COMPLIANCE — the legal-hold primitive)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RSM-3: the raw-snapshots bucket has object locking ENABLED (GOVERNANCE/COMPLIANCE)', async () => {
    const mod = await loadSnapshotModule();
    const store = mod?.createMinioSnapshotStore
      ? mod.createMinioSnapshotStore({ endpoint: minio?.endpoint, bucket: 'raw-snapshots' })
      : undefined;
    // Then: the bucket reports object-locking is enabled (the legal-hold basis).
    const config = store ? await store.bucketObjectLockConfig() : undefined;
    expect(config?.objectLockEnabled).toBe(true);
    // And: the mode is GOVERNANCE or COMPLIANCE (not unset).
    expect(['GOVERNANCE', 'COMPLIANCE']).toContain(config?.mode);
  });
});
