/**
 * Story 3.4 — Immutable raw snapshots contract test.
 *
 * Every fetched document must produce an immutable raw snapshot in MinIO
 * (private bucket, OFF the serving path). This is defamation-critical: the
 * snapshot is the evidence artifact a court would examine. No snapshot =
 * no provenance = no defense.
 *
 * These are CONTRACT tests on the snapshot store port — they test the
 * structural shape and content-addressing invariant using a mock client.
 * Integration tests against a REAL MinIO container live in
 * ``tests/integration/raw-snapshot-minio.integration.test.ts``.
 *
 * @rules FR-1.4, NFR-S-5, SEC-5
 * @adr ADR-001
 * @activates-in Epic 3 (Story 3.4 — RawSnapshotStore MinIO client)
 *
 * GIVEN a document is fetched and cleaned
 * WHEN the raw snapshot is stored
 * THEN an immutable snapshot is written to MinIO (private, off serving path)
 *   AND the snapshot includes original content + fetch metadata
 *   AND the snapshot is content-addressed (SHA-256 key)
 *   AND the bucket is versioned append-only (NFR-S-5)
 *   AND the snapshot is NEVER on the public serving path
 */

import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { Buffer } from 'node:buffer';
import type { Client as MinioClient } from 'minio';
import { makeValidContentChecksum } from '../support/helpers/ingest';
import {
  RawSnapshotStore,
  createMinioSnapshotStore,
  SnapshotStoreError,
} from '@iip/ingest/snapshot';

// ─────────────────────────────────────────────────────────────────────────
// Mock MinIO client for contract tests (SC-5 — injectable client).
// Stores objects in-memory keyed by object name. Simulates the real S3 API
// surface used by the snapshot store: putObject, statObject, getObject,
// getBucketPolicy, getBucketVersioning, getObjectLockConfig.
// ─────────────────────────────────────────────────────────────────────────

interface MockObject {
  data: Buffer;
  metaData: Record<string, string>;
}

function createMockClient() {
  const store = new Map<string, MockObject>();
  let bucketPolicy = '';
  let versioningConfig = { Status: 'Enabled' };
  let lockConfig: { objectLockEnabled: string; mode: string } | Record<string, never> = {
    objectLockEnabled: 'Enabled',
    mode: 'GOVERNANCE',
  };

  const putObject = vi.fn(async (
    _bucket: string,
    objectName: string,
    data: Buffer | string | NodeJS.ReadableStream,
    _size?: number,
    metaData?: Record<string, string>,
  ): Promise<{ etag: string; versionId?: string }> => {
    const buf =
      typeof data === 'string'
        ? Buffer.from(data)
        : Buffer.isBuffer(data)
          ? data
          : Buffer.from(await readMockStream(data));
    store.set(objectName, { data: buf, metaData: metaData ?? {} });
    return { etag: 'mock-etag' };
  });

  return {
    store,
    putObject,
    async statObject(bucket: string, objectName: string): Promise<{
      size: number;
      etag: string;
      lastModified: Date;
      metaData: Record<string, string>;
      versionId?: string;
    }> {
      const obj = store.get(objectName);
      if (!obj) {
        const err = new Error('Not Found') as Error & { code?: string };
        err.code = 'NotFound';
        throw err;
      }
      return {
        size: obj.data.length,
        etag: 'mock-etag',
        lastModified: new Date(),
        metaData: obj.metaData,
      };
    },
    async getObject(bucket: string, objectName: string): Promise<NodeJS.ReadableStream> {
      const obj = store.get(objectName);
      if (!obj) {
        const err = new Error('Not Found') as Error & { code?: string };
        err.code = 'NotFound';
        throw err;
      }
      return Readable.from([obj.data]);
    },
    async getBucketPolicy(_bucket: string): Promise<string> {
      return bucketPolicy;
    },
    async getBucketVersioning(_bucket: string): Promise<{ Status: string }> {
      return versioningConfig;
    },
    async getObjectLockConfig(_bucket: string): Promise<typeof lockConfig> {
      return lockConfig;
    },
    // Test helpers to control mock state
    _setBucketPolicy(p: string) {
      bucketPolicy = p;
    },
    _setVersioningConfig(c: { Status: string }) {
      versioningConfig = c;
    },
    _setLockConfig(c: typeof lockConfig) {
      lockConfig = c;
    },
  };
}

async function readMockStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────

function createStoreWithMock() {
  const client = createMockClient() as unknown as MinioClient;
  const store = createMinioSnapshotStore({
    endpoint: 'http://localhost:9100',
    rootUser: 'minioadmin',
    rootPassword: 'minioadmin',
    bucket: 'raw-snapshots',
    client,
  });
  return { store, client };
}

// ─────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────

describe('Story 3.4 — Immutable raw snapshots contract', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Snapshot store port (SC-5 boundary)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-1: a RawSnapshotStore port is exported with put() + get()', () => {
    expect(RawSnapshotStore).toBeDefined();
    const { store } = createStoreWithMock();
    expect(store).toBeInstanceOf(RawSnapshotStore);
    expect(typeof store.put).toBe('function');
    expect(typeof store.get).toBe('function');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Content-addressed key (FR-1.4 — SHA-256)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-2: put() returns a SHA-256 content-addressed key', async () => {
    const { store } = createStoreWithMock();
    const fetched = {
      url: 'https://www.senate.gov/press/release-001',
      fetchedAt: '2026-07-08T10:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('<html>…</html>'),
    };
    const result = await store.put(fetched);
    expect(result.key).toMatch(/^[0-9a-f]{64}$/);
    expect(result.key).toBe(makeValidContentChecksum('<html>…</html>'));
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Round-trip: get() returns the original bytes + metadata
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-3: get() by content key returns the original bytes + fetch metadata', async () => {
    const { store } = createStoreWithMock();
    const fetched = {
      url: 'https://www.senate.gov/press/release-002',
      fetchedAt: '2026-07-08T11:00:00Z',
      contentType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 …'),
    };
    const put = await store.put(fetched);
    const snapshot = await store.get(put.key);
    expect(snapshot.bytes).toEqual(fetched.bytes);
    expect(snapshot.metadata.url).toBe(fetched.url);
    expect(snapshot.metadata.fetchedAt).toBe(fetched.fetchedAt);
    expect(snapshot.metadata.contentType).toBe('application/pdf');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Immutability + append-only (NFR-S-5)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-4: re-putting identical content is idempotent (same key, no duplicate object)', async () => {
    const { store, client } = createStoreWithMock();
    const fetched = {
      url: 'https://example.com/doc',
      fetchedAt: '2026-07-08T12:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.from('stable-content'),
    };
    const first = await store.put(fetched);
    const second = await store.put(fetched);
    expect(first.key).toBe(second.key);
    const mockClient = client as ReturnType<typeof createMockClient>;
    expect(mockClient.store.size).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Off the serving path (SEC-5 — the snapshot must never reach a user)
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-5: the snapshot bucket is private (no anonymous/public access)', async () => {
    const { store } = createStoreWithMock();
    const policy = await store.bucketAccessPolicy();
    expect(policy.anonymousAccess).toBe('none');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-8: Content-type boundary — put() accepts any Buffer
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-6: put() accepts any Buffer — store is byte-level primitive (AC-8)', async () => {
    const { store } = createStoreWithMock();
    const fetched = {
      url: 'https://example.com/binary',
      fetchedAt: '2026-07-08T13:00:00Z',
      contentType: 'application/octet-stream',
      bytes: Buffer.from([0x00, 0x01, 0xff, 0xfe]),
    };
    const result = await store.put(fetched);
    expect(result.key).toMatch(/^[0-9a-f]{64}$/);
    const snapshot = await store.get(result.key);
    expect(snapshot.bytes).toEqual(fetched.bytes);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC-7: Failure contract — typed SnapshotStoreError when MinIO unreachable
  // ─────────────────────────────────────────────────────────────────────────

  it('[P0] RS-7: put() throws SnapshotStoreError on bucket not found (AC-7)', async () => {
    // Create a store pointing to a non-existent bucket: the mock client throws.
    const client = createMockClient() as unknown as MinioClient;
    (client as { putObject: () => Promise<never> }).putObject = async () => {
      const err = new Error('The specified bucket does not exist') as Error & {
        code?: string;
      };
      err.code = 'NoSuchBucket';
      throw err;
    };
    const store = createMinioSnapshotStore({
      endpoint: 'http://localhost:9100',
      rootUser: 'minioadmin',
      rootPassword: 'minioadmin',
      bucket: 'nonexistent-bucket',
      client,
    });
    await expect(
      store.put({
        url: 'https://example.com',
        fetchedAt: '2026-07-08T14:00:00Z',
        contentType: 'text/html',
        bytes: Buffer.from('content'),
      }),
    ).rejects.toThrow(SnapshotStoreError);
  });

  it('[P0] RS-8: get() throws SnapshotStoreError when snapshot not found (AC-7)', async () => {
    const { store } = createStoreWithMock();
    const key = 'nonexistent-key-123456' as const;
    await expect(store.get(key)).rejects.toThrow(SnapshotStoreError);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Zero-byte document — empty snapshot is valid evidence
  // ─────────────────────────────────────────────────────────────────────────

  it('[P1] RS-9: zero-byte document is accepted (empty snapshot is valid evidence)', async () => {
    const { store, client } = createStoreWithMock();
    const fetched = {
      url: 'https://example.com/empty',
      fetchedAt: '2026-07-08T15:00:00Z',
      contentType: 'text/html',
      bytes: Buffer.alloc(0),
    };
    const result = await store.put(fetched);
    expect(result.key).toMatch(/^[0-9a-f]{64}$/);
    const mockClient = client as ReturnType<typeof createMockClient>;
    const lastCall = mockClient.putObject.mock?.lastCall ?? mockClient.putObject.calls?.at(-1);
    expect(lastCall).toBeDefined();
    expect(lastCall[0]).toBe('raw-snapshots');
    expect(lastCall[1]).toBe(result.key);
    expect(lastCall[2]).toEqual(Buffer.alloc(0));
    expect(lastCall[3]).toBe(0);
    expect(lastCall[4]).toMatchObject({
      'Content-Type': 'text/html',
      'x-amz-meta-url': 'https://example.com/empty',
      'x-amz-meta-fetched-at': '2026-07-08T15:00:00Z',
      'x-amz-meta-content-type': 'text/html',
    });
    const snapshot = await store.get(result.key);
    expect(snapshot.bytes.length).toBe(0);
  });

  it('[P1] RS-10: metadata with Unicode values round-trips intact', async () => {
    const { store } = createStoreWithMock();
    const fetched = {
      url: 'https://example.com/ünïcöde-press-release',
      fetchedAt: '2026-07-08T16:00:00Z',
      contentType: 'text/html; charset=utf-8',
      bytes: Buffer.from('unicode-content'),
    };
    const result = await store.put(fetched);
    const snapshot = await store.get(result.key);
    expect(snapshot.metadata.url).toBe(fetched.url);
    expect(snapshot.metadata.contentType).toBe(fetched.contentType);
  });
});
